import "server-only";
import { createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { TripState } from "@/lib/types";

/**
 * Local accounts mode: used when Supabase is not configured, so the whole app (sign-up, login,
 * saved trips) works on one machine with no cloud accounts. Data lives in JSON files under
 * `.data/` (override with COUPLETAB_DATA_DIR). Good for testing and a single small server,
 * not for many concurrent users.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const DATA_DIR = path.resolve(process.env.COUPLETAB_DATA_DIR || path.join(process.cwd(), ".data"));
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TRIPS_DIR = path.join(DATA_DIR, "trips");
const SECRET_FILE = path.join(DATA_DIR, "session-secret");

export const SESSION_COOKIE = "ct_session";
export const SESSION_DAYS = 30;

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}
export type PublicUser = Pick<LocalUser, "id" | "name" | "email" | "createdAt">;

export interface StoredTrip {
  id: string;
  ownerId: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  state: TripState;
}

export const publicUser = (u: LocalUser): PublicUser => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });

// Serialise writes in this process so concurrent requests can't clobber a file.
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

// ---------- secrets & sessions ----------

let cachedSecret: Buffer | null = null;
async function secret(): Promise<Buffer> {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET) return (cachedSecret = Buffer.from(process.env.SESSION_SECRET));
  try {
    cachedSecret = Buffer.from(await fs.readFile(SECRET_FILE, "utf8"), "hex");
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const s = randomBytes(32);
    await fs.writeFile(SECRET_FILE, s.toString("hex"), { mode: 0o600 });
    cachedSecret = s;
  }
  return cachedSecret;
}

export async function signSession(userId: string): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const body = `${userId}.${exp}`;
  const mac = createHmac("sha256", await secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, mac] = parts;
  const expected = createHmac("sha256", await secret()).update(`${userId}.${exp}`).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (Number(exp) < Date.now()) return null;
  return userId;
}

// ---------- passwords ----------

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scrypt(pw, Buffer.from(saltHex, "hex"), 64);
  const want = Buffer.from(keyHex, "hex");
  return key.length === want.length && timingSafeEqual(key, want);
}

// ---------- users ----------

const normEmail = (e: string) => e.trim().toLowerCase();

export async function findUserByEmail(email: string): Promise<LocalUser | null> {
  const users = await readJson<LocalUser[]>(USERS_FILE, []);
  return users.find((u) => u.email === normEmail(email)) ?? null;
}

export async function findUserById(id: string): Promise<LocalUser | null> {
  const users = await readJson<LocalUser[]>(USERS_FILE, []);
  return users.find((u) => u.id === id) ?? null;
}

export class EmailTakenError extends Error {}

export function createUser(input: { name: string; email: string; password: string }): Promise<LocalUser> {
  return locked(async () => {
    const users = await readJson<LocalUser[]>(USERS_FILE, []);
    const email = normEmail(input.email);
    if (users.some((u) => u.email === email)) throw new EmailTakenError("An account with that email already exists");
    const user: LocalUser = {
      id: randomUUID(),
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await writeJson(USERS_FILE, users);
    return user;
  });
}

// ---------- trips ----------

const tripFile = (id: string) => {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) throw new Error("Bad trip id");
  return path.join(TRIPS_DIR, `${id}.json`);
};

export async function listTrips(ownerId: string): Promise<StoredTrip[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(TRIPS_DIR);
  } catch {
    return [];
  }
  const trips = await Promise.all(files.filter((f) => f.endsWith(".json")).map((f) => readJson<StoredTrip | null>(path.join(TRIPS_DIR, f), null)));
  return trips
    .filter((t): t is StoredTrip => !!t && t.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTrip(id: string): Promise<StoredTrip | null> {
  try {
    return await readJson<StoredTrip | null>(tripFile(id), null);
  } catch {
    return null;
  }
}

export function saveTrip(trip: StoredTrip): Promise<StoredTrip> {
  return locked(async () => {
    const next = { ...trip, updatedAt: new Date().toISOString() };
    await writeJson(tripFile(trip.id), next);
    return next;
  });
}

export function deleteTrip(id: string): Promise<void> {
  return locked(async () => {
    await fs.rm(tripFile(id), { force: true });
  });
}

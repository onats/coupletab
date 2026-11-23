export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const fmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
export const money = (n: number) => fmt.format(round2(n) === 0 ? 0 : round2(n));

/** Split `total` into `parts` cent-exact pieces (remainder cents go to the first pieces). */
export function splitCents(total: number, parts: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.trunc(cents / parts);
  let rem = cents - base * parts;
  const out: number[] = [];
  for (let i = 0; i < parts; i++) {
    let c = base;
    if (rem > 0) {
      c += 1;
      rem -= 1;
    } else if (rem < 0) {
      c -= 1;
      rem += 1;
    }
    out.push(c / 100);
  }
  return out;
}

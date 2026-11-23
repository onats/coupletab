-- CoupleTab initial schema
-- Tables: profiles, saved_groups, trips, trip_units, trip_members, receipts, line_items, item_assignments
-- Access model:
--   * Trip owners have full access to their trip rows.
--   * Guests at the table can read a trip and toggle item_assignments by sending the trip's
--     join token in the `x-join-token` request header (only for unlocked trips or Pro hosts).
--   * Plan / billing columns are only writable by the service role (API routes + Stripe webhook).


-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'trip_pass', 'pro')),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- [{ "kind": "couple"|"single", "name": text, "members": [text], "payid": text|null }]
  units jsonb not null default '[]'::jsonb check (jsonb_typeof(units) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[A-Za-z0-9_-]{6,32}$'),
  title text not null default 'Weekend away' check (char_length(title) <= 120),
  trip_date date,
  status text not null default 'active' check (status in ('active', 'archived')),
  join_token text not null default replace(gen_random_uuid()::text, '-', ''),
  is_unlocked boolean not null default false,
  ocr_scans integer not null default 0 check (ocr_scans >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_units (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null check (kind in ('couple', 'single')),
  name text not null check (char_length(name) <= 60),
  color text not null default 'blue',
  sort integer not null default 0,
  payid text check (char_length(payid) <= 120),
  created_at timestamptz not null default now()
);

create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  unit_id uuid not null references public.trip_units (id) on delete cascade,
  name text not null check (char_length(name) <= 60),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  venue_name text not null default 'Receipt',
  doc_type text not null default 'other'
    check (doc_type in ('itemised_receipt', 'guest_bill', 'tax_invoice', 'payment_slip', 'other')),
  receipt_number text,
  reference_numbers text[] not null default '{}',
  date_time text,
  subtotal numeric(12, 2),
  surcharge_rate numeric(6, 4) not null default 0 check (surcharge_rate >= 0 and surcharge_rate <= 1),
  surcharge_amount numeric(12, 2),
  surcharge_label text,
  tax_included boolean not null default true,
  grand_total numeric(12, 2),
  paid_by_unit_id uuid references public.trip_units (id) on delete set null,
  is_duplicate boolean not null default false,
  duplicate_of_id uuid references public.receipts (id) on delete set null,
  duplicate_reason text,
  storage_path text,
  source text not null default 'manual' check (source in ('ocr', 'manual')),
  raw jsonb,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  label text not null check (char_length(label) <= 200),
  price numeric(12, 2) not null,
  source_label text,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.item_assignments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  line_item_id uuid not null references public.line_items (id) on delete cascade,
  target_type text not null check (target_type in ('unit', 'member')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (line_item_id, target_type, target_id)
);

-- Stripe webhook idempotency
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index saved_groups_owner_idx on public.saved_groups (owner_id);
create index trips_owner_status_idx on public.trips (owner_id, status);
create index trip_units_trip_idx on public.trip_units (trip_id, sort);
create index trip_members_trip_idx on public.trip_members (trip_id);
create index trip_members_unit_idx on public.trip_members (unit_id);
create index receipts_trip_idx on public.receipts (trip_id, sort);
create index line_items_trip_idx on public.line_items (trip_id);
create index line_items_receipt_idx on public.line_items (receipt_id, sort);
create index item_assignments_trip_idx on public.item_assignments (trip_id);
create index item_assignments_item_idx on public.item_assignments (line_item_id);
create index item_assignments_target_idx on public.item_assignments (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger saved_groups_touch before update on public.saved_groups for each row execute function public.touch_updated_at();
create trigger trips_touch before update on public.trips for each row execute function public.touch_updated_at();

-- Create a profile for every new auth user (including anonymous users).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when an anonymous user links an email address.
create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
for each row when (old.email is distinct from new.email) execute function public.handle_user_email_change();

-- Join token sent by guests as an HTTP header (PostgREST exposes request headers as a GUC).
create or replace function public.request_join_token() returns text
language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-join-token', '')
$$;

create or replace function public.can_edit_trip(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips t where t.id = p_trip and t.owner_id = auth.uid())
$$;

create or replace function public.can_access_trip(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_edit_trip(p_trip)
      or exists (
        select 1
        from trips t
        join profiles p on p.id = t.owner_id
        where t.id = p_trip
          and t.join_token = public.request_join_token()
          and (t.is_unlocked or p.plan_tier = 'pro')
      )
$$;

create or replace function public.has_paid_plan(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and plan_tier in ('trip_pass', 'pro'))
$$;

-- Atomically consume one OCR scan. Free trips get 2 scans; unlocked trips / Pro hosts are unlimited.
-- Only callable by the service role (from /api/parse-receipt).
create or replace function public.consume_ocr_scan(p_trip uuid, p_free_limit integer default 2) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  ok boolean;
begin
  update trips t
     set ocr_scans = t.ocr_scans + 1
   where t.id = p_trip
     and (
       t.is_unlocked
       or exists (select 1 from profiles p where p.id = t.owner_id and p.plan_tier = 'pro')
       or t.ocr_scans < p_free_limit
     )
  returning true into ok;
  return coalesce(ok, false);
end $$;

create or replace function public.refund_ocr_scan(p_trip uuid) returns void
language sql security definer set search_path = public as $$
  update trips set ocr_scans = greatest(ocr_scans - 1, 0) where id = p_trip
$$;

revoke all on function public.consume_ocr_scan(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_ocr_scan(uuid) from public, anon, authenticated;
grant execute on function public.consume_ocr_scan(uuid, integer) to service_role;
grant execute on function public.refund_ocr_scan(uuid) to service_role;

-- Ensure an assignment's line item and target belong to the same trip.
create or replace function public.assignment_is_consistent(p_trip uuid, p_item uuid, p_type text, p_target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from line_items li where li.id = p_item and li.trip_id = p_trip)
     and (
       (p_type = 'unit' and exists (select 1 from trip_units u where u.id = p_target and u.trip_id = p_trip))
       or (p_type = 'member' and exists (select 1 from trip_members m where m.id = p_target and m.trip_id = p_trip))
     )
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.saved_groups enable row level security;
alter table public.trips enable row level security;
alter table public.trip_units enable row level security;
alter table public.trip_members enable row level security;
alter table public.receipts enable row level security;
alter table public.line_items enable row level security;
alter table public.item_assignments enable row level security;
alter table public.stripe_events enable row level security; -- no policies: service role only

-- profiles: read/update self; billing columns are not grantable to clients
create policy profiles_select_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- saved_groups ("My Regulars"): owner only; free plan limited to 1 preset
create policy saved_groups_select on public.saved_groups for select to authenticated using (owner_id = auth.uid());
create policy saved_groups_insert on public.saved_groups for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (public.has_paid_plan(auth.uid()) or (select count(*) from public.saved_groups g where g.owner_id = auth.uid()) < 1)
  );
create policy saved_groups_update on public.saved_groups for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy saved_groups_delete on public.saved_groups for delete to authenticated using (owner_id = auth.uid());

-- trips: created by the API (quota check); owners may edit title/date/status only
create policy trips_select on public.trips for select to anon, authenticated using (public.can_access_trip(id));
create policy trips_update on public.trips for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy trips_delete on public.trips for delete to authenticated using (owner_id = auth.uid());
revoke insert, update on public.trips from anon, authenticated;
grant update (title, trip_date, status) on public.trips to authenticated;

-- trip structure tables: readable by anyone with access, editable by the owner
create policy trip_units_select on public.trip_units for select to anon, authenticated using (public.can_access_trip(trip_id));
create policy trip_units_write on public.trip_units for all to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy trip_members_select on public.trip_members for select to anon, authenticated using (public.can_access_trip(trip_id));
create policy trip_members_write on public.trip_members for all to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id) and exists (select 1 from public.trip_units u where u.id = unit_id and u.trip_id = trip_members.trip_id));

create policy receipts_select on public.receipts for select to anon, authenticated using (public.can_access_trip(trip_id));
create policy receipts_write on public.receipts for all to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy line_items_select on public.line_items for select to anon, authenticated using (public.can_access_trip(trip_id));
create policy line_items_write on public.line_items for all to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id) and exists (select 1 from public.receipts r where r.id = receipt_id and r.trip_id = line_items.trip_id));

-- assignments: anyone at the table (owner or join-token guest) can tap chips
create policy item_assignments_select on public.item_assignments for select to anon, authenticated using (public.can_access_trip(trip_id));
create policy item_assignments_insert on public.item_assignments for insert to anon, authenticated
  with check (public.can_access_trip(trip_id) and public.assignment_is_consistent(trip_id, line_item_id, target_type, target_id));
create policy item_assignments_delete on public.item_assignments for delete to anon, authenticated using (public.can_access_trip(trip_id));
revoke update on public.item_assignments from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private `receipts` bucket, objects stored as <trip_id>/<file>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

create policy receipts_bucket_owner_read on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.can_edit_trip(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.item_assignments replica identity full;
alter table public.line_items replica identity full;

alter publication supabase_realtime add table public.item_assignments;
alter publication supabase_realtime add table public.line_items;
alter publication supabase_realtime add table public.receipts;
alter publication supabase_realtime add table public.trip_units;
alter publication supabase_realtime add table public.trip_members;

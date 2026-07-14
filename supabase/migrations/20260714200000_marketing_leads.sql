-- Marketing leads — Website-DentOrd §4.8 / W13.
-- Platform table (no clinic_id). Insert + read only via service role (server actions / platform admin).
--
-- Applied to the remote Supabase project via MCP `apply_migration`
-- under the name: marketing_leads

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  clinic_name text not null,
  phone text not null,
  email text,
  preferred_time text not null
    check (preferred_time in ('morning', 'afternoon', 'anytime')),
  message text,
  locale text not null default 'bs'
    check (locale in ('bs', 'en')),
  source_page text not null default 'contact',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'closed')),
  -- SHA-256 hex of client IP + server salt; used for rate limit only (not raw IP).
  ip_hash text
);

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

create index if not exists leads_status_created_at_idx
  on public.leads (status, created_at desc);

create index if not exists leads_ip_hash_created_at_idx
  on public.leads (ip_hash, created_at desc)
  where ip_hash is not null;

comment on table public.leads is
  'Marketing contact/callback leads (W13). No clinic_id — platform data. Access only via service role.';

alter table public.leads enable row level security;

-- No policies for anon/authenticated: deny all via RLS.
-- service_role bypasses RLS for server inserts and platform admin reads (D41).

revoke all on table public.leads from public, anon, authenticated;
grant select, insert, update on table public.leads to service_role;

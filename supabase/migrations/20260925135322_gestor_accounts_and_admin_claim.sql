create table if not exists public.gs_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  shop_id bigint references public.shop_credentials(shop_id) on delete set null,
  session_version integer not null default 1 check (session_version > 0),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  last_seen_at timestamptz
);
create index if not exists gs_accounts_last_seen_idx on public.gs_accounts(last_seen_at desc);
alter table public.gs_accounts enable row level security;
revoke all on public.gs_accounts from anon, authenticated;
grant all on public.gs_accounts to service_role;
create table if not exists public.gs_admin_claim (
  id integer primary key check (id=1),
  claim_hash text not null,
  claimed_by uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz
);
alter table public.gs_admin_claim enable row level security;
revoke all on public.gs_admin_claim from anon, authenticated;
grant all on public.gs_admin_claim to service_role;
insert into public.gs_admin_claim(id,claim_hash) values(1,'ef652556e06d0927ac0fa77b5fc6cb24cbeb2f343a749fcf54f412c73f9f1fa2') on conflict(id) do nothing;

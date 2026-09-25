alter table public.gs_admin_claim
  add column if not exists bootstrap_user_id uuid unique references auth.users(id) on delete set null;
create table if not exists public.gs_signup_invites (
  code_hash text primary key,
  created_by uuid not null references auth.users(id) on delete cascade,
  used_by uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.gs_signup_invites enable row level security;
revoke all on public.gs_signup_invites from anon, authenticated;
grant all on public.gs_signup_invites to service_role;

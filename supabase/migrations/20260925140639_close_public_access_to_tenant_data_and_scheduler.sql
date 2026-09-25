-- Dados de loja e rotina agendada são acessíveis apenas pelo servidor.
-- O cron segue executando como postgres.
alter table public.gs_competitor_visibility_snapshots enable row level security;
revoke all on table public.gs_competitor_visibility_snapshots from anon, authenticated;
revoke execute on function public.invoke_flash_sale_automation() from public, anon, authenticated;

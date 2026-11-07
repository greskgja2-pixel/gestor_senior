create table if not exists public.gs_revenda_garimpo(
  id bigserial primary key,
  shop_id bigint not null,
  produto text not null,
  fornecedor text not null default '',
  link_fornecedor text,
  custo numeric(10,2) not null,
  preco_caixa boolean not null default false,
  lider_preco numeric(10,2), lider_vendas integer, lider_url text,
  menor_preco numeric(10,2), menor_vendas integer, menor_url text,
  viavel_preco numeric(10,2), viavel_vendas integer, viavel_url text,
  veredito text not null check (veredito in ('vale_testar','teste_pequeno','arriscado','so_se_baixar_custo','nao_compensa')),
  observacao text,
  pesquisado_em date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gs_revenda_garimpo_shop_idx on public.gs_revenda_garimpo(shop_id);
alter table public.gs_revenda_garimpo enable row level security;
revoke all on public.gs_revenda_garimpo from anon, authenticated;
grant all on public.gs_revenda_garimpo to service_role;
grant usage,select on sequence public.gs_revenda_garimpo_id_seq to service_role;

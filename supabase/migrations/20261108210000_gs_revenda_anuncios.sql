-- Anúncios da Shopee abertos e conferidos para cada produto do Garimpo de Revenda.
create table if not exists public.gs_revenda_anuncios(
  id bigserial primary key,
  shop_id bigint not null,
  garimpo_id bigint not null references public.gs_revenda_garimpo(id) on delete cascade,
  titulo text not null,
  url text not null,
  anunciante text,
  marca text,
  preco numeric(10,2),
  vendas_30d integer,
  vendas_total integer,
  idade_dias integer,
  equivalencia text not null default 'nao_confirmado' check (equivalencia in ('identico','muito_parecido','parcial','diferente','nao_confirmado')),
  motivo text,
  coletado_em date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists gs_revenda_anuncios_garimpo_idx on public.gs_revenda_anuncios(garimpo_id);
create index if not exists gs_revenda_anuncios_shop_idx on public.gs_revenda_anuncios(shop_id);
alter table public.gs_revenda_anuncios enable row level security;
revoke all on public.gs_revenda_anuncios from anon, authenticated;
grant all on public.gs_revenda_anuncios to service_role;
grant usage,select on sequence public.gs_revenda_anuncios_id_seq to service_role;

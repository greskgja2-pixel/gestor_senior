alter table public.gs_revenda_garimpo add column if not exists marcadores text[] not null default '{}';
comment on column public.gs_revenda_garimpo.marcadores is 'Marcadores livres colocados pelo usuário (ex.: Sem estoque, Vou testar, Análise equivocada).';

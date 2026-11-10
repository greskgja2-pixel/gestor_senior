-- Espelha ajustes já aplicados no banco: status 'aguardando', pesquisado_em opcional e coluna categoria.
alter table public.gs_revenda_garimpo drop constraint if exists gs_revenda_garimpo_veredito_check;
alter table public.gs_revenda_garimpo add constraint gs_revenda_garimpo_veredito_check check (veredito in ('vale_testar','teste_pequeno','arriscado','so_se_baixar_custo','nao_compensa','aguardando'));
alter table public.gs_revenda_garimpo alter column pesquisado_em drop not null;
alter table public.gs_revenda_garimpo add column if not exists categoria text;

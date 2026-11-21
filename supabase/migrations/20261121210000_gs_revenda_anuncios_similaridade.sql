-- Similaridade (0 a 100) do anúncio da Shopee com o produto do fornecedor. Nulo = não medido.
alter table gs_revenda_anuncios add column if not exists sim_titulo smallint check (sim_titulo between 0 and 100);
alter table gs_revenda_anuncios add column if not exists sim_descricao smallint check (sim_descricao between 0 and 100);
alter table gs_revenda_anuncios add column if not exists sim_fotos smallint check (sim_fotos between 0 and 100);

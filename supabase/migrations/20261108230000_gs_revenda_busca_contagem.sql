alter table gs_revenda_garimpo
  add column if not exists busca_total int,
  add column if not exists busca_nacionais int,
  add column if not exists busca_internacionais int;

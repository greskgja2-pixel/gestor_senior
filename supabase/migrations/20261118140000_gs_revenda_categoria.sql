-- Categoria do produto no Garimpo de revenda (vinda do catálogo do fornecedor).
-- Nullable de propósito: linhas sem categoria aparecem como "Sem categoria"; nada é inventado.
alter table public.gs_revenda_garimpo add column if not exists categoria text;

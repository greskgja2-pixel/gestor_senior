import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getCategories, getAttributes, getBrands, getModelList } from "../../../../lib/shopee-catalog";

export const dynamic = "force-dynamic";

function positiveInt(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function translated(list, fallback = "") {
  if (!Array.isArray(list)) return fallback;
  const pt = list.find((x) => String(x?.language || "").toLowerCase() === "pt-br");
  return pt?.value || list[0]?.value || fallback;
}

function normalizeAttributeTree(raw, categoryId) {
  const groups = raw?.response?.list || [];
  const group = groups.find((x) => Number(x?.category_id) === Number(categoryId)) || groups[0] || {};
  const tree = Array.isArray(group.attribute_tree) ? group.attribute_tree : [];

  const normalizeValue = (value) => ({
    value_id: value?.value_id ?? 0,
    original_value_name: value?.name || translated(value?.multi_lang, ""),
    display_value_name: translated(value?.multi_lang, value?.name || ""),
    value_unit: value?.value_unit || "",
  });

  const attribute_list = tree.map((attr) => ({
    attribute_id: attr?.attribute_id,
    original_attribute_name: attr?.name || translated(attr?.multi_lang, ""),
    display_attribute_name: translated(attr?.multi_lang, attr?.name || ""),
    is_mandatory: Boolean(attr?.mandatory),
    input_type: attr?.attribute_info?.input_type ?? null,
    max_value_count: attr?.attribute_info?.max_value_count ?? null,
    attribute_unit_list: attr?.attribute_info?.attribute_unit_list || [],
    attribute_value_list: Array.isArray(attr?.attribute_value_list)
      ? attr.attribute_value_list.map(normalizeValue)
      : [],
  }));

  return {
    error: raw?.error || "",
    message: raw?.message || "",
    request_id: raw?.request_id || "",
    response: {
      category_id: Number(group?.category_id || categoryId),
      warning: group?.warning || raw?.warning || "",
      attribute_list,
    },
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") || "categories";
  const shop = await getActiveShop();
  if (!shop) return NextResponse.json({ error: "Nenhuma loja Shopee autorizada." }, { status: 400 });

  try {
    let data;
    if (resource === "categories") {
      data = await getCategories(shop);
    } else if (resource === "attributes") {
      const categoryId = positiveInt(url.searchParams.get("category_id"));
      if (!categoryId) return NextResponse.json({ error: "category_id inválido." }, { status: 400 });
      const raw = await getAttributes(shop, categoryId);
      data = normalizeAttributeTree(raw, categoryId);
    } else if (resource === "brands") {
      const categoryId = positiveInt(url.searchParams.get("category_id"));
      if (!categoryId) return NextResponse.json({ error: "category_id inválido." }, { status: 400 });
      const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
      data = await getBrands(shop, categoryId, offset, 100);
    } else if (resource === "models") {
      const itemId = positiveInt(url.searchParams.get("item_id"));
      if (!itemId) return NextResponse.json({ error: "item_id inválido." }, { status: 400 });
      data = await getModelList(shop, itemId);
    } else {
      return NextResponse.json({ error: "resource desconhecido." }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

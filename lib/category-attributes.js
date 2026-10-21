// Atributos e marca exigidos por uma categoria da Shopee (get_attribute_tree / get_brand_list).
// Funções puras: a rota de catálogo normaliza a resposta e a rota de atualização valida o que o usuário escolheu.

function translated(list, fallback = "") {
  if (!Array.isArray(list)) return fallback;
  const pt = list.find((x) => String(x?.language || "").toLowerCase() === "pt-br");
  return pt?.value || list[0]?.value || fallback;
}

export function normalizeAttributeTree(raw, categoryId) {
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

const attrName = (a) => a.display_attribute_name || a.original_attribute_name || `Atributo ${a.attribute_id}`;

// input.attributeList: [{attributeId, valueId?, name?}]; input.brand: {brandId, name} | null.
// Devolve {error} ou {attribute_list, brand?} no formato do update_item. Todo atributo obrigatório precisa ter valor;
// valor de lista precisa existir na lista da categoria; texto livre vai com value_id 0.
export function buildCategoryPayload({ attributes, brandInfo, input }) {
  const given = new Map();
  for (const row of Array.isArray(input?.attributeList) ? input.attributeList : []) {
    const id = Number(row?.attributeId);
    if (Number.isSafeInteger(id) && id > 0) given.set(id, row);
  }
  const attribute_list = [];
  const missing = [];
  for (const attr of attributes || []) {
    const id = Number(attr.attribute_id);
    const row = given.get(id);
    const name = String(row?.name ?? "").trim().slice(0, 200);
    const valueId = Number(row?.valueId) || 0;
    let value = null;
    if (valueId > 0) {
      const found = (attr.attribute_value_list || []).find((v) => Number(v.value_id) === valueId);
      if (!found) return { error: `Valor inválido para “${attrName(attr)}”.` };
      value = { value_id: valueId, original_value_name: found.original_value_name };
    } else if (name) {
      value = { value_id: 0, original_value_name: name };
    }
    if (!value) {
      if (attr.is_mandatory) missing.push(attrName(attr));
      continue;
    }
    attribute_list.push({ attribute_id: id, attribute_value_list: [value] });
  }
  if (missing.length) return { error: `Preencha os campos obrigatórios da categoria: ${missing.join(", ")}.` };

  const out = { attribute_list };
  const brandId = input?.brand != null ? Number(input.brand?.brandId) : null;
  if (brandId != null && Number.isSafeInteger(brandId) && brandId >= 0) {
    out.brand = { brand_id: brandId, original_brand_name: String(input.brand?.name || (brandId === 0 ? "NoBrand" : "")).slice(0, 200) };
  } else if (brandInfo?.is_mandatory) {
    return { error: "A categoria exige uma marca. Escolha a marca antes de salvar." };
  }
  return out;
}

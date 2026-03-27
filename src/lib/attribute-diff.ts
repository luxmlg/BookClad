import type { Attribute, AttributeValue, AttributeConfigJson } from "./attributes";

// ── Change types ────────────────────────────────────────

export type ConfigChange =
  | { type: "add-attribute"; attribute: Attribute }
  | { type: "remove-attribute"; attribute: Attribute }
  | { type: "modify-attribute"; attributeId: string; attributeName: string; field: string; before: string; after: string }
  | { type: "add-value"; attributeId: string; attributeName: string; value: AttributeValue }
  | { type: "remove-value"; attributeId: string; attributeName: string; value: AttributeValue }
  | { type: "modify-value"; attributeId: string; attributeName: string; valueBefore: AttributeValue; valueAfter: AttributeValue };

// ── Diff ────────────────────────────────────────────────

export function diffAttributeConfigs(
  before: AttributeConfigJson,
  after: AttributeConfigJson,
): ConfigChange[] {
  const changes: ConfigChange[] = [];
  const beforeMap = new Map(before.attributes.map((a) => [a.id, a]));
  const afterMap = new Map(after.attributes.map((a) => [a.id, a]));

  // Removed attributes
  for (const attr of before.attributes) {
    if (!afterMap.has(attr.id)) {
      changes.push({ type: "remove-attribute", attribute: attr });
    }
  }

  // Added attributes
  for (const attr of after.attributes) {
    if (!beforeMap.has(attr.id)) {
      changes.push({ type: "add-attribute", attribute: attr });
    }
  }

  // Modified attributes
  for (const afterAttr of after.attributes) {
    const beforeAttr = beforeMap.get(afterAttr.id);
    if (!beforeAttr) continue;

    // Field-level changes
    for (const field of ["name", "type", "description", "enabled"] as const) {
      const bVal = String(beforeAttr[field] ?? "");
      const aVal = String(afterAttr[field] ?? "");
      if (bVal !== aVal) {
        changes.push({
          type: "modify-attribute",
          attributeId: afterAttr.id,
          attributeName: afterAttr.name,
          field,
          before: bVal,
          after: aVal,
        });
      }
    }

    // Value-level changes
    const beforeValues = new Map(beforeAttr.values.map((v) => [v.value, v]));
    const afterValues = new Map(afterAttr.values.map((v) => [v.value, v]));

    for (const v of beforeAttr.values) {
      if (!afterValues.has(v.value)) {
        changes.push({ type: "remove-value", attributeId: afterAttr.id, attributeName: afterAttr.name, value: v });
      }
    }

    for (const v of afterAttr.values) {
      if (!beforeValues.has(v.value)) {
        changes.push({ type: "add-value", attributeId: afterAttr.id, attributeName: afterAttr.name, value: v });
      }
    }

    for (const afterVal of afterAttr.values) {
      const beforeVal = beforeValues.get(afterVal.value);
      if (!beforeVal) continue;
      if (
        beforeVal.label !== afterVal.label ||
        beforeVal.description !== afterVal.description ||
        JSON.stringify(beforeVal.colors) !== JSON.stringify(afterVal.colors)
      ) {
        changes.push({
          type: "modify-value",
          attributeId: afterAttr.id,
          attributeName: afterAttr.name,
          valueBefore: beforeVal,
          valueAfter: afterVal,
        });
      }
    }
  }

  return changes;
}

// ── Apply ───────────────────────────────────────────────

export function applyConfigChanges(
  config: AttributeConfigJson,
  allChanges: ConfigChange[],
  selectedIndices: Set<number>,
): AttributeConfigJson {
  // Build selected change lists by type
  const selected = allChanges.filter((_, i) => selectedIndices.has(i));
  const removedAttrIds = new Set(
    selected.filter((c) => c.type === "remove-attribute").map((c) => (c as { attribute: Attribute }).attribute.id),
  );
  const addedAttrs = selected
    .filter((c) => c.type === "add-attribute")
    .map((c) => (c as { attribute: Attribute }).attribute);
  const modifiedFields = selected.filter((c) => c.type === "modify-attribute") as Extract<ConfigChange, { type: "modify-attribute" }>[];
  const addedValues = selected.filter((c) => c.type === "add-value") as Extract<ConfigChange, { type: "add-value" }>[];
  const removedValues = selected.filter((c) => c.type === "remove-value") as Extract<ConfigChange, { type: "remove-value" }>[];
  const modifiedValues = selected.filter((c) => c.type === "modify-value") as Extract<ConfigChange, { type: "modify-value" }>[];

  // Group value changes by attribute
  const addedByAttr = new Map<string, AttributeValue[]>();
  for (const c of addedValues) {
    const arr = addedByAttr.get(c.attributeId) ?? [];
    arr.push(c.value);
    addedByAttr.set(c.attributeId, arr);
  }
  const removedByAttr = new Map<string, Set<string>>();
  for (const c of removedValues) {
    const set = removedByAttr.get(c.attributeId) ?? new Set();
    set.add(c.value.value);
    removedByAttr.set(c.attributeId, set);
  }
  const modifiedByAttr = new Map<string, Map<string, AttributeValue>>();
  for (const c of modifiedValues) {
    const map = modifiedByAttr.get(c.attributeId) ?? new Map();
    map.set(c.valueAfter.value, c.valueAfter);
    modifiedByAttr.set(c.attributeId, map);
  }

  // Apply to existing attributes (preserve order)
  const attributes = config.attributes
    .filter((a) => !removedAttrIds.has(a.id))
    .map((attr) => {
      let updated = { ...attr };

      // Apply field modifications
      for (const mod of modifiedFields) {
        if (mod.attributeId !== attr.id) continue;
        updated = { ...updated, [mod.field]: mod.field === "enabled" ? mod.after === "true" : mod.after };
      }

      // Apply value changes
      const toRemove = removedByAttr.get(attr.id);
      const toAdd = addedByAttr.get(attr.id);
      const toModify = modifiedByAttr.get(attr.id);

      if (toRemove || toAdd || toModify) {
        let values = updated.values;
        if (toRemove) values = values.filter((v) => !toRemove.has(v.value));
        if (toModify) values = values.map((v) => toModify.get(v.value) ?? v);
        if (toAdd) values = [...values, ...toAdd];
        updated = { ...updated, values };
      }

      return updated;
    });

  // Append new attributes at end
  return { ...config, attributes: [...attributes, ...addedAttrs] };
}

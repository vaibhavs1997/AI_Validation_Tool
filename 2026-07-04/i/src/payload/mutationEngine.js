function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function pathParts(path) {
  if (Array.isArray(path)) return path;
  return String(path || "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
}

function parentFor(target, fieldPath) {
  const parts = pathParts(fieldPath);
  const key = parts.pop();
  let cursor = target;
  for (const part of parts) {
    if (cursor[part] === undefined || cursor[part] === null) cursor[part] = {};
    cursor = cursor[part];
  }
  return { parent: cursor, key };
}

function invalidValue(current) {
  if (typeof current === "number") return "not-a-number";
  if (typeof current === "boolean") return "not-a-boolean";
  if (Array.isArray(current)) return "not-an-array";
  if (current && typeof current === "object") return "not-an-object";
  return 999999;
}

function applyMutation(payload, mutation) {
  const next = clone(payload || {});
  const { parent, key } = parentFor(next, mutation.field);

  if (!key) return next;

  switch (mutation.operation) {
    case "remove":
      delete parent[key];
      break;
    case "nullify":
      parent[key] = null;
      break;
    case "emptyString":
      parent[key] = "";
      break;
    case "invalidType":
      parent[key] = invalidValue(parent[key]);
      break;
    case "maxLengthExceeded":
      parent[key] = "x".repeat(Number(mutation.length || 300));
      break;
    case "boundaryMin":
      parent[key] = mutation.value ?? 0;
      break;
    case "boundaryMax":
      parent[key] = mutation.value ?? 999999999;
      break;
    case "replace":
    default:
      parent[key] = mutation.value;
      break;
  }

  return next;
}

function applyMutations(payload, mutations = []) {
  return mutations.reduce((current, mutation) => applyMutation(current, mutation), clone(payload || {}));
}

module.exports = {
  applyMutation,
  applyMutations,
};

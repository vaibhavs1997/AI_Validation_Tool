function typeMatches(value, schema) {
  if (!schema || !schema.type) return true;
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (value === null) return schema.nullable === true;
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "object") return value && typeof value === "object" && !Array.isArray(value);
  if (type === "string") return typeof value === "string";
  return true;
}

function validateSchema(value, schema, prefix = "$") {
  const assertions = [];
  if (!schema) return assertions;

  assertions.push({
    name: `${prefix} type matches ${schema.type || "schema"}`,
    passed: typeMatches(value, schema),
  });

  if (!value || typeof value !== "object") return assertions;

  for (const required of schema.required || []) {
    assertions.push({
      name: `${prefix}.${required} is present`,
      passed: Object.prototype.hasOwnProperty.call(value, required),
    });
  }

  for (const [key, childSchema] of Object.entries(schema.properties || {})) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      assertions.push(...validateSchema(value[key], childSchema, `${prefix}.${key}`));
    }
  }

  return assertions;
}

function validateStatus(actualStatus, expectedStatus) {
  const expected = Array.isArray(expectedStatus) ? expectedStatus.map(String) : [String(expectedStatus || "")];
  return {
    name: `HTTP status is ${expected.join(" or ")}`,
    passed: expected.includes(String(actualStatus)),
    expected: expected.join(" or "),
    actual: actualStatus,
  };
}

function validateResponse({ scenario, endpoint, status, body }) {
  const assertions = [];
  if (scenario.expectedStatus) assertions.push(validateStatus(status, scenario.expectedStatus));

  const responseSchema = endpoint?.responseSchemas?.[String(status)] || endpoint?.responseSchemas?.default;
  if (responseSchema && body !== undefined && body !== null) {
    assertions.push(...validateSchema(body, responseSchema));
  }

  for (const assertion of scenario.assertions || []) {
    assertions.push({
      name: assertion,
      passed: null,
      manual: true,
    });
  }

  const deterministic = assertions.filter((assertion) => assertion.passed !== null);
  const failed = deterministic.filter((assertion) => assertion.passed === false);

  return {
    assertions,
    passed: deterministic.length > 0 && failed.length === 0,
    failed: failed.length > 0,
  };
}

module.exports = {
  validateResponse,
  validateSchema,
  validateStatus,
};

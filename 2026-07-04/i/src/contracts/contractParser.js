const crypto = require("crypto");

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

function parseJsonInput(input) {
  if (!input) throw new Error("Contract content is required.");
  if (typeof input === "object") return input;
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`Only JSON OpenAPI/Postman files are supported in this MVP. ${error.message}`);
  }
}

function resolveRef(root, value, seen = new Set()) {
  if (!value || typeof value !== "object") return value;
  if (!value.$ref) return value;
  if (!value.$ref.startsWith("#/")) return value;
  if (seen.has(value.$ref)) return value;

  seen.add(value.$ref);
  const target = value.$ref
    .slice(2)
    .split("/")
    .reduce((cursor, part) => cursor?.[part.replace(/~1/g, "/").replace(/~0/g, "~")], root);

  return resolveSchema(root, target || value, seen);
}

function resolveSchema(root, schema, seen = new Set()) {
  if (!schema || typeof schema !== "object") return schema;
  const resolved = resolveRef(root, schema, seen);
  if (resolved !== schema) return resolved;

  if (Array.isArray(schema)) return schema.map((item) => resolveSchema(root, item, seen));

  const out = { ...schema };
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([key, value]) => [key, resolveSchema(root, value, new Set(seen))])
    );
  }
  if (out.items) out.items = resolveSchema(root, out.items, new Set(seen));
  if (out.allOf) out.allOf = out.allOf.map((item) => resolveSchema(root, item, new Set(seen)));
  if (out.oneOf) out.oneOf = out.oneOf.map((item) => resolveSchema(root, item, new Set(seen)));
  if (out.anyOf) out.anyOf = out.anyOf.map((item) => resolveSchema(root, item, new Set(seen)));
  return out;
}

function mergeAllOf(schema) {
  if (!schema?.allOf) return schema;
  const merged = { type: "object", properties: {}, required: [] };
  for (const item of schema.allOf) {
    const child = mergeAllOf(item);
    if (child.properties) Object.assign(merged.properties, child.properties);
    if (Array.isArray(child.required)) merged.required.push(...child.required);
  }
  return {
    ...schema,
    ...merged,
    required: [...new Set(merged.required)],
  };
}

function schemaFromContent(content, root) {
  if (!content) return null;
  const jsonContent =
    content["application/json"] ||
    content["application/*+json"] ||
    Object.entries(content).find(([type]) => type.includes("json"))?.[1];

  if (!jsonContent?.schema) return null;
  return mergeAllOf(resolveSchema(root, jsonContent.schema));
}

function parseOpenApi(raw) {
  const title = raw.info?.title || "OpenAPI contract";
  const version = raw.info?.version || "";
  const baseUrl = raw.servers?.[0]?.url || "";
  const endpoints = [];

  for (const [apiPath, pathItem] of Object.entries(raw.paths || {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;

      const requestSchema = schemaFromContent(operation.requestBody?.content, raw);
      const responses = {};
      const responseSchemas = {};

      for (const [status, response] of Object.entries(operation.responses || {})) {
        responses[status] = response.description || "";
        const schema = schemaFromContent(response.content, raw);
        if (schema) responseSchemas[status] = schema;
      }

      endpoints.push({
        id: crypto
          .createHash("sha1")
          .update(`${method.toUpperCase()} ${apiPath}`)
          .digest("hex")
          .slice(0, 10),
        method: method.toUpperCase(),
        path: apiPath,
        operationId: operation.operationId || "",
        summary: operation.summary || "",
        description: operation.description || "",
        tags: operation.tags || [],
        parameters: [...(pathItem.parameters || []), ...(operation.parameters || [])],
        requestSchema,
        responses,
        responseSchemas,
      });
    }
  }

  return {
    type: "openapi",
    title,
    version,
    baseUrl,
    endpoints,
    importedAt: new Date().toISOString(),
  };
}

function parsePostmanUrl(url) {
  function normalizePath(value) {
    let next = String(value || "")
      .split("?")[0]
      .replace(/\{\{([^}]+)\}\}/g, "{$1}")
      .replace(/\/:([^/]+)/g, "/{$1}");
    if (!next.startsWith("/")) next = `/${next}`;
    return next || "/";
  }

  if (!url) return { raw: "", path: "/" };
  if (typeof url === "string") {
    const rawPath = url
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^\{\{[^}]+\}\}/, "")
      .replace(/^[^/]+(?=\/)/, "");
    return { raw: url, path: normalizePath(rawPath) };
  }
  const raw = url.raw || "";
  const pathParts = Array.isArray(url.path) ? url.path : [];
  const rawPath = raw
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\{\{[^}]+\}\}/, "")
    .replace(/^[^/]+(?=\/)/, "");
  return {
    raw,
    path: normalizePath(pathParts.length ? `/${pathParts.join("/")}` : rawPath),
  };
}

function inferSchemaFromValue(value) {
  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length ? inferSchemaFromValue(value[0]) : {},
    };
  }
  if (value && typeof value === "object") {
    return {
      type: "object",
      required: Object.keys(value),
      properties: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, inferSchemaFromValue(child)])),
    };
  }
  if (typeof value === "number") return { type: Number.isInteger(value) ? "integer" : "number", example: value };
  if (typeof value === "boolean") return { type: "boolean", example: value };
  return { type: "string", example: value || "sample" };
}

function parsePostmanBody(body) {
  if (!body || body.mode !== "raw" || !body.raw) return null;
  try {
    return inferSchemaFromValue(JSON.parse(body.raw));
  } catch {
    return null;
  }
}

function walkPostmanItems(items, endpoints = []) {
  for (const item of items || []) {
    if (item.item) {
      walkPostmanItems(item.item, endpoints);
      continue;
    }

    const request = item.request || {};
    const url = parsePostmanUrl(request.url);
    endpoints.push({
      id: crypto
        .createHash("sha1")
        .update(`${request.method || "GET"} ${url.path} ${item.name || ""}`)
        .digest("hex")
        .slice(0, 10),
      method: String(request.method || "GET").toUpperCase(),
      path: url.path,
      operationId: item.name || "",
      summary: item.name || "",
      description: request.description || "",
      tags: [],
      parameters: [],
      requestSchema: parsePostmanBody(request.body),
      responses: Object.fromEntries((item.response || []).map((response) => [String(response.code || "default"), response.name || ""])),
      responseSchemas: {},
      rawUrl: url.raw,
    });
  }
  return endpoints;
}

function postmanVariable(raw, names) {
  const variables = raw.variable || raw.collection?.variable || [];
  const lowered = names.map((name) => name.toLowerCase());
  const match = variables.find((variable) => lowered.includes(String(variable.key || "").toLowerCase()));
  return match?.value || "";
}

function parsePostman(raw) {
  const collection = raw.collection?.item ? raw.collection : raw;
  return {
    type: "postman",
    title: collection.info?.name || raw.info?.name || "Postman collection",
    version: collection.info?.version || raw.info?.version || "",
    baseUrl: postmanVariable(collection, ["baseUrl", "base_url", "url", "host"]),
    endpoints: walkPostmanItems(collection.item || []),
    importedAt: new Date().toISOString(),
  };
}

function parseHarRequest(entry) {
  const request = entry.request || {};
  const method = (request.method || "GET").toUpperCase();
  const url = request.url || "";

  let body = null;
  const postData = request.postData || {};
  if (postData.text) {
    try {
      body = JSON.parse(postData.text);
    } catch {
      // Non-JSON body, skip
    }
  }

  return {
    id: `${method}-${url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20)}`.replace(/_+/g, "_"),
    method,
    path: url.replace(/^https?:\/\/[^/]+/i, ""),
    operationId: entry._id || "",
    summary: entry.title || `${method} ${url}`,
    description: entry.comment || "",
    tags: [],
    parameters: request.headers ? Object.entries(request.headers).map(([name, value]) => ({ name, value })) : [],
    requestSchema: body && typeof body === "object" ? inferSchemaFromValue(body) : null,
    responses: { 200: "OK" },
    responseSchemas: {},
  };
}

function parseHarLog(log) {
  const entries = log.entries || [];
  const endpoints = entries
    .filter((entry) => entry.request && (entry.request.method === "GET" || entry.request.method === "POST" || entry.request.method === "PUT" || entry.request.method === "DELETE"))
    .map(parseHarRequest)
    .filter((ep) => ep.path && ep.path !== "/");

  return {
    type: "har",
    title: log.version ? `HAR Log v${log.version}` : "HAR Import",
    version: "1.0.0",
    baseUrl: "",
    endpoints,
    importedAt: new Date().toISOString(),
  };
}

function parseContract(input) {
  const raw = parseJsonInput(input);
  if (raw.openapi || raw.swagger) return parseOpenApi(raw);
  if (raw.info?._postman_id || raw.item || raw.collection?.item) return parsePostman(raw);
  if (raw.log && Array.isArray(raw.log.entries)) return parseHarLog(raw.log);
  throw new Error("Unsupported contract. Provide OpenAPI/Swagger JSON, Postman collection JSON, or HAR file.");
}

function createSampleValue(schema, fieldName = "value") {
  if (!schema || typeof schema !== "object") return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === "object" || schema.properties) {
    const result = {};
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      result[key] = createSampleValue(childSchema, key);
    }
    return result;
  }
  if (type === "array") return [createSampleValue(schema.items || {}, fieldName)];
  if (type === "integer") return schema.minimum ?? 1;
  if (type === "number") return schema.minimum ?? 10.5;
  if (type === "boolean") return true;

  if (/email/i.test(fieldName)) return "qa.user@example.com";
  if (/id$/i.test(fieldName)) return "sample-id";
  if (/date/i.test(fieldName)) return "2026-07-04";
  if (/amount|price|total/i.test(fieldName)) return 10;
  return `sample-${fieldName}`;
}

module.exports = {
  createSampleValue,
  parseContract,
};

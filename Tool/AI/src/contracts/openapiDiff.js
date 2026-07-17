/**
 * OpenAPI Diff - Compare two API contracts and identify breaking changes
 */

function compareSchemas(schemaA, schemaB, path = "") {
  const differences = [];

  if (!schemaA && !schemaB) return differences;
  if (!schemaA) {
    differences.push({ path, type: "removed", message: "Schema removed" });
    return differences;
  }
  if (!schemaB) {
    differences.push({ path, type: "added", message: "Schema added" });
    return differences;
  }

  // Compare required fields
  const requiredA = new Set(schemaA.required || []);
  const requiredB = new Set(schemaB.required || []);

  for (const req of requiredA) {
    if (!requiredB.has(req)) {
      differences.push({ path, type: "removed_required", field: req, message: `Field "${req}" no longer required` });
    }
  }

  for (const req of requiredB) {
    if (!requiredA.has(req)) {
      differences.push({ path, type: "added_required", field: req, message: `Field "${req}" now required` });
    }
  }

  // Compare properties
  const propsA = schemaA.properties || {};
  const propsB = schemaB.properties || {};

  for (const [key, propA] of Object.entries(propsA)) {
    const propB = propsB[key];
    if (!propB) {
      differences.push({ path, type: "removed_property", field: key, message: `Property "${key}" removed` });
    } else if (propA.type !== propB.type) {
      differences.push({
        path,
        type: "type_changed",
        field: key,
        message: `Type changed from "${propA.type}" to "${propB.type}"`,
      });
    }
  }

  return differences;
}

function compareEndpoints(endpointsA, endpointsB) {
  const differences = [];
  const mapA = new Map(endpointsA.map((ep) => [`${ep.method} ${ep.path}`, ep]));
  const mapB = new Map(endpointsB.map((ep) => [`${ep.method} ${ep.path}`, ep]));

  // Check for removed endpoints
  for (const [key, epA] of mapA) {
    if (!mapB.has(key)) {
      differences.push({ type: "removed_endpoint", method: epA.method, path: epA.path, message: `Endpoint ${key} removed` });
    }
  }

  // Check for added endpoints
  for (const [key, epB] of mapB) {
    if (!mapA.has(key)) {
      differences.push({ type: "added_endpoint", method: epB.method, path: epB.path, message: `Endpoint ${key} added` });
    }
  }

  // Check for modified endpoints
  for (const [key, epA] of mapA) {
    const epB = mapB.get(key);
    if (epB && epA.requestSchema !== epB.requestSchema) {
      differences.push(...compareSchemas(epA.requestSchema, epB.requestSchema, `${key} request`));
    }
  }

  return differences;
}

function compareContracts(oldContract, newContract) {
  const differences = [];

  differences.push(...compareEndpoints(oldContract.endpoints || [], newContract.endpoints || []));

  // Add summary
  const breaking = differences.filter((d) => ["removed_endpoint", "type_changed", "removed_property"].includes(d.type));
  const additions = differences.filter((d) => d.type === "added_endpoint");

  return {
    changes: differences,
    breakingChanges: breaking,
    additions: additions,
    summary: {
      totalChanges: differences.length,
      breakingCount: breaking.length,
      additionCount: additions.length,
    },
  };
}

module.exports = {
  compareContracts,
  compareEndpoints,
  compareSchemas,
};
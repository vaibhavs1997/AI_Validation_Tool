/**
 * TestConditionEngine
 *
 * Maps atomic requirements to applicable test design techniques.
 *
 * For each requirement, determines:
 *   - What technique(s) apply (BVA, EP, decision table, etc.)
 *   - What kind of conditions to generate (POSITIVE, NEGATIVE, BOUNDARY, EDGE)
 *   - What field/constraint to test
 *
 * Respects generation mode: SMOKE → positive only, STANDARD → +negative +key boundaries,
 * COMPREHENSIVE → expanded partitions + combinations.
 */

const { RequirementTypes, GenerationModes } = require("./types");

/**
 * Generate test conditions from normalized requirements.
 *
 * @param {Array} requirements - Normalized atomic requirements
 * @param {'SMOKE'|'STANDARD'|'COMPREHENSIVE'} mode
 * @returns {Array<Object>} TestCondition[]
 */
function generateConditions(requirements, mode = GenerationModes.STANDARD) {
  const conditions = [];
  let condCounter = 0;

  for (const req of requirements) {
    const { requirementType, constraint, subject, sourceText } = req;

    switch (requirementType) {
      // ─── DATA TYPE ────────────────────────────────────────────────
      case RequirementTypes.DATA_TYPE: {
        const dataType = (constraint && constraint.dataType) || "string";
        const baseNegativeTypes = getNegativeTypes(dataType);

        // EP: valid type (always, even in SMOKE)
        conditions.push(makeCondition(req, ++condCounter, "EP", "POSITIVE", subject,
          null, `Valid ${dataType} value for field '${subject}' should be accepted`, "valid"));

        // EP: invalid types (STANDARD+)
        if (mode !== GenerationModes.SMOKE) {
          for (const invalidType of baseNegativeTypes.slice(0, mode === GenerationModes.COMPREHENSIVE ? undefined : 3)) {
            conditions.push(makeCondition(req, ++condCounter, "EP", "NEGATIVE", subject,
              { operation: "CHANGE_TYPE", path: `$.${subject}`, value: invalidType.value, description: invalidType.desc },
              `Invalid ${invalidType.desc} for field '${subject}' should be rejected`, invalidType.desc));
          }
        }
        break;
      }

      // ─── REQUIRED FIELD ──────────────────────────────────────────
      case RequirementTypes.REQUIRED_FIELD: {
        // EP: field present (always)
        conditions.push(makeCondition(req, ++condCounter, "EP", "POSITIVE", subject,
          null, `Required field '${subject}' present with valid value should be accepted`, "present"));

        if (mode !== GenerationModes.SMOKE) {
          // EP: field missing
          conditions.push(makeCondition(req, ++condCounter, "EP", "NEGATIVE", subject,
            { operation: "REMOVE", path: `$.${subject}`, description: `Remove required field '${subject}'` },
            `Missing required field '${subject}' should be rejected`, "missing"));

          // EP: field empty
          conditions.push(makeCondition(req, ++condCounter, "EP", "NEGATIVE", subject,
            { operation: "SET_EMPTY", path: `$.${subject}`, description: `Set required field '${subject}' to empty` },
            `Empty required field '${subject}' should be rejected`, "empty"));

          // EP: field null (COMPREHENSIVE)
          if (mode === GenerationModes.COMPREHENSIVE) {
            conditions.push(makeCondition(req, ++condCounter, "EP", "NEGATIVE", subject,
              { operation: "SET_NULL", path: `$.${subject}`, description: `Set required field '${subject}' to null` },
              `Null value for required field '${subject}' should be rejected`, "null"));
          }
        }
        break;
      }

      // ─── RANGE CONSTRAINT ─────────────────────────────────────────
      case RequirementTypes.RANGE_CONSTRAINT: {
        const min = constraint && constraint.minimum;
        const max = constraint && constraint.maximum;

        if (min !== undefined || max !== undefined) {
          // BVA: if both bounds known
          const effectiveMin = min !== undefined ? min : 0;
          const effectiveMax = max !== undefined ? max : Number.MAX_SAFE_INTEGER;

          // Nominal value (always)
          const nominal = getNominal(effectiveMin, effectiveMax);
          conditions.push(makeCondition(req, ++condCounter, "BVA", "POSITIVE", subject,
            { operation: "REPLACE", path: `$.${subject}`, value: nominal, description: `Valid nominal value ${nominal}` },
            `Field '${subject}' with valid value ${nominal} (within range) should be accepted`, "nominal"));

          if (mode !== GenerationModes.SMOKE) {
            if (min !== undefined) {
              // min boundary
              conditions.push(makeCondition(req, ++condCounter, "BVA", "BOUNDARY", subject,
                { operation: "BOUNDARY_VALUE", path: `$.${subject}`, value: min, description: `Boundary: minimum value ${min}` },
                `Field '${subject}' at minimum value ${min} should be accepted`, "min"));
              // min - 1 (below minimum)
              conditions.push(makeCondition(req, ++condCounter, "BVA", "NEGATIVE", subject,
                { operation: "BOUNDARY_VALUE", path: `$.${subject}`, value: min - 1, description: `Below minimum: ${min - 1}` },
                `Field '${subject}' below minimum (${min - 1}) should be rejected`, "below_min"));
            }
            if (max !== undefined && max !== Number.MAX_SAFE_INTEGER) {
              // max boundary
              conditions.push(makeCondition(req, ++condCounter, "BVA", "BOUNDARY", subject,
                { operation: "BOUNDARY_VALUE", path: `$.${subject}`, value: max, description: `Boundary: maximum value ${max}` },
                `Field '${subject}' at maximum value ${max} should be accepted`, "max"));
              // max + 1 (above maximum)
              conditions.push(makeCondition(req, ++condCounter, "BVA", "NEGATIVE", subject,
                { operation: "BOUNDARY_VALUE", path: `$.${subject}`, value: max + 1, description: `Above maximum: ${max + 1}` },
                `Field '${subject}' above maximum (${max + 1}) should be rejected`, "above_max"));
            }
          }
        } else if (constraint && constraint.comparator && constraint.comparisonValue !== undefined) {
          // Single comparator like "> 0" or ">= 10000"
          const compVal = constraint.comparisonValue;
          const comp = constraint.comparator;

          conditions.push(makeCondition(req, ++condCounter, "BVA", "POSITIVE", subject,
            { operation: "REPLACE", path: `$.${subject}`, value: comp === ">" ? compVal + 1 : compVal, description: `Valid value for ${comp} ${compVal}` },
            `Field '${subject}' with value meeting ${comp} ${compVal} should be accepted`, "valid"));

          if (mode !== GenerationModes.SMOKE) {
            conditions.push(makeCondition(req, ++condCounter, "BVA", "NEGATIVE", subject,
              { operation: "BOUNDARY_VALUE", path: `$.${subject}`, value: comp === ">" ? compVal : compVal - 1, description: `Invalid: violates ${comp} ${compVal}` },
              `Field '${subject}' violating ${comp} ${compVal} should be rejected`, "invalid"));
          }
        } else {
          // Range mentioned but no explicit bounds — exploratory
          conditions.push(makeCondition(req, ++condCounter, "ERROR_GUESSING", "EDGE", subject,
            { operation: "REPLACE", path: `$.${subject}`, value: -1, description: "Exploratory: negative value" },
            `Field '${subject}' with negative value (-1) — behavior depends on requirements`, "negative_exploratory"));

          if (mode === GenerationModes.COMPREHENSIVE) {
            conditions.push(makeCondition(req, ++condCounter, "ERROR_GUESSING", "EDGE", subject,
              { operation: "REPLACE", path: `$.${subject}`, value: 999999999, description: "Exploratory: very large value" },
              `Field '${subject}' with very large value (999999999) — behavior depends on requirements`, "large_exploratory"));
          }
        }
        break;
      }

      // ─── FORMAT CONSTRAINT ────────────────────────────────────────
      case RequirementTypes.FORMAT_CONSTRAINT: {
        const format = constraint && constraint.format;
        const validExample = getFormatExample(format, true);
        const invalidExamples = getFormatExample(format, false);

        conditions.push(makeCondition(req, ++condCounter, "EP", "POSITIVE", subject,
          format ? { operation: "REPLACE", path: `$.${subject}`, value: validExample, description: `Valid ${format} format` } : null,
          `Field '${subject}' with valid ${format || "format"} should be accepted`, "valid_format"));

        if (mode !== GenerationModes.SMOKE) {
          for (const invalid of (Array.isArray(invalidExamples) ? invalidExamples : [invalidExamples]).slice(0, 2)) {
            conditions.push(makeCondition(req, ++condCounter, "EP", "NEGATIVE", subject,
              { operation: "INVALID_FORMAT", path: `$.${subject}`, value: invalid, description: `Invalid ${format || "format"}: ${String(invalid).slice(0, 30)}` },
              `Field '${subject}' with invalid ${format || "format"} value should be rejected`, "invalid_format"));
          }
        }
        break;
      }

      // ─── ENUM CONSTRAINT ─────────────────────────────────────────
      case RequirementTypes.ENUM_CONSTRAINT: {
        const validValues = constraint && constraint.enum;
        if (validValues && validValues.length > 0) {
          // EP: valid value
          conditions.push(makeCondition(req, ++condCounter, "EP", "POSITIVE", subject,
            { operation: "REPLACE", path: `$.${subject}`, value: validValues[0], description: `Valid enum value: ${validValues[0]}` },
            `Field '${subject}' with valid enum value '${validValues[0]}' should be accepted`, "valid_enum"));

          if (mode !== GenerationModes.SMOKE) {
            // EP: invalid value
            conditions.push(makeCondition(req, ++condCounter, "EP", "NEGATIVE", subject,
              { operation: "REPLACE", path: `$.${subject}`, value: "invalid_enum_value", description: "Invalid enum value" },
              `Field '${subject}' with an invalid enum value should be rejected`, "invalid_enum"));
          }
        }
        break;
      }

      // ─── LENGTH CONSTRAINT ────────────────────────────────────────
      case RequirementTypes.LENGTH_CONSTRAINT: {
        const minLen = constraint && constraint.minLength;
        const maxLen = constraint && constraint.maxLength;

        if (minLen !== undefined || maxLen !== undefined) {
          const effMin = minLen || 1;
          const effMax = maxLen || 255;
          const nominalStr = "x".repeat(Math.min(Math.max(effMin, Math.floor((effMin + effMax) / 2)), 100));

          conditions.push(makeCondition(req, ++condCounter, "BVA", "POSITIVE", subject,
            { operation: "REPLACE", path: `$.${subject}`, value: nominalStr, description: `Valid length ${nominalStr.length}` },
            `Field '${subject}' with valid length (${nominalStr.length} chars) should be accepted`, "valid_length"));

          if (mode !== GenerationModes.SMOKE) {
            if (minLen !== undefined && minLen > 1) {
              conditions.push(makeCondition(req, ++condCounter, "BVA", "BOUNDARY", subject,
                { operation: "BOUNDARY_VALUE", path: `$.${subject}`, value: "x".repeat(minLen), description: `Min length: ${minLen}` },
                `Field '${subject}' at minimum length ${minLen} should be accepted`, "min_length"));
              conditions.push(makeCondition(req, ++condCounter, "BVA", "NEGATIVE", subject,
                { operation: "BOUNDARY_VALUE", path: `$.${subject}`, value: "x".repeat(Math.max(0, minLen - 1)), description: `Below min length: ${minLen - 1}` },
                `Field '${subject}' below minimum length (${minLen - 1}) should be rejected`, "below_min_length"));
            }
            if (maxLen !== undefined) {
              conditions.push(makeCondition(req, ++condCounter, "BVA", "BOUNDARY", subject,
                { operation: "BOUNDARY_VALUE", path: `$.${subject}`, value: "x".repeat(maxLen), description: `Max length: ${maxLen}` },
                `Field '${subject}' at maximum length ${maxLen} should be accepted`, "max_length"));
              conditions.push(makeCondition(req, ++condCounter, "BVA", "NEGATIVE", subject,
                { operation: "BOUNDARY_VALUE", path: `$.${subject}`, value: "x".repeat(maxLen + 1), description: `Above max length: ${maxLen + 1}` },
                `Field '${subject}' above maximum length (${maxLen + 1}) should be rejected`, "above_max_length"));
            }
          }
        }
        break;
      }

      // ─── BUSINESS RULE ────────────────────────────────────────────
      case RequirementTypes.BUSINESS_RULE: {
        // Business rules typically need the LLM stage for complex coverage
        // For deterministic, generate a positive condition
        conditions.push(makeCondition(req, ++condCounter, "REQUIREMENT_BASED", "POSITIVE", subject,
          null, `Business rule: "${sourceText.slice(0, 80)}" should be enforced correctly`, "business_rule_positive"));

        if (mode !== GenerationModes.SMOKE) {
          conditions.push(makeCondition(req, ++condCounter, "REQUIREMENT_BASED", "EDGE", subject,
            null, `Business rule violation: "${sourceText.slice(0, 80)}" should not be allowed`, "business_rule_negative"));
        }
        break;
      }

      // ─── AUTHENTICATION ───────────────────────────────────────────
      case RequirementTypes.AUTHENTICATION: {
        conditions.push(makeCondition(req, ++condCounter, "EP", "POSITIVE", subject,
          null, `Request with valid authentication should be accepted`, "valid_auth"));

        if (mode !== GenerationModes.SMOKE) {
          conditions.push(makeCondition(req, ++condCounter, "EP", "SECURITY", subject,
            { operation: "REMOVE", path: "$.auth", description: "Remove authentication" },
            `Request without authentication should be rejected with 401`, "missing_auth"));
          conditions.push(makeCondition(req, ++condCounter, "EP", "SECURITY", subject,
            { operation: "REPLACE", path: "$.auth", value: "invalid-token", description: "Invalid authentication token" },
            `Request with invalid authentication token should be rejected with 401 or 403`, "invalid_auth"));
        }
        break;
      }

      // ─── API BEHAVIOR ─────────────────────────────────────────────
      case RequirementTypes.API_BEHAVIOR: {
        conditions.push(makeCondition(req, ++condCounter, "REQUIREMENT_BASED", "POSITIVE", subject,
          null, `API behavior: "${sourceText.slice(0, 80)}" should work as specified`, "api_positive"));
        break;
      }
    }
  }

  return conditions;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCondition(req, counter, technique, category, field, mutation, desc, partition) {
  return {
    conditionId: `COND-${String(counter).padStart(3, "0")}`,
    requirementId: req.requirementId,
    technique,
    category,
    field,
    mutation: mutation || undefined,
    expectedBehaviorDescription: desc,
    equivalencePartition: partition || undefined,
  };
}

function getNegativeTypes(dataType) {
  const types = {
    string: [
      { value: 12345, desc: "number instead of string" },
      { value: true, desc: "boolean instead of string" },
      { value: [], desc: "array instead of string" },
      { value: {}, desc: "object instead of string" },
      { value: null, desc: "null instead of string" },
    ],
    number: [
      { value: "not-a-number", desc: "string instead of number" },
      { value: true, desc: "boolean instead of number" },
      { value: [], desc: "array instead of number" },
      { value: {}, desc: "object instead of number" },
      { value: null, desc: "null instead of number" },
    ],
    integer: [
      { value: "not-an-integer", desc: "string instead of integer" },
      { value: 10.5, desc: "decimal instead of integer" },
      { value: true, desc: "boolean instead of integer" },
      { value: [], desc: "array instead of integer" },
      { value: null, desc: "null instead of integer" },
    ],
    boolean: [
      { value: "not-a-boolean", desc: "string instead of boolean" },
      { value: 1, desc: "number instead of boolean" },
      { value: [], desc: "array instead of boolean" },
      { value: null, desc: "null instead of boolean" },
    ],
    array: [
      { value: "not-an-array", desc: "string instead of array" },
      { value: 1, desc: "number instead of array" },
      { value: {}, desc: "object instead of array" },
      { value: null, desc: "null instead of array" },
    ],
    object: [
      { value: "not-an-object", desc: "string instead of object" },
      { value: 1, desc: "number instead of object" },
      { value: [], desc: "array instead of object" },
      { value: null, desc: "null instead of object" },
    ],
  };
  return types[dataType] || types.string;
}

function getNominal(min, max) {
  if (min === max) return min;
  if (max === Number.MAX_SAFE_INTEGER || max === undefined) return min + 1;
  const mid = Math.floor((min + max) / 2);
  return mid > min ? mid : min + 1;
}

function getFormatExample(format, isValid) {
  const examples = {
    email: { valid: "qa.user@example.com", invalid: ["invalid-email", "user@", "@domain.com", ""] },
    date: { valid: "2026-07-19", invalid: ["not-a-date", "19-07-2026", "07/19/26", ""] },
    phone: { valid: "+1-555-123-4567", invalid: ["123", "not-a-phone", "", "abc-def-ghij"] },
    zip: { valid: "12345", invalid: ["not-a-zip", "123", "123456789", ""] },
    postal: { valid: "12345-6789", invalid: ["not-postal", "12", ""] },
    url: { valid: "https://example.com", invalid: ["not-a-url", "ftp://bad", ""] },
    uri: { valid: "/api/resource/123", invalid: ["not a uri", "", " "] },
    uuid: { valid: "123e4567-e89b-12d3-a456-426614174000", invalid: ["not-a-uuid", "12345", ""] },
    guid: { valid: "123e4567-e89b-12d3-a456-426614174000", invalid: ["not-a-guid", ""] },
    ip: { valid: "192.168.1.1", invalid: ["not-an-ip", "999.999.999.999", ""] },
  };

  if (!format || !examples[format]) {
    return isValid ? "valid-value" : ["invalid-value"];
  }

  return isValid ? examples[format].valid : examples[format].invalid;
}

module.exports = { generateConditions };

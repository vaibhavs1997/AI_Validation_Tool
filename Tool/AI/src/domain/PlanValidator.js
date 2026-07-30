/**
 * PlanValidator
 *
 * Validates ExecutionPlan structure, operation references, dependencies,
 * and detects circular dependencies and duplicate step IDs.
 */

const { createExecutionStep } = require('./ExecutionStep');

/**
 * @param {object} plan
 * @param {Array<object>} availableOperations - List of available API operations from catalog
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }>, warnings: Array<{ field: string, message: string }> }}
 */
function validatePlan(plan, availableOperations = []) {
  const errors = [];
  const warnings = [];

  if (!plan) {
    return {
      valid: false,
      errors: [{ field: 'plan', message: 'Plan is required.' }],
      warnings: [],
    };
  }

  // Check steps exist
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    errors.push({ field: 'steps', message: 'Plan must have at least one step.' });
  }

  // Check execution order
  const validOrders = ['sequential', 'parallel'];
  if (!plan.executionOrder || !validOrders.includes(plan.executionOrder)) {
    errors.push({ field: 'executionOrder', message: 'Execution order must be sequential or parallel.' });
  }

  // Validate individual steps
  const stepIds = new Set();
  const operationMap = new Map();

  // Build map of available operations for validation
  for (const op of availableOperations) {
    if (op.serviceId && op.operationId) {
      const key = `${op.serviceId}:${op.operationId}`;
      operationMap.set(key, op);
    }
  }

  for (const step of plan.steps) {
    // Validate step structure
    const stepValidation = createExecutionStep(step);
    if (!stepValidation) {
      errors.push({ field: 'steps', message: `Invalid step structure: ${step.title || 'untitled'}` });
      continue;
    }

    // Check for duplicate step IDs
    if (stepIds.has(step.id)) {
      errors.push({ field: 'steps', message: `Duplicate step ID: ${step.id}` });
    }
    stepIds.add(step.id);

    // Check operation reference exists in catalog
    if (step.operationRef) {
      const opKey = `${step.operationRef.serviceId}:${step.operationRef.operationId}`;
      if (!operationMap.has(opKey)) {
        warnings.push({
          field: 'steps',
          message: `Operation ${opKey} not found in API catalog. Step: ${step.title || step.id}`,
        });
      }
    }

    // Check dependencies exist
    for (const depId of step.dependencies || []) {
      if (!stepIds.has(depId) && !plan.steps.some(s => s.id === depId)) {
        errors.push({
          field: 'steps',
          message: `Step ${step.id} depends on non-existent step ${depId}.`,
        });
      }
    }

    // Check variables produced are referenced somewhere
    if (step.variablesProduced && step.variablesProduced.length > 0) {
      const referenced = plan.steps.some(s => s.variablesRequired && s.variablesRequired.some(v => step.variablesProduced.includes(v)));
      if (!referenced) {
        warnings.push({
          field: 'steps',
          message: `Step ${step.id} produces variables [${step.variablesProduced.join(', ')}] that are not used by any subsequent step.`,
        });
      }
    }

    // Check variables required are produced somewhere
    for (const varName of step.variablesRequired || []) {
      const produced = plan.steps.some(s => s.variablesProduced && s.variablesProduced.includes(varName));
      if (!produced) {
        warnings.push({
          field: 'steps',
          message: `Step ${step.id} requires variable "${varName}" which is not produced by any step.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detect circular dependencies using DFS.
 * @param {Array<object>} steps
 * @returns {{ hasCycle: boolean, cycles: Array<Array<string>> }}
 */
function detectCircularDependencies(steps) {
  if (!Array.isArray(steps)) {
    return { hasCycle: false, cycles: [] };
  }

  const stepMap = new Map(steps.map(s => [s.id, s]));
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(stepId, path) {
    if (recursionStack.has(stepId)) {
      // Found cycle
      const cycleStart = path.indexOf(stepId);
      cycles.push(path.slice(cycleStart).concat(stepId));
      return true;
    }

    if (visited.has(stepId)) {
      return false;
    }

    visited.add(stepId);
    recursionStack.add(stepId);
    path.push(stepId);

    const step = stepMap.get(stepId);
    if (step && Array.isArray(step.dependencies)) {
      for (const depId of step.dependencies) {
        if (stepMap.has(depId)) {
          dfs(depId, [...path]);
        }
      }
    }

    recursionStack.delete(stepId);
    return false;
  }

  for (const step of steps) {
    if (!visited.has(step.id)) {
      dfs(step.id, []);
    }
  }

  return {
    hasCycle: cycles.length > 0,
    cycles,
  };
}

module.exports = {
  validatePlan,
  detectCircularDependencies,
};
/**
 * DependencyResolver
 *
 * Resolves execution order and detects blocked steps.
 * Uses topological sort for dependency resolution.
 */

/**
 * Build dependency map from steps.
 * @param {Array<object>} steps
 * @returns {Map<string, string[]>}
 */
function buildDependencyMap(steps) {
  const map = new Map();
  for (const step of steps) {
    map.set(step.id, Array.isArray(step.dependencies) ? step.dependencies : []);
  }
  return map;
}

/**
 * Resolve execution order using topological sort (Kahn's algorithm).
 * @param {Array<object>} steps
 * @returns {{ order: string[], hasCycle: boolean, cycles: Array<Array<string>> }}
 */
function resolveExecutionOrder(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { order: [], hasCycle: false, cycles: [] };
  }

  const depMap = buildDependencyMap(steps);
  const inDegree = new Map();
  const queue = [];
  const order = [];

  // Initialize in-degree for each step
  for (const step of steps) {
    const deps = depMap.get(step.id) || [];
    inDegree.set(step.id, deps.length);
    if (deps.length === 0) {
      queue.push(step.id);
    }
  }

  // Process queue
  while (queue.length > 0) {
    const current = queue.shift();
    order.push(current);

    // Find steps that depend on current
    for (const [stepId, deps] of depMap.entries()) {
      if (deps.includes(current)) {
        const newInDegree = inDegree.get(stepId) - 1;
        inDegree.set(stepId, newInDegree);
        if (newInDegree === 0) {
          queue.push(stepId);
        }
      }
    }
  }

  // Check for cycles
  const hasCycle = order.length !== steps.length;
  const cycles = hasCycle ? detectCycles(depMap) : [];

  return { order, hasCycle, cycles };
}

/**
 * Detect cycles using DFS.
 * @param {Map<string, string[]>} depMap
 * @returns {Array<Array<string>>}
 */
function detectCycles(depMap) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();

  function dfs(stepId, path) {
    if (recursionStack.has(stepId)) {
      const cycleStart = path.indexOf(stepId);
      cycles.push(path.slice(cycleStart).concat(stepId));
      return;
    }

    if (visited.has(stepId)) {
      return;
    }

    visited.add(stepId);
    recursionStack.add(stepId);
    path.push(stepId);

    const deps = depMap.get(stepId) || [];
    for (const depId of deps) {
      if (depMap.has(depId)) {
        dfs(depId, [...path]);
      }
    }

    recursionStack.delete(stepId);
  }

  for (const stepId of depMap.keys()) {
    if (!visited.has(stepId)) {
      dfs(stepId, []);
    }
  }

  return cycles;
}

/**
 * Validate dependencies for errors and cycles.
 * @param {Array<object>} steps
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }>, cycles: Array<Array<string>> }}
 */
function validateDependencies(steps) {
  const errors = [];
  const stepIds = new Set(steps.map(s => s.id));

  // Check for missing dependencies
  for (const step of steps) {
    for (const depId of step.dependencies || []) {
      if (!stepIds.has(depId)) {
        errors.push({
          field: 'dependencies',
          message: `Step ${step.id} depends on non-existent step ${depId}.`,
        });
      }
    }
  }

  // Detect cycles
  const depMap = buildDependencyMap(steps);
  const { hasCycle, cycles } = resolveExecutionOrder(steps);

  if (hasCycle) {
    errors.push({
      field: 'dependencies',
      message: `Circular dependency detected: ${cycles.map(c => c.join(' → ')).join('; ')}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    cycles,
  };
}

/**
 * Identify blocked steps based on failed dependencies.
 * @param {Array<object>} steps - Steps with status
 * @returns {Set<string>} Set of blocked step IDs
 */
function identifyBlockedSteps(steps) {
  const blocked = new Set();
  const statusMap = new Map(steps.map(s => [s.id, s.status]));

  for (const step of steps) {
    if (step.status === 'failed' || step.status === 'blocked' || step.status === 'cancelled') {
      // Mark dependent steps as blocked
      markDependentsAsBlocked(step.id, steps, blocked, statusMap);
    }
  }

  return blocked;
}

/**
 * Recursively mark dependent steps as blocked.
 * @param {string} failedStepId
 * @param {Array<object>} steps
 * @param {Set<string>} blocked
 * @param {Map<string, string>} statusMap
 */
function markDependentsAsBlocked(failedStepId, steps, blocked, statusMap) {
  for (const step of steps) {
    if (step.dependencies.includes(failedStepId) && !blocked.has(step.id)) {
      const currentStatus = statusMap.get(step.id);
      if (currentStatus === 'pending' || currentStatus === 'ready') {
        blocked.add(step.id);
      }
      // Recurse to mark transitive dependents
      markDependentsAsBlocked(step.id, steps, blocked, statusMap);
    }
  }
}

module.exports = {
  resolveExecutionOrder,
  validateDependencies,
  identifyBlockedSteps,
  buildDependencyMap,
};
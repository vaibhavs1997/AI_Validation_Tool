/**
 * ExecutionPlan
 *
 * Deterministic execution plan combining dependency ordering and runtime data mappings.
 */

const { resolveDependencies } = require('./DependencyResolver');

const STEP_STATUS = Object.freeze(['pending', 'ready', 'completed', 'failed']);

function buildExecutionPlan({ targetServiceId, targetOperationId, services = [], apiModels = [], relationships = [] }) {
  const dependencyResult = resolveDependencies({ targetServiceId, targetOperationId, services, apiModels, relationships });

  const errors = [...dependencyResult.errors];

  const steps = dependencyResult.sequence.map((op, index) => {
    const key = `${op.serviceId}::${op.operationId}`;
    const incomingMappings = dependencyResult.mappings.filter((m) => `${m.to.serviceId}::${m.to.operationId}` === key);

    const prereqs = incomingMappings.map((m) => ({
      serviceId: m.from.serviceId,
      operationId: m.from.operationId,
    }));

    return {
      order: index,
      operation: op,
      prerequisites: prereqs,
      bindings: incomingMappings.map((m) => ({
        type: m.relationship.type,
        source: m.from.location,
        target: m.to.location,
        transform: m.relationship.transform,
      })),
      status: STEP_STATUS[0],
    };
  });

  const firstStep = steps.find((s) => !s.prerequisites.length);
  if (firstStep) firstStep.status = STEP_STATUS[1]; // ready

  return {
    target: dependencyResult.target,
    steps,
    errors,
    isValid: errors.length === 0,
  };
}

function validatePlan(plan) {
  if (!plan || !plan.steps) return false;
  for (const step of plan.steps) {
    if (!step.operation || !step.operation.serviceId || !step.operation.operationId) {
      return false;
    }
  }
  return true;
}

module.exports = {
  buildExecutionPlan,
  validatePlan,
  STEP_STATUS,
};
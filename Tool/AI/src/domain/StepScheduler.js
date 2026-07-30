/**
 * StepScheduler
 *
 * Schedules steps for execution based on dependencies and state.
 * Determines execution order and handles blocked/skipped steps.
 */

const { identifyBlockedSteps } = require('./DependencyResolver');

/**
 * Create a new StepScheduler.
 * @param {object} options
 * @param {boolean} options.continueOnFailure - Continue execution on step failure
 * @returns {object}
 */
function createStepScheduler(options = {}) {
  const continueOnFailure = options.continueOnFailure ?? false;

  return {
    continueOnFailure,
    executionOrder: [],
    blockedSteps: new Set(),
    skippedSteps: new Set(),
    failedSteps: new Set(),
  };
}

/**
 * Schedule steps based on dependencies and state tracker.
 * @param {object} scheduler - StepScheduler instance
 * @param {Array<object>} steps - Execution steps
 * @param {object} stateTracker - ExecutionStateTracker instance
 * @returns {{ order: string[], blocked: string[], skipped: string[] }}
 */
function scheduleSteps(scheduler, steps, stateTracker) {
  scheduler.executionOrder = [];
  scheduler.blockedSteps.clear();
  scheduler.skippedSteps.clear();
  scheduler.failedSteps.clear();

  // Get blocked steps from state tracker
  const blockedStepIds = new Set();
  for (const [stepId, status] of stateTracker.stepStatuses.entries()) {
    if (status === 'blocked') {
      blockedStepIds.add(stepId);
      scheduler.blockedSteps.add(stepId);
    }
    if (status === 'skipped') {
      scheduler.skippedSteps.add(stepId);
    }
    if (status === 'failed') {
      scheduler.failedSteps.add(stepId);
    }
  }

  // Build execution order
  for (const step of steps) {
    const stepStatus = stateTracker.stepStatuses.get(step.id);

    // Skip if already executed
    if (stepStatus === 'passed' || stepStatus === 'failed' || stepStatus === 'skipped') {
      continue;
    }

    // Skip if blocked
    if (blockedStepIds.has(step.id)) {
      scheduler.blockedSteps.add(step.id);
      continue;
    }

    // Skip if dependency failed
    if (!scheduler.continueOnFailure) {
      const hasFailedDependency = step.dependencies?.some(depId => scheduler.failedSteps.has(depId));
      if (hasFailedDependency) {
        scheduler.skippedSteps.add(step.id);
        continue;
      }
    }

    scheduler.executionOrder.push(step.id);
  }

  return {
    order: scheduler.executionOrder,
    blocked: Array.from(scheduler.blockedSteps),
    skipped: Array.from(scheduler.skippedSteps),
  };
}

/**
 * Check if a step should be executed.
 * @param {object} scheduler - StepScheduler instance
 * @param {object} stateTracker - ExecutionStateTracker instance
 * @param {string} stepId - Step ID
 * @returns {boolean}
 */
function shouldExecute(scheduler, stateTracker, stepId) {
  const stepStatus = stateTracker.stepStatuses.get(stepId);

  // Already executed
  if (stepStatus === 'passed' || stepStatus === 'failed') {
    return false;
  }

  // Blocked
  if (scheduler.blockedSteps.has(stepId)) {
    return false;
  }

  // Skipped
  if (scheduler.skippedSteps.has(stepId)) {
    return false;
  }

  // Dependency failed and continueOnFailure is false
  if (!scheduler.continueOnFailure && scheduler.failedSteps.has(stepId)) {
    return false;
  }

  return true;
}

/**
 * Mark a step as failed.
 * @param {object} scheduler - StepScheduler instance
 * @param {string} stepId - Step ID
 */
function markFailed(scheduler, stepId) {
  scheduler.failedSteps.add(stepId);
}

/**
 * Mark a step as blocked.
 * @param {object} scheduler - StepScheduler instance
 * @param {string} stepId - Step ID
 */
function markBlocked(scheduler, stepId) {
  scheduler.blockedSteps.add(stepId);
}

/**
 * Mark a step as skipped.
 * @param {object} scheduler - StepScheduler instance
 * @param {string} stepId - Step ID
 */
function markSkipped(scheduler, stepId) {
  scheduler.skippedSteps.add(stepId);
}

/**
 * Reset the scheduler.
 * @param {object} scheduler - StepScheduler instance
 */
function reset(scheduler) {
  scheduler.executionOrder = [];
  scheduler.blockedSteps.clear();
  scheduler.skippedSteps.clear();
  scheduler.failedSteps.clear();
}

module.exports = {
  createStepScheduler,
  scheduleSteps,
  shouldExecute,
  markFailed,
  markBlocked,
  markSkipped,
  reset,
};
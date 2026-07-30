/**
 * ExecutionStateTracker
 *
 * Tracks the state of execution runs and steps.
 * Emits events for state changes.
 */

const { createExecutionEvent } = require('./ExecutionEvent');

const VALID_RUN_STATUSES = Object.freeze(['pending', 'running', 'completed', 'failed', 'cancelled']);
const VALID_STEP_STATUSES = Object.freeze(['pending', 'running', 'passed', 'failed', 'blocked', 'skipped', 'cancelled']);

/**
 * Create a new state tracker.
 * @param {object} options
 * @param {boolean} options.continueOnFailure - Continue execution on step failure
 * @returns {object}
 */
function createExecutionStateTracker(options = {}) {
  const continueOnFailure = options.continueOnFailure ?? false;

  return {
    continueOnFailure,
    runStatus: 'pending',
    stepStatuses: new Map(),
    events: [],
    startedAt: null,
    completedAt: null,
  };
}

/**
 * Start tracking a run.
 * @param {object} tracker - StateTracker instance
 * @param {string} runId - Run ID
 */
function startRun(tracker, runId) {
  tracker.runStatus = 'running';
  tracker.startedAt = new Date();
  tracker.events.push(createExecutionEvent({
    runId,
    type: 'run.started',
    severity: 'info',
    message: `Run ${runId} started`,
  }));
}

/**
 * Complete a run.
 * @param {object} tracker - StateTracker instance
 * @param {string} runId - Run ID
 * @param {boolean} success - Whether the run succeeded
 */
function completeRun(tracker, runId, success = true) {
  tracker.runStatus = success ? 'completed' : 'failed';
  tracker.completedAt = new Date();
  tracker.events.push(createExecutionEvent({
    runId,
    type: success ? 'run.completed' : 'run.failed',
    severity: success ? 'info' : 'error',
    message: `Run ${runId} ${success ? 'completed' : 'failed'}`,
  }));
}

/**
 * Cancel a run.
 * @param {object} tracker - StateTracker instance
 * @param {string} runId - Run ID
 */
function cancelRun(tracker, runId) {
  tracker.runStatus = 'cancelled';
  tracker.completedAt = new Date();
  tracker.events.push(createExecutionEvent({
    runId,
    type: 'run.cancelled',
    severity: 'warning',
    message: `Run ${runId} was cancelled`,
  }));
}

/**
 * Start tracking a step.
 * @param {object} tracker - StateTracker instance
 * @param {string} runId - Run ID
 * @param {string} stepId - Step ID
 */
function startStep(tracker, runId, stepId) {
  tracker.stepStatuses.set(stepId, 'running');
  tracker.events.push(createExecutionEvent({
    runId,
    stepId,
    type: 'step.started',
    severity: 'info',
    message: `Step ${stepId} started`,
  }));
}

/**
 * Complete a step.
 * @param {object} tracker - StateTracker instance
 * @param {string} runId - Run ID
 * @param {string} stepId - Step ID
 * @param {boolean} success - Whether the step succeeded
 * @param {object} result - ExecutionResult
 */
function completeStep(tracker, runId, stepId, success = true, result = null) {
  const status = success ? 'passed' : 'failed';
  tracker.stepStatuses.set(stepId, status);
  tracker.events.push(createExecutionEvent({
    runId,
    stepId,
    type: success ? 'step.completed' : 'step.failed',
    severity: success ? 'info' : 'error',
    message: `Step ${stepId} ${status}`,
    data: result ? { statusCode: result.statusCode, error: result.error } : undefined,
  }));
}

/**
 * Skip a step.
 * @param {object} tracker - StateTracker instance
 * @param {string} runId - Run ID
 * @param {string} stepId - Step ID
 * @param {string} reason - Reason for skipping
 */
function skipStep(tracker, runId, stepId, reason = 'Blocked by dependency') {
  tracker.stepStatuses.set(stepId, 'skipped');
  tracker.events.push(createExecutionEvent({
    runId,
    stepId,
    type: 'step.skipped',
    severity: 'warning',
    message: `Step ${stepId} skipped: ${reason}`,
  }));
}

/**
 * Block a step.
 * @param {object} tracker - StateTracker instance
 * @param {string} runId - Run ID
 * @param {string} stepId - Step ID
 * @param {string} reason - Reason for blocking
 */
function blockStep(tracker, runId, stepId, reason = 'Dependency failed') {
  tracker.stepStatuses.set(stepId, 'blocked');
  tracker.events.push(createExecutionEvent({
    runId,
    stepId,
    type: 'step.blocked',
    severity: 'warning',
    message: `Step ${stepId} blocked: ${reason}`,
  }));
}

/**
 * Get step status.
 * @param {object} tracker - StateTracker instance
 * @param {string} stepId - Step ID
 * @returns {string|undefined}
 */
function getStepStatus(tracker, stepId) {
  return tracker.stepStatuses.get(stepId);
}

/**
 * Check if a step should be executed.
 * @param {object} tracker - StateTracker instance
 * @param {string} stepId - Step ID
 * @returns {boolean}
 */
function shouldExecuteStep(tracker, stepId) {
  const status = tracker.stepStatuses.get(stepId);
  return !status || status === 'pending';
}

/**
 * Get all events.
 * @param {object} tracker - StateTracker instance
 * @returns {Array<object>}
 */
function getEvents(tracker) {
  return tracker.events;
}

/**
 * Get events filtered by run ID.
 * @param {object} tracker - StateTracker instance
 * @param {string} runId - Run ID
 * @returns {Array<object>}
 */
function getEventsByRunId(tracker, runId) {
  return tracker.events.filter(event => event.runId === runId);
}

module.exports = {
  createExecutionStateTracker,
  startRun,
  completeRun,
  cancelRun,
  startStep,
  completeStep,
  skipStep,
  blockStep,
  getStepStatus,
  shouldExecuteStep,
  getEvents,
  getEventsByRunId,
  VALID_RUN_STATUSES,
  VALID_STEP_STATUSES,
};
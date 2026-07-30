/**
 * ExecutionEvent
 *
 * Domain model for execution events.
 * Represents discrete events that occur during execution (start, stop, error, etc.).
 */

const VALID_EVENT_TYPES = Object.freeze([
  'info',
  'run.started',
  'run.completed',
  'run.failed',
  'run.cancelled',
  'step.started',
  'step.completed',
  'step.failed',
  'step.blocked',
  'step.skipped',
  'plan.built',
  'plan.rebuilt',
  'variable.extracted',
  'authentication.required',
  'error.thrown',
  'warning.raised',
]);

const VALID_SEVERITIES = Object.freeze(['info', 'warning', 'error', 'debug']);

/**
 * @param {{
 *   id?: string,
 *   runId?: string,
 *   stepId?: string,
 *   type?: string,
 *   severity?: string,
 *   message?: string,
 *   data?: Record<string, any>,
 *   timestamp?: Date|string,
 * }} input
 * @returns {{
 *   id: string,
 *   runId: string|null,
 *   stepId: string|null,
 *   type: string,
 *   severity: string,
 *   message: string,
 *   data: Record<string, any>,
 *   timestamp: Date,
 *   createdAt: Date,
 * }}
 */
function createExecutionEvent(input = {}) {
  const id = input.id || `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const type = String(input.type || 'info').toLowerCase();
  if (!VALID_EVENT_TYPES.includes(type)) {
    throw new Error(`ExecutionEvent type must be one of: ${VALID_EVENT_TYPES.join(', ')}`);
  }

  const severity = String(input.severity || 'info').toLowerCase();
  if (!VALID_SEVERITIES.includes(severity)) {
    throw new Error(`ExecutionEvent severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  return {
    id,
    runId: input.runId || null,
    stepId: input.stepId || null,
    type,
    severity,
    message: input.message ? String(input.message) : '',
    data: input.data && typeof input.data === 'object' ? { ...input.data } : {},
    timestamp: input.timestamp ? new Date(input.timestamp) : now,
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
  };
}

/**
 * Create a batch of events from an array.
 * @param {Array<object>} eventsInput
 * @returns {Array<ReturnType<typeof createExecutionEvent>>}
 */
function createExecutionEvents(eventsInput = []) {
  if (!Array.isArray(eventsInput)) {
    throw new Error('ExecutionEvents input must be an array.');
  }

  return eventsInput.map(event => createExecutionEvent(event));
}

/**
 * Validate that an event has all required fields.
 * @param {object} event
 * @returns {{ valid: boolean, checks: Array<{ field: string, passed: boolean, message: string }> }}
 */
function validateEvent(event) {
  if (!event) {
    return {
      valid: false,
      checks: [
        { field: 'type', passed: false, message: 'Event must have a type.' },
        { field: 'message', passed: false, message: 'Event must have a message.' },
      ],
    };
  }

  const checks = [
    {
      field: 'type',
      passed: VALID_EVENT_TYPES.includes(event.type),
      message: 'Event type must be a valid event type.',
    },
    {
      field: 'severity',
      passed: VALID_SEVERITIES.includes(event.severity),
      message: 'Event severity must be a valid severity level.',
    },
    {
      field: 'message',
      passed: Boolean(event.message && event.message.trim().length > 0),
      message: 'Event must have a non-empty message.',
    },
    {
      field: 'timestamp',
      passed: event.timestamp instanceof Date || (typeof event.timestamp === 'string' && !isNaN(Date.parse(event.timestamp))),
      message: 'Event must have a valid timestamp.',
    },
  ];

  const allPassed = checks.every((c) => c.passed);
  const somePassed = checks.some((c) => c.passed);

  return {
    valid: allPassed,
    checks,
    overall: allPassed ? 'valid' : somePassed ? 'partial' : 'invalid',
  };
}

/**
 * Filter events by run ID.
 * @param {Array<object>} events
 * @param {string} runId
 * @returns {Array<object>}
 */
function filterEventsByRunId(events, runId) {
  if (!Array.isArray(events) || !runId) return [];
  return events.filter(event => event.runId === runId);
}

/**
 * Filter events by step ID.
 * @param {Array<object>} events
 * @param {string} stepId
 * @returns {Array<object>}
 */
function filterEventsByStepId(events, stepId) {
  if (!Array.isArray(events) || !stepId) return [];
  return events.filter(event => event.stepId === stepId);
}

/**
 * Filter events by type.
 * @param {Array<object>} events
 * @param {string} type
 * @returns {Array<object>}
 */
function filterEventsByType(events, type) {
  if (!Array.isArray(events) || !type) return [];
  return events.filter(event => event.type === type);
}

/**
 * Filter events by severity.
 * @param {Array<object>} events
 * @param {string} severity
 * @returns {Array<object>}
 */
function filterEventsBySeverity(events, severity) {
  if (!Array.isArray(events) || !severity) return [];
  return events.filter(event => event.severity === severity);
}

module.exports = {
  createExecutionEvent,
  createExecutionEvents,
  validateEvent,
  filterEventsByRunId,
  filterEventsByStepId,
  filterEventsByType,
  filterEventsBySeverity,
  VALID_EVENT_TYPES,
  VALID_SEVERITIES,
};
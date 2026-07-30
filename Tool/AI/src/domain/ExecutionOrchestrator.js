/**
 * ExecutionOrchestrator
 *
 * Orchestrates the complete execution of an ExecutionRun.
 * Coordinates pipeline, scheduling, execution, and result collection.
 */

const { executePipeline } = require('./ExecutionPipeline');
const { getExecutor } = require('./RequestExecutor');
const { parseResponse, extractVariables } = require('./ResponseParser');
const { createResultCollector, addResult, finalize, getExecutionSummary } = require('./ResultCollector');
const { createExecutionStateTracker, startRun, completeRun, cancelRun, startStep, completeStep, skipStep, blockStep } = require('./ExecutionStateTracker');
const { createStepScheduler, scheduleSteps, markFailed, markBlocked, markSkipped } = require('./StepScheduler');

/**
 * Execute a complete ExecutionRun.
 * @param {object} run - ExecutionRun
 * @param {object} context - ExecutionContext
 * @param {Array<object>} availableOperations - Available API operations
 * @param {object} options - Execution options
 * @param {boolean} options.continueOnFailure - Continue execution on step failure
 * @param {boolean} options.dryRun - Dry run mode
 * @returns {{ success: boolean, summary: object, collector: object, tracker: object }}
 */
async function executeRun(run, context, availableOperations = [], options = {}) {
  const continueOnFailure = options.continueOnFailure ?? false;
  const dryRun = options.dryRun ?? context.environment?.dryRun ?? false;

  // Initialize components
  const collector = createResultCollector({ continueOnFailure });
  const tracker = createExecutionStateTracker({ continueOnFailure });
  const scheduler = createStepScheduler({ continueOnFailure });

  collector.startedAt = new Date();
  let hasFailure = false;

  try {
    // Start run
    startRun(tracker, run.id);

    // Step 1: Execute pipeline to get resolved steps
    const pipelineResult = executePipeline(run, context, availableOperations);

    if (pipelineResult.errors.length > 0 && !continueOnFailure) {
      // Pipeline validation failed
      hasFailure = true;
      completeRun(tracker, run.id, false);
      finalize(collector);
      return {
        success: false,
        summary: getExecutionSummary(collector),
        collector,
        tracker,
        errors: pipelineResult.errors,
      };
    }

    const resolvedSteps = pipelineResult.resolvedSteps;

    // Step 2: Schedule steps
    const schedule = scheduleSteps(scheduler, resolvedSteps, tracker);

    // Mark blocked and skipped steps
    for (const stepId of schedule.blocked) {
      blockStep(tracker, run.id, stepId, 'Dependency failed');
      markBlocked(scheduler, stepId);
    }
    for (const stepId of schedule.skipped) {
      skipStep(tracker, run.id, stepId, 'Dependency failed');
      markSkipped(scheduler, stepId);
    }

    // Step 3: Execute steps
    for (const stepId of schedule.order) {
      const step = resolvedSteps.find(s => s.id === stepId);
      if (!step) {
        continue;
      }

      // Check if step should be executed
      if (!shouldExecute(scheduler, tracker, stepId)) {
        continue;
      }

      // Start step
      startStep(tracker, run.id, stepId);

      try {
        // Get executor
        const executor = getExecutor(step);

        // Execute step
        const result = await executor.execute(step, context, { dryRun, timeout: context.environment?.timeout, retries: context.environment?.retries });

        // Parse response
        const parsedResult = parseResponse({
          stepId: step.id,
          runId: run.id,
          statusCode: result.statusCode,
          body: result.body || result.responseBody,
          headers: result.headers || {},
          durationMs: result.durationMs,
          error: result.error,
          logs: result.logs || [],
        });

        // Extract variables
        const variableDefinitions = step.variablesProduced?.map(name => ({ name, extractFrom: 'response.body', path: name })) || [];
        const variablesExtracted = extractVariables(parsedResult, variableDefinitions);

        // Add variables to result
        parsedResult.variablesExtracted = variablesExtracted;

        // Evaluate assertions if present
        if (step.assertions && step.assertions.length > 0) {
          parsedResult.assertions = parseResponse.evaluateAssertions(parsedResult, step.assertions);
        }

        // Determine success
        const success = parsedResult.statusCode >= 200 && parsedResult.statusCode < 300 && !parsedResult.error;

        // Complete step
        completeStep(tracker, run.id, stepId, success, parsedResult);

        // Add to collector
        addResult(collector, step, parsedResult, variableDefinitions);

        // Handle failure
        if (!success) {
          hasFailure = true;

          if (!continueOnFailure) {
            // Stop execution
            break;
          }
        }

      } catch (error) {
        // Step execution failed
        completeStep(tracker, run.id, stepId, false, { error: error.message });
        markFailed(scheduler, stepId);
        hasFailure = true;

        if (!continueOnFailure) {
          break;
        }
      }
    }

    // Complete run
    const runSuccess = !hasFailure || continueOnFailure;
    completeRun(tracker, run.id, runSuccess);

  } catch (error) {
    // Run failed
    completeRun(tracker, run.id, false);
    collector.errors.push({
      stepId: null,
      message: error.message,
      timestamp: new Date(),
    });
  } finally {
    finalize(collector);
  }

  return {
    success: !hasFailure,
    summary: getExecutionSummary(collector),
    collector,
    tracker,
  };
}

/**
 * Cancel a running execution.
 * @param {object} tracker - ExecutionStateTracker instance
 * @param {string} runId - Run ID
 */
function cancelExecution(tracker, runId) {
  cancelRun(tracker, runId);
}

module.exports = {
  executeRun,
  cancelExecution,
};
/**
 * ExecutionPipeline
 *
 * Orchestrates the execution pipeline:
 * 1. Validates plan
 * 2. Resolves dependencies
 * 3. Resolves variables
 * 4. Resolves authentication
 * 5. Builds resolved steps
 */

const { validatePlan, detectCircularDependencies } = require('./PlanValidator');
const { resolveExecutionOrder, identifyBlockedSteps } = require('./DependencyResolver');
const { resolveVariables, validateVariables, getMissingVariables } = require('./VariableResolver');
const { resolveAuthentication } = require('./AuthenticationResolver');
const { createExecutionStep } = require('./ExecutionStep');

/**
 * Execute the pipeline on an ExecutionRun.
 * @param {object} run - ExecutionRun
 * @param {object} context - ExecutionContext
 * @param {Array<object>} availableOperations - Available API operations
 * @returns {{ resolvedSteps: Array<object>, errors: Array<{ field: string, message: string }>, warnings: Array<{ field: string, message: string }>, blockedSteps: Array<string> }}
 */
function executePipeline(run, context, availableOperations = []) {
  const errors = [];
  const warnings = [];
  const blockedSteps = [];

  if (!run || !run.plan) {
    return {
      resolvedSteps: [],
      errors: [{ field: 'plan', message: 'Run must have a plan.' }],
      warnings: [],
      blockedSteps: [],
    };
  }

  const plan = run.plan;

  // Step 1: Validate plan
  const planValidation = validatePlan(plan, availableOperations);
  if (!planValidation.valid) {
    errors.push(...planValidation.errors);
    return {
      resolvedSteps: [],
      errors,
      warnings: planValidation.warnings,
      blockedSteps: [],
    };
  }
  warnings.push(...planValidation.warnings);

  // Step 2: Check for circular dependencies
  const cycleDetection = detectCircularDependencies(plan.steps);
  if (cycleDetection.hasCycle) {
    errors.push({
      field: 'dependencies',
      message: `Circular dependency detected: ${cycleDetection.cycles.map(c => c.join(' → ')).join('; ')}`,
    });
    return {
      resolvedSteps: [],
      errors,
      warnings,
      blockedSteps: [],
    };
  }

  // Step 3: Resolve execution order
  const { order } = resolveExecutionOrder(plan.steps);
  const stepMap = new Map(plan.steps.map(s => [s.id, s]));

  // Step 4: Build resolved steps
  const resolvedSteps = [];
  const previousResults = [];
  const variableContext = { ...(context.variables || {}) };

  for (const stepId of order) {
    const step = stepMap.get(stepId);
    if (!step) {
      errors.push({ field: 'steps', message: `Step ${stepId} not found.` });
      continue;
    }

    // Check for blocked dependencies
    const blockedDeps = step.dependencies.filter(depId => {
      const depResult = previousResults.find(r => r.stepId === depId);
      return depResult && (depResult.statusCode >= 400 || depResult.error);
    });

    if (blockedDeps.length > 0) {
      blockedSteps.push(stepId);
      warnings.push({
        field: 'steps',
        message: `Step ${stepId} is blocked due to failed dependencies: ${blockedDeps.join(', ')}`,
      });
      continue;
    }

    // Validate variables - check if missing vars are produced by already-resolved steps
    const variableValidation = validateVariables(step, variableContext);
    if (!variableValidation.valid) {
      // Check if missing variables are produced by already-resolved steps
      const resolvedStepIds = new Set(resolvedSteps.map(s => s.id));
      const trulyMissing = variableValidation.missingVariables.filter(varName => {
        // Check if any resolved step produces this variable
        return !resolvedSteps.some(s => s.variablesProduced?.includes(varName));
      });

      if (trulyMissing.length > 0) {
        errors.push({
          field: 'variables',
          message: `Step ${stepId} missing variables: ${trulyMissing.join(', ')}`,
        });
        continue;
      }
    }

    // Update variable context with variables produced by already-resolved steps
    // This allows subsequent steps to validate variables that will be produced
    if (step.variablesProduced) {
      for (const varName of step.variablesProduced) {
        if (!(varName in variableContext)) {
          variableContext[varName] = `__resolved_${varName}__`;
        }
      }
    }

    // Resolve variables
    const resolvedStep = resolveVariables(step, variableContext, previousResults);

    // Resolve authentication
    const authResolvedStep = resolveAuthentication(resolvedStep, context);

    // Build resolved step
    const resolvedStepFinal = {
      ...createExecutionStep(authResolvedStep),
      request: {
        ...authResolvedStep.request,
        queryParams: authResolvedStep.request?.queryParams || {},
      },
      metadata: {
        resolvedAt: new Date(),
        variableResolution: variableContext,
        authInjected: authResolvedStep.authenticationRequired,
        blockedBy: null,
      },
    };

    resolvedSteps.push(resolvedStepFinal);

    // Extract variables for next steps
    if (resolvedStepFinal.variablesProduced && resolvedStepFinal.variablesProduced.length > 0) {
      // Variable extraction happens after execution, but we can prepare the context
      // For now, variables will be extracted by ResponseParser after execution
    }
  }

  return {
    resolvedSteps,
    errors,
    warnings,
    blockedSteps,
  };
}

/**
 * Get pipeline summary.
 * @param {object} pipelineResult - Result from executePipeline
 * @returns {object} Summary
 */
function getPipelineSummary(pipelineResult) {
  return {
    totalSteps: pipelineResult.resolvedSteps?.length || 0,
    blockedSteps: pipelineResult.blockedSteps?.length || 0,
    errorCount: pipelineResult.errors?.length || 0,
    warningCount: pipelineResult.warnings?.length || 0,
    hasBlockingErrors: pipelineResult.errors?.length > 0,
    hasBlockedSteps: pipelineResult.blockedSteps?.length > 0,
  };
}

module.exports = {
  executePipeline,
  getPipelineSummary,
};
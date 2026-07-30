/**
 * RequirementWorkflowService
 *
 * Orchestration service for the Requirements AI Workshop workflow.
 * Coordinates between RequirementService, RequirementAnalysisService,
 * TestGenerationService, ApiMatchingService, and ValidationScenarioService.
 *
 * This is the central orchestrator for the Requirements module.
 */

const repo = require('./workflow/FileRequirementWorkflowRepository');
const requirementRepo = require('./RequirementRepository');
const { createWorkflow, advanceToStep, markReadyForValidation, getCoverageSummary } = require('./RequirementWorkflow');
const { analyzeRequirement, generateTestCasesFromAnalysis } = require('./RequirementAnalysisService');
const { getProjectKnowledge } = require('./ProjectKnowledgeRepository');
const { listServices, getApiModel } = require('./ServiceRepository');
const { matchTestCasesToApis } = require('../engine/matching/testCaseMatcher');
const { generateScenarios } = require('./ScenarioGenerationService');
const validationScenarioRepo = require('./ValidationScenarioRepository');
const { getProject } = require('./ProjectRepository');

class RequirementWorkflowService {
  /**
   * Initialize a workflow for a requirement.
   * @param {string} projectId
   * @param {string} requirementId
   * @returns {Promise<object>} workflow
   */
  async initializeWorkflow(projectId, requirementId) {
    if (!projectId || !requirementId) {
      throw new Error('Project ID and Requirement ID are required.');
    }

    // Check if workflow already exists
    const existing = repo.getWorkflowByRequirementId(projectId, requirementId);
    if (existing) {
      return existing;
    }

    // Get the requirement to populate initial workflow data
    const requirement = requirementRepo.getRequirement(projectId, requirementId);
    if (!requirement) {
      throw new Error(`Requirement not found: ${requirementId}`);
    }

    const workflow = repo.createWorkflowForProject(projectId, {
      projectId,
      requirementId,
      requirement: {
        title: requirement.title,
        description: requirement.description,
        acceptanceCriteria: requirement.acceptanceCriteria,
        businessRules: requirement.businessRules,
        priority: requirement.priority,
        status: requirement.status,
        source: requirement.source,
        fileName: requirement.fileName,
      },
    });

    return workflow;
  }

  /**
   * Get a workflow by ID.
   */
  async getWorkflow(projectId, workflowId) {
    if (!projectId || !workflowId) {
      throw new Error('Project ID and Workflow ID are required.');
    }
    const workflow = repo.getWorkflow(projectId, workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    return workflow;
  }

  /**
   * Get workflow by requirement ID.
   */
  async getWorkflowByRequirement(projectId, requirementId) {
    if (!projectId || !requirementId) {
      throw new Error('Project ID and Requirement ID are required.');
    }
    return repo.getWorkflowByRequirementId(projectId, requirementId);
  }

  /**
   * List workflows for a project.
   */
  async listWorkflows(projectId, options = {}) {
    if (!projectId) {
      throw new Error('Project ID is required.');
    }
    return repo.listWorkflows(projectId, options);
  }

  /**
   * Step 2: Analyze requirement using AI.
   * Uses Knowledge Library and API Catalog as context.
   */
  async analyzeRequirement(projectId, workflowId) {
    const workflow = await this.getWorkflow(projectId, workflowId);

    // Get context from Knowledge Library
    let knowledge = null;
    let apiCatalog = null;
    try {
      knowledge = await getProjectKnowledge(projectId);
      const services = await listServices(projectId);
      apiCatalog = {};
      for (const service of services) {
        const apiModel = await getApiModel(projectId, service.id);
        if (apiModel) {
          apiCatalog[service.id] = {
            name: service.name,
            baseUrl: apiModel.baseUrl,
            operations: apiModel.operations || [],
          };
        }
      }
    } catch {
      // Non-critical - proceed without context
    }

    const analysis = await analyzeRequirement({
      requirement: workflow.requirement,
      knowledge,
      apiCatalog,
    });

    const updated = repo.updateWorkflow(projectId, workflowId, {
      analysis: {
        completed: analysis.completed,
        acceptanceCriteria: analysis.acceptanceCriteria,
        businessRules: analysis.businessRules,
        positivePaths: analysis.positivePaths,
        negativePaths: analysis.negativePaths,
        edgeCases: analysis.edgeCases,
        preconditions: analysis.preconditions,
        postconditions: analysis.postconditions,
        dependencies: analysis.dependencies,
        assumptions: analysis.assumptions,
        missingInformation: analysis.missingInformation,
        ambiguities: analysis.ambiguities,
        analyzedAt: analysis.analyzedAt,
      },
      currentStep: 3,
    });

    // Update the requirement with extracted data
    try {
      if (analysis.acceptanceCriteria.length > 0 || analysis.businessRules.length > 0) {
        requirementRepo.updateRequirement(projectId, workflow.requirementId, {
          acceptanceCriteria: analysis.acceptanceCriteria,
          businessRules: analysis.businessRules,
          status: 'needs-review',
        });
      }
    } catch {
      // Non-critical
    }

    return updated;
  }

  /**
   * Step 3: Generate test cases for analyzed requirement.
   */
  async generateTestCases(projectId, workflowId) {
    const workflow = await this.getWorkflow(projectId, workflowId);

    if (!workflow.analysis.completed) {
      throw new Error('Analysis must be completed before generating test cases.');
    }

    const testCases = await generateTestCasesFromAnalysis({
      requirement: workflow.requirement,
      analysis: workflow.analysis,
    });

    const updated = repo.updateWorkflow(projectId, workflowId, {
      generatedTests: {
        completed: true,
        testCases,
        generatedAt: new Date().toISOString(),
      },
      selectedTests: {
        testCaseIds: testCases.map((tc) => tc.id),
        selectedAt: new Date().toISOString(),
      },
    });

    return updated;
  }

  /**
   * Step 3: Update test case selection.
   */
  async updateTestSelection(projectId, workflowId, testCaseIds) {
    const workflow = await this.getWorkflow(projectId, workflowId);

    return repo.updateWorkflow(projectId, workflowId, {
      selectedTests: {
        testCaseIds: Array.isArray(testCaseIds) ? testCaseIds.map(String) : [],
        selectedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Step 3: Approve selected test cases.
   */
  async approveTests(projectId, workflowId) {
    const workflow = await this.getWorkflow(projectId, workflowId);

    const updatedTests = (workflow.generatedTests.testCases || []).map((tc) => ({
      ...tc,
      approved: (workflow.selectedTests.testCaseIds || []).includes(tc.id),
    }));

    return repo.updateWorkflow(projectId, workflowId, {
      generatedTests: {
        ...workflow.generatedTests,
        testCases: updatedTests,
      },
      currentStep: 4,
    });
  }

  /**
   * Step 4: Match test cases to APIs.
   */
  async matchApis(projectId, workflowId) {
    const workflow = await this.getWorkflow(projectId, workflowId);

    const selectedTests = (workflow.generatedTests.testCases || []).filter((tc) =>
      (workflow.selectedTests.testCaseIds || []).includes(tc.id)
    );

    if (selectedTests.length === 0) {
      throw new Error('No selected test cases to match.');
    }

    const result = await matchTestCasesToApis({
      projectId,
      testCases: selectedTests.map((tc) => ({
        id: tc.id,
        summary: tc.title,
        description: tc.description,
        priority: tc.priority,
        tags: tc.tags,
      })),
    });

    const matches = (result.matches || []).map((match) => {
      const testCaseTitle = selectedTests.find((tc) => tc.id === match.testCaseId)?.title || 'Unknown';
      return {
        testCaseId: match.testCaseId,
        testCaseTitle,
        matchedApi: match.selectedMatch ? {
          serviceId: match.selectedMatch.serviceId || '',
          serviceName: match.selectedMatch.serviceName || 'Unknown Service',
          operationId: match.selectedMatch.operationId,
          operationName: match.selectedMatch.operationName || 'Unknown Operation',
          method: match.selectedMatch.method || '',
          path: match.selectedMatch.path || '',
          authentication: match.selectedMatch.authentication || '',
          confidence: match.selectedMatch.confidence || 0,
        } : null,
        suggestedApi: null,
        status: match.status === 'matched' ? 'matched' :
                match.status === 'ambiguous' ? 'review-required' : 'unmatched',
        authentication: match.selectedMatch?.authentication || '',
        dependencies: match.selectedMatch?.dependencies || [],
      };
    });

    const updated = repo.updateWorkflow(projectId, workflowId, {
      apiMatches: {
        completed: true,
        matches,
        matchedAt: new Date().toISOString(),
      },
    });

    return updated;
  }

  /**
   * Step 4: Confirm API mappings.
   */
  async confirmMappings(projectId, workflowId) {
    const workflow = await this.getWorkflow(projectId, workflowId);

    if (!workflow.apiMatches.completed) {
      throw new Error('API matching must be completed before confirming mappings.');
    }

    return repo.updateWorkflow(projectId, workflowId, {
      approvedMappings: {
        completed: true,
        mappings: (workflow.apiMatches.matches || [])
          .filter((m) => m.status === 'matched')
          .map((m) => m.testCaseId),
        approvedAt: new Date().toISOString(),
      },
      currentStep: 5,
    });
  }

  /**
   * Step 5: Generate draft validation scenarios.
   */
  async generateDraftScenarios(projectId, workflowId) {
    const workflow = await this.getWorkflow(projectId, workflowId);

    if (!workflow.approvedMappings.completed) {
      throw new Error('API mappings must be confirmed before generating scenarios.');
    }

    // Generate scenarios using existing scenario generation service
    const result = await generateScenarios({
      requirements: [{
        id: workflow.requirementId,
        title: workflow.requirement.title,
        description: workflow.requirement.description,
        acceptanceCriteria: workflow.requirement.acceptanceCriteria,
        businessRules: workflow.requirement.businessRules,
      }],
    });

    const proposals = result.proposals || [];
    const scenarioIds = [];

    for (const proposal of proposals) {
      const scenario = validationScenarioRepo.createValidationScenario({
        projectId,
        requirementId: workflow.requirementId,
        title: proposal.title,
        description: proposal.description,
        priority: proposal.priority || 'medium',
        confidence: proposal.confidence || 0.5,
        status: 'draft',
        source: 'ai-generated',
      });
      scenarioIds.push(scenario.id);
    }

    const updated = repo.updateWorkflow(projectId, workflowId, {
      draftValidationScenarioIds: scenarioIds,
      scenariosGeneratedAt: new Date().toISOString(),
    });

    return markReadyForValidation(updated);
  }

  /**
   * Get coverage summary for a workflow.
   */
  async getSummary(projectId, workflowId) {
    const workflow = await this.getWorkflow(projectId, workflowId);
    return getCoverageSummary(workflow);
  }

  /**
   * Delete a workflow.
   */
  async deleteWorkflow(projectId, workflowId) {
    return repo.deleteWorkflow(projectId, workflowId);
  }
}

let serviceInstance = null;

function getRequirementWorkflowService() {
  if (!serviceInstance) {
    serviceInstance = new RequirementWorkflowService();
  }
  return serviceInstance;
}

function resetRequirementWorkflowService() {
  serviceInstance = null;
}

module.exports = {
  RequirementWorkflowService,
  getRequirementWorkflowService,
  resetRequirementWorkflowService,
};
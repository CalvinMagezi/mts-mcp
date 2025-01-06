import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  ReasoningStep,
  ReasoningType,
  CreateReasoningStepArgs,
  AnalyzeArgs,
  SynthesizeArgs,
  ValidateArgs,
  SequentialReasoningArgs,
} from "../../types/reasoning.js";
import { v4 as uuidv4 } from "uuid";

export class ReasoningManager {
  private steps: Map<string, ReasoningStep>;
  private branches: Record<string, string[]>;

  constructor(private server: Server) {
    this.steps = new Map();
    this.branches = {};
  }

  private createStep(
    type: ReasoningType,
    content: string,
    options: Partial<ReasoningStep> = {}
  ): ReasoningStep {
    const id = uuidv4();
    const step: ReasoningStep = {
      id,
      type,
      content,
      created_at: new Date().toISOString(),
      ...options,
    };
    this.steps.set(id, step);
    return step;
  }

  async createReasoningStep(
    args: CreateReasoningStepArgs
  ): Promise<{ content: { type: string; text: string }[] }> {
    const step = this.createStep(args.type, args.content, {
      dependencies: args.dependencies,
      evidence: args.evidence,
      confidence: args.confidence,
    });

    return {
      content: [
        {
          type: "text",
          text: `Created ${args.type} step: ${step.content} (ID: ${step.id})`,
        },
      ],
    };
  }

  async analyze(
    args: AnalyzeArgs
  ): Promise<{ content: { type: string; text: string }[] }> {
    const depth = args.depth || 3;
    const steps: ReasoningStep[] = [];
    const branchId = uuidv4();

    // Create initial decomposition step
    const decompositionStep = this.createStep(
      ReasoningType.DECOMPOSITION,
      `Initial decomposition: ${args.prompt}`,
      {
        branchId,
        sequenceNumber: 1,
        totalSteps: depth,
        focus_areas: args.focus_areas,
      }
    );
    steps.push(decompositionStep);

    // Create analysis steps
    for (let i = 1; i < depth - 1; i++) {
      const step = this.createStep(
        ReasoningType.ANALYSIS,
        `Analysis step ${i}: ${args.prompt}`,
        {
          branchId,
          sequenceNumber: i + 1,
          totalSteps: depth,
          focus_areas: args.focus_areas,
          dependencies: [steps[i - 1].id],
        }
      );
      steps.push(step);
    }

    // Create conclusion step
    const conclusionStep = this.createStep(
      ReasoningType.CONCLUSION,
      `Final synthesis: ${args.prompt}`,
      {
        branchId,
        sequenceNumber: depth,
        totalSteps: depth,
        focus_areas: args.focus_areas,
        dependencies: [steps[steps.length - 1].id],
      }
    );
    steps.push(conclusionStep);

    // Store branch information
    this.branches[branchId] = steps.map((s) => s.id);

    // Format response according to MCP requirements
    return {
      content: [
        {
          type: "text",
          text: steps
            .map(
              (step) =>
                `Step ${step.sequenceNumber}/${step.totalSteps} (${step.type}): ${step.content} (ID: ${step.id})`
            )
            .join("\n"),
        },
      ],
    };
  }

  async synthesize(
    args: SynthesizeArgs
  ): Promise<{ content: { type: string; text: string }[] }> {
    const stepsToSynthesize = args.step_ids
      .map((id) => this.steps.get(id))
      .filter((step): step is ReasoningStep => step !== undefined);

    if (stepsToSynthesize.length !== args.step_ids.length) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "One or more step IDs not found"
      );
    }

    const synthesizedStep = this.createStep(
      ReasoningType.SYNTHESIS,
      `Synthesis of steps: ${args.step_ids.join(", ")}`,
      {
        dependencies: args.step_ids,
        perspective: args.perspective,
      }
    );

    return {
      content: [
        {
          type: "text",
          text: `Synthesized result (ID: ${
            synthesizedStep.id
          }): Combined analysis from steps ${args.step_ids.join(
            ", "
          )} from perspective: ${args.perspective || "general"}`,
        },
      ],
    };
  }

  async validate(
    args: ValidateArgs
  ): Promise<{ content: { type: string; text: string }[] }> {
    const stepToValidate = this.steps.get(args.step_id);
    if (!stepToValidate) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Step not found: ${args.step_id}`
      );
    }

    const validationStep = this.createStep(
      ReasoningType.VALIDATION,
      `Validation of step: ${args.step_id}`,
      {
        dependencies: [args.step_id],
        criteria: args.criteria,
      }
    );

    return {
      content: [
        {
          type: "text",
          text: `Validation result (ID: ${validationStep.id}): Evaluated step ${
            args.step_id
          } against criteria: ${args.criteria?.join(", ")}`,
        },
      ],
    };
  }

  async sequentialReasoning(
    args: SequentialReasoningArgs
  ): Promise<{ content: { type: string; text: string }[] }> {
    const steps: ReasoningStep[] = [];
    const initialSteps = args.initialSteps || 3;
    const branchId = args.branchId || uuidv4();

    // Create initial steps
    for (let i = 0; i < initialSteps; i++) {
      const step = this.createStep(
        i === 0
          ? ReasoningType.HYPOTHESIS
          : i === initialSteps - 1
          ? ReasoningType.CONCLUSION
          : ReasoningType.ANALYSIS,
        i === 0 ? args.prompt : `Step ${i + 1} for: ${args.prompt}`,
        {
          branchId,
          sequenceNumber: i + 1,
          totalSteps: initialSteps,
        }
      );

      if (i > 0) {
        step.dependencies = [steps[i - 1].id];
      }

      steps.push(step);
    }

    // Store branch information
    if (!this.branches[branchId]) {
      this.branches[branchId] = [];
    }
    this.branches[branchId].push(...steps.map((s) => s.id));

    // Format response according to MCP requirements
    return {
      content: steps.map((step) => ({
        type: "text",
        text: `Step ${step.sequenceNumber}/${step.totalSteps} (${step.type}): ${step.content} (ID: ${step.id})`,
      })),
    };
  }

  async getStep(id: string): Promise<ReasoningStep> {
    const step = this.steps.get(id);
    if (!step) {
      throw new McpError(ErrorCode.InvalidRequest, `Step not found: ${id}`);
    }
    return step;
  }

  async getBranch(branchId: string): Promise<ReasoningStep[]> {
    const stepIds = this.branches[branchId];
    if (!stepIds) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Branch not found: ${branchId}`
      );
    }
    return stepIds
      .map((id) => this.steps.get(id))
      .filter((step): step is ReasoningStep => step !== undefined);
  }

  private async createSequentialStep(args: {
    type: ReasoningType;
    content: string;
    sequenceNumber: number;
    totalSteps: number;
    dependencies?: string[];
    branchId?: string;
    branchFromStepId?: string;
  }): Promise<ReasoningStep> {
    const step: ReasoningStep = {
      id: uuidv4(),
      type: args.type,
      content: args.content,
      created_at: new Date().toISOString(),
      dependencies: args.dependencies || [],
      sequenceNumber: args.sequenceNumber,
      totalSteps: args.totalSteps,
      branchId: args.branchId,
      branchFromStepId: args.branchFromStepId,
    };

    this.steps.set(step.id, step);
    return step;
  }

  async getBranchSteps(branchId: string): Promise<ReasoningStep[]> {
    const branchSteps = this.branches[branchId];
    if (!branchSteps) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Branch not found: ${branchId}`
      );
    }
    return branchSteps
      .map((id) => this.steps.get(id))
      .filter((step): step is ReasoningStep => step !== undefined);
  }

  async getStepsByType(type: ReasoningType): Promise<ReasoningStep[]> {
    return Array.from(this.steps.values()).filter((step) => step.type === type);
  }

  async updateStep(
    stepId: string,
    updates: Partial<Omit<ReasoningStep, "id" | "created_at">>
  ): Promise<ReasoningStep> {
    const step = this.steps.get(stepId);
    if (!step) {
      throw new McpError(ErrorCode.InvalidRequest, `Step not found: ${stepId}`);
    }

    const updatedStep = {
      ...step,
      ...updates,
    };

    this.steps.set(stepId, updatedStep);
    return updatedStep;
  }
}

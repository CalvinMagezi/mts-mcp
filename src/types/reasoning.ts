export enum ReasoningType {
  HYPOTHESIS = "hypothesis",
  ANALYSIS = "analysis",
  INFERENCE = "inference",
  CONCLUSION = "conclusion",
  COUNTERARGUMENT = "counterargument",
  SYNTHESIS = "synthesis",
  DECOMPOSITION = "decomposition",
  VALIDATION = "validation",
  REVISION = "revision",
  BRANCH = "branch",
  QUESTION = "question",
  REALIZATION = "realization",
}

// Base interface for MCP response content
export interface McpResponseContent {
  type: string;
  text: string;
}

// Base interface for MCP response
export interface McpResponse {
  content: McpResponseContent[];
}

export interface ReasoningStep {
  id: string;
  type: ReasoningType;
  content: string;
  created_at: string;
  dependencies?: string[];
  confidence?: number;
  evidence?: string[];
  sequenceNumber?: number;
  totalSteps?: number;
  focus_areas?: string[];
  perspective?: string;
  criteria?: string[];
  branchId?: string;
  branchFromStepId?: string;
}

export interface CreateReasoningStepArgs {
  type: ReasoningType;
  content: string;
  dependencies?: string[];
  evidence?: string[];
  confidence?: number;
}

export interface AnalyzeArgs {
  prompt: string;
  depth?: number;
  focus_areas?: string[];
}

export interface SynthesizeArgs {
  step_ids: string[];
  perspective?: string;
}

export interface ValidateArgs {
  step_id: string;
  criteria?: string[];
}

export interface SequentialReasoningArgs {
  prompt: string;
  initialSteps?: number;
  focusAreas?: string[];
  branchId?: string;
  branchFromStepId?: string;
}

// Response types for each method
export interface CreateReasoningStepResponse extends McpResponse {}
export interface AnalyzeResponse extends McpResponse {}
export interface SynthesizeResponse extends McpResponse {}
export interface ValidateResponse extends McpResponse {}
export interface SequentialReasoningResponse extends McpResponse {}

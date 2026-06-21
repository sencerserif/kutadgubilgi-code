// AI Provider Types
export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "xai"
  | "ollama"
  | "openrouter"
  | "zhipu"
  | "perplexity"
  | "mistral"
  | "cohere"
  | "together";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  description: string;
  apiKeyUrl: string;
  baseUrl: string;
  authHeader: "bearer" | "x-api-key" | "google" | "none";
  apiVersion?: string;
  models: ModelConfig[];
  color: string;
  icon: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  capabilities: ModelCapability[];
  tier: "fast" | "balanced" | "powerful";
}

export type ModelCapability =
  | "code"
  | "reasoning"
  | "vision"
  | "long-context"
  | "fast"
  | "creative";

// API Keys stored in localStorage
export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  deepseek?: string;
  xai?: string;
  ollama?: string;
  openrouter?: string;
  zhipu?: string;
  perplexity?: string;
  mistral?: string;
  cohere?: string;
  together?: string;
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: ProviderId;
  model?: string;
  timestamp: number;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  // New fields
  diff?: DiffResult;
  agentStep?: number;
  reviewIssues?: ReviewIssue[];
  ragSources?: RagSource[];
  pinned?: boolean;
  // v9 - vision & reasoning
  images?: Array<{ url: string; mimeType: string; filename?: string }>;
  reasoning?: string; // chain-of-thought for o1/R1
}

export interface ToolCall {
  type: "file_read" | "file_write" | "file_list" | "terminal" | "git" | "search";
  input: Record<string, unknown>;
  output?: string;
  status: "pending" | "running" | "success" | "error";
}

// File system
export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: FileNode[];
  language?: string;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
  originalContent: string;
}

// Routing
export interface RoutingDecision {
  provider: ProviderId;
  model: string;
  reason: string;
  confidence: number;
}

// Cost tracking
export interface CostEntry {
  id: string;
  provider: ProviderId;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  timestamp: number;
  messagePreview: string;
}

// Terminal
export interface TerminalCommand {
  id: string;
  command: string;
  output: string;
  exitCode: number;
  timestamp: number;
}

// Settings
export interface AppSettings {
  apiKeys: ApiKeys;
  defaultProvider: ProviderId;
  defaultModel: string;
  routingMode: "smart" | "manual";
  workspacePath: string;
  theme: "dark" | "light";
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  voiceEnabled: boolean;
  autoSpeak: boolean;
  voiceRate: number;
  voicePitch: number;
}

// ============ NEW TYPES ============

// Compare (multi-provider parallel)
export interface CompareRequest {
  prompt: string;
  providers: Array<{ provider: ProviderId; model: string }>;
  systemPrompt?: string;
}

export interface CompareResult {
  provider: ProviderId;
  model: string;
  content: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  duration: number;
  error?: string;
}

// Diff (code changes)
export interface DiffResult {
  filePath: string;
  originalContent: string;
  newContent: string;
  hunks: DiffHunk[];
  language: string;
  applied: boolean;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "context" | "add" | "remove";
  content: string;
  oldNumber?: number;
  newNumber?: number;
}

// Agent mode
export interface AgentTask {
  id: string;
  goal: string;
  status: "planning" | "running" | "completed" | "failed" | "paused";
  steps: AgentStep[];
  createdAt: number;
  updatedAt: number;
  maxSteps: number;
  currentStep: number;
  result?: string;
  error?: string;
}

export interface AgentStep {
  id: string;
  index: number;
  action: string;
  description: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  input?: string;
  output?: string;
  timestamp: number;
  toolCall?: ToolCall;
  diff?: DiffResult;
}

// Snippets / Templates
export interface Snippet {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: "code" | "review" | "test" | "refactor" | "doc" | "custom";
  icon?: string;
  isBuiltIn?: boolean;
  createdAt: number;
  useCount: number;
}

// Workspaces (multi-tab)
export interface Workspace {
  id: string;
  name: string;
  path: string;
  color: string;
  createdAt: number;
  lastActive: number;
  chatHistory: ChatMessage[];
  openFiles: string[]; // paths
  activeFile?: string;
}

// Git timeline
export interface GitTimelineEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  aiSummary?: string;
}

// Code review
export interface ReviewIssue {
  id: string;
  severity: "critical" | "warning" | "info" | "suggestion";
  category: "security" | "performance" | "style" | "bug" | "best-practice";
  title: string;
  description: string;
  file: string;
  line?: number;
  suggestion?: string;
}

export interface CodeReview {
  id: string;
  filePath: string;
  timestamp: number;
  provider: ProviderId;
  model: string;
  issues: ReviewIssue[];
  summary: string;
  score: number; // 0-100
}

// RAG
export interface RagDocument {
  id: string;
  filename: string;
  path: string;
  size: number;
  pages?: number;
  chunks: number;
  uploadedAt: number;
  type: "pdf" | "markdown" | "text" | "code" | "docx";
}

export interface RagSource {
  documentId: string;
  filename: string;
  chunk: number;
  content: string;
  score: number;
  page?: number;
}

// Plugins
export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  isBuiltIn: boolean;
  icon: string;
  category: "search" | "integration" | "tool" | "data" | "custom";
  config: Record<string, unknown>;
  configSchema?: PluginConfigField[];
}

export interface PluginConfigField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select";
  default?: unknown;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
}

// MCP Server
export interface McpServer {
  id: string;
  name: string;
  url: string;
  status: "connected" | "disconnected" | "error";
  tools: McpTool[];
  lastConnected?: number;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// Voice
export interface VoiceSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
  autoSpeak: boolean;
  sttLanguage: string;
}

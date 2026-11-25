export interface CategorizationTarget {
  url: string;
  title: string;
}

export type CategorizationSource = 'rule' | 'nano' | 'none';

export interface CategorizationSuggestion {
  source: CategorizationSource;
  collectionId?: string;
  suggestedNewCollection?: string;
  tags: string[];
  summaryNote?: string;
  matchedRuleId?: string;
  matchedRuleName?: string;
}

export type NanoAvailabilityStatus =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

export interface LanguageModelDownloadProgressEvent extends Event {
  loaded: number;
  total?: number;
}

export interface LanguageModelDownloadMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: LanguageModelDownloadProgressEvent) => void,
  ): void;
}

export interface LanguageModelExpectedIO {
  type: 'text';
  languages: string[];
}

export interface LanguageModelAvailabilityOptions {
  expectedInputs?: LanguageModelExpectedIO[];
  expectedOutputs?: LanguageModelExpectedIO[];
}

export interface LanguageModelParams {
  defaultTopK: number;
  maxTopK: number;
  defaultTemperature: number;
  maxTemperature: number;
}

export interface LanguageModelCreateOptions
  extends LanguageModelAvailabilityOptions {
  initialPrompts?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
  monitor?: (monitor: LanguageModelDownloadMonitor) => void;
}

export interface LanguageModelPromptOptions {
  responseConstraint?: Record<string, unknown>;
  omitResponseConstraintInput?: boolean;
  signal?: AbortSignal;
}

export interface LanguageModelSession {
  prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>;
  clone?(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
  measureInputUsage?(input: string): Promise<number>;
  inputQuota?: number;
  destroy(): void;
}

export interface LanguageModelAPI {
  availability(options?: LanguageModelAvailabilityOptions): Promise<string>;
  params?(): Promise<LanguageModelParams>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

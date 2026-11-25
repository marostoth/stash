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

export interface LanguageModelCreateOptions
  extends LanguageModelAvailabilityOptions {
  initialPrompts?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  monitor?: (monitor: LanguageModelDownloadMonitor) => void;
}

export interface LanguageModelPromptOptions {
  responseConstraint?: Record<string, unknown>;
}

export interface LanguageModelSession {
  prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>;
  destroy(): void;
}

export interface LanguageModelAPI {
  availability(options?: LanguageModelAvailabilityOptions): Promise<string>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

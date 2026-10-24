import * as vscode from 'vscode';

export const SECTION = 'zaiAutocomplete';
export const SECRET_KEY = 'zaiAutocomplete.apiKey';

export interface Settings {
  enabled: boolean;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  debounceMs: number;
  prefixChars: number;
  suffixChars: number;
  maxCompletionLines: number;
  timeoutMs: number;
  disableThinking: boolean;
  commitModel: string;
  maxCommitDiffChars: number;
  excludeLanguages: string[];
  maxFileChars: number;
  showStatusBar: boolean;
}

export function readSettings(): Settings {
  const c = vscode.workspace.getConfiguration(SECTION);
  const get = <T>(key: string, fallback: T): T => c.get<T>(key, fallback);
  return {
    enabled: get('enabled', true),
    baseUrl: get('baseUrl', 'https://api.z.ai/api/coding/paas/v4').replace(/\/+$/, ''),
    model: get('model', 'glm-5.3-flash'),
    maxTokens: get('maxTokens', 256),
    temperature: get('temperature', 0.2),
    debounceMs: get('debounceMs', 300),
    prefixChars: get('prefixChars', 3000),
    suffixChars: get('suffixChars', 1500),
    maxCompletionLines: get('maxCompletionLines', 8),
    timeoutMs: get('timeoutMs', 10000),
    disableThinking: get('disableThinking', true),
    commitModel: get('commitModel', 'glm-5.3'),
    maxCommitDiffChars: get('maxCommitDiffChars', 60000),
    excludeLanguages: get('excludeLanguages', ['plaintext', 'log']),
    maxFileChars: get('maxFileChars', 200000),
    showStatusBar: get('showStatusBar', true),
  };
}

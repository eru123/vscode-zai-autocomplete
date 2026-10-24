import * as vscode from 'vscode';
import { Settings } from './config';
import { extractContext } from './context';
import { GlmError, requestCompletion } from './glmClient';
import { buildMessages } from './prompt';
import { sanitizeCompletion } from './clean';

export type ProviderState = 'idle' | 'busy' | 'error' | 'noKey';

export interface ProviderDeps {
  getSettings(): Settings;
  getApiKey(): Promise<string | undefined>;
  log(message: string): void;
  onState(state: ProviderState, detail?: string): void;
}

export class GlmInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private inflight: AbortController | undefined;

  constructor(private readonly deps: ProviderDeps) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const settings = this.deps.getSettings();

    if (!settings.enabled || token.isCancellationRequested) {
      return undefined;
    }
    const scheme = document.uri.scheme;
    if (scheme !== 'file' && scheme !== 'untitled') {
      return undefined;
    }
    if (settings.excludeLanguages.includes(document.languageId)) {
      return undefined;
    }

    const apiKey = await this.deps.getApiKey();
    if (!apiKey) {
      this.deps.onState('noKey');
      return undefined;
    }

    if (settings.debounceMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, settings.debounceMs));
      if (token.isCancellationRequested) {
        return undefined;
      }
    }

    const editorContext = extractContext(document, position, settings);
    if (!editorContext) {
      return undefined;
    }

    this.inflight?.abort();
    const abort = new AbortController();
    this.inflight = abort;
    token.onCancellationRequested(() => abort.abort());

    const messages = buildMessages({
      filename: editorContext.filename,
      languageId: editorContext.languageId,
      prefix: editorContext.prefix,
      suffix: editorContext.suffix,
      maxCompletionLines: settings.maxCompletionLines,
    });

    this.deps.onState('busy');
    try {
      const { text: raw, usage } = await requestCompletion(
        {
          baseUrl: settings.baseUrl,
          model: settings.model,
          messages,
          maxTokens: settings.maxTokens,
          temperature: settings.temperature,
          disableThinking: settings.disableThinking,
          timeoutMs: settings.timeoutMs,
        },
        apiKey,
        {
          get isCancellationRequested() {
            return token.isCancellationRequested || abort.signal.aborted;
          },
          onCancellationRequested: (cb: () => void) => abort.signal.addEventListener('abort', cb),
        }
      );

      if (usage.promptTokens !== undefined) {
        this.deps.log(
          `${settings.model} ${usage.completionTokens ?? '?'} out / ${usage.promptTokens} in tokens`
        );
      }

      const insert = sanitizeCompletion(
        raw,
        editorContext.prefix,
        editorContext.suffix,
        settings.maxCompletionLines
      );
      if (!insert || token.isCancellationRequested) {
        this.deps.onState('idle');
        return undefined;
      }

      this.deps.onState('idle');
      return [new vscode.InlineCompletionItem(insert, new vscode.Range(position, position))];
    } catch (err) {
      if (token.isCancellationRequested || abort.signal.aborted) {
        return undefined;
      }
      const message = err instanceof GlmError ? err.message : String(err);
      this.deps.log(`error: ${message}`);
      this.deps.onState('error', message);
      return undefined;
    } finally {
      if (this.inflight === abort) {
        this.inflight = undefined;
      }
    }
  }
}

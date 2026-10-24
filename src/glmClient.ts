import { ChatMessage } from './prompt';

export class GlmError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'GlmError';
  }
}

export interface CompletionOptions {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  disableThinking: boolean;
  timeoutMs: number;
}

export interface CompletionUsage {
  promptTokens?: number;
  completionTokens?: number;
}

interface ChatResponse {
  choices?: { message?: { content?: string | { text?: string }[] } }[];
  error?: { message?: string; code?: string };
  message?: string;
  request_id?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function describeStatus(status: number, detail: string): string {
  if (status === 401 || status === 403) {
    return `API key rejected (${status}). Check the key and that it belongs to the configured endpoint. ${detail}`;
  }
  if (status === 429) {
    return `Rate limited or the model is not part of your plan (429). ${detail}`;
  }
  return `GLM request failed with HTTP ${status}. ${detail}`;
}

function flattenContent(content: string | { text?: string }[] | undefined): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? '').join('');
  }
  return '';
}

/**
 * One chat completion round trip against an OpenAI-protocol endpoint.
 * Cancels with the token, times out on its own, and never leaks the key into
 * error messages or logs.
 */
export async function requestCompletion(
  opts: CompletionOptions,
  apiKey: string,
  token: { isCancellationRequested: boolean; onCancellationRequested(cb: () => void): unknown }
): Promise<{ text: string; usage: CompletionUsage }> {
  const controller = new AbortController();
  const cancelSub = token.onCancellationRequested(() => controller.abort());
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    stream: false,
  };
  if (opts.disableThinking) {
    body.thinking = { type: 'disabled' };
  }

  try {
    const res = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await res.text();
    let parsed: ChatResponse | undefined;
    try {
      parsed = raw ? (JSON.parse(raw) as ChatResponse) : undefined;
    } catch {
      // non-JSON body, handled below through the status code
    }

    if (!res.ok) {
      const detail =
        parsed?.error?.message ?? parsed?.message ?? raw.slice(0, 200) ?? res.statusText;
      throw new GlmError(describeStatus(res.status, detail), res.status);
    }

    const text = flattenContent(parsed?.choices?.[0]?.message?.content);
    return {
      text,
      usage: {
        promptTokens: parsed?.usage?.prompt_tokens,
        completionTokens: parsed?.usage?.completion_tokens,
      },
    };
  } catch (err) {
    if (err instanceof GlmError) {
      throw err;
    }
    if (token.isCancellationRequested) {
      throw err; // caller filters cancellations by the token, keep it simple
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GlmError(`GLM request timed out after ${opts.timeoutMs}ms`);
    }
    throw new GlmError(
      `GLM request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timer);
    if (typeof (cancelSub as { dispose?: () => void })?.dispose === 'function') {
      (cancelSub as { dispose: () => void }).dispose();
    }
  }
}

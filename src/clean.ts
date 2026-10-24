/**
 * Turns raw model output into a safe ghost-text insertion.
 *
 * Chat models wrap answers in markdown fences, restate the code before the
 * cursor, and repeat code the buffer already has after it. Every fix here is
 * a heuristic; the tests pin down the behavior that matters.
 */

const BOUNDARY = /[\s{}[\](),;:=<>+\-*/&|!?.]/;

export function stripFences(text: string): string {
  const trimmed = text.trimStart();

  // Output opens with a fence: drop the fence header, and the closing fence
  // if the model terminated the block.
  if (trimmed.startsWith('```')) {
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline === -1) {
      return '';
    }
    let body = trimmed.slice(firstNewline + 1);
    const lines = body.split('\n');
    let last = lines.length - 1;
    while (last >= 0 && lines[last].trim().length === 0) {
      last--;
    }
    if (last >= 0 && lines[last].trim().startsWith('```')) {
      lines.splice(last);
    }
    body = lines.join('\n');
    return body.replace(/\n+$/, '');
  }

  // Short prose followed by a fenced block: keep the block, drop the chatter.
  const m = /^\s*\S[^\n]{0,160}\n```[^\n]*\n([\s\S]*?)(?:\n```|$)/.exec(text);
  if (m) {
    return m[1].replace(/\n+$/, '');
  }

  return text;
}

export function dropProsePreamble(text: string): string {
  const firstLineEnd = text.indexOf('\n');
  if (firstLineEnd === -1) {
    return text;
  }
  const first = text.slice(0, firstLineEnd).trim();
  if (
    /^(here(?:'s| is)\b|sure\b[,.]?|this (?:function|code|snippet|method)\b|the following\b|i(?:'ll| will)\b )/i.test(first) &&
    first.length < 120 &&
    !/[;=]/.test(first)
  ) {
    return text.slice(firstLineEnd + 1).replace(/^\s+/, '');
  }
  return text;
}

/**
 * Removes the echo of the code directly before the cursor.
 *
 * The model is told not to restate the prefix, but it still happens, most
 * often when the cursor sits in the middle of a word. A chunk only counts as
 * an echo when it has at least two characters, contains something other than
 * whitespace, and the character before it in the prefix is a boundary. That
 * last rule keeps legitimate leading indentation intact.
 */
export function trimPrefixEcho(text: string, prefix: string): string {
  const max = Math.min(text.length, prefix.length, 200);
  for (let k = max; k >= 2; k--) {
    if (prefix.endsWith(text.slice(0, k))) {
      const chunk = text.slice(0, k);
      if (!/\S/.test(chunk)) {
        continue;
      }
      const before = prefix.length >= k + 1 ? prefix[prefix.length - k - 1] : '';
      if (before === '' || BOUNDARY.test(before)) {
        return text.slice(k);
      }
    }
  }
  return text;
}

/**
 * Detects a suggestion whose start already sits in the buffer after the
 * cursor, which happens when the cursor is inside a word and the model
 * repeats the rest of that word. The matching head would insert twice, so
 * the whole suggestion is dropped: there is nothing useful left to add at
 * the cursor.
 */
export function isRedundantWithSuffix(text: string, suffix: string): boolean {
  const max = Math.min(text.length, suffix.length, 120);
  for (let j = max; j >= 1; j--) {
    if (text.startsWith(suffix.slice(0, j))) {
      return j >= text.length || j >= 6;
    }
  }
  return false;
}

/**
 * Removes a trailing chunk that the buffer already has after the cursor,
 * like a closing brace the model repeated. The removed chunk has to start
 * on a boundary so a word that merely happens to end like the suffix
 * survives.
 */
export function trimSuffixOverlap(text: string, suffix: string): string {
  const max = Math.min(text.length - 1, suffix.length, 120);
  for (let k = max; k >= 1; k--) {
    if (text.endsWith(suffix.slice(0, k))) {
      const trimmed = text.slice(0, text.length - k);
      if (trimmed.trim().length > 0 && BOUNDARY.test(text[text.length - k])) {
        return trimmed;
      }
    }
  }
  return text;
}

export function capLines(text: string, max: number): string {
  const lines = text.split('\n');
  if (lines.length <= max) {
    return text;
  }
  return lines.slice(0, max).join('\n');
}

export function sanitizeCompletion(
  raw: string,
  prefix: string,
  suffix: string,
  maxLines: number
): string | null {
  if (!raw) {
    return null;
  }
  let text = stripFences(raw);
  text = dropProsePreamble(text);
  text = trimPrefixEcho(text, prefix);
  if (isRedundantWithSuffix(text, suffix)) {
    return null;
  }
  text = trimSuffixOverlap(text, suffix);
  text = capLines(text, maxLines);
  text = text.replace(/\s+$/, '');
  return text.trim().length > 0 ? text : null;
}

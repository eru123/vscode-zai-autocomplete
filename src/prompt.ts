export interface PromptContext {
  filename: string;
  languageId: string;
  prefix: string;
  suffix: string;
  maxCompletionLines: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function buildMessages(ctx: PromptContext): ChatMessage[] {
  const system = [
    'You are an inline code completion engine embedded in a code editor.',
    'The user message contains source code with a <CURSOR> marker in it.',
    'Respond with exactly the code that should be inserted at the marker.',
    'Rules:',
    '- Continue the code naturally and match the surrounding indentation and style.',
    `- Keep the insertion at most ${ctx.maxCompletionLines} lines long.`,
    '- Output raw code only: no markdown fences, no commentary, no wrapping quotes.',
    '- Never repeat code that already appears before the cursor. Complete it, do not restate it.',
  ].join('\n');

  const user = [
    `File: ${ctx.filename} (${ctx.languageId})`,
    '',
    `${ctx.prefix}<CURSOR>${ctx.suffix}`,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

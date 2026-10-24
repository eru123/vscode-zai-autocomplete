import { dropProsePreamble, stripFences } from './clean';
import { ChatMessage } from './prompt';

export interface CommitPromptInput {
  repoName: string;
  source: 'staged' | 'unstaged';
  diff: string;
}

export function buildCommitMessages(input: CommitPromptInput): ChatMessage[] {
  const system = [
    'You write git commit messages from diffs.',
    'Rules:',
    '- Follow Conventional Commits: <type>(<scope>): <subject> when the type and scope are clear from the diff, otherwise a plain subject.',
    '- Write the subject in imperative mood, lowercase, no trailing period, at most 72 characters.',
    '- Add one blank line and a short body wrapped at 72 characters only when the subject alone leaves real questions open.',
    '- Output the raw message only: no markdown fences, no quotes, no commentary.',
  ].join('\n');

  const user = [
    `Write the commit message for these ${input.source} changes in the "${input.repoName}" repository.`,
    '',
    '```diff',
    input.diff,
    '```',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

const MAX_MESSAGE_CHARS = 4000;

export function cleanCommitMessage(raw: string): string | null {
  if (!raw) {
    return null;
  }
  // Only unwrap a fence that wraps the whole answer. A commit message body
  // that quotes a fenced snippet should keep it.
  let text = raw.trimStart().startsWith('```') ? stripFences(raw) : raw;
  text = dropProsePreamble(text);
  text = text.trim();
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")))
  ) {
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
  if (!text) {
    return null;
  }
  return text.length > MAX_MESSAGE_CHARS ? text.slice(0, MAX_MESSAGE_CHARS) : text;
}

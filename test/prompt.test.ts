import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages } from '../src/prompt';

test('buildMessages places the cursor marker between prefix and suffix', () => {
  const [system, user] = buildMessages({
    filename: 'src/app.ts',
    languageId: 'typescript',
    prefix: 'const a = 1;',
    suffix: '\nexport {}',
    maxCompletionLines: 8,
  });

  assert.match(system.content, /inline code completion/);
  assert.match(system.content, /at most 8 lines/);
  assert.ok(user.content.startsWith('File: src/app.ts (typescript)'));
  assert.ok(user.content.includes('const a = 1;<CURSOR>\nexport {}'));
});

test('buildMessages tolerates an empty suffix', () => {
  const [, user] = buildMessages({
    filename: 'main.py',
    languageId: 'python',
    prefix: 'def main():',
    suffix: '',
    maxCompletionLines: 4,
  });
  assert.ok(user.content.endsWith('def main():<CURSOR>'));
});

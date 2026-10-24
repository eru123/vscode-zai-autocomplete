import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCommitMessages } from '../src/commitMessage';
import { cleanCommitMessage } from '../src/commitMessage';

test('buildCommitMessages describes the source and repo', () => {
  const [system, user] = buildCommitMessages({
    repoName: 'vscode-zai-autocomplete',
    source: 'staged',
    diff: 'diff --git a/x b/x',
  });
  assert.match(system.content, /Conventional Commits/);
  assert.match(system.content, /72 characters/);
  assert.match(user.content, /staged changes in the "vscode-zai-autocomplete" repository/);
  assert.ok(user.content.includes('```diff\ndiff --git a/x b/x\n```'));
});

test('cleanCommitMessage keeps a plain message untouched', () => {
  const msg = 'feat(scm): generate commit messages from diffs\n\nbody line';
  assert.equal(cleanCommitMessage(msg), msg);
});

test('cleanCommitMessage unwraps a fence around the whole answer', () => {
  assert.equal(cleanCommitMessage('```\nfix: drop the shim\n```'), 'fix: drop the shim');
});

test('cleanCommitMessage keeps a fenced snippet inside the body', () => {
  const msg = 'refactor: remove the json shim\n\n```diff\n- import json\n```';
  assert.equal(cleanCommitMessage(msg), msg);
});

test('cleanCommitMessage drops a prose preamble', () => {
  assert.equal(cleanCommitMessage("Here's the message:\n\nfix: handle timeouts"), 'fix: handle timeouts');
});

test('cleanCommitMessage strips wrapping quotes', () => {
  assert.equal(cleanCommitMessage('"fix: handle timeouts"'), 'fix: handle timeouts');
  assert.equal(cleanCommitMessage("'fix: handle timeouts'"), 'fix: handle timeouts');
});

test('cleanCommitMessage collapses runs of blank lines', () => {
  assert.equal(cleanCommitMessage('fix: x\n\n\n\nbody'), 'fix: x\n\nbody');
});

test('cleanCommitMessage returns null for empty output', () => {
  assert.equal(cleanCommitMessage(''), null);
  assert.equal(cleanCommitMessage('   '), null);
});

test('cleanCommitMessage caps pathological output', () => {
  const out = cleanCommitMessage('a'.repeat(5000));
  assert.equal(out?.length, 4000);
});

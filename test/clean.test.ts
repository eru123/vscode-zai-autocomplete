import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  capLines,
  dropProsePreamble,
  isRedundantWithSuffix,
  sanitizeCompletion,
  stripFences,
  trimPrefixEcho,
  trimSuffixOverlap,
} from '../src/clean';

test('stripFences removes a terminated fenced block', () => {
  assert.equal(stripFences('```python\n    return a + b\n```'), '    return a + b');
});

test('stripFences removes an unterminated opening fence', () => {
  assert.equal(stripFences('```js\nfoo();'), 'foo();');
});

test('stripFences keeps a fenced block preceded by prose', () => {
  assert.equal(stripFences('Here is the code:\n```ts\nfoo();\n```'), 'foo();');
});

test('stripFences leaves plain code alone', () => {
  assert.equal(stripFences('  x = 1;\n  y = 2;'), '  x = 1;\n  y = 2;');
});

test('dropProsePreamble drops a chatty first line', () => {
  assert.equal(dropProsePreamble("Here's the completion:\nfoo();"), 'foo();');
});

test('dropProsePreamble keeps code that merely starts with a word', () => {
  assert.equal(dropProsePreamble('sureFire();\nnext();'), 'sureFire();\nnext();');
});

test('trimPrefixEcho removes a repeated word before the cursor', () => {
  assert.equal(trimPrefixEcho('console.log(1)', 'const x = con'), 'sole.log(1)');
});

test('trimPrefixEcho keeps leading indentation', () => {
  assert.equal(trimPrefixEcho('    return a + b', 'def add(a, b):\n    '), '    return a + b');
});

test('trimPrefixEcho ignores short or whitespace-only overlaps', () => {
  assert.equal(trimPrefixEcho(' a', 'x '), ' a');
});

test('trimSuffixOverlap removes a doubled closing brace', () => {
  assert.equal(trimSuffixOverlap('return x\n}', '\n}\n'), 'return x');
});

test('trimSuffixOverlap keeps a word that merely ends like the suffix', () => {
  assert.equal(trimSuffixOverlap('return', 'rn more'), 'return');
});

test('trimSuffixOverlap leaves code without suffix overlap', () => {
  assert.equal(trimSuffixOverlap('return x', '\nnext();'), 'return x');
});

test('trimSuffixOverlap never empties the completion', () => {
  assert.equal(trimSuffixOverlap('}', '}'), '}');
});

test('capLines cuts at the limit', () => {
  assert.equal(capLines('a\nb\nc', 2), 'a\nb');
});

test('sanitizeCompletion runs the full pipeline', () => {
  const out = sanitizeCompletion(
    '```python\n    return a + b\n```',
    'def add(a, b):\n    ',
    '\n\ndef mul(a, b):',
    8
  );
  assert.equal(out, '    return a + b');
});

test('sanitizeCompletion drops a suggestion that repeats the word after the cursor', () => {
  const out = sanitizeCompletion('console.log(1);\n}', 'let x = con', 'sole.log(1);\n', 8);
  assert.equal(out, null);
});

test('isRedundantWithSuffix flags the rest-of-word echo', () => {
  assert.equal(isRedundantWithSuffix('sole.log(1);', 'sole.log(1);\n'), true);
});

test('isRedundantWithSuffix leaves ordinary continuations alone', () => {
  assert.equal(isRedundantWithSuffix('sole.log(1);', '\n}'), false);
  assert.equal(isRedundantWithSuffix('return true;', '\n}\n'), false);
});

test('sanitizeCompletion returns null for empty output', () => {
  assert.equal(sanitizeCompletion('   ', 'foo', 'bar', 8), null);
});

test('sanitizeCompletion caps long answers', () => {
  const raw = Array.from({ length: 20 }, (_, i) => `line(${i});`).join('\n');
  const out = sanitizeCompletion(raw, '', '', 5);
  assert.equal(out?.split('\n').length, 5);
});

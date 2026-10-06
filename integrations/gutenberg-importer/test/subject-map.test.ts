import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { CONTROLLED_CATEGORIES, parseSubjectMap, readSubjectMap } from '../src/subject-map.js';

test('accepts every controlled category', () => {
  const subjectMap = parseSubjectMap(JSON.stringify({ 84: CONTROLLED_CATEGORIES }));
  assert.deepEqual(subjectMap.get(84), [...CONTROLLED_CATEGORIES]);
});

test('trims subjects and removes exact duplicates', () => {
  const subjectMap = parseSubjectMap('{"84": ["  Psychology ", "Psychology", " psychology "]}');
  assert.deepEqual(subjectMap.get(84), ['Psychology']);
});

test('rejects malformed JSON', () => {
  assert.throws(() => parseSubjectMap('{'), /malformed JSON/);
});

test('rejects a non-object root', () => {
  assert.throws(() => parseSubjectMap('[]'), /expected a JSON object/);
});

test('rejects invalid IDs and subject values', () => {
  assert.throws(() => parseSubjectMap('{"0": ["History"]}'), /positive Gutenberg ID/);
  assert.throws(() => parseSubjectMap('{"84": []}'), /nonempty array/);
  assert.throws(() => parseSubjectMap('{"84": ["   "]}'), /nonempty string/);
  assert.throws(() => parseSubjectMap('{"84": ["History", 7]}'), /nonempty string/);
  assert.throws(() => parseSubjectMap('{"84": ["Cognitive science"]}'), /unsupported category/);
});

test('canonical subjects map has 61 IDs and the expected complete totals', async () => {
  const subjectMap = await readSubjectMap(fileURLToPath(new URL('../examples/subjects.json', import.meta.url)));
  const totals = Object.values(Object.fromEntries(subjectMap)).flat().reduce<Record<string, number>>((counts, category) => {
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});
  assert.equal(subjectMap.size, 61);
  assert.deepEqual(totals, {
    Literature: 49,
    History: 4,
    Psychology: 2,
    Engineering: 1,
    'Computer Science': 1,
    Photography: 1,
    Accounting: 1,
    Architecture: 1,
    'Business & Economics': 1,
  });
});
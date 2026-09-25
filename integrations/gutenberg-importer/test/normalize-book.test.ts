import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBook } from '../src/gutendex/normalize-book.js';

test('normalizes Unicode, whitespace, multiple authors, subjects, and formats', () => {
  const book = normalizeBook({
    id: 84,
    title: '  Frankenstein:   Or, the Modern Prometheus  ',
    authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }, { name: '  Editor  ' }],
    subjects: [' Gothic fiction ', 'Monsters & myths'],
    languages: ['en'],
    summaries: ['A summary with   meaningful punctuation...'],
    formats: { 'text/html': ' https://example.test/book?x=1&y=2 ', 'image/jpeg': 'not-a-url' },
    bookshelves: [' Science Fiction '],
    copyright: false,
    media_type: 'Text',
  }, 84);

  assert.equal(book.title, 'Frankenstein: Or, the Modern Prometheus');
  assert.deepEqual(book.authors.map((author) => author.name), ['Shelley, Mary', 'Editor']);
  assert.deepEqual(book.subjects, ['Gothic fiction', 'Monsters & myths']);
  assert.equal(book.formats.length, 1);
  assert.equal(book.formats[0]?.url, 'https://example.test/book?x=1&y=2');
});

test('rejects missing required IDs and titles', () => {
  assert.throws(() => normalizeBook({ title: 'No ID' }), /id must be a positive integer/);
  assert.throws(() => normalizeBook({ id: 11, title: '   ' }), /missing required title/);
});
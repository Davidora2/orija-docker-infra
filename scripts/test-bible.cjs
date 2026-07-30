const assert = require('assert');
const {
  parseReference,
  findReferencesInText,
  createBibleIndex,
  lookupReference,
  formatReference,
} = require('../server/bible.cjs');

const sample = createBibleIndex({
  translation: 'TEST',
  books: [
    {
      name: 'John',
      chapters: [
        {
          chapter: 3,
          verses: [
            { verse: 16, text: 'For God so loved the world…' },
            { verse: 17, text: 'For God did not send his Son…' },
          ],
        },
      ],
    },
    {
      name: '1 John',
      chapters: [
        {
          chapter: 4,
          verses: [{ verse: 8, text: 'He who does not love does not know God…' }],
        },
      ],
    },
    {
      name: 'Psalms',
      chapters: [
        {
          chapter: 23,
          verses: [{ verse: 1, text: 'Yahweh is my shepherd…' }],
        },
      ],
    },
  ],
});

assert.deepStrictEqual(parseReference('John 3:16'), {
  book: 'John',
  chapter: 3,
  verse: 16,
  endVerse: null,
  raw: 'John 3:16',
});

assert.equal(parseReference('1 John 4:8').book, '1 John');
assert.equal(parseReference('Psalm 23:1').book, 'Psalms');

const spoken = findReferencesInText('Turn with me to John chapter 3 verse 16 today');
assert.ok(spoken.length >= 1);
assert.equal(spoken[0].book, 'John');
assert.equal(spoken[0].chapter, 3);
assert.equal(spoken[0].verse, 16);

const verse = lookupReference(sample, 'John 3:16-17');
assert.equal(verse.reference, 'John 3:16-17');
assert.ok(verse.text.includes('loved the world'));
assert.ok(verse.text.includes('did not send'));

assert.equal(formatReference({ book: 'Romans', chapter: 8, verse: 28 }), 'Romans 8:28');

console.log('All bible/verse detection tests passed.');

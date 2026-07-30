const BOOK_ALIASES = [
  ['Genesis', ['genesis', 'gen', 'ge', 'gn']],
  ['Exodus', ['exodus', 'exod', 'exo', 'ex']],
  ['Leviticus', ['leviticus', 'lev', 'le', 'lv']],
  ['Numbers', ['numbers', 'num', 'nu', 'nm', 'nb']],
  ['Deuteronomy', ['deuteronomy', 'deut', 'de', 'dt']],
  ['Joshua', ['joshua', 'josh', 'jos', 'jsh']],
  ['Judges', ['judges', 'judg', 'jdg', 'jg', 'jdgs']],
  ['Ruth', ['ruth', 'rth', 'ru']],
  ['1 Samuel', ['1 samuel', '1samuel', '1 sam', '1sam', '1 sa', '1sa', '1sm', 'first samuel', 'i samuel']],
  ['2 Samuel', ['2 samuel', '2samuel', '2 sam', '2sam', '2 sa', '2sa', '2sm', 'second samuel', 'ii samuel']],
  ['1 Kings', ['1 kings', '1kings', '1 kgs', '1kgs', '1 ki', '1ki', '1k', 'first kings', 'i kings']],
  ['2 Kings', ['2 kings', '2kings', '2 kgs', '2kgs', '2 ki', '2ki', '2k', 'second kings', 'ii kings']],
  ['1 Chronicles', ['1 chronicles', '1chronicles', '1 chron', '1chron', '1 chr', '1chr', '1 ch', '1ch', 'first chronicles', 'i chronicles']],
  ['2 Chronicles', ['2 chronicles', '2chronicles', '2 chron', '2chron', '2 chr', '2chr', '2 ch', '2ch', 'second chronicles', 'ii chronicles']],
  ['Ezra', ['ezra', 'ezr', 'ez']],
  ['Nehemiah', ['nehemiah', 'neh', 'ne']],
  ['Esther', ['esther', 'esth', 'est', 'es']],
  ['Job', ['job', 'jb']],
  ['Psalms', ['psalms', 'psalm', 'psa', 'ps', 'psm', 'pss']],
  ['Proverbs', ['proverbs', 'prov', 'pro', 'prv', 'pr']],
  ['Ecclesiastes', ['ecclesiastes', 'eccles', 'eccl', 'ecc', 'ec']],
  ['Song of Solomon', ['song of solomon', 'song of songs', 'song', 'songs', 'sos', 'so', 'canticle']],
  ['Isaiah', ['isaiah', 'isa', 'is']],
  ['Jeremiah', ['jeremiah', 'jer', 'je', 'jr']],
  ['Lamentations', ['lamentations', 'lam', 'la']],
  ['Ezekiel', ['ezekiel', 'ezek', 'eze', 'ezk']],
  ['Daniel', ['daniel', 'dan', 'da', 'dn']],
  ['Hosea', ['hosea', 'hos', 'ho']],
  ['Joel', ['joel', 'jl']],
  ['Amos', ['amos', 'am']],
  ['Obadiah', ['obadiah', 'obad', 'ob']],
  ['Jonah', ['jonah', 'jon', 'jnh']],
  ['Micah', ['micah', 'mic', 'mc']],
  ['Nahum', ['nahum', 'nah', 'na']],
  ['Habakkuk', ['habakkuk', 'hab', 'hb']],
  ['Zephaniah', ['zephaniah', 'zeph', 'zep', 'zp']],
  ['Haggai', ['haggai', 'hag', 'hg']],
  ['Zechariah', ['zechariah', 'zech', 'zec', 'zc']],
  ['Malachi', ['malachi', 'mal', 'ml']],
  ['Matthew', ['matthew', 'matt', 'mat', 'mt']],
  ['Mark', ['mark', 'mrk', 'mar', 'mk', 'mr']],
  ['Luke', ['luke', 'luk', 'lk']],
  ['John', ['john', 'joh', 'jhn', 'jn']],
  ['Acts', ['acts', 'act', 'ac']],
  ['Romans', ['romans', 'rom', 'ro', 'rm']],
  ['1 Corinthians', ['1 corinthians', '1corinthians', '1 cor', '1cor', '1 co', '1co', 'first corinthians', 'i corinthians']],
  ['2 Corinthians', ['2 corinthians', '2corinthians', '2 cor', '2cor', '2 co', '2co', 'second corinthians', 'ii corinthians']],
  ['Galatians', ['galatians', 'gal', 'ga']],
  ['Ephesians', ['ephesians', 'eph', 'ephes']],
  ['Philippians', ['philippians', 'phil', 'php', 'pp']],
  ['Colossians', ['colossians', 'col', 'co']],
  ['1 Thessalonians', ['1 thessalonians', '1thessalonians', '1 thess', '1thess', '1 th', '1th', '1 thes', '1thes', 'first thessalonians', 'i thessalonians']],
  ['2 Thessalonians', ['2 thessalonians', '2thessalonians', '2 thess', '2thess', '2 th', '2th', '2 thes', '2thes', 'second thessalonians', 'ii thessalonians']],
  ['1 Timothy', ['1 timothy', '1timothy', '1 tim', '1tim', '1 ti', '1ti', 'first timothy', 'i timothy']],
  ['2 Timothy', ['2 timothy', '2timothy', '2 tim', '2tim', '2 ti', '2ti', 'second timothy', 'ii timothy']],
  ['Titus', ['titus', 'tit', 'ti']],
  ['Philemon', ['philemon', 'phlm', 'phm', 'pm']],
  ['Hebrews', ['hebrews', 'heb', 'he']],
  ['James', ['james', 'jas', 'jm']],
  ['1 Peter', ['1 peter', '1peter', '1 pet', '1pet', '1 pe', '1pe', '1 pt', '1pt', 'first peter', 'i peter']],
  ['2 Peter', ['2 peter', '2peter', '2 pet', '2pet', '2 pe', '2pe', '2 pt', '2pt', 'second peter', 'ii peter']],
  ['1 John', ['1 john', '1john', '1 jn', '1jn', '1 jo', '1jo', '1 jhn', '1jhn', 'first john', 'i john']],
  ['2 John', ['2 john', '2john', '2 jn', '2jn', '2 jo', '2jo', '2 jhn', '2jhn', 'second john', 'ii john']],
  ['3 John', ['3 john', '3john', '3 jn', '3jn', '3 jo', '3jo', '3 jhn', '3jhn', 'third john', 'iii john']],
  ['Jude', ['jude', 'jud', 'jd']],
  ['Revelation', ['revelation', 'revelations', 'rev', 're', 'rv', 'apocalypse']],
];

const ALIAS_TO_BOOK = new Map();
for (const [canonical, aliases] of BOOK_ALIASES) {
  ALIAS_TO_BOOK.set(canonical.toLowerCase(), canonical);
  for (const a of aliases) ALIAS_TO_BOOK.set(a.toLowerCase(), canonical);
}

// Sort aliases longest-first for matching
const SORTED_ALIASES = [...ALIAS_TO_BOOK.keys()].sort((a, b) => b.length - a.length);

const REF_PATTERN =
  /\b((?:[123]|first|second|third|i{1,3})\s*)?([A-Za-z]+(?:\s+of\s+[A-Za-z]+)?)\s+(\d{1,3})\s*[:.\s]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?\b/gi;

const SPOKEN_PATTERN =
  /\b((?:first|second|third|one|two|three|1|2|3)\s+)?(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|song of (?:solomon|songs)|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\s+(?:chapter\s+)?(\d{1,3})\s*(?:verse|verses|v\.?)?\s*(\d{1,3})(?:\s*(?:through|to|[-–—])\s*(\d{1,3}))?\b/gi;

function normalizeSpokenBook(prefix, name) {
  const p = (prefix || '').trim().toLowerCase();
  const n = name.toLowerCase();
  let key = n;
  if (p) {
    const num =
      p.startsWith('first') || p === '1' || p === 'one' || p === 'i'
        ? '1'
        : p.startsWith('second') || p === '2' || p === 'two' || p === 'ii'
          ? '2'
          : p.startsWith('third') || p === '3' || p === 'three' || p === 'iii'
            ? '3'
            : '';
    if (num) key = `${num} ${n}`;
  }
  if (key === 'psalm') key = 'psalms';
  return ALIAS_TO_BOOK.get(key) || null;
}

function createBibleIndex(raw) {
  const books = {};
  const bookNames = [];
  for (const book of raw.books || []) {
    bookNames.push(book.name);
    const chapters = {};
    for (const ch of book.chapters || []) {
      const verses = {};
      for (const v of ch.verses || []) {
        verses[String(v.verse)] = v.text;
      }
      chapters[String(ch.chapter)] = verses;
    }
    books[book.name] = chapters;
  }
  return {
    translation: raw.translation || 'WEB',
    books,
    bookNames,
  };
}

function resolveBookName(name) {
  if (!name) return null;
  const cleaned = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIAS_TO_BOOK.get(cleaned) || null;
}

function parseReference(text) {
  if (!text) return null;
  const cleaned = String(text).trim();

  // Direct: "John 3:16" or "1 John 4:8-10"
  REF_PATTERN.lastIndex = 0;
  let m = REF_PATTERN.exec(cleaned);
  if (m) {
    const bookPart = `${m[1] || ''}${m[2]}`.trim();
    const book = resolveBookName(bookPart);
    if (book) {
      return {
        book,
        chapter: Number(m[3]),
        verse: Number(m[4]),
        endVerse: m[5] ? Number(m[5]) : null,
        raw: m[0],
      };
    }
  }

  // Spoken style
  SPOKEN_PATTERN.lastIndex = 0;
  m = SPOKEN_PATTERN.exec(cleaned);
  if (m) {
    const book = normalizeSpokenBook(m[1], m[2]);
    if (book) {
      return {
        book,
        chapter: Number(m[3]),
        verse: Number(m[4]),
        endVerse: m[5] ? Number(m[5]) : null,
        raw: m[0],
      };
    }
  }

  return null;
}

function findReferencesInText(text) {
  if (!text) return [];
  const found = [];
  const seen = new Set();

  const patterns = [REF_PATTERN, SPOKEN_PATTERN];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      let ref;
      if (pattern === REF_PATTERN) {
        const bookPart = `${m[1] || ''}${m[2]}`.trim();
        const book = resolveBookName(bookPart);
        if (!book) continue;
        ref = {
          book,
          chapter: Number(m[3]),
          verse: Number(m[4]),
          endVerse: m[5] ? Number(m[5]) : null,
          raw: m[0],
          index: m.index,
        };
      } else {
        const book = normalizeSpokenBook(m[1], m[2]);
        if (!book) continue;
        ref = {
          book,
          chapter: Number(m[3]),
          verse: Number(m[4]),
          endVerse: m[5] ? Number(m[5]) : null,
          raw: m[0],
          index: m.index,
        };
      }
      const key = `${ref.book}:${ref.chapter}:${ref.verse}:${ref.endVerse || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push(ref);
      }
    }
  }

  return found.sort((a, b) => a.index - b.index);
}

function formatReference(ref) {
  if (!ref) return '';
  if (ref.endVerse && ref.endVerse !== ref.verse) {
    return `${ref.book} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
  }
  return `${ref.book} ${ref.chapter}:${ref.verse}`;
}

function lookupReference(bible, input) {
  const ref = typeof input === 'string' ? parseReference(input) : input;
  if (!ref || !bible?.books?.[ref.book]) return null;

  const chapter = bible.books[ref.book][String(ref.chapter)];
  if (!chapter) return null;

  const start = ref.verse;
  const end = ref.endVerse && ref.endVerse >= start ? ref.endVerse : start;
  const parts = [];
  for (let v = start; v <= end; v++) {
    const text = chapter[String(v)];
    if (text) parts.push(text);
  }
  if (!parts.length) return null;

  return {
    book: ref.book,
    chapter: ref.chapter,
    verse: start,
    endVerse: end !== start ? end : null,
    reference: formatReference({ ...ref, verse: start, endVerse: end !== start ? end : null }),
    text: parts.join(' '),
    translation: bible.translation,
  };
}

function searchText(bible, query, limit = 20) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  // Prefer exact reference lookup
  const direct = lookupReference(bible, q);
  if (direct) return [direct];

  const results = [];
  for (const bookName of bible.bookNames) {
    const chapters = bible.books[bookName];
    for (const [ch, verses] of Object.entries(chapters)) {
      for (const [v, text] of Object.entries(verses)) {
        if (text.toLowerCase().includes(q)) {
          results.push({
            book: bookName,
            chapter: Number(ch),
            verse: Number(v),
            endVerse: null,
            reference: `${bookName} ${ch}:${v}`,
            text,
            translation: bible.translation,
          });
          if (results.length >= limit) return results;
        }
      }
    }
  }
  return results;
}

module.exports = {
  createBibleIndex,
  lookupReference,
  searchText,
  parseReference,
  findReferencesInText,
  formatReference,
  BOOK_ALIASES,
};

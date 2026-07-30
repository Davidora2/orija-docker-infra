const BOOK_ALIASES = [
  ['Genesis', ['genesis', 'gen', 'ge', 'gn']],
  ['Exodus', ['exodus', 'exod', 'exo', 'ex']],
  ['Leviticus', ['leviticus', 'lev', 'le', 'lv']],
  ['Numbers', ['numbers', 'num', 'nu', 'nm', 'nb']],
  ['Deuteronomy', ['deuteronomy', 'deut', 'de', 'dt']],
  ['Joshua', ['joshua', 'josh', 'jos', 'jsh']],
  ['Judges', ['judges', 'judg', 'jdg', 'jg', 'jdgs']],
  ['Ruth', ['ruth', 'rth', 'ru']],
  ['1 Samuel', ['1 samuel', '1samuel', '1 sam', '1sam', '1 sa', '1sa', 'first samuel', 'i samuel']],
  ['2 Samuel', ['2 samuel', '2samuel', '2 sam', '2sam', '2 sa', '2sa', 'second samuel', 'ii samuel']],
  ['1 Kings', ['1 kings', '1kings', '1 kgs', '1kgs', '1 ki', '1ki', 'first kings', 'i kings']],
  ['2 Kings', ['2 kings', '2kings', '2 kgs', '2kgs', '2 ki', '2ki', 'second kings', 'ii kings']],
  ['1 Chronicles', ['1 chronicles', '1chronicles', '1 chron', '1chron', '1 chr', '1chr', 'first chronicles']],
  ['2 Chronicles', ['2 chronicles', '2chronicles', '2 chron', '2chron', '2 chr', '2chr', 'second chronicles']],
  ['Ezra', ['ezra', 'ezr']],
  ['Nehemiah', ['nehemiah', 'neh', 'ne']],
  ['Esther', ['esther', 'esth', 'est']],
  ['Job', ['job', 'jb']],
  ['Psalms', ['psalms', 'psalm', 'psa', 'ps', 'psm']],
  ['Proverbs', ['proverbs', 'prov', 'pro', 'prv']],
  ['Ecclesiastes', ['ecclesiastes', 'eccles', 'eccl', 'ecc']],
  ['Song of Solomon', ['song of solomon', 'song of songs', 'song', 'songs', 'sos']],
  ['Isaiah', ['isaiah', 'isa', 'is']],
  ['Jeremiah', ['jeremiah', 'jer', 'je']],
  ['Lamentations', ['lamentations', 'lam', 'la']],
  ['Ezekiel', ['ezekiel', 'ezek', 'eze']],
  ['Daniel', ['daniel', 'dan', 'da']],
  ['Hosea', ['hosea', 'hos', 'ho']],
  ['Joel', ['joel', 'jl']],
  ['Amos', ['amos', 'am']],
  ['Obadiah', ['obadiah', 'obad', 'ob']],
  ['Jonah', ['jonah', 'jon']],
  ['Micah', ['micah', 'mic']],
  ['Nahum', ['nahum', 'nah']],
  ['Habakkuk', ['habakkuk', 'hab']],
  ['Zephaniah', ['zephaniah', 'zeph', 'zep']],
  ['Haggai', ['haggai', 'hag']],
  ['Zechariah', ['zechariah', 'zech', 'zec']],
  ['Malachi', ['malachi', 'mal']],
  ['Matthew', ['matthew', 'matt', 'mat', 'mt']],
  ['Mark', ['mark', 'mrk', 'mar', 'mk']],
  ['Luke', ['luke', 'luk', 'lk']],
  ['John', ['john', 'joh', 'jhn', 'jn']],
  ['Acts', ['acts', 'act', 'ac']],
  ['Romans', ['romans', 'rom', 'ro', 'rm']],
  ['1 Corinthians', ['1 corinthians', '1corinthians', '1 cor', '1cor', '1 co', 'first corinthians']],
  ['2 Corinthians', ['2 corinthians', '2corinthians', '2 cor', '2cor', '2 co', 'second corinthians']],
  ['Galatians', ['galatians', 'gal', 'ga']],
  ['Ephesians', ['ephesians', 'eph']],
  ['Philippians', ['philippians', 'phil', 'php']],
  ['Colossians', ['colossians', 'col']],
  ['1 Thessalonians', ['1 thessalonians', '1thessalonians', '1 thess', '1thess', '1 th', 'first thessalonians']],
  ['2 Thessalonians', ['2 thessalonians', '2thessalonians', '2 thess', '2thess', '2 th', 'second thessalonians']],
  ['1 Timothy', ['1 timothy', '1timothy', '1 tim', '1tim', 'first timothy']],
  ['2 Timothy', ['2 timothy', '2timothy', '2 tim', '2tim', 'second timothy']],
  ['Titus', ['titus', 'tit']],
  ['Philemon', ['philemon', 'phlm', 'phm']],
  ['Hebrews', ['hebrews', 'heb']],
  ['James', ['james', 'jas', 'jm']],
  ['1 Peter', ['1 peter', '1peter', '1 pet', '1pet', 'first peter']],
  ['2 Peter', ['2 peter', '2peter', '2 pet', '2pet', 'second peter']],
  ['1 John', ['1 john', '1john', '1 jn', '1jn', 'first john']],
  ['2 John', ['2 john', '2john', '2 jn', '2jn', 'second john']],
  ['3 John', ['3 john', '3john', '3 jn', '3jn', 'third john']],
  ['Jude', ['jude', 'jud']],
  ['Revelation', ['revelation', 'revelations', 'rev', 're']],
];

const ALIAS_TO_BOOK = new Map();
for (const [canonical, aliases] of BOOK_ALIASES) {
  ALIAS_TO_BOOK.set(canonical.toLowerCase(), canonical);
  for (const a of aliases) ALIAS_TO_BOOK.set(a.toLowerCase(), canonical);
}

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

function resolveBookName(name) {
  return ALIAS_TO_BOOK.get(name.trim().toLowerCase().replace(/\s+/g, ' ')) || null;
}

export function findReferencesInText(text) {
  if (!text) return [];
  const found = [];
  const seen = new Set();

  for (const pattern of [REF_PATTERN, SPOKEN_PATTERN]) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      let book;
      if (pattern === REF_PATTERN) {
        book = resolveBookName(`${m[1] || ''}${m[2]}`.trim());
      } else {
        book = normalizeSpokenBook(m[1], m[2]);
      }
      if (!book) continue;
      const ref = {
        book,
        chapter: Number(m[3]),
        verse: Number(m[4]),
        endVerse: m[5] ? Number(m[5]) : null,
        raw: m[0],
      };
      const key = `${ref.book}:${ref.chapter}:${ref.verse}:${ref.endVerse || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push(ref);
      }
    }
  }
  return found;
}

export function formatReference(ref) {
  if (!ref) return '';
  if (ref.endVerse && ref.endVerse !== ref.verse) {
    return `${ref.book} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
  }
  return `${ref.book} ${ref.chapter}:${ref.verse}`;
}

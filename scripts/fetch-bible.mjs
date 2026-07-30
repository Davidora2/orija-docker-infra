/**
 * Builds a compact Bible dataset for VerseCast (public-domain English text).
 * Run: node scripts/fetch-bible.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'data', 'bible', 'web.json');

const SOURCES = [
  {
    url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json',
    translation: 'BBE',
    format: 'thiago',
  },
  {
    url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json',
    translation: 'KJV',
    format: 'thiago',
  },
];

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'VerseCast/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchBuffer(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

function convertThiago(data, translation) {
  const books = [];
  for (const book of data) {
    const chapters = (book.chapters || []).map((verses, idx) => ({
      chapter: idx + 1,
      verses: (verses || []).map((text, vIdx) => ({
        verse: vIdx + 1,
        text: String(text).trim(),
      })),
    }));
    books.push({ name: book.name, chapters });
  }
  return { translation, books };
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  for (const source of SOURCES) {
    try {
      console.log(`Downloading ${source.translation} from ${source.url}…`);
      const buf = await fetchBuffer(source.url);
      const text = buf.toString('utf8').replace(/^\uFEFF/, '');
      const data = JSON.parse(text);
      const converted = convertThiago(data, source.translation);
      fs.writeFileSync(OUT, JSON.stringify(converted));
      console.log(`Wrote ${converted.books.length} books (${source.translation}) to ${OUT}`);
      return;
    } catch (err) {
      console.warn(`Failed ${source.translation}:`, err.message);
    }
  }

  console.warn('All downloads failed; writing built-in sermon corpus.');
  const { BUILTIN } = await import('./builtin-bible.mjs');
  fs.writeFileSync(OUT, JSON.stringify(BUILTIN, null, 2));
  console.log(`Wrote built-in corpus to ${OUT}`);
}

main();

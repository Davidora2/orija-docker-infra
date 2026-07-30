/**
 * Quick node smoke test for Lightroom XMP / lrtemplate parsing.
 * Run: npx tsx scripts/test-xmp.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  looksLikeLightroomPreset,
  parseLightroomXmp,
  parseLrTemplate,
} from '../src/lib/xmpParser';

const sample = fs.readFileSync(
  path.join(__dirname, '../assets/presets/sample-golden-film.xmp'),
  'utf8',
);

console.assert(looksLikeLightroomPreset(sample), 'should detect XMP');
const parsed = parseLightroomXmp(sample);
console.assert(parsed.name === 'Sample Golden Film', `name=${parsed.name}`);
console.assert(parsed.adjustments.exposure === 0.35, `exp=${parsed.adjustments.exposure}`);
console.assert(parsed.adjustments.contrast === 22, `con=${parsed.adjustments.contrast}`);
console.assert(parsed.adjustments.highlights === -35);
console.assert(parsed.adjustments.vibrance === 24);
console.assert(parsed.adjustments.grain === 15);
console.assert(
  parsed.adjustments.temperature > 0,
  `temp relative should be warm, got ${parsed.adjustments.temperature}`,
);

const lr = `
s = {
  id = "0",
  internalName = "Test",
  title = "Lua Warm",
  type = "Develop",
  value = {
    settings = {
      Exposure2012 = 0.5,
      Contrast2012 = 10,
      Temperature = 5800,
      Vibrance = 20,
    },
  },
}
`;
const lrParsed = parseLrTemplate(lr);
console.assert(lrParsed != null, 'lrtemplate parse');
console.assert(lrParsed!.name === 'Lua Warm');
console.assert(lrParsed!.adjustments.exposure === 0.5);
console.assert(lrParsed!.adjustments.vibrance === 20);

console.log('All XMP parser checks passed.');
console.log(JSON.stringify(parsed, null, 2));

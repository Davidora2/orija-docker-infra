/**
 * Tests for XMP + DNG preset import.
 * Run: npx tsx scripts/test-xmp.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  looksLikeLightroomPreset,
  parseLightroomXmp,
  parseLrTemplate,
} from '../src/lib/xmpParser';
import {
  extractXmpFromDng,
  extractXmpFromTiffIfd,
  importPresetFromBytes,
} from '../src/lib/dngPreset';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

const root = path.join(__dirname, '..');

const sample = fs.readFileSync(
  path.join(root, 'assets/presets/sample-golden-film.xmp'),
  'utf8',
);

assert(looksLikeLightroomPreset(sample), 'should detect XMP');
const parsed = parseLightroomXmp(sample);
assert(parsed.name === 'Sample Golden Film', `name=${parsed.name}`);
assert(parsed.adjustments.exposure === 0.35, `exp=${parsed.adjustments.exposure}`);
assert(parsed.adjustments.contrast === 22, `con=${parsed.adjustments.contrast}`);
assert(parsed.adjustments.highlights === -35, 'highlights');
assert(parsed.adjustments.vibrance === 24, 'vibrance');
assert(parsed.adjustments.grain === 15, 'grain');
assert(
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
assert(lrParsed != null, 'lrtemplate parse');
assert(lrParsed!.name === 'Lua Warm', 'lr name');
assert(lrParsed!.adjustments.exposure === 0.5, 'lr exposure');
assert(lrParsed!.adjustments.vibrance === 20, 'lr vibrance');

// --- DNG with embedded XMP packet ---
const dngPath = path.join(root, 'assets/presets/sample-settings.dng');
const dngBytes = new Uint8Array(fs.readFileSync(dngPath));
const dngXmp = extractXmpFromDng(dngBytes);
assert(dngXmp != null, 'extract XMP from DNG blob');
assert(
  /From DNG Sample/.test(dngXmp!),
  `dng xmp missing name: ${dngXmp?.slice(0, 120)}`,
);

const dngImport = importPresetFromBytes(dngBytes, 'sample-settings.dng');
assert(dngImport.ok, 'dng import ok');
if (dngImport.ok) {
  assert(dngImport.source === 'dng', `source=${dngImport.source}`);
  assert(
    dngImport.preset.name === 'From DNG Sample',
    `dng preset name=${dngImport.preset.name}`,
  );
  assert(
    dngImport.preset.adjustments.exposure === 0.8,
    `dng exp=${dngImport.preset.adjustments.exposure}`,
  );
  assert(dngImport.preset.adjustments.vibrance === 28, 'dng vibrance');
  assert(dngImport.preset.adjustments.highlights === -40, 'dng highlights');
}

// --- Proper TIFF IFD with tag 700 ---
function buildTiffWithXmp(xmp: string): Uint8Array {
  const xmpBytes = Buffer.from(xmp, 'utf8');
  const entryCount = 10;
  const ifdOffset = 8;
  const ifdSize = 2 + entryCount * 12 + 4;
  const stripOffset = ifdOffset + ifdSize;
  const strip = Buffer.from([20, 40, 60]);
  const xmpOffset = stripOffset + strip.length;

  const buf = Buffer.alloc(xmpOffset + xmpBytes.length + 8);
  buf.writeUInt8(0x49, 0);
  buf.writeUInt8(0x49, 1);
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(ifdOffset, 4);

  buf.writeUInt16LE(entryCount, ifdOffset);
  let p = ifdOffset + 2;

  function writeEntry(
    tag: number,
    type: number,
    count: number,
    value: number,
  ) {
    buf.writeUInt16LE(tag, p);
    buf.writeUInt16LE(type, p + 2);
    buf.writeUInt32LE(count, p + 4);
    buf.writeUInt32LE(value, p + 8);
    p += 12;
  }

  writeEntry(256, 3, 1, 1);
  writeEntry(257, 3, 1, 1);
  writeEntry(258, 3, 1, 8);
  writeEntry(259, 3, 1, 1);
  writeEntry(262, 3, 1, 2);
  writeEntry(273, 4, 1, stripOffset);
  writeEntry(277, 3, 1, 3);
  writeEntry(278, 3, 1, 1);
  writeEntry(279, 4, 1, strip.length);
  writeEntry(700, 1, xmpBytes.length, xmpOffset);

  buf.writeUInt32LE(0, p);
  strip.copy(buf, stripOffset);
  xmpBytes.copy(buf, xmpOffset);
  return new Uint8Array(buf);
}

const tiffXmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
    crs:Exposure2012="-0.25"
    crs:Contrast2012="+40"
    crs:Temperature="6500"
    crs:Vibrance="+18"
    crs:Name="TIFF Tag700"
    crs:HasSettings="True"/>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

const tiffBytes = buildTiffWithXmp(tiffXmp);
const fromIfd = extractXmpFromTiffIfd(tiffBytes);
assert(fromIfd != null, 'IFD tag 700 extract');
assert(/TIFF Tag700/.test(fromIfd!), 'IFD xmp content');

const tiffImport = importPresetFromBytes(tiffBytes, 'look.dng');
assert(tiffImport.ok && tiffImport.source === 'dng', 'tiff/dng import');
if (tiffImport.ok) {
  assert(tiffImport.preset.name === 'TIFF Tag700', 'tiff name');
  assert(tiffImport.preset.adjustments.exposure === -0.25, 'tiff exposure');
  assert(tiffImport.preset.adjustments.contrast === 40, 'tiff contrast');
}

// XMP via unified importer
const xmpImport = importPresetFromBytes(
  new Uint8Array(Buffer.from(sample, 'utf8')),
  'sample-golden-film.xmp',
);
assert(xmpImport.ok && xmpImport.source === 'xmp', 'xmp import path');

console.log('All XMP + DNG parser checks passed.');
console.log(
  JSON.stringify(
    {
      xmp: parsed.name,
      dng: dngImport.ok ? dngImport.preset.name : null,
      tiff: tiffImport.ok ? tiffImport.preset.name : null,
    },
    null,
    2,
  ),
);

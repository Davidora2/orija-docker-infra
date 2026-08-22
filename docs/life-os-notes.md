# Life OS rich notes

Project and Idea detail notes use two synchronized fields in `life_items.body`:

- `notesMarkdown`: canonical, portable source (maximum 32,768 characters).
- `notesBlocks`: `{ "version": 1, "blocks": [...] }`, the visual editor model
  materialized from the canonical Markdown (maximum 200 blocks).

Quick capture continues to write the legacy `note` field. A detail editor loads
`notesMarkdown` first, then a valid `notesBlocks` document, then `note` as a
read-only fallback. The first edit saves both rich fields without deleting or
rewriting `note`, so older clients remain safe.

## Canonical conversion rules

Blank lines separate blocks. The supported lossless block mappings are:

| Visual block | Canonical Markdown |
| --- | --- |
| Paragraph | Plain text; structural leading characters are escaped |
| Heading | `#`, `##`, or `###` plus one space |
| Bullet list | One `- item` per line |
| Number list | Consecutive `1. item`, `2. item` lines |
| Checklist | `- [ ] item` or `- [x] item` |
| Quote | One `> ` prefix per line |
| Link | A standalone `[label](url)` block |
| Code | Fenced code with an optional simple language token |
| Divider | `---` |

Switching to Visual parses the current Markdown. Switching to Markdown serializes
the current blocks. Visual edits always regenerate `notesMarkdown` and
`notesBlocks` together. Block IDs are deterministic implementation metadata and
do not affect Markdown.

Markdown outside this subset remains safe and visible, but may normalize to
paragraph blocks in Visual mode. Nested lists, tables, images, inline formatting
as editable marks, reference links, footnotes, and raw HTML blocks are not
first-class visual blocks in this slice. Web preview supports safe GFM display;
mobile preview intentionally renders only the strict block allowlist.

Links allow only `https:`, `http:`, `mailto:`, root-relative paths, and in-page
fragments. Web Markdown renders without raw HTML and passes through a sanitizing
allowlist. Mobile uses native text components and opens only links accepted by
the same protocol allowlist.

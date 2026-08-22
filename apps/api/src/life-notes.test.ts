import {
  markdownToNotesDocument,
  notesDocumentToMarkdown,
  safeLinkUrl,
  type NotesDocument,
} from '@life-os/notes';
import { describe, expect, it } from 'vitest';
import {
  MAX_NOTE_BLOCKS,
  MAX_NOTES_MARKDOWN,
  lifeItemBodySchema,
} from './life-notes.js';

const supportedMarkdown = `# Project brief

Keep the scope calm and clear.

- First item
- Second item

1. Draft
2. Review

- [x] Confirm goal
- [ ] Share update

> A useful constraint

[Life OS docs](https://example.com/docs)

\`\`\`ts
const safe = true;
\`\`\`

---`;

describe('Life OS rich notes validation and conversion', () => {
  it('round-trips every supported block through canonical Markdown', () => {
    const document = markdownToNotesDocument(supportedMarkdown);
    expect(document.blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'numberList',
      'checklist',
      'quote',
      'link',
      'code',
      'divider',
    ]);

    const canonical = notesDocumentToMarkdown(document);
    expect(notesDocumentToMarkdown(markdownToNotesDocument(canonical))).toBe(
      canonical,
    );
    expect(
      lifeItemBodySchema.safeParse({
        notesMarkdown: canonical,
        notesBlocks: document,
      }).success,
    ).toBe(true);
  });

  it('rejects malformed, unversioned, and oversized note payloads', () => {
    const malformed: NotesDocument = {
      version: 1,
      blocks: [
        {
          id: 'heading-1',
          type: 'heading',
          level: 2,
          text: 'Valid shape before tampering',
        },
      ],
    };
    (malformed.blocks[0] as { level: number }).level = 7;
    expect(
      lifeItemBodySchema.safeParse({ notesBlocks: malformed }).success,
    ).toBe(false);
    expect(
      lifeItemBodySchema.safeParse({
        notesBlocks: { version: 2, blocks: [] },
      }).success,
    ).toBe(false);
    expect(
      lifeItemBodySchema.safeParse({
        notesMarkdown: 'x'.repeat(MAX_NOTES_MARKDOWN + 1),
      }).success,
    ).toBe(false);
    expect(
      lifeItemBodySchema.safeParse({
        notesBlocks: {
          version: 1,
          blocks: Array.from({ length: MAX_NOTE_BLOCKS + 1 }, (_, index) => ({
            id: `paragraph-${index}`,
            type: 'paragraph',
            text: '',
          })),
        },
      }).success,
    ).toBe(false);
    expect(
      lifeItemBodySchema.safeParse({
        notesBlocks: {
          version: 1,
          blocks: [
            {
              id: 'code-1',
              type: 'code',
              code: 'x'.repeat(8_193),
              language: 'js',
            },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it('blocks executable link protocols and treats raw HTML as inert text', () => {
    expect(safeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(safeLinkUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeLinkUrl('https://example.com')).toBe('https://example.com');
    expect(safeLinkUrl('mailto:hello@example.com')).toBe(
      'mailto:hello@example.com',
    );

    const injected = markdownToNotesDocument(
      '<img src=x onerror=alert(1)>\n\n[open](javascript:alert(1))',
    );
    expect(injected.blocks.every((block) => block.type === 'paragraph')).toBe(
      true,
    );
    expect(notesDocumentToMarkdown(injected)).toContain(
      '<img src=x onerror=alert(1)>',
    );
    expect(
      lifeItemBodySchema.safeParse({
        notesBlocks: {
          version: 1,
          blocks: [
            {
              id: 'bad-link',
              type: 'link',
              text: 'Open',
              url: 'javascript:alert(1)',
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});

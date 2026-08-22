import { z } from 'zod';

export const MAX_NOTES_MARKDOWN = 32_768;
export const MAX_NOTE_BLOCKS = 200;

const blockId = z.string().min(1).max(80);
const text = z.string().max(4_096);
const shortText = z.string().max(1_000);
const listItems = z.array(shortText).max(100);
const safeLink = z
  .string()
  .max(2_048)
  .refine((value) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
    if (trimmed.startsWith('#')) return true;
    try {
      return ['http:', 'https:', 'mailto:'].includes(
        new URL(trimmed).protocol.toLowerCase(),
      );
    } catch {
      return false;
    }
  }, 'Link protocol is not allowed.');

export const noteBlockSchema = z.discriminatedUnion('type', [
  z.object({ id: blockId, type: z.literal('paragraph'), text }).strict(),
  z
    .object({
      id: blockId,
      type: z.literal('heading'),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      text: shortText,
    })
    .strict(),
  z
    .object({ id: blockId, type: z.literal('bulletList'), items: listItems })
    .strict(),
  z
    .object({ id: blockId, type: z.literal('numberList'), items: listItems })
    .strict(),
  z
    .object({
      id: blockId,
      type: z.literal('checklist'),
      items: z
        .array(z.object({ text: shortText, checked: z.boolean() }).strict())
        .max(100),
    })
    .strict(),
  z.object({ id: blockId, type: z.literal('quote'), text }).strict(),
  z
    .object({
      id: blockId,
      type: z.literal('link'),
      text: shortText,
      url: safeLink,
    })
    .strict(),
  z
    .object({
      id: blockId,
      type: z.literal('code'),
      code: z.string().max(8_192),
      language: z.string().max(32).regex(/^[A-Za-z0-9_+-]*$/),
    })
    .strict(),
  z.object({ id: blockId, type: z.literal('divider') }).strict(),
]);

export const notesDocumentSchema = z
  .object({
    version: z.literal(1),
    blocks: z.array(noteBlockSchema).max(MAX_NOTE_BLOCKS),
  })
  .strict();

export const lifeItemBodySchema = z
  .record(z.string(), z.unknown())
  .superRefine((body, context) => {
    if (Object.prototype.hasOwnProperty.call(body, 'notesMarkdown')) {
      const parsed = z.string().max(MAX_NOTES_MARKDOWN).safeParse(body.notesMarkdown);
      if (!parsed.success) {
        context.addIssue({
          code: 'custom',
          path: ['notesMarkdown'],
          message: `Notes Markdown must be at most ${MAX_NOTES_MARKDOWN} characters.`,
        });
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'notesBlocks')) {
      const parsed = notesDocumentSchema.safeParse(body.notesBlocks);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          context.addIssue({
            code: 'custom',
            path: ['notesBlocks', ...issue.path],
            message: issue.message,
          });
        }
      }
    }
  });

export const NOTES_DOCUMENT_VERSION: 1;
export const MAX_NOTES_MARKDOWN: 32768;
export const MAX_NOTE_BLOCKS: 200;

export type ParagraphBlock = { id: string; type: "paragraph"; text: string };
export type HeadingBlock = {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
};
export type BulletListBlock = {
  id: string;
  type: "bulletList";
  items: string[];
};
export type NumberListBlock = {
  id: string;
  type: "numberList";
  items: string[];
};
export type ChecklistBlock = {
  id: string;
  type: "checklist";
  items: { text: string; checked: boolean }[];
};
export type QuoteBlock = { id: string; type: "quote"; text: string };
export type LinkBlock = {
  id: string;
  type: "link";
  text: string;
  url: string;
};
export type CodeBlock = {
  id: string;
  type: "code";
  code: string;
  language: string;
};
export type DividerBlock = { id: string; type: "divider" };

export type NoteBlock =
  | ParagraphBlock
  | HeadingBlock
  | BulletListBlock
  | NumberListBlock
  | ChecklistBlock
  | QuoteBlock
  | LinkBlock
  | CodeBlock
  | DividerBlock;

export type NotesDocument = { version: 1; blocks: NoteBlock[] };

export function createEmptyBlock(
  type: NoteBlock["type"],
  seed?: string,
): NoteBlock;
export function isNotesDocument(value: unknown): value is NotesDocument;
export function normalizeNotesDocument(value: unknown): NotesDocument | null;
export function markdownToNotesDocument(markdown: string): NotesDocument;
export function notesDocumentToMarkdown(document: NotesDocument): string;
export function notesStateFromBody(body: Record<string, unknown>): {
  markdown: string;
  document: NotesDocument;
  source: "markdown" | "blocks" | "legacy" | "empty";
};
export function notesBodyPatch(
  body: Record<string, unknown>,
  markdown: string,
): Record<string, unknown>;
export function safeLinkUrl(value: string): string | null;

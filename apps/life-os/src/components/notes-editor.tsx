"use client";

import {
  MAX_NOTES_MARKDOWN,
  createEmptyBlock,
  markdownToNotesDocument,
  notesBodyPatch,
  notesDocumentToMarkdown,
  notesStateFromBody,
  safeLinkUrl,
  type NoteBlock,
  type NotesDocument,
} from "@life-os/notes";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { LifeItem } from "../lib/api";

type SaveState = "saved" | "dirty" | "saving" | "error";

const BLOCK_OPTIONS: { type: NoteBlock["type"]; label: string }[] = [
  { type: "paragraph", label: "Paragraph" },
  { type: "heading", label: "Heading" },
  { type: "bulletList", label: "Bullets" },
  { type: "numberList", label: "Numbered list" },
  { type: "checklist", label: "Checklist" },
  { type: "quote", label: "Quote" },
  { type: "link", label: "Link" },
  { type: "code", label: "Code" },
  { type: "divider", label: "Divider" },
];

function replaceAt<T>(values: T[], index: number, value: T): T[] {
  return values.map((current, currentIndex) =>
    currentIndex === index ? value : current,
  );
}

function blockLabel(block: NoteBlock): string {
  return BLOCK_OPTIONS.find((option) => option.type === block.type)?.label ?? "Block";
}

function lines(value: string): string[] {
  return value.split("\n").slice(0, 100);
}

function checklistLines(block: Extract<NoteBlock, { type: "checklist" }>): string {
  return block.items
    .map((item) => `[${item.checked ? "x" : " "}] ${item.text}`)
    .join("\n");
}

function parseChecklistLines(value: string) {
  return lines(value).map((line) => {
    const match = /^\[([ xX])\]\s?(.*)$/.exec(line);
    return {
      checked: (match?.[1] ?? "").toLowerCase() === "x",
      text: (match?.[2] ?? line).slice(0, 1000),
    };
  });
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-sm max-w-none rounded-2xl border border-[#dde2dd] bg-[#f8faf7] p-4 text-[#14241f] [&_a]:font-semibold [&_a]:text-[#4f7045] [&_blockquote]:border-l-4 [&_blockquote]:border-[#b9d4b0] [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-[#e9eee7] [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-[#14241f] [&_pre]:p-4 [&_pre]:text-[#f4f5f0]">
      {markdown.trim() ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          skipHtml
          urlTransform={(url) => safeLinkUrl(url) ?? ""}
        >
          {markdown}
        </ReactMarkdown>
      ) : (
        <p className="m-0 text-sm text-[#6c7771]">
          Your note preview will appear here.
        </p>
      )}
    </div>
  );
}

function BlockFields({
  block,
  onChange,
}: {
  block: NoteBlock;
  onChange: (block: NoteBlock) => void;
}) {
  const inputClass =
    "w-full rounded-xl border border-[#d7ded6] bg-white px-3 py-2.5 text-sm text-[#14241f]";
  if (block.type === "divider") {
    return <hr className="my-2 border-[#cbd5ca]" />;
  }
  if (block.type === "heading") {
    return (
      <div className="grid gap-2 sm:grid-cols-[90px_1fr]">
        <select
          aria-label="Heading level"
          className={inputClass}
          value={block.level}
          onChange={(event) =>
            onChange({
              ...block,
              level: Number(event.target.value) as 1 | 2 | 3,
            })
          }
        >
          <option value={1}>H1</option>
          <option value={2}>H2</option>
          <option value={3}>H3</option>
        </select>
        <input
          aria-label="Heading text"
          className={inputClass}
          maxLength={1000}
          value={block.text}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
          placeholder="Heading"
        />
      </div>
    );
  }
  if (block.type === "bulletList" || block.type === "numberList") {
    return (
      <textarea
        aria-label={`${blockLabel(block)} items, one per line`}
        className={`${inputClass} min-h-28 resize-y`}
        value={block.items.join("\n")}
        onChange={(event) =>
          onChange({
            ...block,
            items: lines(event.target.value).map((item) => item.slice(0, 1000)),
          })
        }
        placeholder="One item per line"
      />
    );
  }
  if (block.type === "checklist") {
    return (
      <textarea
        aria-label="Checklist items, one per line"
        className={`${inputClass} min-h-28 resize-y`}
        value={checklistLines(block)}
        onChange={(event) =>
          onChange({ ...block, items: parseChecklistLines(event.target.value) })
        }
        placeholder="[ ] To do&#10;[x] Done"
      />
    );
  }
  if (block.type === "link") {
    const isSafe = safeLinkUrl(block.url) !== null;
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          aria-label="Link label"
          className={inputClass}
          maxLength={1000}
          value={block.text}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
          placeholder="Link label"
        />
        <div>
          <input
            aria-label="Link URL"
            className={`${inputClass} ${isSafe ? "" : "border-[#c9634f]"}`}
            maxLength={2048}
            value={block.url}
            onChange={(event) => onChange({ ...block, url: event.target.value })}
            placeholder="https://example.com"
          />
          {!isSafe ? (
            <p className="mt-1 text-xs text-[#c9634f]">
              Use http, https, mailto, /path, or #anchor.
            </p>
          ) : null}
        </div>
      </div>
    );
  }
  if (block.type === "code") {
    return (
      <div className="space-y-2">
        <input
          aria-label="Code language"
          className={inputClass}
          maxLength={32}
          value={block.language}
          onChange={(event) =>
            onChange({
              ...block,
              language: event.target.value.replace(/[^A-Za-z0-9_+-]/g, ""),
            })
          }
          placeholder="Language, e.g. ts"
        />
        <textarea
          aria-label="Code"
          className={`${inputClass} min-h-36 resize-y font-mono`}
          maxLength={8192}
          value={block.code}
          onChange={(event) => onChange({ ...block, code: event.target.value })}
          placeholder="Code"
          spellCheck={false}
        />
      </div>
    );
  }
  return (
    <textarea
      aria-label={`${blockLabel(block)} text`}
      className={`${inputClass} min-h-24 resize-y ${
        block.type === "quote" ? "border-l-4 border-l-[#9db595]" : ""
      }`}
      maxLength={4096}
      value={block.text}
      onChange={(event) => onChange({ ...block, text: event.target.value })}
      placeholder={block.type === "quote" ? "Quote" : "Write something…"}
    />
  );
}

export function NotesEditor({
  item,
  label,
  onSave,
}: {
  item: LifeItem;
  label: string;
  onSave: (
    item: LifeItem,
    body: Record<string, unknown>,
  ) => Promise<LifeItem | void>;
}) {
  const initial = notesStateFromBody(item.body);
  const [mode, setMode] = useState<"visual" | "markdown">("visual");
  const [document, setDocument] = useState<NotesDocument>(initial.document);
  const [markdown, setMarkdown] = useState(initial.markdown);
  const [addType, setAddType] = useState<NoteBlock["type"]>("paragraph");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const lastSaved = useRef(initial.markdown);
  const latestMarkdown = useRef(initial.markdown);
  const saveSequence = useRef(0);

  useEffect(() => {
    const next = notesStateFromBody(item.body);
    setDocument(next.document);
    setMarkdown(next.markdown);
    latestMarkdown.current = next.markdown;
    lastSaved.current = next.markdown;
    setSaveState("saved");
  }, [item.id]);

  async function saveNow(value = latestMarkdown.current) {
    if (value === lastSaved.current) {
      setSaveState("saved");
      return;
    }
    if (value.length > MAX_NOTES_MARKDOWN) {
      setSaveState("error");
      return;
    }
    const sequence = ++saveSequence.current;
    setSaveState("saving");
    try {
      await onSave(item, notesBodyPatch(item.body, value));
      if (sequence === saveSequence.current) {
        lastSaved.current = value;
        setSaveState(latestMarkdown.current === value ? "saved" : "dirty");
      }
    } catch {
      if (sequence === saveSequence.current) setSaveState("error");
    }
  }

  useEffect(() => {
    if (markdown === lastSaved.current) return;
    setSaveState("dirty");
    const timer = window.setTimeout(() => void saveNow(markdown), 1000);
    return () => window.clearTimeout(timer);
  }, [markdown]);

  function applyDocument(next: NotesDocument) {
    const nextMarkdown = notesDocumentToMarkdown(next);
    setDocument(next);
    setMarkdown(nextMarkdown);
    latestMarkdown.current = nextMarkdown;
  }

  function applyMarkdown(value: string) {
    const next = value.slice(0, MAX_NOTES_MARKDOWN);
    setMarkdown(next);
    latestMarkdown.current = next;
    setDocument(markdownToNotesDocument(next));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= document.blocks.length) return;
    const blocks = [...document.blocks];
    [blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!];
    applyDocument({ version: 1, blocks });
  }

  const status =
    saveState === "saving"
      ? "Saving…"
      : saveState === "dirty"
        ? "Unsaved changes"
        : saveState === "error"
          ? "Couldn’t save"
          : "Saved";

  return (
    <section
      aria-label={label}
      className="space-y-4 rounded-2xl border border-[#d7ded6] bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            {label}
          </p>
          <p aria-live="polite" className="mt-1 text-xs text-[#6c7771]">
            {status}
          </p>
        </div>
        <div
          aria-label="Note editor mode"
          className="flex rounded-full border border-[#dde2dd] bg-[#f7f8f5] p-1"
          role="group"
        >
          {(["visual", "markdown"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                mode === value
                  ? "bg-[#14241f] text-white"
                  : "text-[#5c6862]"
              }`}
              onClick={() => {
                if (value === "visual") {
                  setDocument(markdownToNotesDocument(markdown));
                } else {
                  const next = notesDocumentToMarkdown(document);
                  setMarkdown(next);
                  latestMarkdown.current = next;
                }
                setMode(value);
              }}
            >
              {value === "visual" ? "Visual" : "Markdown"}
            </button>
          ))}
        </div>
      </div>

      {mode === "visual" ? (
        <div className="space-y-3">
          {document.blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cbd5ca] bg-[#f8faf7] p-6 text-center text-sm text-[#6c7771]">
              Add a block to start these notes.
            </div>
          ) : null}
          {document.blocks.map((block, index) => (
            <div
              key={block.id}
              className="rounded-2xl border border-[#e0e5df] bg-[#fbfcfa] p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#6c7771]">
                  {blockLabel(block)}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${blockLabel(block)} block up`}
                    disabled={index === 0}
                    className="rounded-lg border border-[#dde2dd] bg-white px-2 py-1 text-xs disabled:opacity-35"
                    onClick={() => moveBlock(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${blockLabel(block)} block down`}
                    disabled={index === document.blocks.length - 1}
                    className="rounded-lg border border-[#dde2dd] bg-white px-2 py-1 text-xs disabled:opacity-35"
                    onClick={() => moveBlock(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${blockLabel(block)} block`}
                    className="rounded-lg border border-[#efd4cd] bg-[#fff7f5] px-2 py-1 text-xs text-[#a14938]"
                    onClick={() =>
                      applyDocument({
                        version: 1,
                        blocks: document.blocks.filter(
                          (_, blockIndex) => blockIndex !== index,
                        ),
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
              <BlockFields
                block={block}
                onChange={(next) =>
                  applyDocument({
                    version: 1,
                    blocks: replaceAt(document.blocks, index, next),
                  })
                }
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-[#cbd5ca] bg-[#f8faf7] p-3">
            <select
              aria-label="Block type to add"
              className="min-h-10 flex-1 rounded-xl border border-[#d7ded6] bg-white px-3 text-sm"
              value={addType}
              onChange={(event) =>
                setAddType(event.target.value as NoteBlock["type"])
              }
            >
              {BLOCK_OPTIONS.map((option) => (
                <option key={option.type} value={option.type}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="min-h-10 rounded-xl bg-[#14241f] px-4 text-xs font-bold text-white"
              onClick={() =>
                applyDocument({
                  version: 1,
                  blocks: [
                    ...document.blocks,
                    createEmptyBlock(addType, `${item.id}-${Date.now()}`),
                  ],
                })
              }
            >
              Add block
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block">
            <span className="sr-only">Markdown source</span>
            <textarea
              aria-label="Markdown source"
              className="min-h-80 w-full resize-y rounded-2xl border border-[#d7ded6] bg-[#fbfcfa] p-4 font-mono text-sm leading-6 text-[#14241f]"
              maxLength={MAX_NOTES_MARKDOWN}
              value={markdown}
              onChange={(event) => applyMarkdown(event.target.value)}
              placeholder="Write Markdown…"
              spellCheck={false}
            />
          </label>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6c7771]">
              Live preview
            </p>
            <MarkdownPreview markdown={markdown} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0ec] pt-3">
        <p className="text-xs text-[#7b857f]">
          {markdown.length.toLocaleString()} / {MAX_NOTES_MARKDOWN.toLocaleString()}{" "}
          characters
        </p>
        <button
          type="button"
          disabled={saveState === "saving" || markdown === lastSaved.current}
          className="rounded-xl border border-[#d7ded6] bg-white px-3 py-2 text-xs font-bold text-[#14241f] disabled:opacity-40"
          onClick={() => void saveNow()}
        >
          Save now
        </button>
      </div>
    </section>
  );
}

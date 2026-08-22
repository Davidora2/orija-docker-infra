export const NOTES_DOCUMENT_VERSION = 1;
export const MAX_NOTES_MARKDOWN = 32_768;
export const MAX_NOTE_BLOCKS = 200;

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "numberList",
  "checklist",
  "quote",
  "link",
  "code",
  "divider",
]);

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function blockId(type, index, content = "") {
  return `note-${type}-${index}-${hash(content).slice(0, 8)}`;
}

function cleanLineValue(value) {
  return String(value ?? "").replace(/\r?\n/g, " ");
}

export function safeLinkUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (trimmed.startsWith("#")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol.toLowerCase())
      ? trimmed
      : null;
  } catch {
    return null;
  }
}

export function createEmptyBlock(type, seed = `${Date.now()}-${Math.random()}`) {
  const id = blockId(type, 0, seed);
  switch (type) {
    case "heading":
      return { id, type, level: 2, text: "" };
    case "bulletList":
    case "numberList":
      return { id, type, items: [""] };
    case "checklist":
      return { id, type, items: [{ text: "", checked: false }] };
    case "quote":
      return { id, type, text: "" };
    case "link":
      return { id, type, text: "", url: "https://" };
    case "code":
      return { id, type, code: "", language: "" };
    case "divider":
      return { id, type };
    default:
      return { id, type: "paragraph", text: "" };
  }
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 80;
}

function validText(value, max = 4096) {
  return typeof value === "string" && value.length <= max;
}

function isNoteBlock(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !validId(value.id) ||
    !BLOCK_TYPES.has(value.type)
  ) {
    return false;
  }
  switch (value.type) {
    case "paragraph":
    case "quote":
      return (
        hasOnlyKeys(value, ["id", "type", "text"]) && validText(value.text)
      );
    case "heading":
      return (
        hasOnlyKeys(value, ["id", "type", "level", "text"]) &&
        [1, 2, 3].includes(value.level) &&
        validText(value.text, 1000)
      );
    case "bulletList":
    case "numberList":
      return (
        hasOnlyKeys(value, ["id", "type", "items"]) &&
        Array.isArray(value.items) &&
        value.items.length <= 100 &&
        value.items.every((item) => validText(item, 1000))
      );
    case "checklist":
      return (
        hasOnlyKeys(value, ["id", "type", "items"]) &&
        Array.isArray(value.items) &&
        value.items.length <= 100 &&
        value.items.every(
          (item) =>
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            hasOnlyKeys(item, ["text", "checked"]) &&
            validText(item.text, 1000) &&
            typeof item.checked === "boolean",
        )
      );
    case "link":
      return (
        hasOnlyKeys(value, ["id", "type", "text", "url"]) &&
        validText(value.text, 1000) &&
        validText(value.url, 2048) &&
        safeLinkUrl(value.url) !== null
      );
    case "code":
      return (
        hasOnlyKeys(value, ["id", "type", "code", "language"]) &&
        validText(value.code, 8192) &&
        validText(value.language, 32) &&
        /^[A-Za-z0-9_+-]*$/.test(value.language)
      );
    case "divider":
      return hasOnlyKeys(value, ["id", "type"]);
    default:
      return false;
  }
}

export function isNotesDocument(value) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    hasOnlyKeys(value, ["version", "blocks"]) &&
    value.version === NOTES_DOCUMENT_VERSION &&
    Array.isArray(value.blocks) &&
    value.blocks.length <= MAX_NOTE_BLOCKS &&
    value.blocks.every(isNoteBlock)
  );
}

export function normalizeNotesDocument(value) {
  if (!isNotesDocument(value)) return null;
  return {
    version: NOTES_DOCUMENT_VERSION,
    blocks: value.blocks.map((block) => {
      if (block.type === "checklist") {
        return { ...block, items: block.items.map((item) => ({ ...item })) };
      }
      if (block.type === "bulletList" || block.type === "numberList") {
        return { ...block, items: [...block.items] };
      }
      return { ...block };
    }),
  };
}

function isFence(line) {
  return /^```[A-Za-z0-9_+-]*\s*$/.test(line);
}

function isBlockStart(line) {
  return (
    isFence(line) ||
    /^(#{1,3})\s+/.test(line) ||
    /^[-*+]\s+\[[ xX]\]\s+/.test(line) ||
    /^[-*+]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line) ||
    /^\[[^\]\n]+\]\([^\s)]+(?:\s+"[^"]*")?\)\s*$/.test(line)
  );
}

function unescapeParagraphLine(line) {
  return line.replace(
    /^\\(?=(?:#{1,3}\s|[-*+]\s|>\s?|```|\d+\.\s| {0,3}(?:---|\*\*\*|___)\s*$))/,
    "",
  );
}

export function markdownToNotesDocument(markdown) {
  const source = String(markdown ?? "")
    .slice(0, MAX_NOTES_MARKDOWN)
    .replace(/\r\n?/g, "\n");
  const lines = source.split("\n");
  const blocks = [];
  let cursor = 0;

  const push = (block, content) => {
    if (blocks.length >= MAX_NOTE_BLOCKS) return;
    blocks.push({
      ...block,
      id: blockId(block.type, blocks.length, content),
    });
  };

  while (cursor < lines.length && blocks.length < MAX_NOTE_BLOCKS) {
    const line = lines[cursor] ?? "";
    if (!line.trim()) {
      cursor += 1;
      continue;
    }

    if (isFence(line)) {
      const language = line.slice(3).trim();
      const code = [];
      cursor += 1;
      while (cursor < lines.length && (lines[cursor] ?? "").trim() !== "```") {
        code.push(lines[cursor] ?? "");
        cursor += 1;
      }
      if (cursor < lines.length) cursor += 1;
      const value = code.join("\n").slice(0, 8192);
      push({ type: "code", code: value, language }, `${language}:${value}`);
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const text = (heading[2] ?? "").slice(0, 1000);
      push(
        { type: "heading", level: heading[1].length, text },
        `${heading[1].length}:${text}`,
      );
      cursor += 1;
      continue;
    }

    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      push({ type: "divider" }, "divider");
      cursor += 1;
      continue;
    }

    if (/^[-*+]\s+\[[ xX]\]\s+/.test(line)) {
      const items = [];
      while (
        cursor < lines.length &&
        /^[-*+]\s+\[[ xX]\]\s+/.test(lines[cursor] ?? "") &&
        items.length < 100
      ) {
        const match = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(lines[cursor] ?? "");
        if (!match) break;
        items.push({
          checked: (match[1] ?? "").toLowerCase() === "x",
          text: cleanLineValue(match[2]).slice(0, 1000),
        });
        cursor += 1;
      }
      push({ type: "checklist", items }, JSON.stringify(items));
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items = [];
      while (
        cursor < lines.length &&
        /^[-*+]\s+/.test(lines[cursor] ?? "") &&
        !/^[-*+]\s+\[[ xX]\]\s+/.test(lines[cursor] ?? "") &&
        items.length < 100
      ) {
        items.push(
          cleanLineValue((lines[cursor] ?? "").replace(/^[-*+]\s+/, "")).slice(
            0,
            1000,
          ),
        );
        cursor += 1;
      }
      push({ type: "bulletList", items }, JSON.stringify(items));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (
        cursor < lines.length &&
        /^\d+\.\s+/.test(lines[cursor] ?? "") &&
        items.length < 100
      ) {
        items.push(
          cleanLineValue((lines[cursor] ?? "").replace(/^\d+\.\s+/, "")).slice(
            0,
            1000,
          ),
        );
        cursor += 1;
      }
      push({ type: "numberList", items }, JSON.stringify(items));
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (cursor < lines.length && /^>\s?/.test(lines[cursor] ?? "")) {
        quote.push((lines[cursor] ?? "").replace(/^>\s?/, ""));
        cursor += 1;
      }
      const text = quote.join("\n").slice(0, 4096);
      push({ type: "quote", text }, text);
      continue;
    }

    const link = /^\[([^\]\n]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)\s*$/.exec(line);
    if (link && safeLinkUrl(link[2] ?? "")) {
      const text = (link[1] ?? "").slice(0, 1000);
      const url = safeLinkUrl(link[2] ?? "");
      push({ type: "link", text, url }, `${text}:${url}`);
      cursor += 1;
      continue;
    }

    const paragraph = [unescapeParagraphLine(line)];
    cursor += 1;
    while (
      cursor < lines.length &&
      (lines[cursor] ?? "").trim() &&
      !isBlockStart(lines[cursor] ?? "")
    ) {
      paragraph.push(unescapeParagraphLine(lines[cursor] ?? ""));
      cursor += 1;
    }
    const text = paragraph.join("\n").slice(0, 4096);
    push({ type: "paragraph", text }, text);
  }

  return { version: NOTES_DOCUMENT_VERSION, blocks };
}

function escapeParagraphLine(line) {
  if (
    /^(?:#{1,3}\s|[-*+]\s|>\s?|```|\d+\.\s)/.test(line) ||
    /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)
  ) {
    return `\\${line}`;
  }
  return line;
}

export function notesDocumentToMarkdown(document) {
  const normalized = normalizeNotesDocument(document);
  if (!normalized) return "";
  return normalized.blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return block.text.split("\n").map(escapeParagraphLine).join("\n");
        case "heading":
          return `${"#".repeat(block.level)} ${block.text}`;
        case "bulletList":
          return block.items.map((item) => `- ${cleanLineValue(item)}`).join("\n");
        case "numberList":
          return block.items
            .map((item, index) => `${index + 1}. ${cleanLineValue(item)}`)
            .join("\n");
        case "checklist":
          return block.items
            .map(
              (item) =>
                `- [${item.checked ? "x" : " "}] ${cleanLineValue(item.text)}`,
            )
            .join("\n");
        case "quote":
          return block.text
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n");
        case "link": {
          const url = safeLinkUrl(block.url);
          return url
            ? `[${block.text.replace(/[\[\]]/g, "")}](${url})`
            : escapeParagraphLine(`${block.text} (${block.url})`);
        }
        case "code":
          return `\`\`\`${block.language}\n${block.code.replace(/```/g, "\\`\\`\\`")}\n\`\`\``;
        case "divider":
          return "---";
        default:
          return "";
      }
    })
    .join("\n\n")
    .slice(0, MAX_NOTES_MARKDOWN);
}

export function notesStateFromBody(body) {
  const markdown =
    typeof body?.notesMarkdown === "string"
      ? body.notesMarkdown.slice(0, MAX_NOTES_MARKDOWN)
      : null;
  if (markdown !== null) {
    return {
      markdown,
      document: markdownToNotesDocument(markdown),
      source: "markdown",
    };
  }
  const document = normalizeNotesDocument(body?.notesBlocks);
  if (document) {
    return {
      markdown: notesDocumentToMarkdown(document),
      document,
      source: "blocks",
    };
  }
  const legacy = typeof body?.note === "string" ? body.note : "";
  if (legacy) {
    return {
      markdown: legacy.slice(0, MAX_NOTES_MARKDOWN),
      document: markdownToNotesDocument(legacy),
      source: "legacy",
    };
  }
  return {
    markdown: "",
    document: { version: NOTES_DOCUMENT_VERSION, blocks: [] },
    source: "empty",
  };
}

export function notesBodyPatch(body, markdown) {
  const normalizedMarkdown = String(markdown ?? "")
    .replace(/\r\n?/g, "\n")
    .slice(0, MAX_NOTES_MARKDOWN);
  return {
    ...body,
    notesMarkdown: normalizedMarkdown,
    notesBlocks: markdownToNotesDocument(normalizedMarkdown),
  };
}

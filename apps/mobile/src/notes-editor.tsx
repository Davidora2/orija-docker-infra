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
} from '@life-os/notes';
import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { LifeItem } from './api';

const colors = {
  ink: '#14241F',
  muted: '#6C7771',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  canvas: '#F4F5F0',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  danger: '#C9634F',
};

const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
});

const BLOCK_OPTIONS: { type: NoteBlock['type']; label: string }[] = [
  { type: 'paragraph', label: 'Text' },
  { type: 'heading', label: 'Heading' },
  { type: 'bulletList', label: 'Bullets' },
  { type: 'numberList', label: 'Numbers' },
  { type: 'checklist', label: 'Checklist' },
  { type: 'quote', label: 'Quote' },
  { type: 'link', label: 'Link' },
  { type: 'code', label: 'Code' },
  { type: 'divider', label: 'Divider' },
];

function blockLabel(block: NoteBlock): string {
  return BLOCK_OPTIONS.find((option) => option.type === block.type)?.label ?? 'Block';
}

function listLines(value: string): string[] {
  return value.split('\n').slice(0, 100).map((line) => line.slice(0, 1000));
}

function checklistText(block: Extract<NoteBlock, { type: 'checklist' }>): string {
  return block.items
    .map((item) => `[${item.checked ? 'x' : ' '}] ${item.text}`)
    .join('\n');
}

function parseChecklist(value: string) {
  return listLines(value).map((line) => {
    const match = /^\[([ xX])\]\s?(.*)$/.exec(line);
    return {
      checked: (match?.[1] ?? '').toLowerCase() === 'x',
      text: match?.[2] ?? line,
    };
  });
}

function Control({
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.control,
        danger && styles.controlDanger,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.controlText, danger && styles.controlTextDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StrictPreview({ document }: { document: NotesDocument }) {
  if (document.blocks.length === 0) {
    return <Text style={styles.emptyText}>Your note preview will appear here.</Text>;
  }
  return (
    <View style={styles.preview}>
      {document.blocks.map((block) => {
        if (block.type === 'divider') {
          return <View key={block.id} style={styles.divider} />;
        }
        if (block.type === 'heading') {
          return (
            <Text
              key={block.id}
              accessibilityRole="header"
              style={[
                styles.heading,
                block.level === 1 && styles.headingOne,
                block.level === 3 && styles.headingThree,
              ]}
            >
              {block.text}
            </Text>
          );
        }
        if (block.type === 'bulletList' || block.type === 'numberList') {
          return (
            <View key={block.id} style={styles.previewGroup}>
              {block.items.map((item, index) => (
                <Text key={`${block.id}-${index}`} style={styles.previewText}>
                  {block.type === 'bulletList' ? '•' : `${index + 1}.`} {item}
                </Text>
              ))}
            </View>
          );
        }
        if (block.type === 'checklist') {
          return (
            <View key={block.id} style={styles.previewGroup}>
              {block.items.map((item, index) => (
                <Text key={`${block.id}-${index}`} style={styles.previewText}>
                  {item.checked ? '☑' : '☐'} {item.text}
                </Text>
              ))}
            </View>
          );
        }
        if (block.type === 'quote') {
          return (
            <View key={block.id} style={styles.quote}>
              <Text style={styles.previewText}>{block.text}</Text>
            </View>
          );
        }
        if (block.type === 'link') {
          const url = safeLinkUrl(block.url);
          return (
            <Pressable
              key={block.id}
              accessibilityRole={url ? 'link' : undefined}
              disabled={!url}
              onPress={() => {
                if (url) void Linking.openURL(url);
              }}
            >
              <Text style={[styles.previewText, url && styles.link]}>
                {block.text || block.url}
              </Text>
            </Pressable>
          );
        }
        if (block.type === 'code') {
          return (
            <View key={block.id} style={styles.codePreview}>
              {block.language ? (
                <Text style={styles.codeLanguage}>{block.language}</Text>
              ) : null}
              <Text selectable style={styles.codeText}>
                {block.code}
              </Text>
            </View>
          );
        }
        return (
          <Text key={block.id} style={styles.previewText}>
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}

function BlockInput({
  block,
  onChange,
}: {
  block: NoteBlock;
  onChange: (block: NoteBlock) => void;
}) {
  if (block.type === 'divider') return <View style={styles.divider} />;
  if (block.type === 'heading') {
    return (
      <View style={styles.inputStack}>
        <View style={styles.controls}>
          {([1, 2, 3] as const).map((level) => (
            <Pressable
              key={level}
              accessibilityRole="button"
              accessibilityState={{ selected: block.level === level }}
              onPress={() => onChange({ ...block, level })}
              style={[
                styles.levelButton,
                block.level === level && styles.levelButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.levelText,
                  block.level === level && styles.levelTextActive,
                ]}
              >
                H{level}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          accessibilityLabel="Heading text"
          maxLength={1000}
          onChangeText={(text) => onChange({ ...block, text })}
          placeholder="Heading"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={block.text}
        />
      </View>
    );
  }
  if (block.type === 'bulletList' || block.type === 'numberList') {
    return (
      <TextInput
        accessibilityLabel={`${blockLabel(block)} items, one per line`}
        multiline
        onChangeText={(value) => onChange({ ...block, items: listLines(value) })}
        placeholder="One item per line"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.multiline]}
        textAlignVertical="top"
        value={block.items.join('\n')}
      />
    );
  }
  if (block.type === 'checklist') {
    return (
      <TextInput
        accessibilityLabel="Checklist items, one per line"
        multiline
        onChangeText={(value) => onChange({ ...block, items: parseChecklist(value) })}
        placeholder={'[ ] To do\n[x] Done'}
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.multiline]}
        textAlignVertical="top"
        value={checklistText(block)}
      />
    );
  }
  if (block.type === 'link') {
    const safe = safeLinkUrl(block.url) !== null;
    return (
      <View style={styles.inputStack}>
        <TextInput
          accessibilityLabel="Link label"
          maxLength={1000}
          onChangeText={(text) => onChange({ ...block, text })}
          placeholder="Link label"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={block.text}
        />
        <TextInput
          accessibilityLabel="Link URL"
          autoCapitalize="none"
          keyboardType="url"
          maxLength={2048}
          onChangeText={(url) => onChange({ ...block, url })}
          placeholder="https://example.com"
          placeholderTextColor={colors.muted}
          style={[styles.input, !safe && styles.inputError]}
          value={block.url}
        />
        {!safe ? (
          <Text style={styles.errorText}>
            Use http, https, mailto, /path, or #anchor.
          </Text>
        ) : null}
      </View>
    );
  }
  if (block.type === 'code') {
    return (
      <View style={styles.inputStack}>
        <TextInput
          accessibilityLabel="Code language"
          autoCapitalize="none"
          maxLength={32}
          onChangeText={(language) =>
            onChange({
              ...block,
              language: language.replace(/[^A-Za-z0-9_+-]/g, ''),
            })
          }
          placeholder="Language, e.g. ts"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={block.language}
        />
        <TextInput
          accessibilityLabel="Code"
          autoCapitalize="none"
          maxLength={8192}
          multiline
          onChangeText={(code) => onChange({ ...block, code })}
          placeholder="Code"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.codeInput]}
          textAlignVertical="top"
          value={block.code}
        />
      </View>
    );
  }
  return (
    <TextInput
      accessibilityLabel={`${blockLabel(block)} text`}
      maxLength={4096}
      multiline
      onChangeText={(text) => onChange({ ...block, text })}
      placeholder={block.type === 'quote' ? 'Quote' : 'Write something…'}
      placeholderTextColor={colors.muted}
      style={[
        styles.input,
        styles.multiline,
        block.type === 'quote' && styles.quoteInput,
      ]}
      textAlignVertical="top"
      value={block.text}
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
  onSave: (item: LifeItem, body: Record<string, unknown>) => Promise<LifeItem | void>;
}) {
  const initial = notesStateFromBody(item.body);
  const [mode, setMode] = useState<'visual' | 'markdown'>('visual');
  const [document, setDocument] = useState<NotesDocument>(initial.document);
  const [markdown, setMarkdown] = useState(initial.markdown);
  const [addType, setAddType] = useState<NoteBlock['type']>('paragraph');
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>(
    'saved',
  );
  const latestMarkdown = useRef(initial.markdown);
  const lastSaved = useRef(initial.markdown);
  const saveSequence = useRef(0);

  useEffect(() => {
    const next = notesStateFromBody(item.body);
    setDocument(next.document);
    setMarkdown(next.markdown);
    latestMarkdown.current = next.markdown;
    lastSaved.current = next.markdown;
    setSaveState('saved');
  }, [item.id]);

  async function saveNow(value = latestMarkdown.current) {
    if (value === lastSaved.current) {
      setSaveState('saved');
      return;
    }
    const sequence = ++saveSequence.current;
    setSaveState('saving');
    try {
      await onSave(item, notesBodyPatch(item.body, value));
      if (sequence === saveSequence.current) {
        lastSaved.current = value;
        setSaveState(latestMarkdown.current === value ? 'saved' : 'dirty');
      }
    } catch {
      if (sequence === saveSequence.current) setSaveState('error');
    }
  }

  useEffect(() => {
    if (markdown === lastSaved.current) return;
    setSaveState('dirty');
    const timer = setTimeout(() => void saveNow(markdown), 1000);
    return () => clearTimeout(timer);
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
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'dirty'
        ? 'Unsaved changes'
        : saveState === 'error'
          ? 'Couldn’t save'
          : 'Saved';

  return (
    <View accessibilityLabel={label} style={styles.editor}>
      <View style={styles.header}>
        <View>
          <Text style={styles.micro}>{label}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {status}
          </Text>
        </View>
        <View accessibilityRole="tablist" style={styles.mode}>
          {(['visual', 'markdown'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === value }}
              onPress={() => {
                if (value === 'visual') {
                  setDocument(markdownToNotesDocument(markdown));
                } else {
                  const next = notesDocumentToMarkdown(document);
                  setMarkdown(next);
                  latestMarkdown.current = next;
                }
                setMode(value);
              }}
              style={[styles.modeButton, mode === value && styles.modeButtonActive]}
            >
              <Text
                style={[styles.modeText, mode === value && styles.modeTextActive]}
              >
                {value === 'visual' ? 'Visual' : 'Markdown'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {mode === 'visual' ? (
        <View style={styles.inputStack}>
          {document.blocks.length === 0 ? (
            <Text style={styles.emptyText}>Add a block to start these notes.</Text>
          ) : null}
          {document.blocks.map((block, index) => (
            <View key={block.id} style={styles.block}>
              <View style={styles.blockHeader}>
                <Text style={styles.blockLabel}>{blockLabel(block)}</Text>
                <View style={styles.controls}>
                  <Control
                    disabled={index === 0}
                    label="Move up"
                    onPress={() => moveBlock(index, -1)}
                  />
                  <Control
                    disabled={index === document.blocks.length - 1}
                    label="Move down"
                    onPress={() => moveBlock(index, 1)}
                  />
                  <Control
                    danger
                    label="Delete"
                    onPress={() =>
                      applyDocument({
                        version: 1,
                        blocks: document.blocks.filter(
                          (_, blockIndex) => blockIndex !== index,
                        ),
                      })
                    }
                  />
                </View>
              </View>
              <BlockInput
                block={block}
                onChange={(next) =>
                  applyDocument({
                    version: 1,
                    blocks: document.blocks.map((current, blockIndex) =>
                      blockIndex === index ? next : current,
                    ),
                  })
                }
              />
            </View>
          ))}
          <View style={styles.addArea}>
            <ScrollView
              horizontal
              contentContainerStyle={styles.typeScroller}
              showsHorizontalScrollIndicator={false}
            >
              {BLOCK_OPTIONS.map((option) => (
                <Pressable
                  key={option.type}
                  accessibilityRole="button"
                  accessibilityState={{ selected: addType === option.type }}
                  onPress={() => setAddType(option.type)}
                  style={[
                    styles.typeButton,
                    addType === option.type && styles.typeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeText,
                      addType === option.type && styles.typeTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                applyDocument({
                  version: 1,
                  blocks: [
                    ...document.blocks,
                    createEmptyBlock(addType, `${item.id}-${Date.now()}`),
                  ],
                })
              }
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>Add block</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.inputStack}>
          <TextInput
            accessibilityLabel="Markdown source"
            autoCapitalize="none"
            maxLength={MAX_NOTES_MARKDOWN}
            multiline
            onChangeText={applyMarkdown}
            placeholder="Write Markdown…"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.markdownInput]}
            textAlignVertical="top"
            value={markdown}
          />
          <Text style={styles.blockLabel}>Live preview</Text>
          <StrictPreview document={document} />
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.status}>
          {markdown.length.toLocaleString()} / {MAX_NOTES_MARKDOWN.toLocaleString()}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={saveState === 'saving' || markdown === lastSaved.current}
          onPress={() => void saveNow()}
          style={[
            styles.saveButton,
            (saveState === 'saving' || markdown === lastSaved.current) &&
              styles.disabled,
          ]}
        >
          <Text style={styles.saveText}>Save now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  micro: {
    color: colors.sageDeep,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  status: { color: colors.muted, fontSize: 11, marginTop: 3 },
  mode: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  modeButton: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  modeButtonActive: { backgroundColor: colors.ink },
  modeText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  modeTextActive: { color: colors.paper },
  inputStack: { gap: 10 },
  block: {
    backgroundColor: '#FBFCFA',
    borderColor: '#E0E5DF',
    borderRadius: 16,
    borderWidth: 1,
    gap: 9,
    padding: 12,
  },
  blockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'space-between',
  },
  blockLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  control: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  controlDanger: { backgroundColor: '#FFF7F5', borderColor: '#EFD4CD' },
  controlText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  controlTextDanger: { color: colors.danger },
  disabled: { opacity: 0.35 },
  input: {
    backgroundColor: colors.paper,
    borderColor: '#D7DED6',
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 11 },
  multiline: { minHeight: 88 },
  codeInput: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    minHeight: 130,
  },
  quoteInput: { borderLeftColor: colors.sageDeep, borderLeftWidth: 4 },
  levelButton: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  levelButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  levelText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  levelTextActive: { color: colors.paper },
  addArea: {
    backgroundColor: '#F8FAF7',
    borderColor: '#CBD5CA',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 10,
    padding: 11,
  },
  typeScroller: { gap: 6 },
  typeButton: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  typeButtonActive: { backgroundColor: colors.sageDeep },
  typeText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  typeTextActive: { color: colors.paper },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 12,
    minHeight: 42,
    justifyContent: 'center',
  },
  addButtonText: { color: colors.paper, fontSize: 12, fontWeight: '700' },
  markdownInput: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    minHeight: 260,
  },
  preview: {
    backgroundColor: '#F8FAF7',
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  previewGroup: { gap: 5 },
  previewText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  heading: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 21,
    lineHeight: 27,
  },
  headingOne: { fontSize: 26, lineHeight: 32 },
  headingThree: { fontSize: 18, lineHeight: 24 },
  quote: {
    borderLeftColor: colors.sageDeep,
    borderLeftWidth: 4,
    paddingLeft: 12,
  },
  link: { color: colors.sageDeep, fontWeight: '700', textDecorationLine: 'underline' },
  codePreview: { backgroundColor: colors.ink, borderRadius: 12, gap: 6, padding: 12 },
  codeLanguage: { color: '#B9D4B0', fontSize: 10, textTransform: 'uppercase' },
  codeText: {
    color: colors.paper,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
  },
  divider: { backgroundColor: '#CBD5CA', height: 1, marginVertical: 6 },
  emptyText: {
    backgroundColor: '#F8FAF7',
    borderColor: '#CBD5CA',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    color: colors.muted,
    fontSize: 13,
    padding: 18,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    borderTopColor: '#EDF0EC',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  saveButton: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  saveText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
});

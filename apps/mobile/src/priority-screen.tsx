import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PRIORITY_FILTERS,
  isValidDateOnly,
  resetPriorityFilters,
  type PriorityFilters,
} from '@life-os/plan-domain';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { LifeItem } from './api';
import { bodyNumber, bodyString } from './life-data';
import {
  PRIORITY_MATRIX_ORDER,
  PRIORITY_QUADRANT_META,
  actionPriorityQuadrant,
  actionScheduledDate,
  quadrantRequiresScheduledDate,
  type PriorityQuadrant,
} from './priority-matrix';
import { LifeIcon, lifeIconFromLegacy } from './life-icon';
import { CapacityStrip } from './ui';
import { DatePickerField } from './ui/date-picker-field';

const colors = {
  ink: '#14241F',
  inkSoft: '#24362F',
  canvas: '#F4F5F0',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  danger: '#C9634F',
  dangerSoft: '#FDF4F1',
  tipBg: '#EEF3EA',
};

const ACCORDION_COPY: Record<
  PriorityQuadrant,
  { title: string; subtitle: string; empty?: string }
> = {
  DO_FIRST: {
    title: 'DO NOW',
    subtitle: 'Urgent & important',
    empty: 'Nothing needs immediate attention.',
  },
  SCHEDULE: {
    title: 'SCHEDULE',
    subtitle: 'Important, not urgent',
  },
  DELEGATE: {
    title: 'DELEGATE',
    subtitle: 'Urgent, less important',
  },
  ELIMINATE: {
    title: 'DELETE',
    subtitle: 'Neither urgent nor important',
  },
};

function hoursOf(action: LifeItem) {
  return bodyNumber(action, 'hours', 1);
}

type DateEditState = {
  action: LifeItem;
  draft: string;
  completeAfter: boolean;
};

type Props = {
  pillars: LifeItem[];
  projects: LifeItem[];
  openActions: LifeItem[];
  filters: PriorityFilters;
  onFiltersChange: (filters: PriorityFilters) => void;
  availableHours: number;
  busy: boolean;
  tipDismissed: boolean;
  onDismissTip: () => void;
  onOpenMatrix: () => void;
  onCompleteAction: (action: LifeItem) => void;
  onMoveActionQuadrant: (action: LifeItem, quadrant: PriorityQuadrant) => void;
  onSetScheduledDate?: (action: LifeItem, date: string) => void;
  onOpenProject?: (project: LifeItem) => void;
  onMoveProjectToIdea?: (project: LifeItem) => void;
  onParkAction?: (action: LifeItem) => void;
};

export function PriorityScreen({
  pillars,
  projects,
  openActions,
  filters,
  onFiltersChange,
  availableHours,
  busy,
  tipDismissed,
  onDismissTip,
  onOpenMatrix,
  onCompleteAction,
  onMoveActionQuadrant,
  onSetScheduledDate,
  onOpenProject,
  onMoveProjectToIdea,
  onParkAction,
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [windowPickerOpen, setWindowPickerOpen] = useState(false);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<PriorityQuadrant, boolean>>({
    DO_FIRST: true,
    SCHEDULE: true,
    DELEGATE: false,
    ELIMINATE: false,
  });
  const [dateEdit, setDateEdit] = useState<DateEditState | null>(null);

  function openScheduleDateEditor(
    action: LifeItem,
    options?: { completeAfter?: boolean },
  ) {
    setDateEdit({
      action,
      draft: actionScheduledDate(action.body) ?? '',
      completeAfter: Boolean(options?.completeAfter),
    });
  }

  function handleCompleteAction(action: LifeItem, quadrant: PriorityQuadrant) {
    if (
      action.status !== 'DONE' &&
      quadrantRequiresScheduledDate(quadrant) &&
      !actionScheduledDate(action.body) &&
      onSetScheduledDate
    ) {
      openScheduleDateEditor(action, { completeAfter: true });
      return;
    }
    onCompleteAction(action);
  }

  function saveScheduleDate() {
    if (!dateEdit || !onSetScheduledDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEdit.draft)) return;
    const { action, draft, completeAfter } = dateEdit;
    onSetScheduledDate(action, draft);
    setDateEdit(null);
    if (completeAfter) onCompleteAction(action);
  }

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const filteredActions = openActions;

  const plannedHours = filteredActions.reduce(
    (sum, action) => sum + hoursOf(action),
    0,
  );
  const overHours = Math.max(0, plannedHours - availableHours);
  const overCapacity = overHours > 0.05;

  const byQuadrant = useMemo(() => {
    const groups: Record<PriorityQuadrant, LifeItem[]> = {
      DO_FIRST: [],
      SCHEDULE: [],
      DELEGATE: [],
      ELIMINATE: [],
    };
    for (const action of filteredActions) {
      const project = projectById.get(action.parentId ?? '');
      const q = actionPriorityQuadrant(action.body, project?.body);
      groups[q].push(action);
    }
    return groups;
  }, [filteredActions, projectById]);

  const heavyProjects = useMemo(() => {
    const hoursByProject = new Map<string, number>();
    for (const action of filteredActions) {
      if (!action.parentId) continue;
      hoursByProject.set(
        action.parentId,
        (hoursByProject.get(action.parentId) ?? 0) + hoursOf(action),
      );
    }
    return [...hoursByProject.entries()]
      .map(([id, hours]) => ({
        project: projectById.get(id),
        hours,
      }))
      .filter(
        (row): row is { project: LifeItem; hours: number } =>
          Boolean(row.project) && row.hours >= 2,
      )
      .sort((a, b) => b.hours - a.hours);
  }, [filteredActions, projectById]);

  const rankedActions = useMemo(
    () =>
      [...filteredActions].sort(
        (a, b) => hoursOf(b) - hoursOf(a) || a.title.localeCompare(b.title),
      ),
    [filteredActions],
  );

  const areaLabel =
    pillars.find((p) => p.id === filters.areaId)?.title ?? 'All areas';
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) =>
      value !== DEFAULT_PRIORITY_FILTERS[key as keyof PriorityFilters],
  ).length;

  useEffect(() => {
    if (!overCapacity) setRebalanceOpen(false);
  }, [overCapacity]);

  return (
    <View style={styles.stack}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Priority</Text>
          <Text style={styles.subtitle}>
            Focus on what deserves your attention.
          </Text>
        </View>
        <Pressable onPress={onOpenMatrix} style={styles.matrixBtn}>
          <Text style={styles.matrixBtnText}>Matrix</Text>
        </Pressable>
      </View>

      <TextInput
        value={filters.query}
        onChangeText={(query) => onFiltersChange({ ...filters, query })}
        placeholder="Search action titles"
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        accessibilityLabel="Search action titles"
      />

      <View style={styles.filterRow}>
        <Pressable
          style={styles.filterChip}
          onPress={() => setAreaPickerOpen(true)}
        >
          <Text style={styles.filterChipText} numberOfLines={1}>
            {areaLabel} ▾
          </Text>
        </Pressable>
        <Pressable
          style={styles.filterChip}
          onPress={() => setWindowPickerOpen(true)}
        >
          <Text style={styles.filterChipText}>
            {
              {
                THIS_WEEK: 'This week',
                TODAY: 'Today',
                NEXT_7_DAYS: 'Next 7 days',
                OVERDUE: 'Overdue',
                UNSCHEDULED: 'Unscheduled',
                ALL: 'All time',
              }[filters.window]
            }{' '}
            ▾
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.filterChip,
            (activeFilterCount > 0 || filterOpen) && styles.filterChipActive,
          ]}
          onPress={() => setFilterOpen(true)}
        >
          <Text
            style={[
              styles.filterChipText,
              (activeFilterCount > 0 || filterOpen) && styles.filterChipTextActive,
            ]}
          >
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
        {activeFilterCount ? (
          <Pressable
            style={styles.clearChip}
            onPress={() => onFiltersChange(resetPriorityFilters())}
          >
            <Text style={styles.clearChipText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <CapacityStrip
        available={availableHours}
        planned={plannedHours}
        onOpenCapacity={
          overCapacity ? () => setRebalanceOpen(true) : undefined
        }
      />

      {overCapacity ? (
        <Pressable
          style={styles.rebalanceLink}
          onPress={() => setRebalanceOpen(true)}
        >
          <Text style={styles.rebalanceLinkText} numberOfLines={1}>
            Rebalance your week
          </Text>
          <LifeIcon name="chevron-right" size={15} color={colors.sageDeep} />
        </Pressable>
      ) : null}

      {PRIORITY_MATRIX_ORDER.map((quadrant) => {
        const copy = ACCORDION_COPY[quadrant];
        const actions = byQuadrant[quadrant];
        const hours = actions.reduce((sum, a) => sum + hoursOf(a), 0);
        const open = expanded[quadrant];
        return (
          <View key={quadrant} style={styles.accordion}>
            <Pressable
              style={styles.accordionHeader}
              onPress={() =>
                setExpanded((current) => ({
                  ...current,
                  [quadrant]: !current[quadrant],
                }))
              }
            >
              <View style={styles.accordionHeaderText}>
                <Text style={styles.micro}>{copy.title}</Text>
                <Text style={styles.accordionSubtitle} numberOfLines={1}>
                  {copy.subtitle}
                </Text>
                <Text style={styles.accordionMeta}>
                  {actions.length} action{actions.length === 1 ? '' : 's'} ·{' '}
                  {hours.toFixed(hours % 1 === 0 ? 0 : 1)}h
                </Text>
              </View>
              <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
            </Pressable>
            {open ? (
              <View style={styles.accordionBody}>
                {actions.length === 0 ? (
                  <Text style={styles.emptyCopy}>
                    {copy.empty ?? 'No actions here.'}
                  </Text>
                ) : (
                  actions.map((action, index) => {
                    const project = projectById.get(action.parentId ?? '');
                    const area = pillars.find(
                      (p) => p.id === project?.parentId,
                    );
                    const icon = lifeIconFromLegacy(
                      area && bodyString(area, 'icon'),
                      index,
                    );
                    const scheduled =
                      quadrant === 'SCHEDULE'
                        ? actionScheduledDate(action.body)
                        : null;
                    const metaLabel = `${area?.title ?? 'Unassigned'}${
                      project ? ` · ${project.title}` : ''
                    }`;
                    return (
                      <View key={action.id} style={styles.actionRow}>
                        <View style={styles.actionIcon}>
                          <LifeIcon name={icon} size={18} />
                        </View>
                        <View style={styles.actionText}>
                          <Text
                            style={[
                              styles.actionTitle,
                              action.status === 'DONE' && styles.actionTitleDone,
                            ]}
                            numberOfLines={1}
                          >
                            {action.title}
                          </Text>
                          {project && onOpenProject ? (
                            <Pressable
                              onPress={() => onOpenProject(project)}
                              hitSlop={4}
                            >
                              <Text
                                style={styles.actionMetaLink}
                                numberOfLines={1}
                              >
                                {metaLabel}
                              </Text>
                            </Pressable>
                          ) : (
                            <Text style={styles.actionMeta} numberOfLines={1}>
                              {metaLabel}
                            </Text>
                          )}
                        </View>
                        <View style={styles.actionAside}>
                          <Text style={styles.actionHours}>
                            {hoursOf(action)}h
                          </Text>
                          {quadrant === 'SCHEDULE' && onSetScheduledDate ? (
                            <Pressable
                              disabled={busy}
                              style={styles.dateChipRow}
                              onPress={(event) => {
                                event?.stopPropagation?.();
                                openScheduleDateEditor(action);
                              }}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel={
                                scheduled
                                  ? `Edit schedule date ${scheduled}`
                                  : 'Set schedule date'
                              }
                            >
                              <LifeIcon
                                name="calendar-edit"
                                size={12}
                                color={scheduled ? colors.sageDeep : colors.danger}
                              />
                              <Text
                                style={[
                                  styles.dateChip,
                                  !scheduled && styles.dateChipMissing,
                                ]}
                                numberOfLines={1}
                              >
                                {scheduled ?? 'Set date'}
                              </Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            disabled={busy}
                            onPress={(event) => {
                              event?.stopPropagation?.();
                              handleCompleteAction(action, quadrant);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={
                              action.status === 'DONE'
                                ? 'Mark action open'
                                : 'Mark action done'
                            }
                            hitSlop={8}
                          >
                            <LifeIcon
                              name="done"
                              size={18}
                              weight={action.status === 'DONE' ? 'fill' : 'regular'}
                            />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      {!tipDismissed ? (
        <View style={styles.tipCard}>
          <Pressable style={styles.tipDismiss} onPress={onDismissTip}>
            <Text style={styles.tipDismissText}>×</Text>
          </Pressable>
          <Text style={styles.micro}>Tip</Text>
          <Text style={styles.tipBody}>
            Protect Do Now for high-importance, high-urgency work. Schedule what
            matters; park or delete the rest when capacity is tight.
          </Text>
        </View>
      ) : null}

      <Modal
        visible={areaPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAreaPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setAreaPickerOpen(false)}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Area</Text>
            <Pressable
              style={styles.sheetRow}
              onPress={() => {
                onFiltersChange({ ...filters, areaId: '', projectId: '' });
                setAreaPickerOpen(false);
              }}
            >
              <Text style={styles.sheetRowText}>All areas</Text>
            </Pressable>
            {pillars.map((pillar) => (
              <Pressable
                key={pillar.id}
                style={styles.sheetRow}
                onPress={() => {
                  onFiltersChange({
                    ...filters,
                    areaId: pillar.id,
                    projectId: '',
                  });
                  setAreaPickerOpen(false);
                }}
              >
                <Text style={styles.sheetRowText} numberOfLines={1}>
                  {pillar.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={windowPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWindowPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setWindowPickerOpen(false)}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Window</Text>
            {(
              [
                ['THIS_WEEK', 'This week'],
                ['TODAY', 'Today'],
                ['NEXT_7_DAYS', 'Next 7 days'],
                ['OVERDUE', 'Overdue'],
                ['UNSCHEDULED', 'Unscheduled'],
                ['ALL', 'All time'],
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                style={styles.sheetRow}
                onPress={() => {
                  onFiltersChange({ ...filters, window: id });
                  setWindowPickerOpen(false);
                }}
              >
                <Text style={styles.sheetRowText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={styles.modalWrap}>
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setFilterOpen(false)}
          />
          <ScrollView
            style={[styles.bottomSheet, { maxHeight: '88%' }]}
            contentContainerStyle={{ gap: 10 }}
          >
            <Text style={styles.sheetTitle}>Filters</Text>
            <Text style={styles.sheetHint}>Narrow actions on Priority.</Text>
            <Text style={styles.micro}>Project</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipWrap}>
                <Pressable
                  style={[styles.chip, !filters.projectId && styles.chipActive]}
                  onPress={() =>
                    onFiltersChange({ ...filters, projectId: '' })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      !filters.projectId && styles.chipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </Pressable>
                {projects
                  .filter(
                    (project) =>
                      !filters.areaId || project.parentId === filters.areaId,
                  )
                  .map((project) => (
                    <Pressable
                      key={project.id}
                      style={[
                        styles.chip,
                        filters.projectId === project.id && styles.chipActive,
                      ]}
                      onPress={() =>
                        onFiltersChange({
                          ...filters,
                          projectId: project.id,
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          filters.projectId === project.id &&
                            styles.chipTextActive,
                        ]}
                      >
                        {project.title}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </ScrollView>
            <Text style={styles.micro}>Project priority</Text>
            <View style={styles.chipWrap}>
              {(['', 'HIGH', 'MEDIUM', 'LOW'] as const).map((priority) => (
                <Pressable
                  key={priority || 'any'}
                  style={[
                    styles.chip,
                    filters.projectPriority === priority && styles.chipActive,
                  ]}
                  onPress={() =>
                    onFiltersChange({ ...filters, projectPriority: priority })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.projectPriority === priority &&
                        styles.chipTextActive,
                    ]}
                  >
                    {priority || 'Any'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.micro}>Action status</Text>
            <View style={styles.chipWrap}>
              {(['OPEN', 'DONE', 'ANY'] as const).map((status) => (
                <Pressable
                  key={status}
                  style={[
                    styles.chip,
                    filters.actionStatus === status && styles.chipActive,
                  ]}
                  onPress={() =>
                    onFiltersChange({ ...filters, actionStatus: status })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.actionStatus === status && styles.chipTextActive,
                    ]}
                  >
                    {status === 'ANY' ? 'Any' : status === 'DONE' ? 'Done' : 'Open'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.micro}>Quadrant</Text>
            <View style={styles.chipWrap}>
              <Pressable
                style={[styles.chip, !filters.quadrant && styles.chipActive]}
                onPress={() =>
                  onFiltersChange({ ...filters, quadrant: '' })
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    !filters.quadrant && styles.chipTextActive,
                  ]}
                >
                  Any
                </Text>
              </Pressable>
              {PRIORITY_MATRIX_ORDER.map((id) => (
                <Pressable
                  key={id}
                  style={[
                    styles.chip,
                    filters.quadrant === id && styles.chipActive,
                  ]}
                  onPress={() =>
                    onFiltersChange({ ...filters, quadrant: id })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.quadrant === id && styles.chipTextActive,
                    ]}
                  >
                    {PRIORITY_QUADRANT_META[id].label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.dateModalActions}>
              <Pressable
                style={[styles.dateModalBtn, styles.dateModalBtnSecondary]}
                onPress={() => onFiltersChange(resetPriorityFilters())}
              >
                <Text style={styles.dateModalBtnSecondaryText}>Reset</Text>
              </Pressable>
              <Pressable
                style={[styles.dateModalBtn, styles.dateModalBtnPrimary]}
                onPress={() => setFilterOpen(false)}
              >
                <Text style={styles.dateModalBtnPrimaryText}>
                  Apply · {filteredActions.length}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={rebalanceOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRebalanceOpen(false)}
      >
        <View style={styles.modalWrap}>
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setRebalanceOpen(false)}
          />
          <View style={[styles.bottomSheet, { maxHeight: '85%' }]}>
            <Text style={styles.sheetTitle}>Rebalance your week</Text>
            <Text style={styles.sheetHint}>
              {overHours.toFixed(1)}h over capacity — park heavy work or move
              projects to Ideas.
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {heavyProjects.length > 0 && onMoveProjectToIdea ? (
                <View style={{ gap: 8, marginBottom: 16 }}>
                  <Text style={styles.micro}>Move to Ideas</Text>
                  {heavyProjects.slice(0, 5).map(({ project, hours }) => (
                    <View key={project.id} style={styles.rebalanceRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.actionTitle} numberOfLines={1}>
                          {project.title}
                        </Text>
                        <Text style={styles.actionMeta} numberOfLines={1}>
                          {hours.toFixed(1)}h across open actions
                        </Text>
                      </View>
                      <Pressable
                        disabled={busy}
                        onPress={() => {
                          onMoveProjectToIdea(project);
                          setRebalanceOpen(false);
                        }}
                        style={styles.smallBtn}
                      >
                        <Text style={styles.smallBtnText}>Park</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={styles.micro}>Actions by hours</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                {rankedActions.map((action) => {
                  const project = projectById.get(action.parentId ?? '');
                  return (
                    <View key={action.id} style={styles.rebalanceRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.actionTitle} numberOfLines={1}>
                          {action.title}
                        </Text>
                        <Text style={styles.actionMeta} numberOfLines={1}>
                          {hoursOf(action)}h
                          {project ? ` · ${project.title}` : ''}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {onParkAction ? (
                          <Pressable
                            disabled={busy}
                            onPress={() => onParkAction(action)}
                            style={styles.smallBtn}
                          >
                            <Text style={styles.smallBtnText}>Later</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          disabled={busy}
                          onPress={() =>
                            onMoveActionQuadrant(action, 'ELIMINATE')
                          }
                          style={styles.smallBtn}
                        >
                          <Text style={styles.smallBtnText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable
              style={[styles.primaryBtn, { marginTop: 12 }]}
              onPress={() => setRebalanceOpen(false)}
            >
              <Text style={styles.primaryBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={dateEdit != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDateEdit(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.micro}>Schedule</Text>
            <Text style={styles.sheetTitle}>
              {dateEdit?.completeAfter ? 'Date before done' : 'Pick a date'}
            </Text>
            <Text style={styles.sheetHint}>
              {dateEdit
                ? `"${dateEdit.action.title}" needs a calendar date${
                    dateEdit.completeAfter ? ' before marking it done' : ''
                  }.`
                : ''}
            </Text>
            <DatePickerField
              error={
                dateEdit?.draft && !isValidDateOnly(dateEdit.draft)
                  ? 'Choose a date for Schedule'
                  : undefined
              }
              label="Date"
              onChange={(value) =>
                setDateEdit((current) =>
                  current ? { ...current, draft: value } : current,
                )
              }
              required
              value={dateEdit?.draft ?? ''}
            />
            <View style={styles.dateModalActions}>
              <Pressable
                style={[styles.dateModalBtn, styles.dateModalBtnSecondary]}
                onPress={() => setDateEdit(null)}
              >
                <Text style={styles.dateModalBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.dateModalBtn,
                  styles.dateModalBtnPrimary,
                  (busy ||
                    !dateEdit ||
                    !isValidDateOnly(dateEdit.draft)) &&
                    styles.dateModalBtnDisabled,
                ]}
                disabled={
                  busy ||
                  !dateEdit ||
                  !isValidDateOnly(dateEdit.draft)
                }
                onPress={saveScheduleDate}
              >
                <Text style={styles.dateModalBtnPrimaryText}>
                  {dateEdit?.completeAfter ? 'Save & complete' : 'Save date'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: 'serif',
    fontSize: 34,
    color: colors.ink,
  },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 14, lineHeight: 20 },
  matrixBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  matrixBtnText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 14,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '48%',
  },
  filterChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  filterChipTextActive: { color: '#D6F57A' },
  clearChip: { paddingHorizontal: 10, paddingVertical: 8 },
  clearChipText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  capacityCard: {
    backgroundColor: colors.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    overflow: 'hidden',
  },
  capacityRow: { flexDirection: 'row', gap: 8 },
  capacityCell: { flex: 1, minWidth: 0, alignItems: 'center' },
  capacityValue: {
    fontFamily: 'serif',
    fontSize: 22,
    color: colors.ink,
  },
  capacityLabel: { marginTop: 2, fontSize: 11, color: colors.muted },
  rebalanceLink: {
    marginTop: 12,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rebalanceLinkText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  accordion: {
    backgroundColor: colors.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  accordionHeaderText: { flex: 1, minWidth: 0 },
  micro: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.sageDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  accordionSubtitle: { marginTop: 2, color: colors.muted, fontSize: 13 },
  accordionMeta: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: { color: colors.muted, marginTop: 2 },
  accordionBody: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 8,
    gap: 8,
  },
  emptyCopy: { color: colors.muted, fontSize: 14, padding: 8 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F8F5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, minWidth: 0 },
  actionTitle: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  actionTitleDone: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  actionMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  actionMetaLink: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    textDecorationLine: 'underline',
  },
  actionAside: { alignItems: 'flex-end', gap: 4 },
  actionHours: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  dateChipRow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  dateChip: {
    color: colors.sageDeep,
    fontWeight: '700',
    fontSize: 10,
    maxWidth: 88,
  },
  dateChipMissing: { color: colors.danger },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
    backgroundColor: colors.paper,
    marginBottom: 8,
  },
  dateModalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dateModalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateModalBtnSecondary: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  dateModalBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  dateModalBtnPrimary: { backgroundColor: colors.ink },
  dateModalBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F4F5F0',
  },
  dateModalBtnDisabled: { opacity: 0.45 },
  doneLink: { color: colors.sageDeep, fontWeight: '700', fontSize: 10 },
  doneDot: { color: colors.sageDeep, fontWeight: '700', fontSize: 16, lineHeight: 18 },
  tipCard: {
    backgroundColor: colors.tipBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C9D6C4',
    padding: 14,
    paddingRight: 36,
  },
  tipDismiss: { position: 'absolute', right: 8, top: 6, padding: 6 },
  tipDismissText: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  tipBody: { marginTop: 6, color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,36,31,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.canvas,
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  sheetTitle: {
    fontFamily: 'serif',
    fontSize: 22,
    color: colors.ink,
    marginBottom: 8,
  },
  sheetHint: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  sheetRow: { paddingVertical: 12 },
  sheetRowText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalDismiss: {
    flex: 1,
    backgroundColor: 'rgba(20,36,31,0.35)',
  },
  bottomSheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 10,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  chipTextActive: { color: '#F4F5F0' },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: colors.ink,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#F4F5F0', fontWeight: '700', fontSize: 13 },
  rebalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallBtnText: { fontSize: 10, fontWeight: '700', color: colors.sageDeep },
});

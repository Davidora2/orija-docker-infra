import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { LifeItem } from './api';
import { CapacityRing } from './capacity-ring';
import {
  bodyNumber,
  bodyString,
  childrenOf,
  ideaScore,
  isOpen,
} from './life-data';
import { LifeIcon, lifeIconFromLegacy } from './life-icon';
import {
  PRIORITY_MATRIX_ORDER,
  PRIORITY_QUADRANT_META,
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_META,
  actionPriorityQuadrant,
  isProjectDeadlineOverdue,
  projectPriorityLevel,
  projectPriorityRank,
  projectTargetDate,
  type PriorityQuadrant,
  type ProjectPriority,
} from './priority-matrix';
import { SwipeableRow } from './swipeable-row';
import { PriorityScreen } from './priority-screen';

const colors = {
  ink: '#14241F',
  inkSoft: '#24362F',
  canvas: '#F4F5F0',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  amberSoft: '#FFF3E8',
  danger: '#C9634F',
  acid: '#D6F57A',
};

const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
});

const QUADRANT_TONE: Record<
  PriorityQuadrant,
  { bg: string; border: string }
> = {
  DO_FIRST: { bg: '#F8E4DF', border: '#E8C4BC' },
  SCHEDULE: { bg: '#EEF3EA', border: '#C9D6C4' },
  DELEGATE: { bg: '#F7F1E4', border: '#E4D5B5' },
  ELIMINATE: { bg: '#F7F8F5', border: '#DDE2DD' },
};

type PlanSegment = 'priority' | 'areas' | 'projects' | 'ideas';
type ProjectsView = 'list' | 'matrix';
type IdeasTab = 'inbox' | 'evaluated';

type Props = {
  planSegment: PlanSegment;
  pillars: LifeItem[];
  projects: LifeItem[];
  allIdeas: LifeItem[];
  items: LifeItem[];
  openActions: LifeItem[];
  availableHours: number;
  busy: boolean;
  onNewProject: () => void;
  onCaptureIdea: () => void;
  onQuickAction: (projectId: string) => void;
  onEvaluate: (idea: LifeItem) => void;
  onConvert: (idea: LifeItem) => void;
  onArchiveIdea: (idea: LifeItem) => void;
  onMoveProjectPriority: (project: LifeItem, priority: ProjectPriority) => void;
  onMoveActionQuadrant: (action: LifeItem, quadrant: PriorityQuadrant) => void;
  onCompleteAction: (action: LifeItem) => void;
  onArchiveAction: (action: LifeItem) => void;
  onDeleteAction: (action: LifeItem) => void;
  onArchiveProject: (project: LifeItem) => void;
  onSetProjectStatus: (
    project: LifeItem,
    status: 'ACTIVE' | 'PAUSED' | 'DONE',
  ) => void;
  onSetProjectDeadline: (
    project: LifeItem,
    targetDate: string | null,
  ) => void;
  onAddArea: (title: string) => void;
  onRemoveArea: (pillar: LifeItem) => void;
  onOpenProjectsMatrix: () => void;
  onMoveProjectToIdea?: (project: LifeItem) => void;
  onParkAction?: (action: LifeItem) => void;
  onSetScheduledDate?: (action: LifeItem, date: string) => void;
  onRequestPlanSegment?: (segment: PlanSegment) => void;
  tipDismissed?: boolean;
  onDismissTip?: () => void;
  areaTitle: string;
  onAreaTitleChange: (value: string) => void;
  /** When parent switches to Projects for matrix, prefer matrix view */
  preferMatrix?: boolean;
  showArchived?: boolean;
  onShowArchivedChange?: (value: boolean) => void;
};

function MicroLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.micro}>{children}</Text>;
}

function Pill({
  children,
  tone = 'sage',
}: {
  children: ReactNode;
  tone?: 'sage' | 'amber' | 'ink' | 'danger';
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'amber' && styles.pillAmber,
        tone === 'ink' && styles.pillInk,
        tone === 'danger' && styles.pillDanger,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === 'amber' && styles.pillTextAmber,
          tone === 'ink' && styles.pillTextInk,
          tone === 'danger' && styles.pillTextDanger,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${clamped}%` },
          clamped > 100 ? styles.progressWarn : null,
        ]}
      />
    </View>
  );
}

function Button({
  children,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.buttonTextSecondary,
          variant === 'ghost' && styles.buttonTextGhost,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

function projectStatusLabel(status: string): string {
  if (status === 'DONE') return 'Done';
  if (status === 'PAUSED') return 'Paused';
  if (status === 'ARCHIVED') return 'Archived';
  return 'Active';
}

function projectStatusRank(status: string): number {
  if (status === 'DONE') return 2;
  if (status === 'PAUSED') return 1;
  return 0;
}

function sortedProjects(projects: LifeItem[]): LifeItem[] {
  return [...projects].sort((a, b) => {
    const statusDelta =
      projectStatusRank(a.status) - projectStatusRank(b.status);
    if (statusDelta !== 0) return statusDelta;
    const aRank = projectPriorityRank(projectPriorityLevel(a.body));
    const bRank = projectPriorityRank(projectPriorityLevel(b.body));
    return aRank - bRank || a.title.localeCompare(b.title);
  });
}

function projectHours(items: LifeItem[], projectId: string): number {
  return childrenOf(items, projectId)
    .filter((item) => item.kind === 'ACTION' && isOpen(item))
    .reduce((sum, action) => sum + bodyNumber(action, 'hours', 1), 0);
}

function areaHours(items: LifeItem[], projects: LifeItem[], areaId: string): number {
  return projects
    .filter((project) => project.parentId === areaId && isOpen(project))
    .reduce((sum, project) => sum + projectHours(items, project.id), 0);
}

function areaHealth(
  activeCount: number,
  hours: number,
  available: number,
): { label: string; tone: 'sage' | 'amber' | 'danger' } {
  if (activeCount === 0) return { label: 'Quiet', tone: 'amber' };
  const share = available > 0 ? hours / available : 0;
  if (share >= 0.45) return { label: 'Needs attention', tone: 'amber' };
  if (activeCount >= 1 && hours === 0) return { label: 'Needs attention', tone: 'amber' };
  return { label: 'On track', tone: 'sage' };
}

export function PlanScreen({
  planSegment,
  pillars,
  projects,
  allIdeas,
  items,
  openActions,
  availableHours,
  busy,
  onNewProject,
  onCaptureIdea,
  onQuickAction,
  onEvaluate,
  onConvert,
  onArchiveIdea,
  onMoveProjectPriority,
  onMoveActionQuadrant,
  onCompleteAction,
  onArchiveAction,
  onDeleteAction,
  onArchiveProject,
  onSetProjectStatus,
  onSetProjectDeadline,
  onAddArea,
  onRemoveArea,
  onOpenProjectsMatrix,
  onMoveProjectToIdea,
  onParkAction,
  onSetScheduledDate,
  onRequestPlanSegment,
  tipDismissed = false,
  onDismissTip,
  areaTitle,
  onAreaTitleChange,
  preferMatrix = false,
  showArchived = false,
  onShowArchivedChange,
}: Props) {
  const [projectsView, setProjectsView] = useState<ProjectsView>(
    preferMatrix ? 'matrix' : 'list',
  );
  const [ideasTab, setIdeasTab] = useState<IdeasTab>('inbox');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [movingActionId, setMovingActionId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const visibleProjects = useMemo(() => {
    if (!showArchived) return projects;
    const archived = items.filter(
      (item) => item.kind === 'PROJECT' && item.status === 'ARCHIVED',
    );
    const seen = new Set(projects.map((p) => p.id));
    return [...projects, ...archived.filter((p) => !seen.has(p.id))];
  }, [projects, items, showArchived]);

  useEffect(() => {
    if (preferMatrix) setProjectsView('matrix');
  }, [preferMatrix]);

  useEffect(() => {
    setSelectedAreaId(null);
    setDetailsOpen(false);
    setMovingActionId(null);
    if (planSegment !== 'projects') {
      setSelectedProjectId(null);
    }
    if (planSegment === 'priority' && !preferMatrix) {
      setProjectsView('list');
    }
  }, [planSegment, preferMatrix]);

  const inboxIdeas = useMemo(
    () =>
      allIdeas.filter(
        (idea) =>
          idea.status !== 'EVALUATED' &&
          idea.status !== 'CONVERTED' &&
          idea.status !== 'ARCHIVED' &&
          idea.status !== 'DONE',
      ),
    [allIdeas],
  );
  const evaluatedIdeas = useMemo(
    () => allIdeas.filter((idea) => idea.status === 'EVALUATED'),
    [allIdeas],
  );

  const selectedProject =
    visibleProjects.find((p) => p.id === selectedProjectId) ?? null;
  const selectedArea = pillars.find((p) => p.id === selectedAreaId) ?? null;

  const archivedToggle =
    onShowArchivedChange != null ? (
      <Pressable
        onPress={() => onShowArchivedChange(!showArchived)}
        style={[styles.toggleChip, showArchived && styles.toggleChipActive]}
      >
        <Text
          style={[
            styles.toggleChipText,
            showArchived && styles.toggleChipTextActive,
          ]}
        >
          {showArchived ? 'Showing archived' : 'Show archived'}
        </Text>
      </Pressable>
    ) : null;

  if (planSegment === 'priority') {
    if (projectsView === 'matrix') {
      return (
        <View style={styles.stack}>
          <Pressable
            onPress={() => setProjectsView('list')}
            style={styles.backRow}
          >
            <LifeIcon name="chevron-left" size={16} />
            <Text style={styles.backText}>Priority</Text>
          </Pressable>
          <ActionMatrixView
            openActions={openActions}
            projects={visibleProjects}
            movingActionId={movingActionId}
            onSelectAction={(id) =>
              setMovingActionId((current) => (current === id ? null : id))
            }
            onPlaceInQuadrant={(quadrant) => {
              const action = openActions.find((a) => a.id === movingActionId);
              if (!action) return;
              onMoveActionQuadrant(action, quadrant);
              setMovingActionId(null);
            }}
          />
        </View>
      );
    }
    return (
      <PriorityScreen
        pillars={pillars}
        projects={projects}
        openActions={openActions}
        availableHours={availableHours}
        busy={busy}
        tipDismissed={tipDismissed}
        onDismissTip={() => onDismissTip?.()}
        onOpenMatrix={() => setProjectsView('matrix')}
        onCompleteAction={onCompleteAction}
        onMoveActionQuadrant={onMoveActionQuadrant}
        onSetScheduledDate={onSetScheduledDate}
        onOpenProject={(project) => {
          setSelectedProjectId(project.id);
          onRequestPlanSegment?.('projects');
        }}
        onMoveProjectToIdea={onMoveProjectToIdea}
        onParkAction={onParkAction}
      />
    );
  }

  if (planSegment === 'ideas') {
    const list = ideasTab === 'inbox' ? inboxIdeas : evaluatedIdeas;
    return (
      <View style={styles.stack}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ideas</Text>
          <Button onPress={onCaptureIdea}>Capture</Button>
        </View>
        <View style={styles.toggleRow}>
          {(
            [
              ['inbox', 'Inbox'],
              ['evaluated', 'Evaluated'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setIdeasTab(id)}
              style={[styles.toggleChip, ideasTab === id && styles.toggleChipActive]}
            >
              <Text
                style={[
                  styles.toggleChipText,
                  ideasTab === id && styles.toggleChipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {list.length === 0 ? (
          <Card>
            <Text style={styles.cardTitle}>
              {ideasTab === 'inbox' ? 'Inbox is clear' : 'Nothing evaluated yet'}
            </Text>
            <Text style={styles.cardBody}>
              {ideasTab === 'inbox'
                ? 'Capture something rough. Evaluate winners, then turn them into projects.'
                : 'Score an idea from Inbox to move it here.'}
            </Text>
          </Card>
        ) : (
          list.map((idea) => {
            const score = ideaScore(idea);
            return (
              <Card key={idea.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{idea.title}</Text>
                  <Pill tone={score > 0 ? 'sage' : 'amber'}>
                    {score > 0 ? `Score ${score}` : 'Unevaluated'}
                  </Pill>
                </View>
                {bodyString(idea, 'note') ? (
                  <Text style={styles.cardBody}>{bodyString(idea, 'note')}</Text>
                ) : null}
                <View style={styles.row}>
                  {ideasTab === 'inbox' ? (
                    <Button
                      variant="secondary"
                      style={{ flex: 1 }}
                      onPress={() => onEvaluate(idea)}
                    >
                      Evaluate
                    </Button>
                  ) : null}
                  <Button style={{ flex: 1 }} onPress={() => onConvert(idea)}>
                    Turn into project
                  </Button>
                </View>
                <Button variant="ghost" onPress={() => onArchiveIdea(idea)}>
                  Archive
                </Button>
              </Card>
            );
          })
        )}
      </View>
    );
  }

  if (planSegment === 'areas') {
    if (selectedProject) {
      return (
        <ProjectDetail
          project={selectedProject}
          pillars={pillars}
          items={items}
          detailsOpen={detailsOpen}
          setDetailsOpen={setDetailsOpen}
          busy={busy}
          backLabel="Area"
          onBack={() => {
            setSelectedProjectId(null);
            setDetailsOpen(false);
          }}
          onMovePriority={onMoveProjectPriority}
          onQuickAction={onQuickAction}
          onCompleteAction={onCompleteAction}
          onArchiveAction={onArchiveAction}
          onDeleteAction={onDeleteAction}
          onArchiveProject={onArchiveProject}
          onSetProjectStatus={onSetProjectStatus}
          onSetProjectDeadline={onSetProjectDeadline}
          showArchived={showArchived}
          onShowMatrix={() => {
            setSelectedProjectId(null);
            setSelectedAreaId(null);
            setProjectsView('matrix');
            onOpenProjectsMatrix();
          }}
        />
      );
    }

    if (selectedArea) {
      const areaProjects = sortedProjects(
        visibleProjects.filter(
          (project) =>
            project.parentId === selectedArea.id &&
            (showArchived || isOpen(project)),
        ),
      );
      const openAreaIdeas = inboxIdeas.filter(
        (idea) => idea.parentId === selectedArea.id,
      );
      const hours = areaHours(items, projects, selectedArea.id);
      return (
        <View style={styles.stack}>
          <Pressable
            onPress={() => setSelectedAreaId(null)}
            style={styles.backRow}
          >
            <LifeIcon name="chevron-left" size={16} />
            <Text style={styles.backText}>Areas</Text>
          </Pressable>
          <View style={styles.areaHeading}>
            <View style={styles.areaIcon}>
              <LifeIcon
                name={lifeIconFromLegacy(
                  bodyString(selectedArea, 'icon'),
                  Math.max(pillars.findIndex((pillar) => pillar.id === selectedArea.id), 0),
                )}
                size={25}
              />
            </View>
            <Text style={styles.sectionTitle}>{selectedArea.title}</Text>
          </View>
          <Text style={styles.cardBody}>
            {areaProjects.length} active project
            {areaProjects.length === 1 ? '' : 's'} · {hours.toFixed(1)}h this week
          </Text>
          <Card>
            <View style={styles.capacitySummary}>
              <CapacityRing
                used={hours}
                capacity={availableHours}
                size={96}
                label={`${selectedArea.title} weekly capacity`}
              />
              <View style={styles.capacitySummaryCopy}>
                <MicroLabel>Weekly capacity</MicroLabel>
                <Text style={styles.cardTitle}>
                  {hours.toFixed(1)}h of {availableHours}h
                </Text>
                <Text style={styles.cardBody}>Committed this week</Text>
              </View>
            </View>
          </Card>
          <MicroLabel>Projects</MicroLabel>
          {areaProjects.length === 0 ? (
            <Card>
              <Text style={styles.cardBody}>
                No projects yet — add one from Projects or convert an idea.
              </Text>
              <Button onPress={onNewProject}>New project</Button>
            </Card>
          ) : (
            areaProjects.map((project) => {
              const next = childrenOf(items, project.id).find(
                (item) => item.kind === 'ACTION' && isOpen(item),
              );
              const level = projectPriorityLevel(project.body);
              return (
                <SwipeableRow
                  key={project.id}
                  disabled={busy || project.status === 'ARCHIVED'}
                  onArchive={() => onArchiveProject(project)}
                >
                  <Pressable
                    onPress={() => {
                      setSelectedProjectId(project.id);
                      setDetailsOpen(false);
                    }}
                  >
                    <Card>
                      <View style={styles.rowBetween}>
                        <Text style={styles.listTitle}>{project.title}</Text>
                        <Pill>{PROJECT_PRIORITY_META[level].title}</Pill>
                      </View>
                      <Text style={styles.listMeta}>
                        Next:{' '}
                        {next
                          ? `${next.title} (${bodyNumber(next, 'hours', 1)}h)`
                          : 'Define next action'}
                      </Text>
                    </Card>
                  </Pressable>
                </SwipeableRow>
              );
            })
          )}
          {openAreaIdeas.length > 0 ? (
            <>
              <MicroLabel>Open ideas</MicroLabel>
              {openAreaIdeas.map((idea) => (
                <Card key={idea.id}>
                  <Text style={styles.listTitle}>{idea.title}</Text>
                  <Button variant="secondary" onPress={() => onConvert(idea)}>
                    Turn into project
                  </Button>
                </Card>
              ))}
            </>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.stack}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Areas</Text>
        </View>
        <Text style={styles.lede}>
          Life domains with active load. Tap an area to see its projects.
        </Text>
        {pillars.length === 0 ? (
          <Card>
            <Text style={styles.cardTitle}>No areas yet</Text>
            <Text style={styles.cardBody}>
              Add a life area, then attach projects under it.
            </Text>
          </Card>
        ) : (
          pillars.map((pillar, index) => {
            const pillarProjects = projects.filter(
              (project) => project.parentId === pillar.id && isOpen(project),
            );
            const hours = areaHours(items, projects, pillar.id);
            const pct =
              availableHours > 0
                ? Math.round((hours / availableHours) * 100)
                : 0;
            const health = areaHealth(
              pillarProjects.length,
              hours,
              availableHours,
            );
            return (
              <Pressable
                key={pillar.id}
                onPress={() => setSelectedAreaId(pillar.id)}
              >
                <Card>
                  <View style={styles.areaListRow}>
                    <View style={styles.areaIcon}>
                      <LifeIcon
                        name={lifeIconFromLegacy(
                          bodyString(pillar, 'icon'),
                          index,
                        )}
                        size={22}
                      />
                    </View>
                    <View style={styles.capacitySummaryCopy}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.cardTitle}>{pillar.title}</Text>
                        <Pill tone={health.tone}>{health.label}</Pill>
                      </View>
                      <Text style={styles.statLine}>
                        {pillarProjects.length} active project
                        {pillarProjects.length === 1 ? '' : 's'}
                      </Text>
                      <Text style={styles.statLine}>
                        {hours.toFixed(1)}h this week · {pct}% of capacity
                      </Text>
                    </View>
                  </View>
                  <ProgressBar value={pct} />
                </Card>
              </Pressable>
            );
          })
        )}
        <Card>
          <MicroLabel>Add area</MicroLabel>
          <TextInput
            value={areaTitle}
            onChangeText={onAreaTitleChange}
            placeholder="e.g. Fitness, Side project"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Button disabled={busy} onPress={() => onAddArea(areaTitle)}>
            Add area
          </Button>
          {pillars.length > 0 ? (
            <View style={{ gap: 6, marginTop: 4 }}>
              {pillars.map((pillar) => (
                <View key={`rm-${pillar.id}`} style={styles.rowBetween}>
                  <Text style={styles.listMeta}>{pillar.title}</Text>
                  <Button variant="ghost" onPress={() => onRemoveArea(pillar)}>
                    Remove
                  </Button>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </View>
    );
  }

  // Projects segment
  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        pillars={pillars}
        items={items}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        busy={busy}
        backLabel="Projects"
        onBack={() => {
          setSelectedProjectId(null);
          setDetailsOpen(false);
        }}
        onMovePriority={onMoveProjectPriority}
        onQuickAction={onQuickAction}
        onCompleteAction={onCompleteAction}
        onArchiveAction={onArchiveAction}
        onDeleteAction={onDeleteAction}
        onArchiveProject={onArchiveProject}
        onSetProjectStatus={onSetProjectStatus}
        onSetProjectDeadline={onSetProjectDeadline}
        showArchived={showArchived}
        onShowMatrix={() => {
          setSelectedProjectId(null);
          setProjectsView('matrix');
        }}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Projects</Text>
        <Button onPress={onNewProject}>New</Button>
      </View>
      <Text style={styles.listMeta}>
        Projects use High / Med / Low priority. First actions use Importance ×
        Urgency on the Eisenhower matrix.
      </Text>
      <View style={styles.toggleRow}>
        {(
          [
            ['list', 'List'],
            ['matrix', 'Matrix'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => {
              setProjectsView(id);
              setMovingActionId(null);
            }}
            style={[styles.toggleChip, projectsView === id && styles.toggleChipActive]}
          >
            <Text
              style={[
                styles.toggleChipText,
                projectsView === id && styles.toggleChipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
        {archivedToggle}
      </View>

      {projectsView === 'matrix' ? (
        <ActionMatrixView
          openActions={openActions}
          projects={visibleProjects}
          movingActionId={movingActionId}
          onSelectAction={(id) =>
            setMovingActionId((current) => (current === id ? null : id))
          }
          onPlaceInQuadrant={(quadrant) => {
            const action = openActions.find((a) => a.id === movingActionId);
            if (!action) return;
            onMoveActionQuadrant(action, quadrant);
            setMovingActionId(null);
          }}
        />
      ) : visibleProjects.length === 0 ? (
        <Card>
          <Text style={styles.cardTitle}>No projects yet</Text>
          <Text style={styles.cardBody}>
            Create a project with a first next action, or turn an idea into a
            project.
          </Text>
          <Button onPress={onNewProject}>New project</Button>
        </Card>
      ) : (
        sortedProjects(visibleProjects).map((project) => {
          const next = childrenOf(items, project.id).find(
            (item) => item.kind === 'ACTION' && isOpen(item),
          );
          const level = projectPriorityLevel(project.body);
          const area = pillars.find((pillar) => pillar.id === project.parentId);
          const hours = projectHours(items, project.id);
          const deadline = projectTargetDate(project.body);
          const overdue = isProjectDeadlineOverdue(project.body, project.status);
          return (
            <SwipeableRow
              key={project.id}
              disabled={busy || project.status === 'ARCHIVED'}
              onArchive={() => onArchiveProject(project)}
            >
              <Pressable
                onPress={() => {
                  setSelectedProjectId(project.id);
                  setDetailsOpen(false);
                }}
              >
                <Card>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={2}>
                      {project.title}
                    </Text>
                    <Pill
                      tone={
                        overdue
                          ? 'danger'
                          : level === 'HIGH'
                            ? 'danger'
                            : level === 'MEDIUM'
                              ? 'amber'
                              : 'sage'
                      }
                    >
                      {overdue
                        ? 'Overdue'
                        : PROJECT_PRIORITY_META[level].title}
                    </Pill>
                  </View>
                  <Text style={styles.listMeta} numberOfLines={1}>
                    {projectStatusLabel(project.status)} ·{' '}
                    {area?.title ?? 'Unassigned'}
                  </Text>
                  <Text style={styles.nextLine} numberOfLines={1}>
                    {next
                      ? `Next: ${next.title}`
                      : 'Define next action'}
                  </Text>
                  <Text
                    style={[
                      styles.listMeta,
                      overdue ? { color: colors.danger, fontWeight: '700' } : null,
                    ]}
                  >
                    {hours.toFixed(1)}h this week
                    {deadline
                      ? ` · ${overdue ? 'Overdue' : 'Due'} ${deadline}`
                      : ''}
                    {next ? ` · ${bodyNumber(next, 'hours', 1)}h next` : ''}
                  </Text>
                </Card>
              </Pressable>
            </SwipeableRow>
          );
        })
      )}
    </View>
  );
}

function ProjectDetail({
  project,
  pillars,
  items,
  detailsOpen,
  setDetailsOpen,
  busy,
  backLabel,
  onBack,
  onMovePriority,
  onQuickAction,
  onCompleteAction,
  onArchiveAction,
  onDeleteAction,
  onArchiveProject,
  onSetProjectStatus,
  onSetProjectDeadline,
  onShowMatrix,
  showArchived = false,
}: {
  project: LifeItem;
  pillars: LifeItem[];
  items: LifeItem[];
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
  busy: boolean;
  backLabel: string;
  onBack: () => void;
  onMovePriority: (project: LifeItem, priority: ProjectPriority) => void;
  onQuickAction: (projectId: string) => void;
  onCompleteAction: (action: LifeItem) => void;
  onArchiveAction: (action: LifeItem) => void;
  onDeleteAction: (action: LifeItem) => void;
  onArchiveProject: (project: LifeItem) => void;
  onSetProjectStatus: (
    project: LifeItem,
    status: 'ACTIVE' | 'PAUSED' | 'DONE',
  ) => void;
  onSetProjectDeadline: (
    project: LifeItem,
    targetDate: string | null,
  ) => void;
  onShowMatrix: () => void;
  showArchived?: boolean;
}) {
  const area = pillars.find((pillar) => pillar.id === project.parentId);
  const level = projectPriorityLevel(project.body);
  const statusLabel = projectStatusLabel(project.status);
  const isDone = project.status === 'DONE';
  const isArchived = project.status === 'ARCHIVED';
  const deadline = projectTargetDate(project.body);
  const overdue = isProjectDeadlineOverdue(project.body, project.status);
  const [deadlineDraft, setDeadlineDraft] = useState(deadline ?? '');
  useEffect(() => {
    setDeadlineDraft(deadline ?? '');
  }, [project.id, deadline]);
  const openProjectActions = childrenOf(items, project.id).filter(
    (item) =>
      item.kind === 'ACTION' &&
      (isOpen(item) || (showArchived && item.status === 'ARCHIVED')),
  );
  const doneProjectActions = childrenOf(items, project.id).filter(
    (item) => item.kind === 'ACTION' && item.status === 'DONE',
  );
  const next = openProjectActions.find((item) => isOpen(item)) ?? null;
  const totalActions =
    openProjectActions.filter(isOpen).length + doneProjectActions.length;
  const progress =
    totalActions === 0
      ? 0
      : Math.round((doneProjectActions.length / totalActions) * 100);
  const hours = openProjectActions
    .filter(isOpen)
    .reduce((sum, action) => sum + bodyNumber(action, 'hours', 1), 0);
  const outcome = bodyString(project, 'outcome');

  return (
    <View style={styles.stack}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <LifeIcon name="chevron-left" size={16} />
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      <View style={styles.rowBetween}>
        <View style={styles.projectHeading}>
          <LifeIcon name="priority" size={24} />
          <Text style={[styles.sectionTitle, { flex: 1 }]}>{project.title}</Text>
        </View>
        <Pill
          tone={
            level === 'HIGH' ? 'danger' : level === 'MEDIUM' ? 'amber' : 'sage'
          }
        >
          {PROJECT_PRIORITY_META[level].title}
        </Pill>
      </View>
      <Text style={styles.listMeta}>
        {area?.title ?? 'Unassigned'} · {statusLabel}
        {isArchived ? ' · Archived' : ''}
      </Text>
      {isArchived ? null : isDone ? (
        <Button
          disabled={busy}
          onPress={() => onSetProjectStatus(project, 'ACTIVE')}
        >
          Reopen project
        </Button>
      ) : (
        <View style={{ gap: 8 }}>
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() => onSetProjectStatus(project, 'DONE')}
          >
            Mark done
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onPress={() => onArchiveProject(project)}
          >
            Archive project
          </Button>
        </View>
      )}

      <Card>
        <MicroLabel>Outcome</MicroLabel>
        <Text style={styles.outcomeText}>
          {outcome || 'Add an outcome so this project has a clear finish line.'}
        </Text>
      </Card>

      <Card>
        <MicroLabel>Next action</MicroLabel>
        {next ? (
          <SwipeableRow
            disabled={busy || isDone}
            onArchive={() => onArchiveAction(next)}
            onDelete={() => onDeleteAction(next)}
          >
            <View style={{ padding: 4, gap: 8 }}>
              <Text style={styles.cardTitle}>{next.title}</Text>
              <Text style={styles.listMeta}>
                {bodyNumber(next, 'hours', 1)}h
                {bodyString(next, 'day') ? ` · ${bodyString(next, 'day')}` : ''}
                {' · '}
                {
                  PRIORITY_QUADRANT_META[
                    actionPriorityQuadrant(next.body, project.body)
                  ].title
                }
              </Text>
              <Text style={styles.listMeta}>Swipe left to archive · tap circle to toggle done</Text>
              <Pressable
                disabled={busy}
                onPress={() => onCompleteAction(next)}
                style={styles.completeRow}
                accessibilityRole="button"
                accessibilityLabel={
                  next.status === 'DONE'
                    ? 'Mark next action open'
                    : 'Mark next action done'
                }
              >
                <View
                  style={[
                    styles.completeDot,
                    next.status === 'DONE' && styles.completeDotDone,
                  ]}
                >
                  <LifeIcon
                    name="done"
                    size={16}
                    weight={next.status === 'DONE' ? 'fill' : 'regular'}
                  />
                </View>
                <Text
                  style={[
                    styles.completeLabel,
                    next.status === 'DONE' && styles.completeLabelDone,
                  ]}
                >
                  {next.status === 'DONE' ? 'Completed — tap to undo' : 'Mark complete'}
                </Text>
              </Pressable>
            </View>
          </SwipeableRow>
        ) : (
          <>
            <Text style={styles.cardTitle}>Define next action</Text>
            <Text style={styles.cardBody}>
              Active projects need a concrete next move.
            </Text>
            {!isDone && !isArchived ? (
              <Button onPress={() => onQuickAction(project.id)}>
                Add next action
              </Button>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <MicroLabel>Progress</MicroLabel>
        <Text style={styles.cardTitle}>{progress}%</Text>
        <ProgressBar value={progress} />
        <Text
          style={[
            styles.listMeta,
            overdue ? { color: colors.danger, fontWeight: '700' } : null,
          ]}
        >
          {doneProjectActions.length} done ·{' '}
          {openProjectActions.filter(isOpen).length} open · {hours.toFixed(1)}h
          remaining
          {deadline
            ? ` · ${overdue ? 'Overdue' : 'Due'} ${deadline}`
            : ' · No deadline'}
        </Text>
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <MicroLabel>Actions</MicroLabel>
          <Button variant="ghost" onPress={onShowMatrix}>
            Matrix view
          </Button>
        </View>
        {openProjectActions.length === 0 ? (
          <Text style={styles.cardBody}>No open actions.</Text>
        ) : (
          openProjectActions.slice(0, 8).map((action) => (
            <SwipeableRow
              key={action.id}
              disabled={busy || action.status === 'ARCHIVED'}
              onArchive={() => onArchiveAction(action)}
              onDelete={() => onDeleteAction(action)}
            >
              <View style={styles.actionPreview}>
                <Pressable
                  disabled={busy}
                  onPress={() => onCompleteAction(action)}
                  hitSlop={8}
                >
                  <LifeIcon name="done" size={18} />
                </Pressable>
                <Text style={styles.listTitle}>{action.title}</Text>
                <Text style={styles.listMeta}>
                  {action.status === 'ARCHIVED' ? 'Archived · ' : ''}
                  {bodyNumber(action, 'hours', 1)}h ·{' '}
                  {
                    PRIORITY_QUADRANT_META[
                      actionPriorityQuadrant(action.body, project.body)
                    ].title
                  }
                </Text>
              </View>
            </SwipeableRow>
          ))
        )}
        {doneProjectActions.length > 0 ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={styles.micro}>Done</Text>
            {doneProjectActions.slice(0, 12).map((action) => (
              <Pressable
                key={action.id}
                disabled={busy}
                onPress={() => onCompleteAction(action)}
                style={styles.doneActionRow}
              >
                <LifeIcon name="done" size={18} weight="fill" />
                <Text style={[styles.listTitle, styles.completeLabelDone]} numberOfLines={2}>
                  {action.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {!isDone && !isArchived ? (
          <Button variant="secondary" onPress={() => onQuickAction(project.id)}>
            Quick add action
          </Button>
        ) : null}
      </Card>

      <Pressable onPress={() => setDetailsOpen(!detailsOpen)}>
        <Card>
          <View style={styles.rowBetween}>
            <MicroLabel>Details</MicroLabel>
            <Text style={styles.listMeta}>{detailsOpen ? 'Hide' : 'Show'}</Text>
          </View>
          {detailsOpen ? (
            <View style={{ gap: 10, marginTop: 4 }}>
              <Text style={styles.fieldLabel}>Status</Text>
              <Text style={styles.listMeta}>{statusLabel}</Text>
              <Text style={styles.fieldLabel}>Deadline (YYYY-MM-DD)</Text>
              <TextInput
                value={deadlineDraft}
                onChangeText={setDeadlineDraft}
                placeholder="Optional due date"
                placeholderTextColor={colors.muted}
                editable={!busy && !isDone && !isArchived}
                style={styles.input}
                autoCapitalize="none"
              />
              <View style={styles.chipRow}>
                <Button
                  disabled={
                    busy ||
                    isDone ||
                    isArchived ||
                    deadlineDraft === (deadline ?? '')
                  }
                  onPress={() =>
                    onSetProjectDeadline(project, deadlineDraft.trim() || null)
                  }
                >
                  Save deadline
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || isDone || isArchived || !deadline}
                  onPress={() => {
                    setDeadlineDraft('');
                    onSetProjectDeadline(project, null);
                  }}
                >
                  Clear
                </Button>
              </View>
              {overdue ? (
                <Text style={[styles.listMeta, { color: colors.danger }]}>
                  This project is past its deadline.
                </Text>
              ) : null}
              <Text style={styles.fieldLabel}>Project priority</Text>
              <Text style={styles.listMeta}>
                How soon this project gets attention (High / Medium / Low) — not
                the same as action Importance × Urgency on the Eisenhower matrix.
              </Text>
              <View style={styles.chipRow}>
                {PROJECT_PRIORITIES.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      if (!isDone && !isArchived) onMovePriority(project, option);
                    }}
                    style={[
                      styles.chip,
                      level === option && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        level === option && styles.chipTextActive,
                      ]}
                    >
                      {PROJECT_PRIORITY_META[option].title}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {bodyString(project, 'fromIdeaId') ? (
                <Text style={styles.listMeta}>Converted from an idea</Text>
              ) : null}
            </View>
          ) : null}
        </Card>
      </Pressable>
    </View>
  );
}


function ActionMatrixView({
  openActions,
  projects,
  movingActionId,
  onSelectAction,
  onPlaceInQuadrant,
}: {
  openActions: LifeItem[];
  projects: LifeItem[];
  movingActionId: string | null;
  onSelectAction: (id: string) => void;
  onPlaceInQuadrant: (quadrant: PriorityQuadrant) => void;
}) {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return (
    <View style={styles.stack}>
      <Card>
        <MicroLabel>Priority matrix</MicroLabel>
        <Text style={styles.cardTitle}>Actions by focus</Text>
        <Text style={styles.cardBody}>
          {movingActionId
            ? 'Tap a quadrant to place the selected action.'
            : 'Tap an action, then tap a quadrant to move it. Long-press also selects.'}
        </Text>
      </Card>
      <View style={styles.matrixGrid}>
        {PRIORITY_MATRIX_ORDER.map((id) => {
          const meta = PRIORITY_QUADRANT_META[id];
          const tone = QUADRANT_TONE[id];
          const quadrantActions = openActions.filter(
            (action) =>
              actionPriorityQuadrant(
                action.body,
                projectById.get(action.parentId ?? '')?.body,
              ) === id,
          );
          const hours = quadrantActions.reduce(
            (sum, action) => sum + bodyNumber(action, 'hours', 1),
            0,
          );
          return (
            <Pressable
              key={id}
              onPress={() => {
                if (movingActionId) onPlaceInQuadrant(id);
              }}
              style={[
                styles.matrixCell,
                { backgroundColor: tone.bg, borderColor: tone.border },
                movingActionId ? styles.matrixCellDrop : null,
              ]}
            >
              <Text style={styles.micro}>{meta.subtitle}</Text>
              <Text style={styles.matrixTitle}>{meta.title}</Text>
              <Text style={styles.matrixHours}>
                {quadrantActions.length} · {hours.toFixed(1)}h
              </Text>
              <Text style={styles.matrixDesc} numberOfLines={2}>
                {meta.description}
              </Text>
              {quadrantActions.length === 0 ? (
                <Text style={styles.listMeta}>No actions here.</Text>
              ) : (
                quadrantActions.map((action) => {
                  const project = projectById.get(action.parentId ?? '');
                  const selected = movingActionId === action.id;
                  return (
                    <Pressable
                      key={action.id}
                      onPress={() => onSelectAction(action.id)}
                      onLongPress={() => onSelectAction(action.id)}
                      style={[
                        styles.actionChip,
                        selected && styles.actionChipSelected,
                      ]}
                    >
                      <Text style={styles.listTitle} numberOfLines={2}>
                        {action.title}
                      </Text>
                      <Text style={styles.listMeta}>
                        {bodyNumber(action, 'hours', 1)}h
                        {project ? ` · ${project.title}` : ''}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  completeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.sageDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeDotDone: {
    backgroundColor: colors.sage,
  },
  completeLabel: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 13,
  },
  completeLabelDone: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  doneActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  stack: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: serif,
    fontSize: 26,
    color: colors.ink,
    flex: 1,
  },
  lede: { color: colors.muted, lineHeight: 20, marginBottom: 4 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  cardTitle: {
    fontFamily: serif,
    fontSize: 22,
    color: colors.ink,
  },
  cardBody: { color: colors.muted, lineHeight: 20, fontSize: 14 },
  micro: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.sageDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  row: { flexDirection: 'row', gap: 10 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  areaHeading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  areaIcon: {
    alignItems: 'center',
    backgroundColor: colors.sage,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  areaListRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  capacitySummary: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  capacitySummaryCopy: { flex: 1, gap: 4, minWidth: 0 },
  projectHeading: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 9,
    minWidth: 0,
  },
  listTitle: { color: colors.ink, fontWeight: '600', fontSize: 15 },
  listMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  nextLine: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  statLine: { color: colors.inkSoft, fontSize: 14 },
  outcomeText: {
    fontFamily: serif,
    fontSize: 20,
    color: colors.ink,
    lineHeight: 28,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sage,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillAmber: { backgroundColor: colors.amberSoft },
  pillInk: { backgroundColor: colors.ink },
  pillDanger: { backgroundColor: '#F8E4DF' },
  pillText: { color: colors.sageDeep, fontSize: 11, fontWeight: '700' },
  pillTextAmber: { color: '#8A5A16' },
  pillTextInk: { color: colors.acid },
  pillTextDanger: { color: colors.danger },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.sageDeep,
  },
  progressWarn: { backgroundColor: colors.danger },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonSecondary: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonText: { color: colors.paper, fontWeight: '700', fontSize: 13 },
  buttonTextSecondary: { color: colors.ink },
  buttonTextGhost: { color: colors.muted },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingVertical: 10,
  },
  toggleChipActive: {
    backgroundColor: colors.sageDeep,
    borderColor: colors.sageDeep,
  },
  toggleChipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  toggleChipTextActive: { color: colors.paper },
  backRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
  },
  backText: { color: colors.sageDeep, fontWeight: '700', fontSize: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.paper,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  chipTextActive: { color: colors.paper },
  actionPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
  },
  matrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  matrixCell: {
    width: '47.5%',
    flexGrow: 1,
    minWidth: 150,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  matrixCellDrop: {
    borderStyle: 'dashed',
  },
  matrixTitle: {
    fontFamily: serif,
    fontSize: 18,
    color: colors.ink,
  },
  matrixHours: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.sageDeep,
  },
  matrixDesc: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 15,
  },
  actionChip: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
    gap: 2,
    marginTop: 4,
  },
  actionChipSelected: {
    borderColor: colors.ink,
    borderWidth: 2,
    backgroundColor: colors.paper,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
});

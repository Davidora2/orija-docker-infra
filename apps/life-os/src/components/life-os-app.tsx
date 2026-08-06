"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Compass,
  Download,
  Flag,
  Focus,
  Gauge,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  Layers3,
  Lightbulb,
  ListTodo,
  MoreHorizontal,
  Pause,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type View = "command" | "portfolio" | "ideas" | "capacity" | "review" | "scorecard";
type Modal = "capture" | "project" | null;

type PrototypeState = {
  journeyStep: number;
  ideaTitle: string;
  ideaNote: string;
  pillar: string;
  projectTitle: string;
  projectOutcome: string;
  projectEstimate: number;
  actionTitle: string;
  actionDuration: number;
  scheduleDay: string;
  scheduled: boolean;
  primaryComplete: boolean;
  scorecardGenerated: boolean;
};

const initialPrototype: PrototypeState = {
  journeyStep: 0,
  ideaTitle: "",
  ideaNote: "",
  pillar: "Product",
  projectTitle: "",
  projectOutcome: "",
  projectEstimate: 7.5,
  actionTitle: "",
  actionDuration: 2,
  scheduleDay: "Fri",
  scheduled: false,
  primaryComplete: false,
  scorecardGenerated: false,
};

const existingHours = 6.5;
const availableHours = 11;

const journey = [
  { label: "Capture idea", view: "ideas" as View },
  { label: "Evaluate", view: "ideas" as View },
  { label: "Create project", view: "portfolio" as View },
  { label: "Check capacity", view: "capacity" as View },
  { label: "Schedule", view: "capacity" as View },
  { label: "Daily brief", view: "command" as View },
  { label: "Weekly review", view: "review" as View },
];

const seedIdeas = [
  {
    title: "Quarterly founder field notes",
    meta: "Captured yesterday · Business",
    status: "Incubate",
  },
  {
    title: "Invite-only design leadership dinner",
    meta: "Captured 3 days ago · Creative",
    status: "Reference",
  },
  {
    title: "Automate weekly investment summary",
    meta: "Captured 5 days ago · Wealth",
    status: "Incubate",
  },
];

const pillarData = [
  {
    name: "Product",
    description: "Build useful products with durable customer value.",
    icon: Layers3,
    goals: 2,
    projects: 3,
    progress: 72,
    attention: false,
  },
  {
    name: "Business",
    description: "Create repeatable systems for sustainable growth.",
    icon: BriefcaseBusiness,
    goals: 2,
    projects: 2,
    progress: 58,
    attention: false,
  },
  {
    name: "Wealth",
    description: "Build a resilient, long-term investment portfolio.",
    icon: CircleDollarSign,
    goals: 1,
    projects: 1,
    progress: 36,
    attention: true,
  },
  {
    name: "Career",
    description: "Develop influence and deliver exceptional work.",
    icon: TrendingUp,
    goals: 2,
    projects: 2,
    progress: 64,
    attention: false,
  },
  {
    name: "Personal",
    description: "Protect energy, relationships and physical health.",
    icon: HeartPulse,
    goals: 2,
    projects: 2,
    progress: 48,
    attention: true,
  },
  {
    name: "Creative",
    description: "Make space for original ideas and expression.",
    icon: Sparkles,
    goals: 1,
    projects: 1,
    progress: 81,
    attention: false,
  },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function percentageStyle(value: number, color?: string) {
  return {
    "--capacity": Math.min(value, 100),
    ...(color ? { "--ring-color": color } : {}),
  } as CSSProperties;
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">
          <Compass size={12} /> {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function JourneyStrip({
  step,
  onNavigate,
}: {
  step: number;
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="journey-strip" aria-label="Prototype journey progress">
      {journey.map((item, index) => (
        <div key={item.label} style={{ display: "contents" }}>
          <button
            className={cx(
              "journey-step",
              index < step && "done",
              index === step && "current",
            )}
            disabled={index > step}
            onClick={() => index <= step && onNavigate(item.view)}
          >
            <span className="journey-step-index">
              {index < step ? <Check size={10} /> : index + 1}
            </span>
            {item.label}
          </button>
          {index < journey.length - 1 && (
            <ChevronRight className="journey-chevron" size={12} />
          )}
        </div>
      ))}
    </div>
  );
}

export function LifeOSApp() {
  const [view, setView] = useState<View>("command");
  const [modal, setModal] = useState<Modal>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [ideaFilter, setIdeaFilter] = useState("Inbox");
  const [toast, setToast] = useState("");
  const [prototype, setPrototype] = useState<PrototypeState>(initialPrototype);
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureNote, setCaptureNote] = useState("");
  const [projectForm, setProjectForm] = useState({
    title: "",
    outcome: "",
    estimate: "7.5",
    action: "",
    duration: "2",
  });
  const hydrated = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("life-os-prototype");
    if (saved) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrototype(JSON.parse(saved) as PrototypeState);
      } catch {
        window.localStorage.removeItem("life-os-prototype");
      }
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (hydrated.current) {
      window.localStorage.setItem("life-os-prototype", JSON.stringify(prototype));
    }
  }, [prototype]);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }

  function patchPrototype(patch: Partial<PrototypeState>) {
    setPrototype((current) => ({ ...current, ...patch }));
  }

  function openCapture() {
    setCaptureTitle("");
    setCaptureNote("");
    setModal("capture");
  }

  function captureIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captureTitle.trim()) return;
    patchPrototype({
      ideaTitle: captureTitle.trim(),
      ideaNote: captureNote.trim(),
      journeyStep: Math.max(1, prototype.journeyStep),
    });
    setModal(null);
    setView("ideas");
    setEvaluating(false);
    showToast("Idea captured — no commitment created.");
  }

  function beginProject() {
    patchPrototype({ journeyStep: Math.max(2, prototype.journeyStep) });
    setProjectForm({
      title: prototype.ideaTitle || "Launch the Life OS founder pilot",
      outcome:
        prototype.ideaNote ||
        "Validate the core planning loop with five founder workflows.",
      estimate: "7.5",
      action: `Create the first working draft of ${prototype.ideaTitle || "the founder pilot"}`,
      duration: "2",
    });
    setModal("project");
  }

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    patchPrototype({
      journeyStep: 3,
      projectTitle: projectForm.title,
      projectOutcome: projectForm.outcome,
      projectEstimate: Number(projectForm.estimate) || 7.5,
      actionTitle: projectForm.action,
      actionDuration: Number(projectForm.duration) || 2,
    });
    setModal(null);
    setView("capacity");
    showToast("Project created. Now check whether it fits.");
  }

  function reduceScope() {
    patchPrototype({ projectEstimate: 4.5, journeyStep: 4 });
    showToast("Scope reduced by 3 hours. Your plan now fits.");
  }

  function scheduleAction() {
    patchPrototype({ scheduled: true, journeyStep: 5 });
    setView("command");
    showToast(`${prototype.actionTitle} scheduled for ${prototype.scheduleDay}.`);
  }

  function completePrimary() {
    patchPrototype({ primaryComplete: true, journeyStep: 6 });
    showToast("Primary Move complete — strong progress.");
  }

  function generateScorecard() {
    patchPrototype({ scorecardGenerated: true, journeyStep: 7 });
    setView("scorecard");
    showToast("Weekly CEO Scorecard generated.");
  }

  function resetPrototype() {
    window.localStorage.removeItem("life-os-prototype");
    setPrototype(initialPrototype);
    setCaptureTitle("");
    setCaptureNote("");
    setEvaluating(false);
    setView("command");
    setModal(null);
    showToast("Prototype journey reset.");
  }

  const currentLabel =
    view === "command"
      ? "Command Centre"
      : view === "portfolio"
        ? "Pillars & Projects"
        : view === "ideas"
          ? "Idea Studio"
          : view === "capacity"
            ? "Capacity Planner"
            : view === "scorecard"
              ? "CEO Scorecard"
              : "Weekly CEO Review";

  const navItems = [
    { view: "command" as View, label: "Command Centre", icon: LayoutDashboard },
    { view: "portfolio" as View, label: "Pillars & Projects", icon: Layers3 },
    {
      view: "ideas" as View,
      label: "Idea Studio",
      icon: Lightbulb,
      count: prototype.ideaTitle ? 4 : 3,
    },
    { view: "capacity" as View, label: "Capacity", icon: Gauge },
    { view: "review" as View, label: "CEO Review", icon: BarChart3 },
  ];

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Life OS</span>
        </div>

        <p className="nav-label">Your operating system</p>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              view === item.view || (view === "scorecard" && item.view === "review");
            return (
              <button
                key={item.view}
                className={cx("nav-item", active && "active")}
                onClick={() => setView(item.view)}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.count && <span className="nav-count">{item.count}</span>}
              </button>
            );
          })}
        </nav>

        <p className="nav-label">Workspace</p>
        <nav className="nav-list" aria-label="Workspace navigation">
          <button className="nav-item" onClick={() => setView("portfolio")}>
            <Target size={17} strokeWidth={1.8} />
            <span>Goals</span>
          </button>
          <button className="nav-item" onClick={() => setView("portfolio")}>
            <ListTodo size={17} strokeWidth={1.8} />
            <span>Actions</span>
          </button>
          <button className="nav-item" onClick={() => showToast("Settings coming next.")}>
            <Settings size={17} strokeWidth={1.8} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="weekly-focus-card">
          <p>Quarterly direction</p>
          <strong>Validate Life OS with a focused founder pilot.</strong>
          <div className="weekly-progress">
            <span />
          </div>
        </div>
        <div className="profile-row">
          <span className="avatar">DO</span>
          <span className="profile-copy">
            <strong>David Orija</strong>
            <span>Founder workspace</span>
          </span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark" aria-hidden="true" />
            Life OS
          </div>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{currentLabel}</strong>
            <span className="prototype-badge">
              <Sparkles size={10} /> Interactive prototype
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              title="Reset prototype journey"
              onClick={resetPrototype}
            >
              <RotateCcw size={15} />
            </button>
            <button
              className="icon-button"
              title="Notifications"
              onClick={() => showToast("2 strategic alerts need your attention.")}
            >
              <Bell size={15} />
              <span className="notification-dot" />
            </button>
            <button className="primary-button" onClick={openCapture}>
              <Plus size={15} />
              <span>Capture idea</span>
            </button>
          </div>
        </header>

        <main className="content">
          <JourneyStrip step={prototype.journeyStep} onNavigate={setView} />

          {view === "command" && (
            <CommandCentre
              prototype={prototype}
              onCapture={openCapture}
              onComplete={completePrimary}
              onReview={() => setView("review")}
              onCapacity={() => setView("capacity")}
              onIdeas={() => setView("ideas")}
              onToast={showToast}
            />
          )}
          {view === "portfolio" && (
            <PortfolioView prototype={prototype} onToast={showToast} />
          )}
          {view === "ideas" && (
            <IdeaStudio
              prototype={prototype}
              evaluating={evaluating}
              filter={ideaFilter}
              onFilter={setIdeaFilter}
              onCapture={openCapture}
              onEvaluate={() => setEvaluating(true)}
              onPillar={(pillar) => patchPrototype({ pillar })}
              onBeginProject={beginProject}
            />
          )}
          {view === "capacity" && (
            <CapacityPlanner
              prototype={prototype}
              onReduce={reduceScope}
              onDay={(scheduleDay) => patchPrototype({ scheduleDay })}
              onSchedule={scheduleAction}
              onToast={showToast}
            />
          )}
          {view === "review" && (
            <WeeklyReview
              prototype={prototype}
              onGenerate={generateScorecard}
              onToast={showToast}
            />
          )}
          {view === "scorecard" && (
            <Scorecard prototype={prototype} onBack={() => setView("review")} />
          )}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            view === item.view || (view === "scorecard" && item.view === "review");
          return (
            <button
              key={item.view}
              className={active ? "active" : ""}
              onClick={() => setView(item.view)}
            >
              <Icon size={18} />
              {item.label.split(" ")[0]}
            </button>
          );
        })}
      </nav>

      {modal === "capture" && (
        <CaptureModal
          title={captureTitle}
          note={captureNote}
          onTitle={setCaptureTitle}
          onNote={setCaptureNote}
          onClose={() => setModal(null)}
          onSubmit={captureIdea}
        />
      )}
      {modal === "project" && (
        <ProjectModal
          form={projectForm}
          pillar={prototype.pillar}
          onChange={(patch) => setProjectForm((current) => ({ ...current, ...patch }))}
          onClose={() => setModal(null)}
          onSubmit={createProject}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} color="#d6f57a" />
          {toast}
        </div>
      )}
    </div>
  );
}

function CommandCentre({
  prototype,
  onCapture,
  onComplete,
  onReview,
  onCapacity,
  onIdeas,
  onToast,
}: {
  prototype: PrototypeState;
  onCapture: () => void;
  onComplete: () => void;
  onReview: () => void;
  onCapacity: () => void;
  onIdeas: () => void;
  onToast: (message: string) => void;
}) {
  const scheduledTitle =
    prototype.actionTitle || "Create the founder-pilot prototype";
  const primaryTitle = prototype.scheduled
    ? scheduledTitle
    : "Approve the Life OS prototype direction";
  const capacity = prototype.scheduled ? 100 : 59;

  const actions = [
    {
      title: "Review capacity assumptions for the founder pilot",
      project: "Life OS · Product",
      time: "45 min",
      energy: "Deep focus",
      done: false,
    },
    {
      title: "Send project handover notes",
      project: "Client delivery · Career",
      time: "25 min",
      energy: "Medium",
      done: false,
    },
    {
      title: "Complete strength session",
      project: "Health baseline · Personal",
      time: "50 min",
      energy: "High",
      done: true,
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Thursday · 06 August"
        title="Good evening, David."
        subtitle={
          prototype.scheduled
            ? "Your plan fits. One focused move will unlock the most progress."
            : "Three priorities are competing for attention. Choose the move with the highest leverage."
        }
        action={
          prototype.primaryComplete ? (
            <button className="primary-button" onClick={onReview}>
              Open weekly review <ArrowRight size={14} />
            </button>
          ) : undefined
        }
      />

      <div className="dashboard-grid">
        <div className="stack">
          <section className="card primary-move">
            <div className="primary-top">
              <span className="label-pill">
                <span className="spark" />
                Primary Move
              </span>
              <span className="primary-time">
                {prototype.scheduled
                  ? `${prototype.scheduleDay} · 09:00–11:00`
                  : "Today · 10:00–11:30"}
              </span>
            </div>
            <h2>{primaryTitle}</h2>
            <p>
              {prototype.scheduled
                ? `This is the next action for “${prototype.projectTitle}” and directly supports your Product pillar.`
                : "Finalize the core workflow and visual direction before expanding the product surface."}
            </p>
            <div className="primary-footer">
              {prototype.primaryComplete ? (
                <button className="primary-button acid" onClick={onReview}>
                  <CheckCircle2 size={15} /> Complete · review the week
                </button>
              ) : (
                <button
                  className="primary-button acid"
                  onClick={
                    prototype.scheduled
                      ? onComplete
                      : () => onToast("Focus timer started for 90 minutes.")
                  }
                >
                  {prototype.scheduled ? (
                    <>
                      <Check size={15} /> Mark complete
                    </>
                  ) : (
                    <>
                      <Focus size={15} /> Start focus
                    </>
                  )}
                </button>
              )}
              <span className="primary-project">
                {prototype.scheduled ? prototype.projectTitle : "Life OS · Product"}
              </span>
            </div>
          </section>

          <section className="card section-card">
            <div className="section-heading">
              <div>
                <h2>Supporting actions</h2>
                <p>Keep today intentionally small.</p>
              </div>
              <button className="text-link" onClick={() => onToast("Action manager opened.")}>
                View all <ChevronRight size={12} />
              </button>
            </div>
            <div className="action-list">
              {actions.map((action) => (
                <div
                  className={cx("action-row", action.done && "completed")}
                  key={action.title}
                >
                  <button
                    className="checkbox"
                    aria-label={`Complete ${action.title}`}
                    onClick={() => onToast(`${action.title} updated.`)}
                  >
                    {action.done && <Check size={13} />}
                  </button>
                  <div className="action-copy">
                    <p className="action-title">{action.title}</p>
                    <div className="action-meta">
                      <span>{action.project}</span>
                      <span className="dot" />
                      <span>{action.time}</span>
                    </div>
                  </div>
                  <span className="energy-tag">
                    <Zap size={10} /> {action.energy}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card section-card">
            <div className="section-heading">
              <div>
                <h2>Pillar pulse</h2>
                <p>Where your attention is landing this week.</p>
              </div>
              <span className="text-link">Last 7 days</span>
            </div>
            <div className="pillar-grid">
              {pillarData.slice(0, 3).map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div className="pillar-mini" key={pillar.name}>
                    <div className="pillar-mini-top">
                      <span className="pillar-icon">
                        <Icon size={14} />
                      </span>
                      <span className={cx("health-dot", pillar.attention && "amber")} />
                    </div>
                    <h3>{pillar.name}</h3>
                    <p>{pillar.attention ? "Needs attention" : "On track"}</p>
                    <div className="progress-track">
                      <span style={{ width: `${pillar.progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className="card capacity-card">
            <div className="section-heading">
              <div>
                <h2>Weekly capacity</h2>
                <p>Mon 03 – Sun 09 Aug</p>
              </div>
              <button className="text-link" onClick={onCapacity}>
                Details <ChevronRight size={12} />
              </button>
            </div>
            <div className="capacity-visual">
              <div
                className="capacity-ring"
                style={percentageStyle(capacity)}
                aria-label={`${capacity}% capacity`}
              >
                <div className="capacity-number">
                  <strong>{capacity}%</strong>
                  <span>allocated</span>
                </div>
              </div>
              <div className="capacity-stats">
                <div className="capacity-stat">
                  <span>Available</span>
                  <strong>11h</strong>
                </div>
                <div className="capacity-stat">
                  <span>Committed</span>
                  <strong>{prototype.scheduled ? "11h" : "6.5h"}</strong>
                </div>
                <div className="capacity-stat">
                  <span>Remaining</span>
                  <strong>{prototype.scheduled ? "0h" : "4.5h"}</strong>
                </div>
              </div>
            </div>
            <div className={cx("capacity-status", prototype.scheduled && "warning")}>
              {prototype.scheduled ? <Gauge size={14} /> : <CheckCircle2 size={14} />}
              {prototype.scheduled
                ? "At capacity · protect this plan"
                : "Healthy · 4.5 hours remain"}
            </div>
          </section>

          <section className="card section-card">
            <div className="section-heading">
              <div>
                <h2>Risk alerts</h2>
                <p>Two items need a decision.</p>
              </div>
            </div>
            <div className="alert-list">
              <div className="alert-row">
                <span className="alert-icon">
                  <AlertTriangle size={14} />
                </span>
                <span className="alert-copy">
                  <strong>Wealth pillar is under-attended</strong>
                  <span>No focused action in 12 days</span>
                </span>
                <span className="alert-time">12d</span>
              </div>
              <div className="alert-row">
                <span className="alert-icon muted">
                  <Flag size={14} />
                </span>
                <span className="alert-copy">
                  <strong>Portfolio review has no next action</strong>
                  <span>Active project · Wealth</span>
                </span>
                <span className="alert-time">Now</span>
              </div>
            </div>
          </section>

          <section className="card section-card">
            <div className="section-heading">
              <div>
                <h2>Idea inbox</h2>
                <p>{prototype.ideaTitle ? 4 : 3} waiting for review.</p>
              </div>
              <button className="text-link" onClick={onIdeas}>
                Review <ChevronRight size={12} />
              </button>
            </div>
            {prototype.ideaTitle ? (
              <div className="idea-row" style={{ padding: "4px 0", border: 0 }}>
                <span className="idea-symbol">
                  <Lightbulb size={15} />
                </span>
                <span className="idea-copy">
                  <h3>{prototype.ideaTitle}</h3>
                  <p>Captured just now · {prototype.pillar}</p>
                </span>
              </div>
            ) : (
              <div className="empty-brief" style={{ minHeight: 120, padding: 10 }}>
                <Lightbulb size={22} />
                <p>Your next useful idea can live here without becoming a task.</p>
                <button className="secondary-button" onClick={onCapture}>
                  <Plus size={13} /> Capture idea
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function IdeaStudio({
  prototype,
  evaluating,
  filter,
  onFilter,
  onCapture,
  onEvaluate,
  onPillar,
  onBeginProject,
}: {
  prototype: PrototypeState;
  evaluating: boolean;
  filter: string;
  onFilter: (filter: string) => void;
  onCapture: () => void;
  onEvaluate: () => void;
  onPillar: (pillar: string) => void;
  onBeginProject: () => void;
}) {
  const showEvaluation = evaluating || prototype.journeyStep >= 2;

  return (
    <>
      <PageHeading
        eyebrow="Capture without commitment"
        title="Idea Studio"
        subtitle="Give ideas room to breathe. Nothing becomes work until you make a deliberate decision."
        action={
          <button className="primary-button" onClick={onCapture}>
            <Plus size={14} /> Capture an idea
          </button>
        }
      />
      <div className="toolbar">
        <div className="tabs">
          {["Inbox", "Incubate", "Develop now", "Reference"].map((tab) => (
            <button
              className={cx("tab", filter === tab && "active")}
              key={tab}
              onClick={() => onFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <button className="secondary-button">
          <Search size={13} /> Search ideas
        </button>
      </div>

      <div className="idea-layout">
        <div className="card idea-list">
          {prototype.ideaTitle && (
            <div className="idea-row">
              <span className="idea-symbol">
                <Lightbulb size={16} />
              </span>
              <span className="idea-copy">
                <h3>{prototype.ideaTitle}</h3>
                <p>Captured just now · {prototype.pillar || "Unassigned"}</p>
              </span>
              <span className="idea-actions">
                <span className="status-tag new">
                  {prototype.journeyStep >= 3
                    ? "Converted"
                    : prototype.journeyStep >= 2
                      ? "Develop now"
                      : "New"}
                </span>
                {prototype.journeyStep < 2 && (
                  <button className="secondary-button" onClick={onEvaluate}>
                    Evaluate <ArrowRight size={12} />
                  </button>
                )}
                {prototype.journeyStep === 2 && (
                  <button className="secondary-button" onClick={onBeginProject}>
                    Create project <ArrowRight size={12} />
                  </button>
                )}
              </span>
            </div>
          )}
          {seedIdeas.map((idea) => (
            <div className="idea-row" key={idea.title}>
              <span className="idea-symbol">
                <Lightbulb size={16} />
              </span>
              <span className="idea-copy">
                <h3>{idea.title}</h3>
                <p>{idea.meta}</p>
              </span>
              <span className="idea-actions">
                <span className="status-tag">{idea.status}</span>
                <button className="icon-button" aria-label={`More options for ${idea.title}`}>
                  <MoreHorizontal size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>

        {showEvaluation && prototype.ideaTitle ? (
          <section className="card evaluation-card">
            <div className="evaluation-head">
              <p className="eyebrow">
                <Sparkles size={11} /> Strategic evaluation
              </p>
              <h2>Is this worth doing now?</h2>
              <p>
                Use the score as guidance. The decision — and the trade-off — remain
                yours.
              </p>
            </div>
            <div className="evaluation-body">
              <div className="field">
                <label htmlFor="idea-pillar">Connected pillar</label>
                <select
                  id="idea-pillar"
                  className="select"
                  value={prototype.pillar}
                  onChange={(event) => onPillar(event.target.value)}
                >
                  {["Product", "Business", "Wealth", "Career", "Personal", "Creative"].map(
                    (pillar) => (
                      <option key={pillar}>{pillar}</option>
                    ),
                  )}
                </select>
              </div>
              <div className="score-list">
                {[
                  ["Strategic alignment", 5],
                  ["Long-term leverage", 5],
                  ["Expected benefit", 4],
                  ["Urgency", 3],
                  ["Confidence", 4],
                  ["Effort required", 3],
                  ["Risk", 2],
                ].map(([label, score]) => (
                  <div className="score-row" key={label}>
                    <span>{label}</span>
                    <span className="score-dots">
                      {[1, 2, 3, 4, 5].map((point) => (
                        <span
                          className={cx("score-dot", point <= Number(score) && "filled")}
                          key={point}
                        />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="score-summary">
                <span>
                  Strategic score
                  <br />
                  Strong fit · manageable risk
                </span>
                <strong>16</strong>
              </div>
              <button className="primary-button full-width" onClick={onBeginProject}>
                Develop now · create project <ArrowRight size={14} />
              </button>
            </div>
          </section>
        ) : (
          <section className="card evaluation-card empty-brief">
            <Sparkles size={23} />
            <h2>Make the trade-off visible</h2>
            <p>
              Select “Evaluate” on a new idea to score alignment, leverage, effort and
              risk.
            </p>
          </section>
        )}
      </div>
    </>
  );
}

function PortfolioView({
  prototype,
  onToast,
}: {
  prototype: PrototypeState;
  onToast: (message: string) => void;
}) {
  const projects = [
    {
      title: "Design the Life OS command loop",
      goal: "Launch a working Life OS founder pilot",
      pillar: "Product",
      status: "Active",
      due: "14 Aug",
    },
    ...(prototype.projectTitle
      ? [
          {
            title: prototype.projectTitle,
            goal: "Validate the founder operating system",
            pillar: prototype.pillar,
            status: prototype.scheduled ? "Active" : "Proposed",
            due: "21 Aug",
          },
        ]
      : []),
    {
      title: "Package design advisory offer",
      goal: "Build a repeatable consulting system",
      pillar: "Business",
      status: "Active",
      due: "18 Aug",
    },
    {
      title: "Quarterly portfolio review",
      goal: "Build a resilient investment portfolio",
      pillar: "Wealth",
      status: "At risk",
      due: "09 Aug",
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Strategic portfolio"
        title="Pillars & projects"
        subtitle="Every active commitment should earn its place and connect to a measurable outcome."
        action={
          <button className="primary-button" onClick={() => onToast("New project opened.")}>
            <Plus size={14} /> New project
          </button>
        }
      />
      <section className="portfolio-grid">
        {pillarData.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <article className="card portfolio-pillar" key={pillar.name}>
              <div className="pillar-mini-top">
                <span className="pillar-icon">
                  <Icon size={15} />
                </span>
                <span className={cx("health-dot", pillar.attention && "amber")} />
              </div>
              <h3>{pillar.name}</h3>
              <p>{pillar.description}</p>
              <div className="portfolio-metrics">
                <span className="portfolio-metric">
                  <strong>{pillar.goals}</strong>
                  <span>Active goals</span>
                </span>
                <span className="portfolio-metric">
                  <strong>{pillar.projects}</strong>
                  <span>Projects</span>
                </span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${pillar.progress}%` }} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="card section-card" style={{ marginTop: 18 }}>
        <div className="section-heading">
          <div>
            <h2>Active project portfolio</h2>
            <p>Four commitments across three pillars.</p>
          </div>
          <button className="text-link">
            Filter <ChevronRight size={12} />
          </button>
        </div>
        <div className="project-table">
          <div className="project-row header">
            <span>Project</span>
            <span>Pillar</span>
            <span>Status</span>
            <span>Target</span>
            <span />
          </div>
          {projects.map((project) => (
            <div className="project-row" key={project.title}>
              <span className="project-title">
                <strong>{project.title}</strong>
                <span>{project.goal}</span>
              </span>
              <span className="pillar-tag">{project.pillar}</span>
              <span>{project.status}</span>
              <span>{project.due}</span>
              <button className="icon-button" aria-label={`Open ${project.title}`}>
                <ChevronRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function CapacityPlanner({
  prototype,
  onReduce,
  onDay,
  onSchedule,
  onToast,
}: {
  prototype: PrototypeState;
  onReduce: () => void;
  onDay: (day: string) => void;
  onSchedule: () => void;
  onToast: (message: string) => void;
}) {
  const hasProject = prototype.journeyStep >= 3 && Boolean(prototype.projectTitle);
  const total = existingHours + (hasProject ? prototype.projectEstimate : 0);
  const over = Math.max(0, total - availableHours);
  const percent = Math.round((total / availableHours) * 100);
  const fits = over === 0;

  return (
    <>
      <PageHeading
        eyebrow="Reality before ambition"
        title="Capacity planner"
        subtitle="Protect the plan by comparing every new commitment with the time you actually control."
        action={
          <span className={cx("capacity-status", !fits && "warning")}>
            {fits ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {fits ? (total === availableHours ? "At capacity" : "Under capacity") : "Over capacity"}
          </span>
        }
      />

      <div className="capacity-page-grid">
        <div className="stack">
          <section className="card capacity-hero">
            <div className="capacity-hero-top">
              <div
                className="large-ring"
                style={percentageStyle(percent, fits ? "#7e9e72" : "#d77858")}
              >
                <div className="capacity-number">
                  <strong>{percent}%</strong>
                  <span>allocated</span>
                </div>
              </div>
              <div className="capacity-breakdown">
                <h2>{fits ? "This plan is realistic." : "Something has to move."}</h2>
                <p>
                  {fits
                    ? "You have allocated the time available for focused project work."
                    : "The proposed project exceeds the time you control this week."}
                </p>
                <div className="capacity-bar-row">
                  <span>Existing work</span>
                  <span className="capacity-bar">
                    <span style={{ width: `${(existingHours / total) * 100}%` }} />
                  </span>
                  <strong>6.5h</strong>
                </div>
                {hasProject && (
                  <div className="capacity-bar-row">
                    <span>{prototype.pillar} project</span>
                    <span className="capacity-bar">
                      <span
                        className="proposed"
                        style={{ width: `${(prototype.projectEstimate / total) * 100}%` }}
                      />
                    </span>
                    <strong>{prototype.projectEstimate}h</strong>
                  </div>
                )}
                <div className="capacity-bar-row">
                  <span>Available</span>
                  <span className="capacity-bar">
                    <span style={{ width: "100%" }} />
                  </span>
                  <strong>11h</strong>
                </div>
              </div>
            </div>
            {!fits ? (
              <div className="warning-banner">
                <AlertTriangle size={19} />
                <div>
                  <strong>
                    You have committed to {total} hours, but only have 11 available.
                  </strong>
                  <p>
                    Remove, delay, reduce, delegate or reschedule {over} hours before
                    accepting this project.
                  </p>
                </div>
              </div>
            ) : (
              <div className="warning-banner success-banner">
                <CheckCircle2 size={19} />
                <div>
                  <strong>
                    Your {total}-hour plan fits within 11 available hours.
                  </strong>
                  <p>Protect this plan from new commitments until the next review.</p>
                </div>
              </div>
            )}
          </section>

          {!fits && hasProject && (
            <section className="card section-card">
              <div className="section-heading">
                <div>
                  <h2>Make the trade-off</h2>
                  <p>Choose how to recover {over} hours.</p>
                </div>
              </div>
              <div className="remedy-grid">
                <button className="remedy-button" onClick={onReduce}>
                  <Scissors size={16} />
                  <span>
                    <strong>Reduce scope</strong>
                    <span>Trim this project to 4.5h</span>
                  </span>
                </button>
                <button
                  className="remedy-button"
                  onClick={() => onToast("Choose a project to delay from the full planner.")}
                >
                  <Pause size={16} />
                  <span>
                    <strong>Delay work</strong>
                    <span>Move a lower priority project</span>
                  </span>
                </button>
                <button
                  className="remedy-button"
                  onClick={() => onToast("Delegation notes added to the project.")}
                >
                  <Activity size={16} />
                  <span>
                    <strong>Delegate</strong>
                    <span>Assign a supporting action</span>
                  </span>
                </button>
                <button
                  className="remedy-button"
                  onClick={() => onToast("Next week has 5.5 hours available.")}
                >
                  <CalendarDays size={16} />
                  <span>
                    <strong>Reschedule</strong>
                    <span>Review next week’s capacity</span>
                  </span>
                </button>
              </div>
            </section>
          )}

          {fits && hasProject && !prototype.scheduled && (
            <section className="schedule-panel">
              <div className="section-heading">
                <div>
                  <h2>Schedule the next action</h2>
                  <p>{prototype.actionTitle}</p>
                </div>
                <span className="energy-tag">
                  <Focus size={10} /> Deep focus · {prototype.actionDuration}h
                </span>
              </div>
              <div className="schedule-days">
                {[
                  ["Mon", "10 Aug"],
                  ["Tue", "11 Aug"],
                  ["Wed", "12 Aug"],
                  ["Thu", "13 Aug"],
                  ["Fri", "14 Aug"],
                ].map(([day, date]) => (
                  <button
                    className={cx("day-button", prototype.scheduleDay === day && "selected")}
                    key={day}
                    onClick={() => onDay(day)}
                  >
                    <strong>{day}</strong>
                    <span>{date}</span>
                  </button>
                ))}
              </div>
              <div className="grid-two">
                <div className="field">
                  <label htmlFor="start-time">Start time</label>
                  <select className="select" id="start-time" defaultValue="09:00">
                    <option>08:00</option>
                    <option>09:00</option>
                    <option>10:00</option>
                    <option>14:00</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="energy-window">Energy window</label>
                  <select className="select" id="energy-window" defaultValue="Deep focus">
                    <option>Deep focus</option>
                    <option>High energy</option>
                    <option>Medium energy</option>
                  </select>
                </div>
              </div>
              <button
                className="primary-button full-width"
                style={{ marginTop: 15 }}
                onClick={onSchedule}
              >
                Schedule and open Daily Command Centre <ArrowRight size={14} />
              </button>
            </section>
          )}
        </div>

        <aside className="stack">
          <section className="card section-card">
            <div className="section-heading">
              <div>
                <h2>This week’s commitments</h2>
                <p>Focused project hours only.</p>
              </div>
            </div>
            <div className="commitment-list">
              <div className="commitment">
                <div className="commitment-top">
                  <h3>Life OS core workflow</h3>
                  <strong>3.5h</strong>
                </div>
                <p>Product · 2 scheduled actions</p>
              </div>
              <div className="commitment">
                <div className="commitment-top">
                  <h3>Client project handover</h3>
                  <strong>3h</strong>
                </div>
                <p>Career · Fixed commitment</p>
              </div>
              {hasProject && (
                <div className="commitment">
                  <div className="commitment-top">
                    <h3>{prototype.projectTitle}</h3>
                    <strong>{prototype.projectEstimate}h</strong>
                  </div>
                  <p>{prototype.pillar} · Proposed this session</p>
                </div>
              )}
            </div>
          </section>

          <section className="card section-card">
            <div className="section-heading">
              <div>
                <h2>Capacity by category</h2>
                <p>Whole-week rhythm.</p>
              </div>
            </div>
            {[
              ["Employment", "24h", 80],
              ["Product", "7h", 70],
              ["Health", "4h", 50],
              ["Rest", "9h", 62],
            ].map(([label, hours, width]) => (
              <div className="capacity-bar-row" key={label}>
                <span>{label}</span>
                <span className="capacity-bar">
                  <span style={{ width: `${width}%` }} />
                </span>
                <strong>{hours}</strong>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}

function WeeklyReview({
  prototype,
  onGenerate,
  onToast,
}: {
  prototype: PrototypeState;
  onGenerate: () => void;
  onToast: (message: string) => void;
}) {
  const reviewItems = [
    ["Results", "What moved forward this week?", Target],
    ["Time", "Where did attention actually go?", Clock3],
    ["Bottlenecks", "What repeatedly created friction?", AlertTriangle],
    ["Decisions", "Start, stop, continue, delegate, delay.", Compass],
    ["Priorities", "Choose the three outcomes that matter next.", Flag],
    ["Capacity", "Does the plan fit 11 available hours?", Gauge],
  ] as const;

  return (
    <>
      <PageHeading
        eyebrow="Week 32 · Founder review"
        title="Weekly CEO Review"
        subtitle="Step out of the work. Keep what creates leverage, remove what does not, and protect next week."
      />
      <div className="review-layout">
        <div className="review-sections">
          <section className="card review-section">
            <div className="review-section-head">
              <span className="review-section-icon">
                <Target size={15} />
              </span>
              <span>
                <h3>Results</h3>
                <p>What moved forward this week?</p>
              </span>
              <CheckCircle2 className="review-check" size={17} />
            </div>
            <div className="review-section-body">
              <div className="review-metrics">
                <span className="review-metric">
                  <strong>{prototype.primaryComplete ? 8 : 7}</strong>
                  <span>Actions completed</span>
                </span>
                <span className="review-metric">
                  <strong>2</strong>
                  <span>Milestones moved</span>
                </span>
                <span className="review-metric">
                  <strong>78%</strong>
                  <span>Priority completion</span>
                </span>
              </div>
              <div className="field">
                <label htmlFor="result-note">Most meaningful result</label>
                <textarea
                  className="textarea"
                  id="result-note"
                  defaultValue={
                    prototype.primaryComplete
                      ? `${prototype.actionTitle} completed, moving ${prototype.projectTitle} into active validation.`
                      : "The Life OS core workflow is defined and ready for founder validation."
                  }
                />
              </div>
            </div>
          </section>

          <section className="card review-section">
            <div className="review-section-head">
              <span className="review-section-icon">
                <Clock3 size={15} />
              </span>
              <span>
                <h3>Time & attention</h3>
                <p>Planned 11h · used 10.5h</p>
              </span>
              <CheckCircle2 className="review-check" size={17} />
            </div>
            <div className="review-section-body">
              {[
                ["Product", "5.5h", 76],
                ["Business", "2.5h", 45],
                ["Career", "2h", 36],
                ["Wealth", "0.5h", 12],
              ].map(([label, hours, width]) => (
                <div className="capacity-bar-row" key={label}>
                  <span>{label}</span>
                  <span className="capacity-bar">
                    <span style={{ width: `${width}%` }} />
                  </span>
                  <strong>{hours}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="card review-section">
            <div className="review-section-head">
              <span className="review-section-icon">
                <AlertTriangle size={15} />
              </span>
              <span>
                <h3>Bottlenecks & decisions</h3>
                <p>Name the friction. Decide what changes.</p>
              </span>
              <CheckCircle2 className="review-check" size={17} />
            </div>
            <div className="review-section-body">
              <div className="grid-two">
                <div className="field">
                  <label htmlFor="bottleneck">Main bottleneck</label>
                  <textarea
                    className="textarea"
                    id="bottleneck"
                    defaultValue="Too many active workstreams diluted deep-focus time on Tuesday."
                  />
                </div>
                <div className="field">
                  <label htmlFor="decision">Decision for next week</label>
                  <textarea
                    className="textarea"
                    id="decision"
                    defaultValue="Pause the portfolio automation task until the Life OS pilot is validated."
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="card review-section">
            <div className="review-section-head">
              <span className="review-section-icon">
                <Flag size={15} />
              </span>
              <span>
                <h3>Next week’s three outcomes</h3>
                <p>Fewer priorities. Clear finish lines.</p>
              </span>
              <CheckCircle2 className="review-check" size={17} />
            </div>
            <div className="review-section-body">
              {[
                prototype.projectTitle
                  ? `Validate “${prototype.projectTitle}” with one founder workflow`
                  : "Validate the Life OS prototype with one founder workflow",
                "Finalize the client handover and close open decisions",
                "Complete a 60-minute wealth pillar review",
              ].map((outcome, index) => (
                <div className="outcome-line" key={outcome}>
                  <span className="outcome-number">{index + 1}</span>
                  <input className="input" defaultValue={outcome} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="card review-summary">
          <p className="eyebrow">
            <BarChart3 size={11} /> Review progress
          </p>
          <div className="review-progress">
            <strong>6/6</strong>
            <span>
              Sections ready
              <br />
              to finalize
            </span>
          </div>
          <div className="review-outline">
            {reviewItems.map(([title, , Icon]) => (
              <div className="review-outline-row done" key={title}>
                <Icon size={13} />
                <span>{title}</span>
                <Check size={12} style={{ marginLeft: "auto" }} />
              </div>
            ))}
          </div>
          <div className="modal-note">
            <Sparkles size={14} />
            Your plan uses 11 of 11 available hours. Any new work must replace an
            existing commitment.
          </div>
          <button
            className="primary-button full-width"
            style={{ marginTop: 15 }}
            onClick={onGenerate}
          >
            Generate CEO Scorecard <ArrowRight size={14} />
          </button>
          <button
            className="ghost-button full-width"
            style={{ marginTop: 7 }}
            onClick={() => onToast("Review saved as a draft.")}
          >
            Save draft
          </button>
        </aside>
      </div>
    </>
  );
}

function Scorecard({
  prototype,
  onBack,
}: {
  prototype: PrototypeState;
  onBack: () => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="Week 32 · Complete"
        title="CEO Scorecard"
        subtitle="One page. The signal from the week and the commitments that matter next."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-button" onClick={onBack}>
              Back to review
            </button>
            <button className="primary-button" onClick={() => window.print()}>
              <Download size={14} /> Export
            </button>
          </div>
        }
      />
      <section className="card scorecard">
        <div className="scorecard-hero">
          <p className="eyebrow" style={{ color: "rgba(255,255,255,.48)" }}>
            <CheckCircle2 size={11} /> Weekly review complete
          </p>
          <h2>Focus is translating into progress.</h2>
          <p>
            You completed 78% of planned priorities and protected your available
            capacity.
          </p>
        </div>
        <div className="scorecard-grid">
          <div className="scorecard-block">
            <h3>Next week’s top outcomes</h3>
            {[
              prototype.projectTitle
                ? `Validate “${prototype.projectTitle}” with one founder workflow`
                : "Validate the Life OS prototype",
              "Finalize client handover",
              "Complete wealth pillar review",
            ].map((item, index) => (
              <div className="outcome-line" key={item}>
                <span className="outcome-number">{index + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="scorecard-block">
            <h3>Performance</h3>
            <div className="score-stat-row">
              <span className="score-stat">
                <strong>78%</strong>
                <span>Priorities complete</span>
              </span>
              <span className="score-stat">
                <strong>10.5h</strong>
                <span>Focused time</span>
              </span>
              <span className="score-stat">
                <strong>2</strong>
                <span>Milestones moved</span>
              </span>
            </div>
          </div>
          <div className="scorecard-block">
            <h3>Pillar health</h3>
            {pillarData.slice(0, 4).map((pillar) => (
              <div className="capacity-bar-row" key={pillar.name}>
                <span>{pillar.name}</span>
                <span className="capacity-bar">
                  <span style={{ width: `${pillar.progress}%` }} />
                </span>
                <strong>{pillar.progress}%</strong>
              </div>
            ))}
          </div>
          <div className="scorecard-block">
            <h3>Capacity & risk</h3>
            <div className="score-stat-row">
              <span className="score-stat">
                <strong>11h</strong>
                <span>Available</span>
              </span>
              <span className="score-stat">
                <strong>11h</strong>
                <span>Planned</span>
              </span>
              <span className="score-stat">
                <strong>1</strong>
                <span>Project at risk</span>
              </span>
            </div>
            <div className="modal-note">
              <AlertTriangle size={14} />
              Protect next week from new commitments. Wealth needs one focused action.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function CaptureModal({
  title,
  note,
  onTitle,
  onNote,
  onClose,
  onSubmit,
}: {
  title: string;
  note: string;
  onTitle: (value: string) => void;
  onNote: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">
              <Lightbulb size={11} /> Idea inbox
            </p>
            <h2>Capture it. Don’t commit yet.</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="idea-title">What are you thinking about?</label>
            <input
              autoFocus
              className="input"
              id="idea-title"
              placeholder="e.g. Run a five-person founder pilot"
              required
              value={title}
              onChange={(event) => onTitle(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="idea-note">A little context (optional)</label>
            <textarea
              className="textarea"
              id="idea-note"
              placeholder="What sparked this, and why might it matter?"
              value={note}
              onChange={(event) => onNote(event.target.value)}
            />
          </div>
          <div className="modal-note">
            <Inbox size={14} />
            This enters the Idea Studio. It will not affect your projects, actions or
            capacity until you choose to develop it.
          </div>
        </div>
        <div className="modal-footer">
          <button className="ghost-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Save to Idea Studio <ArrowRight size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}

function ProjectModal({
  form,
  pillar,
  onChange,
  onClose,
  onSubmit,
}: {
  form: {
    title: string;
    outcome: string;
    estimate: string;
    action: string;
    duration: string;
  };
  pillar: string;
  onChange: (patch: Partial<typeof form>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal wide"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">
              <Target size={11} /> Convert idea · {pillar}
            </p>
            <h2>Define the commitment.</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="project-title">Project title</label>
            <input
              className="input"
              id="project-title"
              required
              value={form.title}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="project-outcome">Desired outcome</label>
            <textarea
              className="textarea"
              id="project-outcome"
              required
              value={form.outcome}
              onChange={(event) => onChange({ outcome: event.target.value })}
            />
            <p className="helper">Describe the finish line, not the activity.</p>
          </div>
          <div className="grid-two">
            <div className="field">
              <label htmlFor="project-effort">Estimated project effort</label>
              <select
                className="select"
                id="project-effort"
                value={form.estimate}
                onChange={(event) => onChange({ estimate: event.target.value })}
              >
                <option value="4">4 hours</option>
                <option value="7.5">7.5 hours</option>
                <option value="12">12 hours</option>
                <option value="20">20 hours</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="project-priority">Priority</label>
              <select className="select" id="project-priority" defaultValue="High">
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="next-action">Clear next action</label>
            <input
              className="input"
              id="next-action"
              required
              value={form.action}
              onChange={(event) => onChange({ action: event.target.value })}
            />
          </div>
          <div className="grid-two">
            <div className="field">
              <label htmlFor="action-duration">Action duration</label>
              <select
                className="select"
                id="action-duration"
                value={form.duration}
                onChange={(event) => onChange({ duration: event.target.value })}
              >
                <option value="0.5">30 minutes</option>
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
                <option value="3">3 hours</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="action-energy">Energy required</label>
              <select className="select" id="action-energy" defaultValue="Deep focus">
                <option>Deep focus</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="ghost-button" type="button" onClick={onClose}>
            Keep as an idea
          </button>
          <button className="primary-button" type="submit">
            Create project & check capacity <ArrowRight size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}

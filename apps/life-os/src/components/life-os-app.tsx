"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ideaConversionMetadata,
  ideaStatusForAction,
} from "@life-os/plan-domain";
import {
  createLifeItem,
  forgotPassword,
  getAccount,
  getAuthProviders,
  listLifeItems,
  login,
  logout,
  moveProjectToIdea,
  pingApi,
  register,
  resetPassword,
  updateLifeItem,
  updateProfile,
  verifyResetCode,
  getWealthMeta,
  type Account,
  type AuthProviders,
  type LifeItem,
} from "../lib/api";
import { BudgetPanel } from "./budget-panel";
import { CalendarPanel } from "./calendar-panel";
import { CapacityRing } from "./capacity-ring";
import { GoogleSignInButton } from "./google-sign-in-button";
import { LifeIcon, type LifeIconName } from "./life-icon";
import { MicrosoftSignInButton } from "./microsoft-sign-in-button";
import { OnboardingPanel } from "./onboarding-panel";
import { PlanPanel } from "./plan-panel";
import {
  PRIORITY_QUADRANT_META,
  actionBodyWithFlags,
  actionBodyWithLevels,
  actionBodyWithScheduledDate,
  actionMeetsScheduleDateRequirement,
  actionPriorityQuadrant,
  actionScheduledDate,
  flagsFromQuadrant,
  levelsFromQuadrant,
  priorityRank,
  projectBodyWithPriority,
  projectBodyWithTargetDate,
  projectPriorityFromImportance,
  projectPriorityLevel,
  projectPriorityRank,
  quadrantFromLevels,
  quadrantRequiresScheduledDate,
  toggledActionStatus,
  type PriorityLevel,
  type PriorityQuadrant,
  type ProjectPriority,
} from "../lib/priority-matrix";

function num(item: LifeItem, key: string, fallback = 0) {
  const value = item.body[key];
  return typeof value === "number" ? value : fallback;
}

function str(item: LifeItem, key: string, fallback = "") {
  const value = item.body[key];
  return typeof value === "string" ? value : fallback;
}

function open(item: LifeItem) {
  return item.status !== "DONE" && item.status !== "ARCHIVED" && item.status !== "CONVERTED";
}

async function ensureCapacity(items: LifeItem[]) {
  const hasCapacity = items.some(
    (item) => item.kind === "VISION" && "availableHours" in item.body,
  );
  if (hasCapacity) return items;
  const vision = await createLifeItem({
    kind: "VISION",
    title: "Weekly capacity",
    body: { availableHours: 11 },
    sortOrder: 100,
  });
  return [...items, vision];
}

export function LifeOSApp() {
  const [account, setAccount] = useState<Account | null>(null);
  const [items, setItems] = useState<LifeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<
    | "today"
    | "plan"
    | "calendar"
    | "money"
    | "you"
  >("today");
  const [planSegment, setPlanSegment] = useState<"priority" | "areas" | "projects" | "ideas">("priority");
  const [preferPriorityMatrix, setPreferPriorityMatrix] = useState(false);
  const [youDest, setYouDest] = useState<"menu" | "capacity" | "review">("menu");
  const [authMode, setAuthMode] = useState<
    "login" | "register" | "forgot" | "reset"
  >("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaNote, setIdeaNote] = useState("");
  const [sourceIdeaId, setSourceIdeaId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectOutcome, setProjectOutcome] = useState("");
  const [projectPillarId, setProjectPillarId] = useState("");
  const [projectTargetDate, setProjectTargetDate] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [actionHours, setActionHours] = useState("2");
  const [actionImportance, setActionImportance] =
    useState<PriorityLevel>("HIGH");
  const [actionUrgency, setActionUrgency] = useState<PriorityLevel>("LOW");
  const [actionScheduleDate, setActionScheduleDate] = useState("");
  const [schedulePrompt, setSchedulePrompt] = useState<{
    actionId: string;
    title: string;
    body: Record<string, unknown>;
    importance: PriorityLevel;
    urgency: PriorityLevel;
  } | null>(null);
  const [scheduleDateDraft, setScheduleDateDraft] = useState("");
  const [stickyPrimaryId, setStickyPrimaryId] = useState<string | null>(null);
  const [areaTitle, setAreaTitle] = useState("");
  const [capacityHoursInput, setCapacityHoursInput] = useState("11");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileCurrency, setProfileCurrency] = useState("GBP");
  const [currencies, setCurrencies] = useState<string[]>([
    "GBP",
    "USD",
    "CAD",
    "EUR",
  ]);

  const refresh = useCallback(async () => {
    setError(null);
    const reachable = await pingApi();
    setOnline(reachable);
    const nextAccount = await getAccount();
    setAccount(nextAccount);
    if (!nextAccount) {
      setItems([]);
      return;
    }
    const nextItems = await ensureCapacity(await listLifeItems());
    setItems(nextItems);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
        try {
          setProviders(await getAuthProviders());
        } catch {
          setProviders(null);
        }
        try {
          const meta = await getWealthMeta();
          if (meta.currencies?.length) setCurrencies(meta.currencies);
        } catch {
          // keep defaults
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const pillars = useMemo(() => items.filter((i) => i.kind === "PILLAR" && open(i)), [items]);
  const ideas = useMemo(() => items.filter((i) => i.kind === "IDEA" && open(i)), [items]);
  const projects = useMemo(
    () =>
      items.filter(
        (i) =>
          i.kind === "PROJECT" &&
          i.status !== "ARCHIVED" &&
          i.status !== "CONVERTED",
      ),
    [items],
  );
  const actions = useMemo(() => items.filter((i) => i.kind === "ACTION"), [items]);
  const openActions = useMemo(() => actions.filter(open), [actions]);
  const doneActions = useMemo(() => actions.filter((i) => i.status === "DONE"), [actions]);
  const available =
    items.find((i) => i.kind === "VISION" && "availableHours" in i.body)
      ? num(
          items.find((i) => i.kind === "VISION" && "availableHours" in i.body)!,
          "availableHours",
          11,
        )
      : 11;
  const planned = openActions.reduce((sum, action) => sum + num(action, "hours", 1), 0);
  const rankedOpenPrimary = useMemo(() => {
    if (openActions.length === 0) return null;
    const projectById = new Map(projects.map((project) => [project.id, project]));
    return [...openActions].sort((a, b) => {
      const aProject = projectById.get(a.parentId ?? "");
      const bProject = projectById.get(b.parentId ?? "");
      const aRank = priorityRank(
        actionPriorityQuadrant(a.body, aProject?.body),
      );
      const bRank = priorityRank(
        actionPriorityQuadrant(b.body, bProject?.body),
      );
      const aProjectRank = projectPriorityRank(
        projectPriorityLevel(aProject?.body),
      );
      const bProjectRank = projectPriorityRank(
        projectPriorityLevel(bProject?.body),
      );
      return (
        aRank - bRank ||
        aProjectRank - bProjectRank ||
        a.sortOrder - b.sortOrder
      );
    })[0];
  }, [openActions, projects]);
  const primary = useMemo(() => {
    if (stickyPrimaryId) {
      const sticky = actions.find((item) => item.id === stickyPrimaryId);
      if (sticky && sticky.kind === "ACTION" && sticky.status === "DONE") {
        return sticky;
      }
    }
    return rankedOpenPrimary;
  }, [stickyPrimaryId, actions, rankedOpenPrimary]);
  const needsOnboarding = Boolean(account && !account.user.onboardingCompletedAt);

  useEffect(() => {
    if (!stickyPrimaryId) return;
    if (!actions.some((item) => item.id === stickyPrimaryId)) {
      setStickyPrimaryId(null);
    }
  }, [actions, stickyPrimaryId]);

  useEffect(() => {
    if (account?.user.preferredCurrency) {
      setProfileCurrency(account.user.preferredCurrency);
    }
  }, [account?.user.preferredCurrency]);

  useEffect(() => {
    setCapacityHoursInput(String(available));
  }, [available]);

  async function run(work: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await work();
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-8 text-[#14241f]">
        Loading Life OS…
      </main>
    );
  }

  if (!account) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6 text-[#14241f]">
        <p className="font-serif text-4xl tracking-tight">Life OS</p>
        <p className="text-sm text-[#6c7771]">
          Sign in to the same account you use on Android. Data lives on the server, not in this browser alone.
        </p>
        {!online ? (
          <p className="rounded-xl bg-[#f8e4df] px-3 py-2 text-sm text-[#c9634f]">
            API unreachable. Check the Cloudflare tunnel.
          </p>
        ) : null}
        {authMode === "login" || authMode === "register" ? (
          <div className="flex gap-2">
            <button
              className={`rounded-full px-3 py-1 text-xs font-bold ${authMode === "login" ? "bg-[#14241f] text-[#f4f5f0]" : "bg-[#dbe8d7] text-[#14241f]"}`}
              onClick={() => {
                setAuthMode("login");
                setAuthNotice(null);
                setError(null);
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`rounded-full px-3 py-1 text-xs font-bold ${authMode === "register" ? "bg-[#14241f] text-[#f4f5f0]" : "bg-[#dbe8d7] text-[#14241f]"}`}
              onClick={() => {
                setAuthMode("register");
                setAuthNotice(null);
                setError(null);
              }}
              type="button"
            >
              Create account
            </button>
          </div>
        ) : (
          <button
            className="inline-flex items-center gap-1 self-start text-xs font-bold text-[#617a57]"
            type="button"
            onClick={() => {
              setAuthMode("login");
              setAuthNotice(null);
              setError(null);
            }}
          >
            <LifeIcon name="chevron-left" size={14} />
            Back to sign in
          </button>
        )}

        {authMode === "register" ? (
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        ) : null}

        {authMode !== "reset" ? (
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        ) : null}

        {authMode === "login" || authMode === "register" ? (
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder="Password (10+ chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        ) : null}

        {authMode === "reset" ? (
          <>
            <input
              className="rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="6-digit code from email"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
            />
            <input
              className="rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="New password (10+ chars)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </>
        ) : null}

        {authNotice ? (
          <p className="rounded-xl bg-[#dbe8d7] px-3 py-2 text-sm text-[#2f431e]">
            {authNotice}
          </p>
        ) : null}
        {error ? <p className="text-sm text-[#c9634f]">{error}</p> : null}

        {authMode === "login" || authMode === "register" ? (
          <button
            className="rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-[#f4f5f0] disabled:opacity-50"
            disabled={busy}
            type="button"
            onClick={() =>
              void run(async () => {
                const next =
                  authMode === "register"
                    ? await register({ displayName, email, password })
                    : await login({ email, password });
                setAccount(next);
              })
            }
          >
            {authMode === "register" ? "Create account" : "Sign in"}
          </button>
        ) : null}

        {authMode === "forgot" ? (
          <button
            className="rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-[#f4f5f0] disabled:opacity-50"
            disabled={busy || !email.trim()}
            type="button"
            onClick={() =>
              void run(async () => {
                const result = await forgotPassword(email.trim());
                setAuthNotice(result.message);
                setAuthMode("reset");
              })
            }
          >
            Send verification code
          </button>
        ) : null}

        {authMode === "reset" ? (
          <button
            className="rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-[#f4f5f0] disabled:opacity-50"
            disabled={busy || resetCode.trim().length < 4 || newPassword.length < 10}
            type="button"
            onClick={() =>
              void run(async () => {
                await verifyResetCode(email.trim(), resetCode.trim());
                const next = await resetPassword({
                  email: email.trim(),
                  code: resetCode.trim(),
                  newPassword,
                });
                setAccount(next);
              })
            }
          >
            Set new password
          </button>
        ) : null}

        {authMode === "login" ? (
          <button
            className="text-left text-xs font-bold text-[#617a57]"
            type="button"
            onClick={() => {
              setAuthMode("forgot");
              setAuthNotice(null);
              setError(null);
            }}
          >
            Forgot password?
          </button>
        ) : null}

        {(authMode === "login" || authMode === "register") &&
        (providers?.google || providers?.microsoft) ? (
          <>
            <div className="flex items-center gap-3 text-xs text-[#6c7771]">
              <span className="h-px flex-1 bg-[#dde2dd]" />
              or
              <span className="h-px flex-1 bg-[#dde2dd]" />
            </div>
            <GoogleSignInButton
              enabled={Boolean(providers?.google)}
              busy={busy}
              onSuccess={(next) => setAccount(next)}
              onError={(message) => setError(message)}
            />
            <MicrosoftSignInButton
              enabled={Boolean(providers?.microsoft)}
              busy={busy}
              onSuccess={(next) => setAccount(next)}
              onError={(message) => setError(message)}
            />
          </>
        ) : null}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#f4f5f0] px-4 py-6 text-[#14241f]">
      {needsOnboarding ? (
        <OnboardingPanel
          onComplete={(next) => {
            setAccount(next);
            void refresh();
          }}
          onError={setError}
        />
      ) : null}

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-3xl">Life OS</p>
          <p className="text-sm text-[#6c7771]">
            {account.user.displayName}
            {!online ? " · Offline" : ""} ·{" "}
            {account.user.preferredCurrency || "GBP"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-xl border border-[#dde2dd] bg-white px-3 py-2 text-xs font-bold"
            type="button"
            onClick={() => setSettingsOpen((value) => !value)}
          >
            Profile
          </button>
          <button
            className="rounded-xl border border-[#dde2dd] bg-white px-3 py-2 text-xs font-bold"
            type="button"
            onClick={() =>
              void run(async () => {
                await logout();
                setAccount(null);
                setItems([]);
              })
            }
          >
            Sign out
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <article className="mb-5 space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
          <h2 className="font-serif text-2xl">Profile settings</h2>
          <p className="text-sm text-[#6c7771]">
            Change the currency used for budgets, savings, and net worth.
          </p>
          <select
            className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
            value={profileCurrency}
            onChange={(e) => setProfileCurrency(e.target.value)}
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
            onClick={() =>
              void run(async () => {
                const next = await updateProfile({
                  preferredCurrency: profileCurrency,
                });
                setAccount(next);
                setSettingsOpen(false);
              })
            }
          >
            Save currency
          </button>
        </article>
      ) : null}

      <nav className="mb-5 flex flex-nowrap gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["today", "Today", "today"],
            ["plan", "Plan", "plan"],
            ["calendar", "Cal", "calendar"],
            ["money", "Money", "money"],
            ["you", "You", "you"],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-bold ${tab === id ? "bg-[#14241f] text-[#d6f57a]" : "bg-white border border-[#dde2dd] text-[#14241f]"}`}
            type="button"
            title={id === "calendar" ? "Calendar" : label}
            aria-label={id === "calendar" ? "Calendar" : label}
            onClick={() => {
              setTab(id);
              if (id === "you") setYouDest("menu");
            }}
          >
            <LifeIcon
              name={icon}
              size={15}
              color={tab === id ? "#d6f57a" : "#617a57"}
            />
            {label}
          </button>
        ))}
      </nav>
      {tab === "plan" ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["priority", "Priority", "priority"],
              ["areas", "Areas", "areas"],
              ["projects", "Projects", "projects"],
              ["ideas", "Ideas", "ideas"],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${planSegment === id ? "bg-[#617a57] text-white" : "bg-white border border-[#dde2dd] text-[#14241f]"}`}
              onClick={() => {
                setPlanSegment(id);
                if (id !== "priority") setPreferPriorityMatrix(false);
              }}
            >
              <LifeIcon
                name={icon}
                size={14}
                color={planSegment === id ? "#ffffff" : "#617a57"}
              />
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-xl bg-[#f8e4df] px-3 py-2 text-sm text-[#c9634f]">
          {error}
        </p>
      ) : null}

      {tab === "today" ? (
        <section className="space-y-4">
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">Primary move</p>
            {primary ? (
              <>
                <h2
                  className={`mt-2 font-serif text-2xl ${
                    primary.status === "DONE"
                      ? "text-[#6c7771] line-through"
                      : "text-[#14241f]"
                  }`}
                >
                  {primary.title}
                </h2>
                <p className="text-sm text-[#6c7771]">
                  {num(primary, "hours", 1)}h
                  {str(primary, "day") ? ` · ${str(primary, "day")}` : ""}
                  {(() => {
                    const parent = projects.find((p) => p.id === primary.parentId);
                    const meta =
                      PRIORITY_QUADRANT_META[
                        actionPriorityQuadrant(primary.body, parent?.body)
                      ];
                    return ` · ${meta.title}`;
                  })()}
                  {primary.status === "DONE" ? " · Done" : ""}
                </p>
                <button
                  className="mt-4 rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0]"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const wasDone = primary.status === "DONE";
                      const id = primary.id;
                      await updateLifeItem(id, {
                        status: toggledActionStatus(primary.status),
                      });
                      if (wasDone) setStickyPrimaryId(null);
                      else setStickyPrimaryId(id);
                    })
                  }
                >
                  {primary.status === "DONE" ? "Undo complete" : "Mark done"}
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-[#6c7771]">
                No open actions yet. Capture an idea and turn it into a project.
              </p>
            )}
          </article>
          <article className="flex items-center gap-4 rounded-2xl border border-[#dde2dd] bg-white p-5">
            <CapacityRing
              planned={planned}
              available={available}
              size={88}
              label="Today weekly capacity"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">Capacity</p>
              <h2 className="mt-1 font-serif text-2xl">
                {planned.toFixed(1)}h / {available}h
              </h2>
              <p className="text-sm text-[#6c7771]">
                {planned > available ? "Over capacity — reduce scope in Capacity." : "Within capacity."}
              </p>
            </div>
          </article>
        </section>
      ) : null}

      {tab === "plan" ? (
        <PlanPanel
          planSegment={planSegment}
          pillars={pillars}
          projects={projects}
          items={items}
          openActions={openActions}
          availableHours={available}
          busy={busy}
          areaTitle={areaTitle}
          onAreaTitleChange={setAreaTitle}
          onAddArea={() =>
            void run(async () => {
              if (!areaTitle.trim()) throw new Error("Name the life area.");
              await createLifeItem({
                kind: "PILLAR",
                title: areaTitle.trim(),
                body: { icon: "compass-outline" },
                sortOrder: pillars.length,
              });
              setAreaTitle("");
            })
          }
          onRemoveArea={(pillar) =>
            void run(async () => {
              await updateLifeItem(pillar.id, { status: "ARCHIVED" });
            })
          }
          ideaTitle={ideaTitle}
          ideaNote={ideaNote}
          onIdeaTitleChange={setIdeaTitle}
          onIdeaNoteChange={setIdeaNote}
          onSaveIdea={() =>
            void run(async () => {
              if (!ideaTitle.trim()) throw new Error("Give the idea a title.");
              await createLifeItem({
                kind: "IDEA",
                title: ideaTitle.trim(),
                body: {
                  note: ideaNote.trim(),
                  impact: 0,
                  effort: 0,
                  alignment: 0,
                  timing: 0,
                },
              });
              setIdeaTitle("");
              setIdeaNote("");
            })
          }
          onConvertIdea={(idea) => {
            setSourceIdeaId(idea.id);
            setProjectTitle(idea.title);
            setProjectOutcome(str(idea, "note"));
            setProjectPillarId(idea.parentId ?? pillars[0]?.id ?? "");
            setActionTitle(`Next: ${idea.title}`);
            setActionImportance("HIGH");
            setActionUrgency("LOW");
          }}
          onCancelIdeaConversion={() => setSourceIdeaId(null)}
          onIdeaLifecycle={(idea, action) =>
            void run(async () => {
              await updateLifeItem(idea.id, {
                status: ideaStatusForAction(action),
              });
            })
          }
          onEvaluateIdea={(idea, scores) =>
            void run(async () => {
              const overall =
                (scores.impact +
                  scores.alignment +
                  scores.timing +
                  (10 - scores.effort)) /
                4;
              await updateLifeItem(idea.id, {
                status: "EVALUATED",
                body: {
                  ...idea.body,
                  impact: scores.impact,
                  effort: scores.effort,
                  alignment: scores.alignment,
                  timing: scores.timing,
                  evalNotes: scores.notes,
                  score: overall,
                },
              });
            })
          }
          projectTitle={projectTitle}
          projectOutcome={projectOutcome}
          projectPillarId={projectPillarId}
          projectTargetDate={projectTargetDate}
          actionTitle={actionTitle}
          actionHours={actionHours}
          actionImportance={actionImportance}
          actionUrgency={actionUrgency}
          actionScheduleDate={actionScheduleDate}
          onProjectTitleChange={setProjectTitle}
          onProjectOutcomeChange={setProjectOutcome}
          onProjectPillarIdChange={setProjectPillarId}
          onProjectTargetDateChange={setProjectTargetDate}
          onActionTitleChange={setActionTitle}
          onActionHoursChange={setActionHours}
          onActionImportanceChange={setActionImportance}
          onActionUrgencyChange={setActionUrgency}
          onActionScheduleDateChange={setActionScheduleDate}
          onSaveProject={async () => {
            const ok = await run(async () => {
              if (!projectTitle.trim() || !actionTitle.trim()) {
                throw new Error("Project and next action are required.");
              }
              const hours = Number(actionHours);
              if (!Number.isFinite(hours) || hours <= 0) {
                throw new Error("Hours must be a positive number.");
              }
              const createQuadrant = quadrantFromLevels(
                actionImportance,
                actionUrgency,
              );
              const scheduleDate = actionScheduleDate.trim();
              if (
                quadrantRequiresScheduledDate(createQuadrant) &&
                !/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)
              ) {
                throw new Error(
                  "Schedule actions need a date — pick a schedule date for the first next action.",
                );
              }
              const project = await createLifeItem({
                kind: "PROJECT",
                title: projectTitle.trim(),
                parentId: projectPillarId || null,
                body: projectBodyWithPriority(
                  projectBodyWithTargetDate(
                    {
                      outcome: projectOutcome.trim(),
                      ...(sourceIdeaId
                        ? ideaConversionMetadata(sourceIdeaId).projectBody
                        : {}),
                    },
                    projectTargetDate || null,
                  ),
                  projectPriorityFromImportance(actionImportance),
                ),
              });
              let actionBody: Record<string, unknown> = {
                hours,
                day: "This week",
              };
              if (quadrantRequiresScheduledDate(createQuadrant)) {
                actionBody = actionBodyWithScheduledDate(
                  actionBody,
                  scheduleDate,
                );
              }
              await createLifeItem({
                kind: "ACTION",
                title: actionTitle.trim(),
                parentId: project.id,
                body: actionBodyWithLevels(
                  actionBody,
                  actionImportance,
                  actionUrgency,
                ),
              });
              if (sourceIdeaId) {
                await updateLifeItem(sourceIdeaId, {
                  status: ideaConversionMetadata(sourceIdeaId).sourceIdeaStatus,
                });
              }
              setSourceIdeaId(null);
              setProjectTitle("");
              setProjectOutcome("");
              setProjectTargetDate("");
              setActionTitle("");
              setActionHours("2");
              setActionImportance("HIGH");
              setActionUrgency("LOW");
              setActionScheduleDate("");
            });
            if (!ok) throw new Error("Could not save project");
          }}
          onMoveProjectPriority={(project, priority) =>
            void run(async () => {
              await updateLifeItem(project.id, {
                body: projectBodyWithPriority(project.body, priority),
              });
            })
          }
          onMoveAction={(action, quadrant) => {
            const { importance, urgency } = levelsFromQuadrant(quadrant);
            if (
              quadrantRequiresScheduledDate(quadrant) &&
              !actionMeetsScheduleDateRequirement(action.body, quadrant)
            ) {
              setScheduleDateDraft(actionScheduledDate(action.body) ?? "");
              setSchedulePrompt({
                actionId: action.id,
                title: action.title,
                body: action.body,
                importance,
                urgency,
              });
              return;
            }
            void run(async () => {
              await updateLifeItem(action.id, {
                body: actionBodyWithLevels(action.body, importance, urgency),
              });
            });
          }}
          onCompleteAction={(action) =>
            void run(async () => {
              await updateLifeItem(action.id, {
                status: toggledActionStatus(action.status),
              });
            })
          }
          onSetProjectStatus={(project, status) =>
            void run(async () => {
              await updateLifeItem(project.id, { status });
            })
          }
          onSetProjectDeadline={(project, targetDate) =>
            void run(async () => {
              await updateLifeItem(project.id, {
                body: projectBodyWithPriority(
                  projectBodyWithTargetDate(project.body, targetDate),
                  projectPriorityLevel(project.body),
                ),
              });
            })
          }
          onQuickAddAction={(
            projectId,
            title,
            hours,
            importance,
            urgency,
            when,
          ) =>
            void run(async () => {
              const quadrant = quadrantFromLevels(importance, urgency);
              let body: Record<string, unknown> = {
                hours,
                day: when ?? "This week",
              };
              if (quadrantRequiresScheduledDate(quadrant)) {
                const date =
                  typeof when === "string" &&
                  /^\d{4}-\d{2}-\d{2}$/.test(when)
                    ? when
                    : null;
                if (!date) {
                  throw new Error(
                    "Schedule actions need a calendar date (YYYY-MM-DD).",
                  );
                }
                body = actionBodyWithScheduledDate(body, date);
              }
              await createLifeItem({
                kind: "ACTION",
                title,
                parentId: projectId,
                body: actionBodyWithLevels(body, importance, urgency),
              });
            })
          }
          onOpenProjectsMatrix={() => {
            setPreferPriorityMatrix(true);
            setPlanSegment("priority");
          }}
          preferPriorityMatrix={preferPriorityMatrix}
          onUpdateActionLevels={(action, importance, urgency) => {
            const quadrant = quadrantFromLevels(importance, urgency);
            const nextBody = actionBodyWithLevels(
              action.body,
              importance,
              urgency,
            );
            if (
              quadrantRequiresScheduledDate(quadrant) &&
              !actionMeetsScheduleDateRequirement(nextBody, quadrant)
            ) {
              setScheduleDateDraft(actionScheduledDate(action.body) ?? "");
              setSchedulePrompt({
                actionId: action.id,
                title: action.title,
                body: action.body,
                importance,
                urgency,
              });
              return;
            }
            void run(async () => {
              await updateLifeItem(action.id, { body: nextBody });
            });
          }}
          onMoveProjectToIdea={(project) =>
            void run(async () => {
              await moveProjectToIdea(project.id);
            })
          }
          onParkAction={(action) =>
            void run(async () => {
              await updateLifeItem(action.id, {
                body: { ...action.body, day: "Later" },
              });
            })
          }
          onSetScheduledDate={(action, date) =>
            void run(async () => {
              await updateLifeItem(action.id, {
                body: actionBodyWithScheduledDate(action.body, date),
              });
            })
          }
          onRequestPlanSegment={(segment) => {
            setPlanSegment(segment);
            if (segment !== "priority") setPreferPriorityMatrix(false);
          }}
        />
      ) : null}

      {tab === "you" && youDest === "menu" ? (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl text-[#14241f]">You</h2>
          <p className="text-sm text-[#6c7771]">Capacity and weekly review live here.</p>
          {(
            [
              ["capacity", "Capacity", "Weekly hours and load", "capacity"],
              ["review", "Weekly Review", "CEO-style check-in", "review"],
              ["settings", "Settings", "Account and currency", "settings"],
            ] as const
          ).map(([id, title, description, icon]) => (
            <button
              key={id}
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-[#dde2dd] bg-white px-4 py-3 text-left"
              onClick={() =>
                id === "settings" ? setSettingsOpen(true) : setYouDest(id)
              }
            >
              <LifeIcon name={icon as LifeIconName} size={22} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#14241f]">
                  {title}
                </span>
                <span className="block text-xs text-[#6c7771]">
                  {description}
                </span>
              </span>
              <LifeIcon name="chevron-right" size={16} color="#6c7771" />
            </button>
          ))}
        </section>
      ) : null}

      {tab === "you" && youDest === "capacity" ? (
        <section className="space-y-4">
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
            <div className="flex items-center gap-4">
              <CapacityRing
                planned={planned}
                available={available}
                label="Weekly planned capacity"
              />
              <div className="min-w-0">
                <h2 className="font-serif text-2xl">
                  {planned.toFixed(1)}h planned / {available}h available
                </h2>
                {planned > available ? (
                  <p className="text-sm text-[#c9634f]">
                    Overcommitted — raise available hours or reduce action hours below.
                  </p>
                ) : (
                  <p className="text-sm text-[#6c7771]">Healthy load.</p>
                )}
              </div>
            </div>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                Available hours / week
              </span>
              <div className="flex flex-wrap gap-2">
                <input
                  className="w-full max-w-[160px] rounded-xl border border-[#dde2dd] px-3 py-3"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={capacityHoursInput}
                  onChange={(e) => setCapacityHoursInput(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                  disabled={busy}
                  onClick={() =>
                    setCapacityHoursInput((prev) =>
                      String(Math.max(0.5, (Number(prev) || 0) - 1)),
                    )
                  }
                >
                  −1h
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                  disabled={busy}
                  onClick={() =>
                    setCapacityHoursInput((prev) =>
                      String((Number(prev) || 0) + 1),
                    )
                  }
                >
                  +1h
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const hours = Number(capacityHoursInput);
                      if (!Number.isFinite(hours) || hours <= 0) {
                        throw new Error(
                          "Available hours must be a positive number.",
                        );
                      }
                      const vision = items.find(
                        (item) =>
                          item.kind === "VISION" &&
                          "availableHours" in item.body,
                      );
                      if (vision) {
                        await updateLifeItem(vision.id, {
                          body: { ...vision.body, availableHours: hours },
                        });
                      } else {
                        await createLifeItem({
                          kind: "VISION",
                          title: "Weekly capacity",
                          body: { availableHours: hours },
                        });
                      }
                    })
                  }
                >
                  Save capacity
                </button>
              </div>
              <span className="block text-sm text-[#6c7771]">
                This is your weekly time budget for planned actions.
              </span>
            </label>
          </article>
          {openActions.length === 0 ? (
            <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
              <p className="text-sm text-[#6c7771]">
                No open actions yet. Create a project with a next action to plan
                the week.
              </p>
            </article>
          ) : (
            openActions.map((action) => (
              <article
                key={action.id}
                className="rounded-2xl border border-[#dde2dd] bg-white p-5"
              >
                <p className="font-semibold">{action.title}</p>
                <p className="text-sm text-[#6c7771]">
                  {num(action, "hours", 1)}h
                  {str(action, "day") ? ` · ${str(action, "day")}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await updateLifeItem(action.id, {
                          body: {
                            ...action.body,
                            hours: Math.max(0.5, num(action, "hours", 1) - 1),
                          },
                        });
                      })
                    }
                  >
                    −1h
                  </button>
                  <button
                    className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await updateLifeItem(action.id, {
                          body: {
                            ...action.body,
                            hours: num(action, "hours", 1) + 1,
                          },
                        });
                      })
                    }
                  >
                    +1h
                  </button>
                  <button
                    className="rounded-xl bg-[#14241f] px-3 py-2 text-xs font-bold text-[#f4f5f0]"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await updateLifeItem(action.id, {
                          status: toggledActionStatus(action.status),
                        });
                      })
                    }
                  >
                    {action.status === "DONE" ? "Undo" : "Done"}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "money" ? (
        <BudgetPanel account={account} onError={setError} />
      ) : null}

      {tab === "calendar" ? (
        <CalendarPanel
          preferredCurrency={account.user.preferredCurrency}
          onError={setError}
        />
      ) : null}

      {tab === "you" && youDest === "review" ? (
        <section className="space-y-4">
          <article className="flex items-center gap-4 rounded-2xl border border-[#dde2dd] bg-white p-5">
            <CapacityRing
              planned={planned}
              available={available}
              label="Weekly review planned capacity"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">Scorecard</p>
              <h2 className="mt-2 font-serif text-2xl">
                {doneActions.length} completed · {openActions.length} open
              </h2>
              <p className="text-sm text-[#6c7771]">
                Completion{" "}
                {actions.length === 0
                  ? 0
                  : Math.round((doneActions.length / actions.length) * 100)}
                % · planned {planned.toFixed(1)}h / {available}h
              </p>
            </div>
          </article>
        </section>
      ) : null}
    
      {schedulePrompt ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-date-title"
            className="w-full max-w-md rounded-2xl border border-[#dde2dd] bg-white p-5 shadow-lg"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Schedule
            </p>
            <h3
              id="schedule-date-title"
              className="mt-1 font-serif text-2xl text-[#14241f]"
            >
              Pick a date
            </h3>
            <p className="mt-1 text-sm text-[#6c7771]">
              &ldquo;{schedulePrompt.title}&rdquo; is Important &amp; not Urgent —
              set a date to place it in Schedule.
            </p>
            <label className="mt-4 block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                Date
              </span>
              <input
                type="date"
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={scheduleDateDraft}
                onChange={(e) => setScheduleDateDraft(e.target.value)}
              />
              <span className="text-[11px] text-[#6c7771]">YYYY-MM-DD</span>
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-[#dde2dd] px-4 py-3 text-xs font-bold"
                onClick={() => {
                  setSchedulePrompt(null);
                  setScheduleDateDraft("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                disabled={
                  busy || !/^\d{4}-\d{2}-\d{2}$/.test(scheduleDateDraft)
                }
                onClick={() => {
                  if (
                    !schedulePrompt ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(scheduleDateDraft)
                  ) {
                    return;
                  }
                  const prompt = schedulePrompt;
                  const date = scheduleDateDraft;
                  void run(async () => {
                    await updateLifeItem(prompt.actionId, {
                      body: actionBodyWithLevels(
                        actionBodyWithScheduledDate(prompt.body, date),
                        prompt.importance,
                        prompt.urgency,
                      ),
                    });
                    setSchedulePrompt(null);
                    setScheduleDateDraft("");
                  });
                }}
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  );
}

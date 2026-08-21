"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createLifeItem,
  forgotPassword,
  getAccount,
  getAuthProviders,
  listLifeItems,
  login,
  logout,
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
import { GoogleSignInButton } from "./google-sign-in-button";
import { MicrosoftSignInButton } from "./microsoft-sign-in-button";
import { OnboardingPanel } from "./onboarding-panel";
import { PriorityMatrixPanel } from "./priority-matrix-panel";
import {
  PRIORITY_QUADRANT_META,
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_META,
  actionBodyWithFlags,
  actionPriorityQuadrant,
  flagsFromQuadrant,
  priorityRank,
  projectBodyWithPriority,
  projectPriorityLevel,
  projectPriorityRank,
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
  const [planSegment, setPlanSegment] = useState<"areas" | "projects" | "ideas">("areas");
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
  const [projectTitle, setProjectTitle] = useState("");
  const [projectOutcome, setProjectOutcome] = useState("");
  const [projectPillarId, setProjectPillarId] = useState("");
  const [projectPriority, setProjectPriority] =
    useState<ProjectPriority>("MEDIUM");
  const [actionTitle, setActionTitle] = useState("");
  const [actionHours, setActionHours] = useState("2");
  const [actionImportantFlag, setActionImportantFlag] = useState(true);
  const [actionUrgentFlag, setActionUrgentFlag] = useState(false);
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
  const projects = useMemo(() => items.filter((i) => i.kind === "PROJECT" && open(i)), [items]);
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
  const primary = useMemo(() => {
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
  const needsOnboarding = Boolean(account && !account.user.onboardingCompletedAt);

  useEffect(() => {
    if (account?.user.preferredCurrency) {
      setProfileCurrency(account.user.preferredCurrency);
    }
  }, [account?.user.preferredCurrency]);

  useEffect(() => {
    setCapacityHoursInput(String(available));
  }, [available]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
            className="self-start text-xs font-bold text-[#617a57]"
            type="button"
            onClick={() => {
              setAuthMode("login");
              setAuthNotice(null);
              setError(null);
            }}
          >
            ← Back to sign in
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
            {account.user.displayName} · {online ? "Online" : "Offline"} ·{" "}
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

      <nav className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["today", "Today"],
            ["plan", "Plan"],
            ["calendar", "Calendar"],
            ["money", "Money"],
            ["you", "You"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${tab === id ? "bg-[#14241f] text-[#d6f57a]" : "bg-white border border-[#dde2dd] text-[#14241f]"}`}
            type="button"
            onClick={() => {
              setTab(id);
              if (id === "you") setYouDest("menu");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "plan" ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["areas", "Areas"],
              ["projects", "Projects"],
              ["ideas", "Ideas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-bold ${planSegment === id ? "bg-[#617a57] text-white" : "bg-white border border-[#dde2dd] text-[#14241f]"}`}
              onClick={() => setPlanSegment(id)}
            >
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
                <h2 className="mt-2 font-serif text-2xl">{primary.title}</h2>
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
                </p>
                <button
                  className="mt-4 rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0]"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await updateLifeItem(primary.id, { status: "DONE" });
                    })
                  }
                >
                  Mark done
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-[#6c7771]">
                No open actions yet. Capture an idea and turn it into a project.
              </p>
            )}
          </article>
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">Capacity</p>
            <h2 className="mt-2 font-serif text-2xl">
              {planned.toFixed(1)}h / {available}h
            </h2>
            <p className="text-sm text-[#6c7771]">
              {planned > available ? "Over capacity — reduce scope in Capacity." : "Within capacity."}
            </p>
          </article>
        </section>
      ) : null}

      {tab === "plan" && planSegment === "ideas" ? (
        <section className="space-y-4">
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
            <h2 className="font-serif text-2xl">Capture idea</h2>
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="Title"
              value={ideaTitle}
              onChange={(e) => setIdeaTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="Note"
              value={ideaNote}
              onChange={(e) => setIdeaNote(e.target.value)}
            />
            <button
              className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (!ideaTitle.trim()) throw new Error("Give the idea a title.");
                  await createLifeItem({
                    kind: "IDEA",
                    title: ideaTitle.trim(),
                    body: { note: ideaNote.trim(), impact: 0, effort: 0, alignment: 0, timing: 0 },
                  });
                  setIdeaTitle("");
                  setIdeaNote("");
                })
              }
            >
              Save idea
            </button>
          </article>
          {ideas.map((idea) => (
            <article key={idea.id} className="rounded-2xl border border-[#dde2dd] bg-white p-5">
              <h3 className="font-serif text-xl">{idea.title}</h3>
              {str(idea, "note") ? (
                <p className="mt-1 text-sm text-[#6c7771]">{str(idea, "note")}</p>
              ) : null}
              <button
                className="mt-3 rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                type="button"
                disabled={busy}
                onClick={() => {
                  setProjectTitle(idea.title);
                  setProjectOutcome(str(idea, "note"));
                  setProjectPillarId(idea.parentId ?? pillars[0]?.id ?? "");
                  setProjectPriority("MEDIUM");
                  setActionTitle(`Next: ${idea.title}`);
                  setActionImportantFlag(true);
                  setActionUrgentFlag(false);
                  setTab("plan");
                  setPlanSegment("projects");
                }}
              >
                Turn into Project
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "plan" && (planSegment === "areas" || planSegment === "projects") ? (
        <section className="space-y-4">
          {planSegment === "areas" ? (
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
            <h2 className="font-serif text-2xl">Life areas</h2>
            <p className="text-sm text-[#6c7771]">
              Areas hold projects. Today stays execution-only.
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-[#dde2dd] px-3 py-3"
                placeholder="e.g. Fitness, Side project"
                value={areaTitle}
                onChange={(e) => setAreaTitle(e.target.value)}
              />
              <button
                className="rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
                type="button"
                disabled={busy}
                onClick={() =>
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
              >
                Add
              </button>
            </div>
            {pillars.length === 0 ? (
              <p className="text-sm text-[#6c7771]">No areas yet — add one above.</p>
            ) : (
              pillars.map((pillar) => {
                const pillarProjects = projects.filter(
                  (project) => project.parentId === pillar.id,
                );
                return (
                  <div
                    key={pillar.id}
                    className="border-t border-[#dde2dd] pt-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{pillar.title}</p>
                      <button
                        type="button"
                        className="text-xs font-bold text-[#c9634f]"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await updateLifeItem(pillar.id, { status: "ARCHIVED" });
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-sm text-[#6c7771]">
                      {pillarProjects.length} project
                      {pillarProjects.length === 1 ? "" : "s"}
                    </p>
                  </div>
                );
              })
            )}
          </article>
          ) : null}

          {planSegment === "projects" ? (
          <>
          <PriorityMatrixPanel
            actions={openActions}
            projects={projects}
            busy={busy}
            onMove={(action, quadrant) =>
              void run(async () => {
                const { important, urgent } = flagsFromQuadrant(quadrant);
                await updateLifeItem(action.id, {
                  body: actionBodyWithFlags(action.body, important, urgent),
                });
              })
            }
          />

          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
            <h2 className="font-serif text-2xl">New project</h2>
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="Project title"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="Outcome"
              value={projectOutcome}
              onChange={(e) => setProjectOutcome(e.target.value)}
            />
            <select
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              value={projectPillarId}
              onChange={(e) => setProjectPillarId(e.target.value)}
            >
              <option value="">Select life area</option>
              {pillars.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.title}
                </option>
              ))}
            </select>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                Project priority
              </span>
              <select
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={projectPriority}
                onChange={(e) =>
                  setProjectPriority(e.target.value as ProjectPriority)
                }
              >
                {PROJECT_PRIORITIES.map((id) => (
                  <option key={id} value={id}>
                    {PROJECT_PRIORITY_META[id].title}
                  </option>
                ))}
              </select>
              <span className="block text-sm text-[#6c7771]">
                High / Medium / Low only. Eisenhower is on the first action.
              </span>
            </label>
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="First next action"
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
            />
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                Hours for first action
              </span>
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                placeholder="Hours"
                value={actionHours}
                onChange={(e) => setActionHours(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                  Important
                </span>
                <select
                  className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                  value={actionImportantFlag ? "yes" : "no"}
                  onChange={(e) =>
                    setActionImportantFlag(e.target.value === "yes")
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                  Urgent
                </span>
                <select
                  className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                  value={actionUrgentFlag ? "yes" : "no"}
                  onChange={(e) => setActionUrgentFlag(e.target.value === "yes")}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>
            <p className="text-sm text-[#6c7771]">
              Matrix:{" "}
              {
                PRIORITY_QUADRANT_META[
                  actionPriorityQuadrant({
                    important: actionImportantFlag,
                    urgent: actionUrgentFlag,
                  })
                ].title
              }
            </p>
            <button
              className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (!projectTitle.trim() || !actionTitle.trim()) {
                    throw new Error("Project and next action are required.");
                  }
                  const hours = Number(actionHours);
                  if (!Number.isFinite(hours) || hours <= 0) {
                    throw new Error("Hours must be a positive number.");
                  }
                  const project = await createLifeItem({
                    kind: "PROJECT",
                    title: projectTitle.trim(),
                    parentId: projectPillarId || null,
                    body: projectBodyWithPriority(
                      { outcome: projectOutcome.trim() },
                      projectPriority,
                    ),
                  });
                  await createLifeItem({
                    kind: "ACTION",
                    title: actionTitle.trim(),
                    parentId: project.id,
                    body: actionBodyWithFlags(
                      { hours, day: "Fri" },
                      actionImportantFlag,
                      actionUrgentFlag,
                    ),
                  });
                  setProjectTitle("");
                  setProjectOutcome("");
                  setProjectPriority("MEDIUM");
                  setActionTitle("");
                  setActionImportantFlag(true);
                  setActionUrgentFlag(false);
                })
              }
            >
              Save project
            </button>
          </article>
          {pillars.map((pillar) => {
            const pillarProjects = projects.filter((project) => project.parentId === pillar.id);
            return (
              <article key={pillar.id} className="rounded-2xl border border-[#dde2dd] bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">Area</p>
                <h3 className="font-serif text-xl">{pillar.title}</h3>
                {pillarProjects.length === 0 ? (
                  <p className="mt-2 text-sm text-[#6c7771]">No projects yet.</p>
                ) : (
                  pillarProjects.map((project) => {
                    const next = items.find(
                      (item) =>
                        item.kind === "ACTION" &&
                        item.parentId === project.id &&
                        open(item),
                    );
                    const level = projectPriorityLevel(project.body);
                    return (
                      <div key={project.id} className="mt-3 border-t border-[#dde2dd] pt-3">
                        <p className="font-semibold">{project.title}</p>
                        <p className="text-sm text-[#6c7771]">
                          {PROJECT_PRIORITY_META[level].title} priority
                        </p>
                        <p className="text-sm text-[#6c7771]">
                          Next: {next ? `${next.title} (${num(next, "hours", 1)}h)` : "None"}
                        </p>
                        <label className="mt-2 block text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                          Priority
                          <select
                            className="mt-1 w-full rounded-xl border border-[#dde2dd] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#14241f]"
                            value={level}
                            disabled={busy}
                            onChange={(e) =>
                              void run(async () => {
                                await updateLifeItem(project.id, {
                                  body: projectBodyWithPriority(
                                    project.body,
                                    e.target.value as ProjectPriority,
                                  ),
                                });
                              })
                            }
                          >
                            {PROJECT_PRIORITIES.map((id) => (
                              <option key={id} value={id}>
                                {PROJECT_PRIORITY_META[id].title}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    );
                  })
                )}
              </article>
            );
          })}
          </>
          ) : null}
        </section>
      ) : null}

      {tab === "you" && youDest === "menu" ? (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl text-[#14241f]">You</h2>
          <p className="text-sm text-[#6c7771]">Capacity and weekly review live here.</p>
          <button type="button" className="block w-full rounded-2xl border border-[#dde2dd] bg-white px-4 py-3 text-left" onClick={() => setYouDest("capacity")}>
            <div className="text-sm font-bold text-[#14241f]">Capacity</div>
            <div className="text-xs text-[#6c7771]">Weekly hours and load</div>
          </button>
          <button type="button" className="block w-full rounded-2xl border border-[#dde2dd] bg-white px-4 py-3 text-left" onClick={() => setYouDest("review")}>
            <div className="text-sm font-bold text-[#14241f]">Weekly Review</div>
            <div className="text-xs text-[#6c7771]">CEO-style check-in</div>
          </button>
          <button type="button" className="block w-full rounded-2xl border border-[#dde2dd] bg-white px-4 py-3 text-left" onClick={() => setSettingsOpen(true)}>
            <div className="text-sm font-bold text-[#14241f]">Settings</div>
            <div className="text-xs text-[#6c7771]">Account and currency</div>
          </button>
        </section>
      ) : null}

      {tab === "you" && youDest === "capacity" ? (
        <section className="space-y-4">
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
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
                        await updateLifeItem(action.id, { status: "DONE" });
                      })
                    }
                  >
                    Done
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
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
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
          </article>
        </section>
      ) : null}
    </main>
  );
}

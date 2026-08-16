"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createLifeItem,
  getAccount,
  listLifeItems,
  login,
  logout,
  pingApi,
  register,
  updateLifeItem,
  type Account,
  type LifeItem,
} from "../lib/api";
import { BudgetPanel } from "./budget-panel";
import { OnboardingPanel } from "./onboarding-panel";

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
    "command" | "ideas" | "portfolio" | "capacity" | "budget" | "review"
  >("command");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaNote, setIdeaNote] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectOutcome, setProjectOutcome] = useState("");
  const [projectPillarId, setProjectPillarId] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [actionHours, setActionHours] = useState("2");
  const [areaTitle, setAreaTitle] = useState("");
  const [busy, setBusy] = useState(false);

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
  const primary = openActions[0] ?? null;
  const needsOnboarding = Boolean(account && !account.user.onboardingCompletedAt);

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
        <div className="flex gap-2">
          <button
            className={`rounded-full px-3 py-1 text-xs font-bold ${authMode === "login" ? "bg-[#14241f] text-white" : "bg-[#dbe8d7]"}`}
            onClick={() => setAuthMode("login")}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`rounded-full px-3 py-1 text-xs font-bold ${authMode === "register" ? "bg-[#14241f] text-white" : "bg-[#dbe8d7]"}`}
            onClick={() => setAuthMode("register")}
            type="button"
          >
            Create account
          </button>
        </div>
        {authMode === "register" ? (
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        ) : null}
        <input
          className="rounded-xl border border-[#dde2dd] px-3 py-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded-xl border border-[#dde2dd] px-3 py-3"
          placeholder="Password (10+ chars)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-[#c9634f]">{error}</p> : null}
        <button
          className="rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
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
            {account.user.displayName} · {online ? "Online" : "Offline"}
          </p>
        </div>
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
      </header>

      <nav className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["command", "Command"],
            ["ideas", "Ideas"],
            ["portfolio", "Areas"],
            ["capacity", "Capacity"],
            ["budget", "Budget"],
            ["review", "Review"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${tab === id ? "bg-[#14241f] text-[#d6f57a]" : "bg-white border border-[#dde2dd]"}`}
            type="button"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? (
        <p className="mb-4 rounded-xl bg-[#f8e4df] px-3 py-2 text-sm text-[#c9634f]">
          {error}
        </p>
      ) : null}

      {tab === "command" ? (
        <section className="space-y-4">
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">Primary move</p>
            {primary ? (
              <>
                <h2 className="mt-2 font-serif text-2xl">{primary.title}</h2>
                <p className="text-sm text-[#6c7771]">
                  {num(primary, "hours", 1)}h
                  {str(primary, "day") ? ` · ${str(primary, "day")}` : ""}
                </p>
                <button
                  className="mt-4 rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-white"
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

      {tab === "ideas" ? (
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
              className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
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
                  setActionTitle(`Advance: ${idea.title}`);
                  setTab("portfolio");
                }}
              >
                Convert to project
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "portfolio" ? (
        <section className="space-y-4">
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
            <h2 className="font-serif text-2xl">Life areas</h2>
            <p className="text-sm text-[#6c7771]">
              Add or remove the areas you want Life OS to track.
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-[#dde2dd] px-3 py-3"
                placeholder="e.g. Fitness, Side project"
                value={areaTitle}
                onChange={(e) => setAreaTitle(e.target.value)}
              />
              <button
                className="rounded-xl bg-[#14241f] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
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
              pillars.map((pillar) => (
                <div
                  key={pillar.id}
                  className="flex items-center justify-between border-t border-[#dde2dd] pt-3"
                >
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
              ))
            )}
          </article>

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
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="First next action"
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="Hours"
              value={actionHours}
              onChange={(e) => setActionHours(e.target.value)}
            />
            <button
              className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
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
                    body: { outcome: projectOutcome.trim() },
                  });
                  await createLifeItem({
                    kind: "ACTION",
                    title: actionTitle.trim(),
                    parentId: project.id,
                    body: { hours, day: "Fri" },
                  });
                  setProjectTitle("");
                  setProjectOutcome("");
                  setActionTitle("");
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
                    return (
                      <div key={project.id} className="mt-3 border-t border-[#dde2dd] pt-3">
                        <p className="font-semibold">{project.title}</p>
                        <p className="text-sm text-[#6c7771]">
                          Next: {next ? `${next.title} (${num(next, "hours", 1)}h)` : "None"}
                        </p>
                      </div>
                    );
                  })
                )}
              </article>
            );
          })}
        </section>
      ) : null}

      {tab === "capacity" ? (
        <section className="space-y-4">
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <h2 className="font-serif text-2xl">
              {planned.toFixed(1)}h planned / {available}h available
            </h2>
            {planned > available ? (
              <p className="mt-2 text-sm text-[#c9634f]">Overcommitted — reduce hours below.</p>
            ) : (
              <p className="mt-2 text-sm text-[#6c7771]">Healthy load.</p>
            )}
          </article>
          {openActions.map((action) => (
            <article key={action.id} className="rounded-2xl border border-[#dde2dd] bg-white p-5">
              <p className="font-semibold">{action.title}</p>
              <p className="text-sm text-[#6c7771]">{num(action, "hours", 1)}h</p>
              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await updateLifeItem(action.id, {
                        body: { ...action.body, hours: Math.max(0.5, num(action, "hours", 1) - 1) },
                      });
                    })
                  }
                >
                  −1h
                </button>
                <button
                  className="rounded-xl bg-[#14241f] px-3 py-2 text-xs font-bold text-white"
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
          ))}
        </section>
      ) : null}

      {tab === "budget" ? (
        <BudgetPanel account={account} onError={setError} />
      ) : null}

      {tab === "review" ? (
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

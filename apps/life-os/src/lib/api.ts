export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "https://lifeos.orija.store/api";

const sessionKey = "life-os-web-session";

export type AccountUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  activeHouseholdId: string | null;
  onboardingCompletedAt: string | null;
};

export type Account = {
  user: AccountUser;
  activeHouseholdId: string | null;
  households: { id: string; name: string; role: "OWNER" | "PARTNER"; active: boolean }[];
  members: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    role: "OWNER" | "PARTNER";
  }[];
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type ItemKind =
  | "VISION"
  | "PILLAR"
  | "GOAL"
  | "PROJECT"
  | "ACTION"
  | "IDEA"
  | "DECISION";

export type LifeItem = {
  id: string;
  ownerUserId: string;
  householdId: string | null;
  parentId: string | null;
  kind: ItemKind;
  visibility: "PRIVATE" | "SHARED";
  title: string;
  status: string;
  body: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function mapItem(raw: Record<string, unknown>): LifeItem {
  return {
    id: String(raw.id),
    ownerUserId: String(raw.ownerUserId ?? raw.owner_user_id),
    householdId: (raw.householdId ?? raw.household_id ?? null) as string | null,
    parentId: (raw.parentId ?? raw.parent_id ?? null) as string | null,
    kind: raw.kind as ItemKind,
    visibility: raw.visibility as "PRIVATE" | "SHARED",
    title: String(raw.title),
    status: String(raw.status),
    body: (raw.body as Record<string, unknown>) ?? {},
    sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 0),
    createdAt: String(raw.createdAt ?? raw.created_at),
    updatedAt: String(raw.updatedAt ?? raw.updated_at),
  };
}

function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(sessionKey);
  return raw ? (JSON.parse(raw) as Session) : null;
}

function saveSession(session: Session | null) {
  if (typeof window === "undefined") return;
  if (session) window.localStorage.setItem(sessionKey, JSON.stringify(session));
  else window.localStorage.removeItem(sessionKey);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = (await response.json()) as {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error ?? "request_failed",
      payload.message ?? "Request failed",
    );
  }
  return payload as T;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const session = loadSession();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401 && session && retry) {
    const refreshed = await fetch(`${apiBaseUrl}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken, deviceName: "web" }),
    });
    if (!refreshed.ok) {
      saveSession(null);
      throw new ApiError(401, "session_expired", "Please sign in again.");
    }
    const next = await parseResponse<Session>(refreshed);
    saveSession(next);
    return request<T>(path, options, false);
  }
  return parseResponse<T>(response);
}

export async function pingApi() {
  try {
    const response = await fetch(`${apiBaseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function register(input: {
  displayName: string;
  email: string;
  password: string;
}): Promise<Account> {
  const auth = await parseResponse<Session & { account: Account }>(
    await fetch(`${apiBaseUrl}/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", deviceName: "web" }),
    }),
  );
  saveSession(auth);
  return auth.account;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<Account> {
  const auth = await parseResponse<Session & { account: Account }>(
    await fetch(`${apiBaseUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, deviceName: "web" }),
    }),
  );
  saveSession(auth);
  return auth.account;
}

export async function logout() {
  const session = loadSession();
  if (session) {
    try {
      await fetch(`${apiBaseUrl}/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } finally {
      saveSession(null);
    }
  }
}

export async function getAccount(): Promise<Account | null> {
  if (!loadSession()) return null;
  return request<Account>("/v1/me");
}

export async function listLifeItems(): Promise<LifeItem[]> {
  const rows = await request<Record<string, unknown>[]>("/v1/items");
  return rows.map(mapItem);
}

export async function createLifeItem(input: {
  kind: ItemKind;
  title: string;
  parentId?: string | null;
  status?: string;
  body?: Record<string, unknown>;
  sortOrder?: number;
}): Promise<LifeItem> {
  const raw = await request<Record<string, unknown>>("/v1/items", {
    method: "POST",
    body: JSON.stringify({
      visibility: "PRIVATE",
      status: "ACTIVE",
      body: {},
      sortOrder: 0,
      ...input,
    }),
  });
  return mapItem(raw);
}

export async function updateLifeItem(
  id: string,
  input: {
    title?: string;
    status?: string;
    parentId?: string | null;
    body?: Record<string, unknown>;
  },
): Promise<LifeItem> {
  const raw = await request<Record<string, unknown>>(`/v1/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return mapItem(raw);
}

export type AreaSuggestion = { title: string; icon: string };

export const SUGGESTED_LIFE_AREAS: AreaSuggestion[] = [
  { title: "Health", icon: "fitness-outline" },
  { title: "Career", icon: "trending-up-outline" },
  { title: "Wealth", icon: "wallet-outline" },
  { title: "Relationships", icon: "heart-outline" },
  { title: "Family", icon: "home-outline" },
  { title: "Personal growth", icon: "sparkles-outline" },
  { title: "Creative", icon: "color-palette-outline" },
  { title: "Product", icon: "layers-outline" },
  { title: "Business", icon: "briefcase-outline" },
  { title: "Faith", icon: "leaf-outline" },
  { title: "Community", icon: "people-outline" },
  { title: "Adventure", icon: "airplane-outline" },
];

export async function listAreaSuggestions(): Promise<AreaSuggestion[]> {
  const payload = await request<{ suggestions: AreaSuggestion[] }>(
    "/v1/areas/suggestions",
  );
  return payload.suggestions;
}

export async function completeOnboarding(
  areas: { title: string; icon?: string }[],
): Promise<Account> {
  return request<Account>("/v1/onboarding/complete", {
    method: "POST",
    body: JSON.stringify({ areas }),
  });
}

export type BudgetSummary = {
  incomeCents: number;
  expenseCents: number;
  plannedCents: number;
  balanceCents: number;
};

export type BudgetCategory = {
  id: string;
  budgetId: string;
  name: string;
  plannedCents: number;
  sortOrder: number;
  spentCents?: number;
};

export type BudgetEntry = {
  id: string;
  budgetId: string;
  categoryId: string | null;
  createdBy: string;
  kind: "INCOME" | "EXPENSE";
  amountCents: number;
  note: string;
  occurredOn: string;
};

export type Budget = {
  id: string;
  ownerUserId: string;
  householdId: string | null;
  visibility: "PRIVATE" | "SHARED";
  name: string;
  currency: string;
  period: "weekly" | "monthly";
  payFrequency?: "weekly" | "biweekly" | "four_weekly" | "monthly" | null;
  nextPayDate?: string | null;
  typicalPayCents?: number | null;
  categories?: BudgetCategory[];
  entries?: BudgetEntry[];
  recurring?: RecurringOutgoing[];
  summary?: BudgetSummary;
};

export type RecurringOutgoing = {
  id: string;
  budgetId: string;
  categoryId: string | null;
  name: string;
  amountCents: number;
  cadence: "weekly" | "monthly" | "yearly";
  dayOfMonth: number | null;
  weekday: number | null;
  active: boolean;
};

export type BudgetRecommendation = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  action: string;
};

export type OutgoingItem = {
  id: string;
  source: "entry" | "recurring";
  kind: "INCOME" | "EXPENSE";
  date: string;
  amountCents: number;
  title: string;
  note: string;
  categoryId: string | null;
  categoryName: string | null;
  recurringId: string | null;
};

export type MonthOutgoings = {
  budgetId: string;
  year: number;
  month: number;
  currency: string;
  paySchedule: {
    frequency: "weekly" | "biweekly" | "four_weekly" | "monthly" | null;
    nextPayDate: string | null;
    typicalPayCents: number | null;
    payDates: string[];
  };
  days: {
    date: string;
    isPayDay: boolean;
    totalCents: number;
    incomeCents: number;
    items: OutgoingItem[];
  }[];
  list: OutgoingItem[];
  totals: {
    expenseCents: number;
    incomeCents: number;
    recurringCents: number;
    oneOffCents: number;
  };
  recommendations: BudgetRecommendation[];
};

function mapBudget(raw: Record<string, unknown>): Budget {
  return {
    id: String(raw.id),
    ownerUserId: String(raw.ownerUserId ?? raw.owner_user_id),
    householdId: (raw.householdId ?? raw.household_id ?? null) as string | null,
    visibility: raw.visibility as "PRIVATE" | "SHARED",
    name: String(raw.name),
    currency: String(raw.currency ?? "GBP"),
    period: (raw.period as "weekly" | "monthly") ?? "monthly",
    payFrequency: (raw.payFrequency ?? raw.pay_frequency ?? null) as Budget["payFrequency"],
    nextPayDate: (raw.nextPayDate ?? raw.next_pay_date ?? null) as string | null,
    typicalPayCents:
      raw.typicalPayCents != null || raw.typical_pay_cents != null
        ? Number(raw.typicalPayCents ?? raw.typical_pay_cents)
        : null,
    categories: Array.isArray(raw.categories)
      ? (raw.categories as Record<string, unknown>[]).map((category) => ({
          id: String(category.id),
          budgetId: String(category.budgetId ?? category.budget_id ?? raw.id),
          name: String(category.name),
          plannedCents: Number(category.plannedCents ?? category.planned_cents ?? 0),
          sortOrder: Number(category.sortOrder ?? category.sort_order ?? 0),
          spentCents: Number(category.spentCents ?? category.spent_cents ?? 0),
        }))
      : undefined,
    entries: Array.isArray(raw.entries)
      ? (raw.entries as Record<string, unknown>[]).map((entry) => ({
          id: String(entry.id),
          budgetId: String(entry.budgetId ?? entry.budget_id ?? raw.id),
          categoryId: (entry.categoryId ?? entry.category_id ?? null) as
            | string
            | null,
          createdBy: String(entry.createdBy ?? entry.created_by),
          kind: entry.kind as "INCOME" | "EXPENSE",
          amountCents: Number(entry.amountCents ?? entry.amount_cents),
          note: String(entry.note ?? ""),
          occurredOn: String(entry.occurredOn ?? entry.occurred_on),
        }))
      : undefined,
    recurring: Array.isArray(raw.recurring)
      ? (raw.recurring as Record<string, unknown>[]).map(mapRecurring)
      : undefined,
    summary: raw.summary
      ? {
          incomeCents: Number((raw.summary as BudgetSummary).incomeCents),
          expenseCents: Number((raw.summary as BudgetSummary).expenseCents),
          plannedCents: Number((raw.summary as BudgetSummary).plannedCents),
          balanceCents: Number((raw.summary as BudgetSummary).balanceCents),
        }
      : undefined,
  };
}

function mapRecurring(raw: Record<string, unknown>): RecurringOutgoing {
  return {
    id: String(raw.id),
    budgetId: String(raw.budgetId ?? raw.budget_id),
    categoryId: (raw.categoryId ?? raw.category_id ?? null) as string | null,
    name: String(raw.name),
    amountCents: Number(raw.amountCents ?? raw.amount_cents),
    cadence: raw.cadence as RecurringOutgoing["cadence"],
    dayOfMonth:
      raw.dayOfMonth != null || raw.day_of_month != null
        ? Number(raw.dayOfMonth ?? raw.day_of_month)
        : null,
    weekday:
      raw.weekday != null ? Number(raw.weekday) : null,
    active: Boolean(raw.active ?? true),
  };
}

export async function listBudgets(): Promise<Budget[]> {
  const rows = await request<Record<string, unknown>[]>("/v1/budgets");
  return rows.map(mapBudget);
}

export async function getBudget(id: string): Promise<Budget> {
  const raw = await request<Record<string, unknown>>(`/v1/budgets/${id}`);
  return mapBudget(raw);
}

export async function createBudget(input: {
  name: string;
  visibility?: "PRIVATE" | "SHARED";
  currency?: string;
  period?: "weekly" | "monthly";
}): Promise<Budget> {
  const raw = await request<Record<string, unknown>>("/v1/budgets", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      visibility: input.visibility ?? "PRIVATE",
      currency: input.currency ?? "GBP",
      period: input.period ?? "monthly",
      seedCategories: true,
    }),
  });
  return mapBudget(raw);
}

export async function updateBudgetCategory(
  budgetId: string,
  categoryId: string,
  input: { name?: string; plannedCents?: number },
): Promise<void> {
  await request(`/v1/budgets/${budgetId}/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function addBudgetEntry(
  budgetId: string,
  input: {
    kind: "INCOME" | "EXPENSE";
    amountCents: number;
    categoryId?: string | null;
    note?: string;
  },
): Promise<void> {
  await request(`/v1/budgets/${budgetId}/entries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function formatMoney(cents: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export async function updateBudget(
  id: string,
  input: {
    name?: string;
    payFrequency?: "weekly" | "biweekly" | "four_weekly" | "monthly" | null;
    nextPayDate?: string | null;
    typicalPayCents?: number | null;
  },
): Promise<Budget> {
  const raw = await request<Record<string, unknown>>(`/v1/budgets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return mapBudget(raw);
}

export async function createRecurringOutgoing(
  budgetId: string,
  input: {
    name: string;
    amountCents: number;
    cadence: "weekly" | "monthly" | "yearly";
    dayOfMonth?: number | null;
    weekday?: number | null;
    categoryId?: string | null;
  },
): Promise<RecurringOutgoing> {
  const raw = await request<Record<string, unknown>>(
    `/v1/budgets/${budgetId}/recurring`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return mapRecurring(raw);
}

export async function getMonthOutgoings(
  budgetId: string,
  year: number,
  month: number,
): Promise<MonthOutgoings> {
  return request<MonthOutgoings>(
    `/v1/budgets/${budgetId}/outgoings?year=${year}&month=${month}`,
  );
}

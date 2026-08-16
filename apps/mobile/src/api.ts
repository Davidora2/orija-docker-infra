import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const sessionKey = 'life-os-api-session';
const requestTimeoutMs = 15_000;

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    android: 'http://10.0.2.2:4000',
    default: 'http://localhost:4000',
  })!;

export type AccountUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  preferredCurrency: string;
  activeHouseholdId: string | null;
  onboardingCompletedAt: string | null;
};

export type Household = {
  id: string;
  name: string;
  role: 'OWNER' | 'PARTNER';
  active: boolean;
};

export type HouseholdMember = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'OWNER' | 'PARTNER';
};

export type Account = {
  user: AccountUser;
  activeHouseholdId: string | null;
  households: Household[];
  members: HouseholdMember[];
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type ItemKind =
  | 'VISION'
  | 'PILLAR'
  | 'GOAL'
  | 'PROJECT'
  | 'ACTION'
  | 'IDEA'
  | 'DECISION';

export type ItemVisibility = 'PRIVATE' | 'SHARED';

export type LifeItem = {
  id: string;
  ownerUserId: string;
  householdId: string | null;
  parentId: string | null;
  kind: ItemKind;
  visibility: ItemVisibility;
  title: string;
  status: string;
  body: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type AuthResponse = Session & {
  account: Account;
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

let memorySession: Session | null = null;
let refreshPromise: Promise<Session> | null = null;

function mapItem(raw: Record<string, unknown>): LifeItem {
  return {
    id: String(raw.id),
    ownerUserId: String(raw.owner_user_id ?? raw.ownerUserId),
    householdId: (raw.household_id ?? raw.householdId ?? null) as string | null,
    parentId: (raw.parent_id ?? raw.parentId ?? null) as string | null,
    kind: raw.kind as ItemKind,
    visibility: raw.visibility as ItemVisibility,
    title: String(raw.title),
    status: String(raw.status),
    body: (raw.body as Record<string, unknown>) ?? {},
    sortOrder: Number(raw.sort_order ?? raw.sortOrder ?? 0),
    createdAt: String(raw.created_at ?? raw.createdAt),
    updatedAt: String(raw.updated_at ?? raw.updatedAt),
  };
}

export async function loadSession(): Promise<Session | null> {
  if (memorySession) return memorySession;
  const stored = await AsyncStorage.getItem(sessionKey);
  if (!stored) return null;
  memorySession = JSON.parse(stored) as Session;
  return memorySession;
}

async function saveSession(session: Session | null): Promise<void> {
  memorySession = session;
  if (session) {
    await AsyncStorage.setItem(sessionKey, JSON.stringify(session));
  } else {
    await AsyncStorage.removeItem(sessionKey);
  }
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
      payload.error ?? 'request_failed',
      payload.message ?? 'The request could not be completed.',
    );
  }
  return payload as T;
}

async function fetchWithTimeout(
  input: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, requestTimeoutMs);
  options.signal?.addEventListener('abort', abort, { once: true });

  try {
    return await fetch(input, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new ApiError(
        408,
        'request_timeout',
        'The Life OS server took too long to respond. Try again.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

async function refreshSession(session: Session): Promise<Session> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: session.refreshToken,
          deviceName: `${Platform.OS} Life OS`,
        }),
      });
      const refreshed = await parseResponse<Session>(response);
      await saveSession(refreshed);
      return refreshed;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const session = await loadSession();
  const response = await fetchWithTimeout(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401 && session && retry) {
    try {
      await refreshSession(session);
      return request<T>(path, options, false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const currentSession = await loadSession();
        if (currentSession?.refreshToken === session.refreshToken) {
          await saveSession(null);
        }
      }
      throw error;
    }
  }
  return parseResponse<T>(response);
}

export async function register(input: {
  displayName: string;
  email: string;
  password: string;
  timezone: string;
}): Promise<Account> {
  const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      deviceName: `${Platform.OS} Life OS`,
    }),
  });
  const auth = await parseResponse<AuthResponse>(response);
  await saveSession(auth);
  return auth.account;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<Account> {
  const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      deviceName: `${Platform.OS} Life OS`,
    }),
  });
  const auth = await parseResponse<AuthResponse>(response);
  await saveSession(auth);
  return auth.account;
}

export type AuthProviders = {
  google: boolean;
  password: boolean;
  emailDelivery: 'smtp' | 'resend' | 'console' | 'unavailable';
};

export async function getAuthProviders(): Promise<AuthProviders> {
  const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/providers`);
  return parseResponse<AuthProviders>(response);
}

export async function loginWithGoogle(idToken: string): Promise<Account> {
  const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken,
      deviceName: `${Platform.OS} Life OS`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }),
  });
  const auth = await parseResponse<AuthResponse>(response);
  await saveSession(auth);
  return auth.account;
}

export async function forgotPassword(email: string): Promise<{
  ok: boolean;
  message: string;
  delivery?: string;
}> {
  const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseResponse(response);
}

export async function verifyResetCode(
  email: string,
  code: string,
): Promise<{ ok: boolean; message: string }> {
  const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/verify-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  return parseResponse(response);
}

export async function resetPassword(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<Account> {
  const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      deviceName: `${Platform.OS} Life OS`,
    }),
  });
  const auth = await parseResponse<AuthResponse>(response);
  await saveSession(auth);
  return auth.account;
}

export type CalendarEvent = {
  id: string;
  type: 'task' | 'payment' | 'payday';
  date: string;
  title: string;
  amountCents: number | null;
  areaId: string | null;
  areaTitle: string | null;
  status: string | null;
  source: string;
  meta: Record<string, unknown>;
};

export type CalendarPayload = {
  view: 'week' | 'month';
  rangeStart: string;
  rangeEnd: string;
  year: number;
  month: number;
  areas: { id: string; title: string }[];
  filters: { areaIds: string[]; types: string[] };
  days: { date: string; weekday: string; events: CalendarEvent[] }[];
  events: CalendarEvent[];
  counts: { tasks: number; payments: number; paydays: number };
};

export async function getCalendar(input: {
  view: 'week' | 'month';
  year?: number;
  month?: number;
  start?: string;
  areaIds?: string[];
  types?: string[];
}): Promise<CalendarPayload> {
  const params = new URLSearchParams({ view: input.view });
  if (input.year) params.set('year', String(input.year));
  if (input.month) params.set('month', String(input.month));
  if (input.start) params.set('start', input.start);
  if (input.areaIds?.length) params.set('areaIds', input.areaIds.join(','));
  if (input.types?.length) params.set('types', input.types.join(','));
  return request<CalendarPayload>(`/v1/calendar?${params.toString()}`);
}

export async function logout(): Promise<void> {
  const session = await loadSession();
  if (session) {
    try {
      await fetchWithTimeout(`${apiBaseUrl}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } finally {
      await saveSession(null);
    }
  }
}

export async function getAccount(): Promise<Account | null> {
  const session = await loadSession();
  if (!session) return null;
  return request<Account>('/v1/me');
}

export async function updateProfile(input: {
  displayName?: string;
  timezone?: string;
  preferredCurrency?: string;
  avatarUrl?: string | null;
}): Promise<Account> {
  return request<Account>('/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function createPartnerInvite(
  invitedEmail?: string,
): Promise<{ token: string; deepLink: string; webUrl: string; expiresAt: string }> {
  return request('/v1/households/invites', {
    method: 'POST',
    body: JSON.stringify({ invitedEmail: invitedEmail || undefined }),
  });
}

export async function acceptPartnerInvite(token: string): Promise<Account> {
  return request<Account>('/v1/households/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function setActiveHousehold(householdId: string): Promise<Account> {
  return request<Account>('/v1/households/active', {
    method: 'PATCH',
    body: JSON.stringify({ householdId }),
  });
}

export async function listLifeItems(kind?: ItemKind): Promise<LifeItem[]> {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const rows = await request<Record<string, unknown>[]>(`/v1/items${query}`);
  return rows.map(mapItem);
}

export async function createLifeItem(input: {
  kind: ItemKind;
  title: string;
  visibility?: ItemVisibility;
  status?: string;
  parentId?: string | null;
  body?: Record<string, unknown>;
  sortOrder?: number;
}): Promise<LifeItem> {
  const raw = await request<Record<string, unknown>>('/v1/items', {
    method: 'POST',
    body: JSON.stringify({
      kind: input.kind,
      title: input.title,
      visibility: input.visibility ?? 'PRIVATE',
      status: input.status ?? 'ACTIVE',
      parentId: input.parentId ?? null,
      body: input.body ?? {},
      sortOrder: input.sortOrder ?? 0,
    }),
  });
  return mapItem(raw);
}

export async function updateLifeItem(
  id: string,
  input: {
    title?: string;
    status?: string;
    visibility?: ItemVisibility;
    parentId?: string | null;
    body?: Record<string, unknown>;
    sortOrder?: number;
  },
): Promise<LifeItem> {
  const raw = await request<Record<string, unknown>>(`/v1/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return mapItem(raw);
}

export async function deleteLifeItem(id: string): Promise<void> {
  await request<void>(`/v1/items/${id}`, { method: 'DELETE' });
}

export async function pingApi(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${apiBaseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export type AreaSuggestion = { title: string; icon: string };

export async function listAreaSuggestions(): Promise<AreaSuggestion[]> {
  const payload = await request<{ suggestions: AreaSuggestion[] }>(
    '/v1/areas/suggestions',
  );
  return payload.suggestions;
}

export async function completeOnboarding(
  areas: { title: string; icon?: string }[],
  preferredCurrency?: string,
): Promise<Account> {
  return request<Account>('/v1/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({ areas, preferredCurrency }),
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
  kind: 'INCOME' | 'EXPENSE';
  amountCents: number;
  note: string;
  occurredOn: string;
};

export type Budget = {
  id: string;
  ownerUserId: string;
  householdId: string | null;
  visibility: ItemVisibility;
  name: string;
  currency: string;
  period: 'weekly' | 'monthly';
  payFrequency?: 'weekly' | 'biweekly' | 'four_weekly' | 'monthly' | null;
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
  cadence: 'weekly' | 'monthly' | 'yearly';
  dayOfMonth: number | null;
  weekday: number | null;
  active: boolean;
};

export type BudgetRecommendation = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
  flagged?: boolean;
  scenario?: string;
};

export type OutgoingItem = {
  id: string;
  source: 'entry' | 'recurring';
  kind: 'INCOME' | 'EXPENSE';
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
    frequency: 'weekly' | 'biweekly' | 'four_weekly' | 'monthly' | null;
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
  flags?: BudgetRecommendation[];
};

function mapBudget(raw: Record<string, unknown>): Budget {
  return {
    id: String(raw.id),
    ownerUserId: String(raw.ownerUserId ?? raw.owner_user_id),
    householdId: (raw.householdId ?? raw.household_id ?? null) as string | null,
    visibility: raw.visibility as ItemVisibility,
    name: String(raw.name),
    currency: String(raw.currency ?? 'GBP'),
    period: (raw.period as 'weekly' | 'monthly') ?? 'monthly',
    payFrequency: (raw.payFrequency ?? raw.pay_frequency ?? null) as Budget['payFrequency'],
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
          categoryId: (entry.categoryId ?? entry.category_id ?? null) as string | null,
          createdBy: String(entry.createdBy ?? entry.created_by),
          kind: entry.kind as 'INCOME' | 'EXPENSE',
          amountCents: Number(entry.amountCents ?? entry.amount_cents),
          note: String(entry.note ?? ''),
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
    cadence: raw.cadence as RecurringOutgoing['cadence'],
    dayOfMonth:
      raw.dayOfMonth != null || raw.day_of_month != null
        ? Number(raw.dayOfMonth ?? raw.day_of_month)
        : null,
    weekday: raw.weekday != null ? Number(raw.weekday) : null,
    active: Boolean(raw.active ?? true),
  };
}

export async function listBudgets(): Promise<Budget[]> {
  const rows = await request<Record<string, unknown>[]>('/v1/budgets');
  return rows.map(mapBudget);
}

export async function getBudget(id: string): Promise<Budget> {
  const raw = await request<Record<string, unknown>>(`/v1/budgets/${id}`);
  return mapBudget(raw);
}

export async function createBudget(input: {
  name: string;
  visibility?: ItemVisibility;
  currency?: string;
  period?: 'weekly' | 'monthly';
}): Promise<Budget> {
  const raw = await request<Record<string, unknown>>('/v1/budgets', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      visibility: input.visibility ?? 'PRIVATE',
      currency: input.currency,
      period: input.period ?? 'monthly',
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
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function addBudgetEntry(
  budgetId: string,
  input: {
    kind: 'INCOME' | 'EXPENSE';
    amountCents: number;
    categoryId?: string | null;
    note?: string;
  },
): Promise<void> {
  await request(`/v1/budgets/${budgetId}/entries`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteBudget(id: string): Promise<void> {
  await request<void>(`/v1/budgets/${id}`, { method: 'DELETE' });
}

export function formatMoney(cents: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function currencySymbol(currency = 'GBP'): string {
  try {
    const parts = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

export async function updateBudget(
  id: string,
  input: {
    name?: string;
    payFrequency?: 'weekly' | 'biweekly' | 'four_weekly' | 'monthly' | null;
    nextPayDate?: string | null;
    typicalPayCents?: number | null;
  },
): Promise<Budget> {
  const raw = await request<Record<string, unknown>>(`/v1/budgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return mapBudget(raw);
}

export async function createRecurringOutgoing(
  budgetId: string,
  input: {
    name: string;
    amountCents: number;
    cadence: 'weekly' | 'monthly' | 'yearly';
    dayOfMonth?: number | null;
    weekday?: number | null;
    categoryId?: string | null;
  },
): Promise<RecurringOutgoing> {
  const raw = await request<Record<string, unknown>>(
    `/v1/budgets/${budgetId}/recurring`,
    {
      method: 'POST',
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

export type SavingGoal = {
  id: string;
  ownerUserId: string;
  householdId: string | null;
  visibility: "PRIVATE" | "SHARED";
  category: "emergency" | "six_month_salary" | "holiday" | "house_deposit" | "custom";
  customLabel: string | null;
  name: string;
  targetCents: number;
  currentCents: number;
};

export type InvestmentAccount = {
  id: string;
  ownerUserId: string;
  householdId: string | null;
  visibility: "PRIVATE" | "SHARED";
  accountType: "fhsa" | "tfsa" | "rrsp" | "isa" | "stocks" | "crypto" | "pension" | "other";
  customLabel: string | null;
  name: string;
  goalCents: number;
  currentCents: number;
};

export type NetWorth = {
  currency: string;
  personal: {
    savingsCents: number;
    investmentsCents: number;
    budgetBalanceCents: number;
    netWorthCents: number;
  };
  household: {
    savingsCents: number;
    investmentsCents: number;
    netWorthCents: number;
    householdId: string | null;
  };
  totalVisibleCents: number;
};

export type DraftExpense = {
  id: string;
  budgetId: string;
  name: string;
  amountCents: number;
  categoryId: string | null;
  dayOfMonth: number | null;
  note: string;
  active: boolean;
};

export type DraftImpact = {
  budgetId: string;
  currency: string;
  drafts: DraftExpense[];
  impact: {
    typicalPayCents: number;
    monthIncomeCents: number;
    monthExpenseCents: number;
    recurringMonthlyCents: number;
    draftCents: number;
    remainingWithoutDraftsCents: number;
    remainingWithDraftsCents: number;
    wouldOverspend: boolean;
    overspendCents: number;
  };
};

function mapSaving(raw: Record<string, unknown>): SavingGoal {
  return {
    id: String(raw.id),
    ownerUserId: String(raw.ownerUserId ?? raw.owner_user_id),
    householdId: (raw.householdId ?? raw.household_id ?? null) as string | null,
    visibility: raw.visibility as "PRIVATE" | "SHARED",
    category: raw.category as SavingGoal["category"],
    customLabel: (raw.customLabel ?? raw.custom_label ?? null) as string | null,
    name: String(raw.name),
    targetCents: Number(raw.targetCents ?? raw.target_cents ?? 0),
    currentCents: Number(raw.currentCents ?? raw.current_cents ?? 0),
  };
}

function mapInvestment(raw: Record<string, unknown>): InvestmentAccount {
  return {
    id: String(raw.id),
    ownerUserId: String(raw.ownerUserId ?? raw.owner_user_id),
    householdId: (raw.householdId ?? raw.household_id ?? null) as string | null,
    visibility: raw.visibility as "PRIVATE" | "SHARED",
    accountType: (raw.accountType ?? raw.account_type) as InvestmentAccount["accountType"],
    customLabel: (raw.customLabel ?? raw.custom_label ?? null) as string | null,
    name: String(raw.name),
    goalCents: Number(raw.goalCents ?? raw.goal_cents ?? 0),
    currentCents: Number(raw.currentCents ?? raw.current_cents ?? 0),
  };
}

function mapDraft(raw: Record<string, unknown>): DraftExpense {
  return {
    id: String(raw.id),
    budgetId: String(raw.budgetId ?? raw.budget_id),
    name: String(raw.name),
    amountCents: Number(raw.amountCents ?? raw.amount_cents),
    categoryId: (raw.categoryId ?? raw.category_id ?? null) as string | null,
    dayOfMonth:
      raw.dayOfMonth != null || raw.day_of_month != null
        ? Number(raw.dayOfMonth ?? raw.day_of_month)
        : null,
    note: String(raw.note ?? ""),
    active: Boolean(raw.active ?? true),
  };
}

export async function getWealthMeta(): Promise<{
  savingCategories: { id: string; label: string }[];
  investmentTypes: { id: string; label: string }[];
  currencies: string[];
}> {
  return request("/v1/wealth/meta");
}

export async function listSavingGoals(): Promise<SavingGoal[]> {
  const rows = await request<Record<string, unknown>[]>("/v1/saving-goals");
  return rows.map(mapSaving);
}

export async function createSavingGoal(input: {
  name: string;
  category: SavingGoal["category"];
  customLabel?: string;
  targetCents?: number;
  currentCents?: number;
  visibility?: "PRIVATE" | "SHARED";
}): Promise<SavingGoal> {
  const raw = await request<Record<string, unknown>>("/v1/saving-goals", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return mapSaving(raw);
}

export async function updateSavingGoal(
  id: string,
  input: Partial<{
    name: string;
    category: SavingGoal["category"];
    customLabel: string | null;
    targetCents: number;
    currentCents: number;
  }>,
): Promise<SavingGoal> {
  const raw = await request<Record<string, unknown>>(`/v1/saving-goals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return mapSaving(raw);
}

export async function deleteSavingGoal(id: string): Promise<void> {
  await request(`/v1/saving-goals/${id}`, { method: "DELETE" });
}

export async function listInvestments(): Promise<InvestmentAccount[]> {
  const rows = await request<Record<string, unknown>[]>("/v1/investments");
  return rows.map(mapInvestment);
}

export async function createInvestment(input: {
  name: string;
  accountType: InvestmentAccount["accountType"];
  customLabel?: string;
  goalCents?: number;
  currentCents?: number;
  visibility?: "PRIVATE" | "SHARED";
}): Promise<InvestmentAccount> {
  const raw = await request<Record<string, unknown>>("/v1/investments", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return mapInvestment(raw);
}

export async function updateInvestment(
  id: string,
  input: Partial<{
    name: string;
    accountType: InvestmentAccount["accountType"];
    customLabel: string | null;
    goalCents: number;
    currentCents: number;
  }>,
): Promise<InvestmentAccount> {
  const raw = await request<Record<string, unknown>>(`/v1/investments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return mapInvestment(raw);
}

export async function deleteInvestment(id: string): Promise<void> {
  await request(`/v1/investments/${id}`, { method: "DELETE" });
}

export async function getNetWorth(): Promise<NetWorth> {
  return request<NetWorth>("/v1/net-worth");
}

export async function listDraftExpenses(budgetId: string): Promise<DraftExpense[]> {
  const rows = await request<Record<string, unknown>[]>(
    `/v1/budgets/${budgetId}/drafts`,
  );
  return rows.map(mapDraft);
}

export async function createDraftExpense(
  budgetId: string,
  input: {
    name: string;
    amountCents: number;
    categoryId?: string | null;
    dayOfMonth?: number | null;
    note?: string;
  },
): Promise<DraftExpense> {
  const raw = await request<Record<string, unknown>>(
    `/v1/budgets/${budgetId}/drafts`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return mapDraft(raw);
}

export async function deleteDraftExpense(
  budgetId: string,
  draftId: string,
): Promise<void> {
  await request(`/v1/budgets/${budgetId}/drafts/${draftId}`, {
    method: "DELETE",
  });
}

export async function getDraftImpact(budgetId: string): Promise<DraftImpact> {
  const raw = await request<Record<string, unknown> & { drafts: Record<string, unknown>[] }>(
    `/v1/budgets/${budgetId}/draft-impact`,
  );
  return {
    budgetId: String(raw.budgetId),
    currency: String(raw.currency),
    drafts: (raw.drafts ?? []).map(mapDraft),
    impact: raw.impact as DraftImpact["impact"],
  };
}

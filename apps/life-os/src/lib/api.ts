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

import { getAccessToken } from "@/lib/google";

const PICKER_BASE = "https://photospicker.googleapis.com/v1";

export type PickerSession = {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
  expireTime?: string;
};

export type PickedMediaItem = {
  id: string;
  createTime?: string;
  type?: string;
  mediaFile?: {
    baseUrl?: string;
    mimeType?: string;
    filename?: string;
    mediaFileMetadata?: {
      width?: number;
      height?: number;
    };
  };
};

async function pickerFetch(path: string, init?: RequestInit) {
  const accessToken = await getAccessToken();
  const res = await fetch(`${PICKER_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Photos Picker error (${res.status}): ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function createPickerSession(): Promise<PickerSession> {
  const data = await pickerFetch("/sessions", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data as PickerSession;
}

export async function getPickerSession(sessionId: string): Promise<PickerSession> {
  const data = await pickerFetch(`/sessions/${encodeURIComponent(sessionId)}`);
  return data as PickerSession;
}

export async function deletePickerSession(sessionId: string): Promise<void> {
  await pickerFetch(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export async function listPickedMediaItems(
  sessionId: string,
): Promise<PickedMediaItem[]> {
  const items: PickedMediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      sessionId,
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const data = await pickerFetch(`/mediaItems?${params.toString()}`);
    items.push(...((data.mediaItems as PickedMediaItem[]) ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

export function downloadUrlForMedia(baseUrl: string, mimeType?: string): string {
  // =d downloads original bytes for photos; videos use =dv
  if (mimeType?.startsWith("video/")) {
    return `${baseUrl}=dv`;
  }
  return `${baseUrl}=d`;
}

export async function fetchMediaBytes(
  baseUrl: string,
  mimeType?: string,
): Promise<ArrayBuffer> {
  const accessToken = await getAccessToken();
  const url = downloadUrlForMedia(baseUrl, mimeType);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to download media (${res.status})`);
  }
  return res.arrayBuffer();
}

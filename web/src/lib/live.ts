/**
 * Jonli joylashuv API'si (VPS'dagi bot) bilan aloqa.
 * `NEXT_PUBLIC_API_URL` build paytida beriladi; bo'lmasa — faqat jadval rejimi.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export interface LiveBus {
  readonly bus: number;
  readonly lat: number;
  readonly lng: number;
  readonly source: "gps" | "stop";
  /** Unix vaqt, soniya. */
  readonly ts: number;
  readonly heading: number | null;
  readonly speed: number | null;
  readonly stop_index: number | null;
}

export async function fetchLive(signal?: AbortSignal): Promise<LiveBus[]> {
  if (!API_URL) return [];
  const response = await fetch(`${API_URL}/api/live`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as { buses?: LiveBus[] };
  return data.buses ?? [];
}

/** Haydovchi so'rovi — Telegram initData bilan imzolanadi. */
export async function driverRequest<T>(
  path: string,
  initData: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `tma ${initData}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}

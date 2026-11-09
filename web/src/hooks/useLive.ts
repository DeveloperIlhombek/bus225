"use client";

import { useEffect, useState } from "react";
import { API_URL, fetchLive, type LiveBus } from "@/lib/live";

const POLL_MS = 5000;
/** Shundan eski joylashuv ko'rsatilmaydi (server bilan bir xil). */
const STALE_SECONDS = 180;

const freshOnly = (items: Iterable<LiveBus>): Map<string, LiveBus> => {
  const now = Date.now() / 1000;
  return new Map([...items].filter((b) => now - b.ts < STALE_SECONDS).map((b) => [String(b.bus), b]));
};

/**
 * Haydovchilardan kelgan jonli joylashuvlar (avtobus raqami → holat).
 * API sozlanmagan yoki ishlamasa — bo'sh: ilova jadval bo'yicha ishlayveradi.
 */
export function useLive(): ReadonlyMap<string, LiveBus> {
  const [live, setLive] = useState<ReadonlyMap<string, LiveBus>>(new Map());

  useEffect(() => {
    if (!API_URL) return;
    let alive = true;
    let controller = new AbortController();
    const load = async () => {
      controller.abort();
      controller = new AbortController();
      try {
        const buses = await fetchLive(controller.signal);
        if (alive) setLive(freshOnly(buses));
      } catch {
        // Tarmoq yo'q — oxirgi holat qoladi, eskirganlari tashlanadi (jadvalga qaytadi)
        if (alive) setLive((prev) => freshOnly(prev.values()));
      }
    };
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  return live;
}

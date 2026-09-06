"use client";

import { useCallback, useEffect, useState } from "react";
import type { Route } from "@/types/route";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ROUTE_URL = `${BASE_PATH}/route.json`;

interface RouteState {
  readonly route: Route | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => void;
}

function assertRoute(value: unknown): asserts value is Route {
  const candidate = value as Partial<Route> | null;
  if (!candidate || !Array.isArray(candidate.stops) || !Array.isArray(candidate.trips)) {
    throw new TypeError("route.json tuzilishi noto'g'ri: 'stops' va 'trips' kerak.");
  }
  if (candidate.stops.length < 2) {
    throw new TypeError("route.json kamida 2 ta bekatdan iborat bo'lishi kerak.");
  }
  for (const trip of candidate.trips) {
    if (trip.times.length !== candidate.stops.length) {
      throw new TypeError(
        `${trip.bus_id} reysidagi vaqtlar soni bekatlar soniga teng emas.`,
      );
    }
  }
}

/**
 * Yo'nalish ma'lumotini `public/route.json` dan yuklaydi.
 *
 * Statik eksportda ham ishlashi uchun bu build vaqtida import qilinmaydi —
 * runtime'da olinadi, shuning uchun jadval o'zgarganda faqat faylni
 * almashtirish kifoya, qayta build qilish shart emas.
 */
export function useRoute(): RouteState {
  const [route, setRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(ROUTE_URL, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`route.json yuklanmadi (HTTP ${response.status})`);
        }
        const data: unknown = await response.json();
        assertRoute(data);
        setRoute(data);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Noma'lum xato");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [attempt]);

  return { route, isLoading, error, reload };
}

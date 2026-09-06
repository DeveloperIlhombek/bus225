"use client";

import { useMemo } from "react";
import type { ActiveBus, Route } from "@/types/route";
import { activeBuses } from "@/lib/schedule";

/**
 * Hozir yo'lda bo'lgan avtobuslar. `now` o'zgargan sayin qayta hisoblanadi
 * (`useNow` odatda 30 soniyada bir marta yangilaydi).
 */
export function useLiveBuses(route: Route | null, now: Date | null): ActiveBus[] {
  return useMemo(() => {
    if (!route || !now) return [];
    return activeBuses(route, now);
  }, [route, now]);
}

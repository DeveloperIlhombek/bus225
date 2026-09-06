"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const MS_PER_MINUTE = 60_000;

/** Soat — React'dan tashqaridagi manba, shuning uchun obuna orqali o'qiladi. */
function currentMinuteBucket(): number {
  return Math.floor(Date.now() / MS_PER_MINUTE);
}

/**
 * Daqiqa aniqligidagi hozirgi vaqt.
 *
 * Serverda va gidratsiya paytida `null` qaytaradi — shu tufayli server bilan
 * klient bir xil HTML chiqaradi. Vaqtga bog'liq har qanday ko'rinish
 * `now === null` holatini ham hisobga olishi kerak.
 *
 * Qiymat faqat daqiqa o'zgarganda yangilanadi: jadval hisob-kitoblari
 * daqiqa aniqligida ishlaydi, shuning uchun ortiqcha render bo'lmaydi.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const timer = window.setInterval(onStoreChange, intervalMs);
      return () => window.clearInterval(timer);
    },
    [intervalMs],
  );

  const minuteBucket = useSyncExternalStore(
    subscribe,
    currentMinuteBucket,
    () => null,
  );

  return useMemo(
    () => (minuteBucket === null ? null : new Date(minuteBucket * MS_PER_MINUTE)),
    [minuteBucket],
  );
}

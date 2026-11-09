"use client";

import { useMemo, useSyncExternalStore } from "react";
import { cityClock } from "@/lib/time";

/**
 * Sinov uchun URL parametrlari (faqat brauzerda o'qiladi):
 *   ?t=07:00 — soatni shu vaqtdan boshlash
 *   ?x=30    — vaqtni 30 barobar tezlatish
 */
interface ClockOverride {
  readonly startMinute: number | null;
  readonly speed: number;
  readonly openedAt: number;
}

let override: ClockOverride | null = null;

function readOverride(): ClockOverride {
  if (override) return override;
  const params = new URLSearchParams(window.location.search);
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(params.get("t") ?? "");
  override = {
    startMinute: match ? Number(match[1]) * 60 + Number(match[2]) : null,
    speed: Math.max(1, Number(params.get("x")) || 1),
    openedAt: Date.now(),
  };
  return override;
}

/** Sinov parametrlari hisobga olingan "hozir" (epoch, ms). */
function virtualNow(): number {
  const o = readOverride();
  const elapsed = (Date.now() - o.openedAt) * o.speed;
  return o.openedAt + elapsed;
}

/**
 * Shahar vaqtidagi soat, har `intervalMs` da yangilanadi.
 *
 * Serverda va gidratsiya paytida `null` — server va klient HTML'i bir xil
 * bo'lishi uchun. Qaytgan Date'ning getHours()/getMinutes() — shahar vaqti.
 */
export function useCityClock(utcOffsetHours: number, intervalMs = 1000): Date | null {
  const tick = useSyncExternalStore(
    (onChange) => {
      const timer = window.setInterval(onChange, intervalMs);
      return () => window.clearInterval(timer);
    },
    () => Math.floor(Date.now() / intervalMs),
    () => null,
  );

  return useMemo(() => {
    if (tick === null) return null;
    const o = readOverride();
    const now = virtualNow();
    if (o.startMinute === null) return cityClock(utcOffsetHours, now);
    // Sinov rejimi: shahar sanasining boshiga + berilgan vaqt + o'tgan virtual vaqt
    const base = cityClock(utcOffsetHours, o.openedAt);
    base.setHours(0, 0, 0, 0);
    return new Date(base.getTime() + o.startMinute * 60_000 + (now - o.openedAt));
  }, [tick, utcOffsetHours]);
}

"use client";

import { useCallback, useState } from "react";
import { telegramLocation } from "@/lib/telegram";
import type { GeoPoint } from "@/types/route";

export type LocateStatus = "idle" | "locating" | "found" | "failed";

interface LocateState {
  readonly location: GeoPoint | null;
  readonly status: LocateStatus;
  readonly locate: () => Promise<GeoPoint | null>;
}

function browserLocation(): Promise<GeoPoint | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 15_000 },
    );
  });
}

/**
 * Foydalanuvchi joylashuvi — faqat 📍 tugmasi bosilganda so'raladi.
 * Telegram 8.0+ da Telegram'ning o'z ruxsat oynasi, aks holda brauzer geolokatsiyasi.
 */
export function useLocate(): LocateState {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [status, setStatus] = useState<LocateStatus>("idle");

  const locate = useCallback(async () => {
    setStatus("locating");
    const fromTelegram = await telegramLocation();
    const point = fromTelegram
      ? { lat: fromTelegram.latitude, lng: fromTelegram.longitude }
      : await browserLocation();
    setLocation(point ?? null);
    setStatus(point ? "found" : "failed");
    return point;
  }, []);

  return { location, status, locate };
}

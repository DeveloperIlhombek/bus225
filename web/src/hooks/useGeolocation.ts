"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { GeoPoint } from "@/types/route";

export type GeolocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

interface GeolocationState {
  readonly location: GeoPoint | null;
  readonly status: GeolocationStatus;
  readonly error: string | null;
  readonly request: () => void;
}

interface Failure {
  readonly status: Extract<GeolocationStatus, "denied" | "unavailable">;
  readonly message: string;
}

const ERROR_MESSAGE: Record<number, string> = {
  1: "Joylashuvga ruxsat berilmadi.",
  2: "Joylashuvni aniqlab bo'lmadi.",
  3: "Joylashuvni aniqlash vaqti tugadi.",
};

const subscribeNothing = (): (() => void) => () => {};
const hasGeolocation = (): boolean =>
  typeof navigator !== "undefined" && "geolocation" in navigator;

/**
 * Brauzer geolokatsiyasi.
 *
 * Holat (`status`) alohida saqlanmaydi — u joylashuv, xato va ruxsat
 * so'ralgan-so'ralmaganidan kelib chiqib hisoblanadi. Shu tufayli effekt
 * ichida holat o'rnatilmaydi va ortiqcha renderlar bo'lmaydi.
 *
 * Ruxsat berilmasa ilova baribir ishlaydi — faqat "eng yaqin bekat"
 * ko'rsatilmaydi.
 */
export function useGeolocation(autoRequest = true): GeolocationState {
  const [isEnabled, setIsEnabled] = useState(autoRequest);
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  // navigator faqat klientda mavjud — gidratsiya mos kelishi uchun obuna orqali.
  const isSupported = useSyncExternalStore(subscribeNothing, hasGeolocation, () => false);

  const request = useCallback(() => {
    setFailure(null);
    setIsEnabled(true);
  }, []);

  useEffect(() => {
    if (!isEnabled || !isSupported) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setFailure(null);
      },
      (positionError) => {
        setFailure({
          status: positionError.code === 1 ? "denied" : "unavailable",
          message: ERROR_MESSAGE[positionError.code] ?? "Joylashuv xatosi.",
        });
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 12_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isEnabled, isSupported]);

  const status: GeolocationStatus = !isEnabled
    ? "idle"
    : !isSupported
      ? "unavailable"
      : (failure?.status ?? (location ? "granted" : "requesting"));

  const error = !isEnabled
    ? null
    : !isSupported
      ? "Brauzer joylashuvni qo'llab-quvvatlamaydi."
      : (failure?.message ?? null);

  return { location, status, error, request };
}

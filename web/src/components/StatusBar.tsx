"use client";

import type { GeolocationStatus } from "@/hooks/useGeolocation";
import type { NearestStop } from "@/types/route";
import { formatDistance } from "@/lib/geo";
import { formatClock } from "@/lib/time";

interface StatusBarProps {
  readonly now: Date | null;
  readonly nearest: NearestStop | null;
  readonly geoStatus: GeolocationStatus;
  readonly onRequestLocation: () => void;
}

/** Yuqoridagi ingichka qator: joylashuv holati va oxirgi yangilanish vaqti. */
export function StatusBar({ now, nearest, geoStatus, onRequestLocation }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-muted)]">
      {nearest ? (
        <span className="truncate">
          📍 {nearest.stop.name} · {formatDistance(nearest.distanceMeters)}
        </span>
      ) : geoStatus === "requesting" ? (
        <span>📍 Joylashuv aniqlanmoqda…</span>
      ) : (
        <button
          type="button"
          onClick={onRequestLocation}
          className="underline underline-offset-2"
        >
          📍 Joylashuvni aniqlash
        </button>
      )}

      <span className="shrink-0 tabular-nums">{now ? formatClock(now) : "--:--"}</span>
    </div>
  );
}

"use client";

import type { Route } from "@/types/route";
import { DIRECTIONS, DIRECTION_LABEL, firstDepartureOfDay, nextDeparturesAt } from "@/lib/schedule";
import { formatDuration } from "@/lib/time";

interface DepartureBoardProps {
  readonly route: Route;
  readonly stopIndex: number;
  readonly now: Date;
  readonly limit?: number;
}

const DIRECTION_ICON = { shaharga: "🏙", qishloqqa: "🏡" } as const;
const DIRECTION_COLOR = {
  shaharga: "var(--color-city)",
  qishloqqa: "var(--color-village)",
} as const;

/** Tanlangan bekat uchun keyingi avtobuslar, ikkala yo'nalish bo'yicha. */
export function DepartureBoard({ route, stopIndex, now, limit = 3 }: DepartureBoardProps) {
  const upcoming = nextDeparturesAt(route, stopIndex, now, limit);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DIRECTIONS.map((direction) => {
        const departures = upcoming[direction];
        const firstOfDay = firstDepartureOfDay(route, stopIndex, direction);

        if (departures.length === 0 && firstOfDay === null) return null;

        return (
          <section
            key={direction}
            className="rounded-2xl bg-[var(--color-surface-alt)] p-4"
            aria-label={DIRECTION_LABEL[direction]}
          >
            <h3
              className="mb-3 flex items-center gap-2 text-sm font-semibold"
              style={{ color: DIRECTION_COLOR[direction] }}
            >
              <span aria-hidden>{DIRECTION_ICON[direction]}</span>
              {DIRECTION_LABEL[direction]}
            </h3>

            {departures.length > 0 ? (
              <ul className="space-y-2">
                {departures.map((departure, index) => (
                  <li key={departure.time} className="flex items-baseline justify-between gap-3">
                    <span
                      className={
                        index === 0
                          ? "text-xl font-semibold tabular-nums"
                          : "text-base tabular-nums text-[var(--color-muted)]"
                      }
                    >
                      {departure.time}
                    </span>
                    <span
                      className={
                        index === 0
                          ? "text-sm font-medium"
                          : "text-xs text-[var(--color-muted)]"
                      }
                      style={index === 0 ? { color: DIRECTION_COLOR[direction] } : undefined}
                    >
                      {formatDuration(departure.minutesAway)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">
                Bugungi reyslar tugadi.
                <br />
                Ertaga birinchisi:{" "}
                <span className="font-semibold tabular-nums text-[var(--color-ink)]">
                  {firstOfDay}
                </span>
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

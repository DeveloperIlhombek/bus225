"use client";

import type { ActiveBus, Route } from "@/types/route";
import { DIRECTION_LABEL } from "@/lib/schedule";

interface BusListProps {
  readonly route: Route;
  readonly buses: readonly ActiveBus[];
}

const DIRECTION_COLOR = {
  shaharga: "var(--color-city)",
  qishloqqa: "var(--color-village)",
} as const;

/** Yo'lda bo'lgan avtobuslar va ular qaysi bekatlar orasida ekani. */
export function BusList({ route, buses }: BusListProps) {
  if (buses.length === 0) {
    return (
      <p className="rounded-2xl bg-[var(--color-surface-alt)] p-4 text-center text-sm text-[var(--color-muted)]">
        Hozir yo&apos;lda avtobus yo&apos;q.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {buses.map((bus) => {
        const fromIndex = Math.floor(bus.position);
        const toIndex = Math.min(fromIndex + 1, route.stops.length - 1);
        const from = route.stops[fromIndex]?.name ?? "—";
        const to = route.stops[toIndex]?.name ?? "—";
        const progress = Math.round((bus.position - fromIndex) * 100);

        return (
          <li
            key={bus.busId}
            className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-alt)] p-3"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: DIRECTION_COLOR[bus.direction] }}
            >
              {bus.busId}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {from} → {to}
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                {DIRECTION_LABEL[bus.direction]} · oraliqning {progress}% i
                {bus.meetingWith ? ` · 🤝 ${bus.meetingWith} bilan uchrashmoqda` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

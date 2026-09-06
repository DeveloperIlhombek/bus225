"use client";

import type { Route } from "@/types/route";
import { hapticTap } from "@/lib/telegram";

interface StopPickerProps {
  readonly route: Route;
  readonly selectedIndex: number;
  readonly nearestIndex: number | null;
  readonly onSelect: (index: number) => void;
}

/** Bekatlar orasida gorizontal siljitiladigan tanlov. */
export function StopPicker({ route, selectedIndex, nearestIndex, onSelect }: StopPickerProps) {
  return (
    <div
      className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1"
      role="tablist"
      aria-label="Bekatlar"
    >
      {route.stops.map((stop, index) => {
        const isSelected = index === selectedIndex;
        return (
          <button
            key={stop.name}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => {
              hapticTap();
              onSelect(index);
            }}
            className={[
              "snap-start whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors",
              isSelected
                ? "bg-[var(--color-accent)] font-medium text-[var(--color-accent-ink)]"
                : "bg-[var(--color-surface-alt)] text-[var(--color-muted)]",
            ].join(" ")}
          >
            {index === nearestIndex ? "📍 " : ""}
            {stop.name}
          </button>
        );
      })}
    </div>
  );
}

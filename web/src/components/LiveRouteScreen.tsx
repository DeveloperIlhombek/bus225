"use client";

import { useMemo, useState } from "react";
import { BusList } from "@/components/BusList";
import { DepartureBoard } from "@/components/DepartureBoard";
import { RouteMap } from "@/components/RouteMap";
import { Skeleton } from "@/components/Skeleton";
import { StatusBar } from "@/components/StatusBar";
import { StopPicker } from "@/components/StopPicker";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import { useNow } from "@/hooks/useNow";
import { useRoute } from "@/hooks/useRoute";
import { useTelegram } from "@/hooks/useTelegram";
import { findNearestStop } from "@/lib/geo";

/** Har 30 soniyada avtobus pozitsiyalari qayta hisoblanadi. */
const REFRESH_INTERVAL_MS = 30_000;

/**
 * Ilovaning yagona ekrani. Barcha holat shu yerda yig'iladi va
 * pastdagi komponentlar sof ko'rinish (presentational) bo'lib qoladi.
 */
export function LiveRouteScreen() {
  useTelegram();

  const { route, isLoading, error, reload } = useRoute();
  const now = useNow(REFRESH_INTERVAL_MS);
  const { location, status: geoStatus, request: requestLocation } = useGeolocation();
  const buses = useLiveBuses(route, now);

  // Foydalanuvchi bekat tanlamaguncha eng yaqini ko'rsatiladi; tanlagandan
  // keyin uning tanlovi saqlanadi. Holatni effekt bilan sinxronlash o'rniga
  // ko'rsatiladigan indeks hisoblab olinadi.
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  const nearest = useMemo(
    () => (route ? findNearestStop(route.stops, location) : null),
    [route, location],
  );

  const selectedIndex = pickedIndex ?? nearest?.index ?? 0;

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-4xl">📡</p>
        <h1 className="text-lg font-semibold">Jadval yuklanmadi</h1>
        <p className="max-w-xs text-sm text-[var(--color-muted)]">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-accent-ink)]"
        >
          Qayta urinish
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 p-4">
      {isLoading || !route ? (
        <Skeleton />
      ) : (
        <>
          <header className="space-y-1">
            <h1 className="text-base font-semibold leading-snug">{route.route_name}</h1>
            <StatusBar
              now={now}
              nearest={nearest}
              geoStatus={geoStatus}
              onRequestLocation={requestLocation}
            />
          </header>

          <div className="rounded-2xl bg-[var(--color-surface-alt)] p-2">
            <RouteMap
              route={route}
              buses={buses}
              nearestStopIndex={nearest?.index ?? null}
              selectedStopIndex={selectedIndex}
              onSelectStop={setPickedIndex}
            />
          </div>

          <StopPicker
            route={route}
            selectedIndex={selectedIndex}
            nearestIndex={nearest?.index ?? null}
            onSelect={setPickedIndex}
          />

          {now ? (
            <DepartureBoard route={route} stopIndex={selectedIndex} now={now} />
          ) : (
            <div className="h-32 animate-pulse rounded-2xl bg-[var(--color-surface-alt)]" />
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-[var(--color-muted)]">
              Yo&apos;lda ({buses.length})
            </h2>
            <BusList route={route} buses={buses} />
          </section>

          {route.telegram_group ? (
            <footer className="pb-2 text-center text-xs text-[var(--color-muted)]">
              💬 {route.telegram_group}
            </footer>
          ) : null}
        </>
      )}
    </main>
  );
}

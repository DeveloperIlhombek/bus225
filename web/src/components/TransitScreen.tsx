"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FocusRequest, MapBus } from "@/components/TransitMap";
import { BusSheet, HomeSheet, SearchSheet, StopSheet, TimetableSheet, type View } from "@/components/sheets";
import { useCityClock } from "@/hooks/useCityClock";
import { useLocate } from "@/hooks/useLocate";
import { useRoute } from "@/hooks/useRoute";
import { useTelegram } from "@/hooks/useTelegram";
import { fleetState } from "@/lib/fleet";
import { routeForDay } from "@/lib/service";
import { distanceMeters } from "@/lib/geo";
import { cumulativeStopDistances, positionToPose, routePolyline } from "@/lib/path";
import { hapticTap, setBackButton } from "@/lib/telegram";
import { formatClock } from "@/lib/time";
import type { GeoPoint } from "@/types/route";

/** Leaflet DOM bilan ishlaydi — faqat brauzerda yuklanadi (statik eksport buzilmaydi). */
const TransitMap = dynamic(() => import("@/components/TransitMap").then((m) => m.TransitMap), {
  ssr: false,
  loading: () => <div className="transit-map loading" />,
});

const DEFAULT_CENTER: GeoPoint = { lat: 39.74, lng: 67.06 };

/**
 * Ilovaning yagona ekrani — Yandex Transport uslubida: butun ekran xarita,
 * tepada sarlavha, pastda surilmaydigan panel.
 */
export function TransitScreen() {
  const telegram = useTelegram();
  const { route, error, reload } = useRoute();
  const now = useCityClock(route?.timezone_offset_hours ?? 5);
  const { location, status: locateStatus, locate } = useLocate();

  const [stack, setStack] = useState<View[]>([{ name: "home" }]);
  const view = stack[stack.length - 1]!;
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [center, setCenter] = useState<GeoPoint>(DEFAULT_CENTER);
  const [toast, setToast] = useState<string | null>(null);

  // ---------------------------------------------------------------- o'lchamlar
  const headerRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const [insets, setInsets] = useState({ top: 90, bottom: 260 });
  useEffect(() => {
    const measure = () => {
      const top = headerRef.current?.getBoundingClientRect().bottom ?? 90;
      const bottom = sheetRef.current?.offsetHeight ?? 260;
      document.documentElement.style.setProperty("--sheet-h", `${bottom}px`);
      setInsets((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (headerRef.current) observer.observe(headerRef.current);
    if (sheetRef.current) observer.observe(sheetRef.current);
    return () => observer.disconnect();
  }, [route]);

  // ---------------------------------------------------------------- avtobuslar
  // Bugun ishlaydigan jadval (yakshanba/bayram — alohida); sana o'zgarganda qayta tanlanadi
  const dayKey = now ? now.toDateString() : "";
  const today = useMemo(
    () => (route && now ? routeForDay(route, now) : route),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat sana muhim, soniyalar emas
    [route, dayKey],
  );
  const fleet = useMemo(() => (today && now ? fleetState(today, now) : []), [today, now]);
  const stopDistances = useMemo(() => (route ? cumulativeStopDistances(route) : []), [route]);

  const mapBuses: MapBus[] = useMemo(() => {
    if (!route) return [];
    const selectedBus = view.name === "bus" ? view.id : null;
    return fleet.flatMap((bus) => {
      const pose = positionToPose(route, bus.position, bus.direction === "shaharga");
      if (!pose) return [];
      return [
        {
          id: bus.bus,
          label: route.route_id,
          pose,
          selected: bus.bus === selectedBus,
          dimmed: selectedBus !== null && bus.bus !== selectedBus,
        },
      ];
    });
  }, [route, fleet, view]);

  // ---------------------------------------------------------------- navigatsiya
  const focusOn = useCallback((points: readonly GeoPoint[], maxZoom: number) => {
    setFocus({ points, maxZoom, nonce: Date.now() });
  }, []);

  const open = useCallback(
    (next: View) => {
      hapticTap();
      setStack((prev) => {
        const top = prev[prev.length - 1]!;
        const same = JSON.stringify(top) === JSON.stringify(next);
        return same ? prev : [...prev, next];
      });
      if (!route) return;
      if (next.name === "stop") {
        const stop = route.stops[next.index];
        if (stop) focusOn([stop], 15);
      } else if (next.name === "bus") {
        const bus = mapBuses.find((b) => b.id === next.id);
        if (bus) focusOn([bus.pose], 14);
      } else if (next.name === "timetable") {
        focusOn(routePolyline(route), 15);
      }
    },
    [route, mapBuses, focusOn],
  );

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const canGoBack = stack.length > 1;
  useEffect(() => setBackButton(canGoBack, back), [canGoBack, back, telegram]);

  const onLocate = useCallback(async () => {
    const point = await locate();
    if (point) focusOn([point], 15);
    else setToast("Joylashuvni aniqlab bo'lmadi — ruxsat bering");
  }, [locate, focusOn]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // ---------------------------------------------------------------- sarlavha
  const placeName = useMemo(() => {
    if (!route) return "";
    const ref = location ?? center;
    let best = { name: "", meters: Infinity };
    for (const stop of route.stops) {
      const meters = distanceMeters(ref, stop);
      if (meters < best.meters) best = { name: stop.name, meters };
    }
    return best.meters < 3000 ? best.name : "Samarqand";
  }, [route, location, center]);

  // ---------------------------------------------------------------- render
  if (error) {
    return (
      <main className="fatal">
        <p className="fatal-emoji">📡</p>
        <h1>Jadval yuklanmadi</h1>
        <p>{error}</p>
        <button type="button" onClick={reload}>
          Qayta urinish
        </button>
      </main>
    );
  }

  const sheetProps = today && now ? { route: today, now, fleet, open, back } : null;

  return (
    <main className="screen">
      {route ? (
        <TransitMap
          route={route}
          buses={mapBuses}
          lineEmphasis={view.name === "bus" || view.name === "timetable"}
          selectedStop={view.name === "stop" ? view.index : null}
          userLocation={location}
          focus={focus}
          insets={insets}
          onStopClick={(index) => open({ name: "stop", index })}
          onBusClick={(id) => open({ name: "bus", id })}
          onMoveEnd={setCenter}
        />
      ) : (
        <div className="transit-map loading" />
      )}

      <header className="topbar" ref={headerRef}>
        <button
          type="button"
          className="avatar"
          aria-label="Butun yo'nalish"
          onClick={() => route && focusOn(routePolyline(route), 15)}
        >
          <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
            <rect x="6" y="12" width="32" height="22" rx="4" fill="#2b2b2b" />
            <rect x="9" y="15" width="9" height="7" rx="1.5" fill="#d9d9d9" />
            <rect x="20" y="15" width="9" height="7" rx="1.5" fill="#d9d9d9" />
            <path d="M38 18h3.5a2 2 0 0 1 1.8 1.2l1.7 4V32a2 2 0 0 1-2 2H38z" fill="#3a3a3a" />
            <rect x="4" y="30" width="5" height="3" rx="1" fill="#e53935" />
            <circle cx="14" cy="35" r="4.2" fill="#1a1a1a" />
            <circle cx="14" cy="35" r="1.8" fill="#9e9e9e" />
            <circle cx="34" cy="35" r="4.2" fill="#1a1a1a" />
            <circle cx="34" cy="35" r="1.8" fill="#9e9e9e" />
          </svg>
        </button>
        <div className="titles">
          <h1>Transport</h1>
          <button type="button" className="subtitle" onClick={onLocate}>
            <span>{placeName || "Samarqand"}</span>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <circle cx="10" cy="10" r="10" fill="#111" />
              <path d="M8.5 6l4 4-4 4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <span className="live">{now ? `Jadval · ${formatClock(now)}` : "Yuklanmoqda…"}</span>
      </header>

      {canGoBack || telegram ? (
        <button
          type="button"
          className="fab fab-left"
          aria-label="Orqaga"
          onClick={() => (canGoBack ? back() : telegram?.close())}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M19 12H5m0 0l6-6m-6 6l6 6" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
      <button
        type="button"
        className={locateStatus === "locating" ? "fab fab-right busy" : "fab fab-right"}
        aria-label="Mening joylashuvim"
        onClick={onLocate}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M20.5 3.5L3.8 10.6c-.8.3-.7 1.5.1 1.7l6.6 1.4 1.4 6.6c.2.8 1.4.9 1.7.1z" fill="#111" />
        </svg>
      </button>

      <section className="sheet" ref={sheetRef}>
        <div className="grabber" />
        {!sheetProps ? (
          <div className="sheet-skeleton" />
        ) : view.name === "home" ? (
          <HomeSheet {...sheetProps} reference={location ?? center} isUserLocation={location !== null} />
        ) : view.name === "search" ? (
          <SearchSheet {...sheetProps} />
        ) : view.name === "stop" ? (
          <StopSheet {...sheetProps} index={view.index} />
        ) : view.name === "bus" ? (
          <BusSheet {...sheetProps} id={view.id} stopDistances={stopDistances} />
        ) : (
          <TimetableSheet {...sheetProps} />
        )}
      </section>

      <div className={toast ? "toast show" : "toast"} role="status">
        {toast}
      </div>
    </main>
  );
}

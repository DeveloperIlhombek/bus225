"use client";

import dynamic from "next/dynamic";
import { RouteMap } from "@/components/RouteMap";
import { usePersistedString } from "@/hooks/usePersistedState";
import { hapticTap } from "@/lib/telegram";
import type { ActiveBus, GeoPoint, Route } from "@/types/route";

/**
 * Leaflet DOM'ga to'g'ridan-to'g'ri murojaat qiladi, shuning uchun u faqat
 * brauzerda yuklanadi. Statik eksportda sahifa oldindan render qilinadi —
 * ssr: false shu bosqichda xarita chaqirilmasligini kafolatlaydi.
 */
const LeafletRouteMap = dynamic(
  () => import("@/components/LeafletRouteMap").then((m) => m.LeafletRouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-2xl bg-[var(--color-surface-alt)]" />
    ),
  },
);

const STORAGE_KEY = "bus225:map-view";
type ViewMode = "map" | "schematic";

interface MapPanelProps {
  readonly route: Route;
  readonly buses: readonly ActiveBus[];
  readonly userLocation: GeoPoint | null;
  readonly nearestStopIndex: number | null;
  readonly selectedStopIndex: number;
  readonly onSelectStop: (index: number) => void;
}

/**
 * Haqiqiy xarita va sxematik chiziq o'rtasida almashtirib turadi.
 *
 * Sxema "avtobus qaysi bekatlar orasida" degan savolga bir qarashda javob
 * beradi, xarita esa aniq joyni ko'rsatadi — ikkalasi ham kerak, shuning
 * uchun tanlov foydalanuvchining brauzerida saqlanadi.
 */
export function MapPanel(props: MapPanelProps) {
  const [stored, setStored] = usePersistedString(STORAGE_KEY);

  // Gidratsiyagacha (stored === null) sxema ko'rsatiladi: u yengil va
  // tashqi so'rovlarsiz darhol chiziladi.
  const mode: ViewMode = stored === "map" ? "map" : "schematic";
  const isMap = mode === "map";

  const toggle = () => {
    hapticTap();
    setStored(isMap ? "schematic" : "map");
  };

  return (
    <section className="relative">
      {isMap ? (
        <LeafletRouteMap {...props} />
      ) : (
        <div className="rounded-2xl bg-[var(--color-surface-alt)] p-2">
          <RouteMap
            route={props.route}
            buses={props.buses}
            nearestStopIndex={props.nearestStopIndex}
            selectedStopIndex={props.selectedStopIndex}
            onSelectStop={props.onSelectStop}
          />
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={isMap ? "Sxematik ko'rinishga o'tish" : "Haqiqiy xaritaga o'tish"}
        title={isMap ? "Sxema" : "Xarita"}
        className="absolute right-2 top-2 z-[1000] rounded-xl bg-[var(--color-surface)] px-3 py-2 text-base shadow-md ring-1 ring-black/10"
      >
        {isMap ? "📊" : "🗺"}
      </button>
    </section>
  );
}

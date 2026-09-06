"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ActiveBus, GeoPoint, Route } from "@/types/route";
import { positionToPoint, routePolyline } from "@/lib/path";

/**
 * OpenStreetMap'ning ochiq tile serveri. Kalit ham, hisob ham talab qilmaydi.
 * Atribut ko'rsatish MAJBURIY — bu OSM foydalanish shartlarining bir qismi.
 * Trafik ortib ketsa faqat shu ikki qatorni boshqa provayderga almashtirish kifoya.
 */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ishtirokchilari';

const DIRECTION_COLOR = { shaharga: "#2563eb", qishloqqa: "#ea580c" } as const;

interface LeafletRouteMapProps {
  readonly route: Route;
  readonly buses: readonly ActiveBus[];
  readonly userLocation: GeoPoint | null;
  readonly nearestStopIndex: number | null;
  readonly selectedStopIndex: number;
  readonly onSelectStop: (index: number) => void;
}

/** Avtobus belgisi — rasm o'rniga HTML, shuning uchun ikonka yo'llari bilan muammo yo'q. */
function busIcon(bus: ActiveBus): L.DivIcon {
  const color = DIRECTION_COLOR[bus.direction];
  const meeting = bus.meetingWith ? "<span class='bus-pin__meet'>🤝</span>" : "";

  return L.divIcon({
    className: "bus-pin-wrapper",
    html: `<div class="bus-pin" style="background:${color}">${bus.busId}${meeting}</div>`,
    iconSize: [34, 20],
    iconAnchor: [17, 10],
  });
}

function userIcon(): L.DivIcon {
  return L.divIcon({
    className: "user-pin-wrapper",
    html: '<div class="user-pin"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Yo'nalish to'liq ko'rinadigan qilib xaritani bir marta moslaydi. */
function FitToRoute({ points }: { points: readonly GeoPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28] });
  }, [map, points]);

  return null;
}

export function LeafletRouteMap({
  route,
  buses,
  userLocation,
  nearestStopIndex,
  selectedStopIndex,
  onSelectStop,
}: LeafletRouteMapProps) {
  const line = useMemo(() => routePolyline(route), [route]);
  const linePositions = useMemo(
    () => line.map((point) => [point.lat, point.lng] as [number, number]),
    [line],
  );

  const busPoints = useMemo(
    () =>
      buses
        .map((bus) => ({ bus, point: positionToPoint(route, bus.position) }))
        .filter((entry): entry is { bus: ActiveBus; point: GeoPoint } => entry.point !== null),
    [buses, route],
  );

  const center = line[Math.floor(line.length / 2)] ?? { lat: 39.67, lng: 66.92 };

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      scrollWheelZoom
      className="h-64 w-full rounded-2xl"
      // Telegram ichida ikki marta bosib kattalashtirish sahifani ham suradi.
      doubleClickZoom={false}
      /*
       * Leaflet tile'larni fade bilan ko'rsatadi: avval opacity 0, keyin
       * animatsiya kadrida 1. Agar konteyner o'lchami mount paytida o'zgarsa
       * (bizda shunday — xarita dinamik yuklanadi), animatsiya boshlanmay
       * qolib, tile'lar ko'rinmas bo'lib turadi. Fade'siz ular darhol
       * chiziladi va Telegram webview'da qayta bo'yash ham kamayadi.
       */
      fadeAnimation={false}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
      <FitToRoute points={line} />

      <Polyline positions={linePositions} pathOptions={{ color: "#64748b", weight: 4, opacity: 0.7 }} />

      {route.stops.map((stop, index) => (
        <CircleMarker
          key={stop.name}
          center={[stop.lat, stop.lng]}
          radius={index === selectedStopIndex ? 9 : 6}
          pathOptions={{
            color: index === nearestStopIndex ? DIRECTION_COLOR.qishloqqa : "#475569",
            weight: index === nearestStopIndex ? 3 : 2,
            fillColor: index === selectedStopIndex ? "#2563eb" : "#ffffff",
            fillOpacity: 1,
          }}
          eventHandlers={{ click: () => onSelectStop(index) }}
        />
      ))}

      {busPoints.map(({ bus, point }) => (
        <Marker key={bus.busId} position={[point.lat, point.lng]} icon={busIcon(bus)} />
      ))}

      {userLocation ? (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon()} />
      ) : null}
    </MapContainer>
  );
}

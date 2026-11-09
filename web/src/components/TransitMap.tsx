"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint, Route } from "@/types/route";
import { routePolyline, type Pose } from "@/lib/path";

/**
 * OpenStreetMap'ning ochiq tile serveri: kalit ham, hisob ham kerak emas.
 * Atribut ko'rsatish MAJBURIY (OSM shartlari). Yandex uslubiga yaqinlashtirish
 * uchun ranglar CSS'da (`.tiles-soft`) yumshatiladi.
 */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Ikki holat orasidagi silliq o'tish davomiyligi — soat har soniyada yangilanadi. */
const ANIMATION_MS = 1000;

export interface MapBus {
  readonly id: string;
  readonly label: string;
  readonly pose: Pose;
  readonly dimmed: boolean;
  readonly selected: boolean;
}

export interface FocusRequest {
  readonly points: readonly GeoPoint[];
  readonly maxZoom: number;
  /** Har safar yangi qiymat — bir xil nuqtaga qayta fokuslash uchun. */
  readonly nonce: number;
}

interface TransitMapProps {
  readonly route: Route;
  readonly buses: readonly MapBus[];
  readonly lineEmphasis: boolean;
  readonly selectedStop: number | null;
  readonly userLocation: GeoPoint | null;
  readonly focus: FocusRequest | null;
  /** Xaritaning ustini va pastini yopib turgan qismlar (sarlavha, panel), px. */
  readonly insets: { readonly top: number; readonly bottom: number };
  readonly onStopClick: (index: number) => void;
  readonly onBusClick: (id: string) => void;
  readonly onMoveEnd: (center: GeoPoint) => void;
}

const BUS_SVG = `<svg viewBox="0 0 20 48" width="20" height="48" aria-hidden="true">
  <rect x="1.5" y="1.5" width="17" height="45" rx="4.5" fill="#5a9cf8" stroke="#10213f" stroke-width="2.4"/>
  <rect x="4.6" y="5" width="10.8" height="9" rx="2" fill="#9cc6ff" stroke="#2a5aa8" stroke-width="1"/>
  <rect x="4.6" y="17.5" width="10.8" height="12" rx="2" fill="#9cc6ff" stroke="#2a5aa8" stroke-width="1"/>
  <rect x="4.6" y="33" width="10.8" height="10" rx="2" fill="#9cc6ff" stroke="#2a5aa8" stroke-width="1"/>
</svg>`;

export const STOP_GLYPH = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="#fff" d="M7 3h10a3 3 0 0 1 3 3v10a2 2 0 0 1-1 1.73V20a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1.5h-7V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2.27A2 2 0 0 1 4 16V6a3 3 0 0 1 3-3zm-.5 4v4.5h11V7h-11zM7.5 14a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm9 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>`;

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface AnimatedBus {
  marker: L.Marker;
  root: HTMLElement | null;
  body: HTMLElement | null;
  from: L.LatLng;
  to: L.LatLng;
  current: L.LatLng;
  fromHeading: number;
  toHeading: number;
  heading: number;
  startedAt: number;
}

/**
 * Yandex Transport uslubidagi xarita: ko'k, harakat yo'nalishiga burilgan
 * avtobus belgilari, bekatlar, yo'nalish chizig'i.
 *
 * Leaflet bevosita (react-leaflet'siz) boshqariladi: avtobuslar har kadrda
 * siljitiladi, buni React render sikli orqali qilish ortiqcha yuk bo'lardi.
 */
export function TransitMap(props: TransitMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const stopsRef = useRef<L.Marker[]>([]);
  const busesRef = useRef(new Map<string, AnimatedBus>());
  const userRef = useRef<L.Marker | null>(null);
  const zoomingRef = useRef(false);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
  });

  // ---------------------------------------------------------------- xaritani yaratish
  const { route } = props;
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.25,
      fadeAnimation: false,
    });
    mapRef.current = map;

    L.tileLayer(TILE_URL, { maxZoom: 19, className: "tiles-soft" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addAttribution(TILE_ATTRIBUTION).addTo(map);

    const line = routePolyline(route).map((p) => L.latLng(p.lat, p.lng));
    L.polyline(line, { color: "#ffffff", weight: 9, opacity: 0.9, interactive: false }).addTo(map);
    lineRef.current = L.polyline(line, { color: "#1e88e5", weight: 5, opacity: 0.55, interactive: false }).addTo(map);

    stopsRef.current = route.stops.map((stop, index) =>
      L.marker([stop.lat, stop.lng], {
        icon: L.divIcon({ className: "", html: `<div class="stop-pin">${STOP_GLYPH}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
        zIndexOffset: -100,
        keyboard: false,
        title: stop.name,
      })
        .on("click", () => propsRef.current.onStopClick(index))
        .addTo(map),
    );

    const { insets } = propsRef.current;
    map.fitBounds(L.latLngBounds(line), {
      paddingTopLeft: [24, insets.top + 16],
      paddingBottomRight: [24, insets.bottom + 24],
    });

    const zoomClass = () => {
      const z = map.getZoom();
      container.classList.toggle("z-lo", z < 11.5);
      container.classList.toggle("z-mid", z >= 11.5 && z < 14.5);
    };
    zoomClass();
    map.on("zoomstart", () => (zoomingRef.current = true));
    map.on("zoomend", () => {
      zoomingRef.current = false;
      zoomClass();
    });
    map.on("moveend", () => {
      const c = map.getCenter();
      propsRef.current.onMoveEnd({ lat: c.lat, lng: c.lng });
    });

    // Silliq harakat: har kadrda ikki holat orasini to'ldiramiz
    let frame = 0;
    const animate = (time: number) => {
      if (!zoomingRef.current) {
        for (const bus of busesRef.current.values()) {
          const k = Math.min(1, (time - bus.startedAt) / ANIMATION_MS);
          if (bus.current.equals(bus.to) && bus.heading === bus.toHeading) continue;
          bus.current = L.latLng(
            bus.from.lat + (bus.to.lat - bus.from.lat) * k,
            bus.from.lng + (bus.to.lng - bus.from.lng) * k,
          );
          bus.marker.setLatLng(bus.current);
          const turn = ((bus.toHeading - bus.fromHeading + 540) % 360) - 180;
          bus.heading = k >= 1 ? bus.toHeading : bus.fromHeading + turn * Math.min(1, k * 2);
          if (bus.body) bus.body.style.transform = `rotate(${bus.heading}deg)`;
        }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    const buses = busesRef.current;
    return () => {
      cancelAnimationFrame(frame);
      buses.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [route]);

  // ---------------------------------------------------------------- avtobuslar
  const { buses } = props;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const now = performance.now();
    const seen = new Set<string>();

    for (const bus of buses) {
      seen.add(bus.id);
      const target = L.latLng(bus.pose.lat, bus.pose.lng);
      let entry = busesRef.current.get(bus.id);
      if (!entry) {
        const marker = L.marker(target, {
          icon: L.divIcon({
            className: "",
            iconSize: [0, 0],
            iconAnchor: [0, 0],
            html: `<div class="bus"><div class="bus-body" style="transform:rotate(${bus.pose.heading}deg)">${BUS_SVG}</div><div class="bus-label">${escapeHtml(bus.label)}</div></div>`,
          }),
          zIndexOffset: 500,
          keyboard: false,
        })
          .on("click", () => propsRef.current.onBusClick(bus.id))
          .addTo(map);
        const root = marker.getElement()?.firstElementChild as HTMLElement | null;
        entry = {
          marker,
          root,
          body: root?.querySelector(".bus-body") ?? null,
          from: target,
          to: target,
          current: target,
          fromHeading: bus.pose.heading,
          toHeading: bus.pose.heading,
          heading: bus.pose.heading,
          startedAt: now,
        };
        busesRef.current.set(bus.id, entry);
      } else if (!entry.to.equals(target) || entry.toHeading !== bus.pose.heading) {
        const jump = map.distance(entry.current, target) > 3000;
        entry.from = jump ? target : entry.current;
        entry.to = target;
        entry.fromHeading = entry.heading;
        entry.toHeading = bus.pose.heading;
        entry.startedAt = now;
      }
      entry.root?.classList.toggle("dim", bus.dimmed);
      entry.root?.classList.toggle("sel", bus.selected);
    }

    for (const [id, entry] of busesRef.current) {
      if (!seen.has(id)) {
        entry.marker.remove();
        busesRef.current.delete(id);
      }
    }
  }, [buses]);

  // ---------------------------------------------------------------- chiziq va bekat ajratilishi
  const { lineEmphasis, selectedStop } = props;
  useEffect(() => {
    lineRef.current?.setStyle({ opacity: lineEmphasis ? 0.95 : 0.55, weight: lineEmphasis ? 6 : 5 });
  }, [lineEmphasis]);

  useEffect(() => {
    stopsRef.current.forEach((marker, index) => {
      marker.getElement()?.firstElementChild?.classList.toggle("sel", index === selectedStop);
    });
  }, [selectedStop]);

  // ---------------------------------------------------------------- foydalanuvchi joyi
  const { userLocation } = props;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      userRef.current?.remove();
      userRef.current = null;
      return;
    }
    const at = L.latLng(userLocation.lat, userLocation.lng);
    if (userRef.current) userRef.current.setLatLng(at);
    else
      userRef.current = L.marker(at, {
        icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(map);
  }, [userLocation]);

  // ---------------------------------------------------------------- fokus
  const { focus } = props;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || focus.points.length === 0) return;
    const { insets } = propsRef.current;
    const bounds = L.latLngBounds(focus.points.map((p) => L.latLng(p.lat, p.lng)));
    map.flyToBounds(bounds, {
      paddingTopLeft: [40, insets.top + 16],
      paddingBottomRight: [40, insets.bottom + 40],
      maxZoom: focus.maxZoom,
      duration: 0.6,
    });
  }, [focus]);

  return <div ref={containerRef} className="transit-map" />;
}

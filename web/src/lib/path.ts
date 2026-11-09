/**
 * Yo'l geometriyasi ustidagi hisob-kitoblar.
 *
 * Avtobusning pozitsiyasi uzluksiz son (0 .. bekatlar_soni−1) sifatida
 * hisoblanadi. Bu modul shu sonni xaritadagi haqiqiy nuqtaga aylantiradi:
 * butun qismi qaysi oraliq ekanini, kasr qismi esa shu oraliqning necha
 * foizi bosib o'tilganini bildiradi.
 */
import type { GeoPoint, LatLngTuple, Route } from "@/types/route";
import { bearingDegrees, distanceMeters } from "@/lib/geo";

const toPoint = ([lat, lng]: LatLngTuple): GeoPoint => ({ lat, lng });

/**
 * `stops[index]` dan `stops[index+1]` gacha bo'lgan yo'l nuqtalari.
 *
 * Geometriya berilmagan bo'lsa (yoki bu oraliq uchun yetarli nuqta yo'q
 * bo'lsa) ikki bekat orasidagi to'g'ri chiziq qaytariladi — shu tufayli
 * ilova haqiqiy geometriyasiz ham to'liq ishlaydi.
 */
export function legPoints(route: Route, index: number): GeoPoint[] {
  const from = route.stops[index];
  const to = route.stops[index + 1];
  if (!from || !to) return [];

  const leg = route.geometry?.legs[index];
  if (leg && leg.length >= 2) return leg.map(toPoint);

  return [
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng },
  ];
}

/** Butun yo'nalish chizig'i — xaritada polyline sifatida chizish uchun. */
export function routePolyline(route: Route): GeoPoint[] {
  const points: GeoPoint[] = [];

  for (let index = 0; index < route.stops.length - 1; index += 1) {
    const leg = legPoints(route, index);
    // Oraliqlar bekatlarda tutashadi — takroriy nuqtani tashlab ketamiz.
    points.push(...(index === 0 ? leg : leg.slice(1)));
  }

  return points;
}

/**
 * Chiziq bo'ylab `ratio` (0..1) ulushiga to'g'ri keladigan nuqta.
 *
 * Taqsimot MASOFA bo'yicha, nuqtalar soni bo'yicha emas — aks holda
 * yo'lning burilishlari zich chizilgan joyida avtobus sekinlashib qolardi.
 */
export function interpolateAlongPath(points: readonly GeoPoint[], ratio: number): GeoPoint | null {
  if (points.length === 0) return null;
  const first = points[0]!;
  if (points.length === 1) return first;

  const segments: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const length = distanceMeters(points[i]!, points[i + 1]!);
    segments.push(length);
    total += length;
  }
  if (total === 0) return first;

  const clamped = Math.min(1, Math.max(0, ratio));
  let remaining = total * clamped;

  for (let i = 0; i < segments.length; i += 1) {
    const length = segments[i]!;
    if (remaining <= length || i === segments.length - 1) {
      const start = points[i]!;
      const end = points[i + 1]!;
      const t = length === 0 ? 0 : Math.min(1, remaining / length);
      return {
        lat: start.lat + (end.lat - start.lat) * t,
        lng: start.lng + (end.lng - start.lng) * t,
      };
    }
    remaining -= length;
  }

  return points[points.length - 1]!;
}

/**
 * Uzluksiz pozitsiyani (0 .. bekatlar_soni−1) xaritadagi nuqtaga aylantiradi.
 */
export function positionToPoint(route: Route, position: number): GeoPoint | null {
  const lastIndex = route.stops.length - 1;
  if (lastIndex < 0) return null;

  const clamped = Math.min(lastIndex, Math.max(0, position));
  const legIndex = Math.min(Math.floor(clamped), Math.max(0, lastIndex - 1));
  const ratio = clamped - legIndex;

  return interpolateAlongPath(legPoints(route, legIndex), ratio);
}

/** Xaritadagi joy va harakat yo'nalishi (azimut, gradus). */
export interface Pose extends GeoPoint {
  readonly heading: number;
}

/**
 * Pozitsiya va harakat yo'nalishidan xaritadagi joy va avtobus qaragan tomon.
 * `forward` — pozitsiya indeksi o'sadigan tomonga (qishloqdan shaharga) harakat.
 */
export function positionToPose(route: Route, position: number, forward: boolean): Pose | null {
  const here = positionToPoint(route, position);
  if (!here) return null;
  const lastIndex = route.stops.length - 1;
  const step = forward ? 0.02 : -0.02;
  const ahead = Math.min(lastIndex, Math.max(0, position + step));
  let from: GeoPoint = here;
  let to = positionToPoint(route, ahead);
  if (!to || (to.lat === here.lat && to.lng === here.lng)) {
    // Chiziq chetida — orqadagi nuqtadan hisoblaymiz
    const behind = positionToPoint(route, Math.min(lastIndex, Math.max(0, position - step)));
    if (behind) {
      from = behind;
      to = here;
    }
  }
  const heading = to && (to.lat !== from.lat || to.lng !== from.lng) ? bearingDegrees(from, to) : 0;
  return { ...here, heading };
}

/** Har bir bekatgacha yo'l bo'ylab masofa (metr), birinchi bekatdan boshlab. */
export function cumulativeStopDistances(route: Route): number[] {
  const result = [0];
  for (let index = 0; index < route.stops.length - 1; index += 1) {
    const leg = legPoints(route, index);
    let length = 0;
    for (let i = 0; i < leg.length - 1; i += 1) length += distanceMeters(leg[i]!, leg[i + 1]!);
    result.push(result[index]! + length);
  }
  return result;
}

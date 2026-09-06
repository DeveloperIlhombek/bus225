import type { GeoPoint, NearestStop, Stop } from "@/types/route";

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Ikki nuqta orasidagi masofa, metrda (haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Foydalanuvchiga eng yaqin bekat. Bekatlar bo'sh bo'lsa — null. */
export function findNearestStop(
  stops: readonly Stop[],
  location: GeoPoint | null,
): NearestStop | null {
  if (!location || stops.length === 0) return null;

  let best: NearestStop | null = null;
  for (const [index, stop] of stops.entries()) {
    const meters = distanceMeters(location, stop);
    if (!best || meters < best.distanceMeters) {
      best = { index, stop, distanceMeters: meters };
    }
  }
  return best;
}

/** Masofani odam o'qiy oladigan ko'rinishga keltiradi. */
export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

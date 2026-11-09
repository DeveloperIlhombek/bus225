/**
 * Foydalanuvchiga ko'rinadigan matnlar — sof funksiyalar.
 */
import type { Direction, Route } from "@/types/route";
import type { BusState } from "@/lib/fleet";
import { nextVisit, tripVisits } from "@/lib/fleet";
import { exactMinutesOfDay } from "@/lib/time";

/** `225-sonli "Siyob bozori - G'o'bdin"` → `Siyob bozori — G'o'bdin`. */
export function routeTitle(route: Route): string {
  const quoted = /"([^"]+)"/.exec(route.route_name)?.[1] ?? route.route_name;
  return quoted.replace(/\s+-\s+/g, " — ");
}

/** Yo'nalish oxiridagi bekat nomi. */
export function terminalName(route: Route, direction: Direction): string {
  const stop = direction === "shaharga" ? route.stops.at(-1) : route.stops[0];
  return stop?.name ?? "";
}

/** Daqiqani "HH:MM" ko'rinishiga keltiradi (sutka chegarasida aylanadi). */
export function clockOf(minute: number): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** O'zbekcha joy kelishigi: "Siyob bozori" → "Siyob bozorida". */
export const locative = (name: string): string => `${name.replace(/\s*\(.*\)$/, "")}da`;

/** Avtobus holati bir qatorda: "Shayman tomon · 07:50 da yetadi". */
export function busStatusText(route: Route, state: BusState, now: Date): string {
  const stopName = (index: number) => route.stops[index]?.name ?? "";

  if (state.status === "finished") {
    return `${locative(stopName(Math.round(state.position)))} · bugungi reyslar tugadi`;
  }
  if (state.status === "waiting") {
    const at = locative(stopName(Math.round(state.position)));
    return state.departsAt !== null ? `${at} turibdi · ${clockOf(state.departsAt)} da jo'naydi` : at;
  }
  const visit = state.trip ? nextVisit(state.trip, now) : null;
  if (!visit) return terminalName(route, state.direction);
  return `${stopName(visit.index)} tomon · ${clockOf(visit.minute)} da yetadi`;
}

/** Avtobusning o'rtacha tezligi (km/soat) hozirgi bekatlar oralig'ida. */
export function currentSpeedKmh(route: Route, state: BusState, now: Date, metersBetween: (a: number, b: number) => number): number {
  if (state.status !== "moving" || !state.trip) return 0;
  const current = exactMinutesOfDay(now);
  const visits = tripVisits(state.trip);
  for (let i = 0; i < visits.length - 1; i += 1) {
    const a = visits[i]!;
    const b = visits[i + 1]!;
    if (a.minute <= current && current <= b.minute && b.minute > a.minute) {
      return Math.round((metersBetween(a.index, b.index) / 1000 / (b.minute - a.minute)) * 60);
    }
  }
  return 0;
}

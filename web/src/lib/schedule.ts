/**
 * Jadval mantiqi — React'dan mustaqil sof funksiyalar.
 * Python tomondagi `bot/services/schedule.py` bilan bir xil algoritm.
 */
import type {
  ActiveBus,
  Departure,
  Direction,
  Route,
  TimeString,
  Trip,
} from "@/types/route";
import { minutesOfDay, parseTime } from "@/lib/time";

/** Uchrashuv chegarasi — chiziq uzunligining ulushi. Bot bilan bir xil. */
export const MEETING_THRESHOLD_RATIO = 0.06;

export const DIRECTIONS: readonly Direction[] = ["shaharga", "qishloqqa"] as const;

export const DIRECTION_LABEL: Record<Direction, string> = {
  shaharga: "Shaharga",
  qishloqqa: "Qishloqqa",
};

export function oppositeOf(direction: Direction): Direction {
  return direction === "shaharga" ? "qishloqqa" : "shaharga";
}

/** Reysdagi `null` bo'lmagan vaqtlar, bekat tartibida. */
function statedTimes(trip: Trip): TimeString[] {
  return trip.times.filter((time): time is TimeString => time !== null);
}

/**
 * Reys yo'nalishi. `stops` qishloqdan shaharga tartibda yozilgani uchun
 * vaqt index bo'yicha oshsa — shaharga, kamaysa — qishloqqa.
 * Aniqlab bo'lmasa (2 tadan kam vaqt) — null.
 */
export function tripDirection(trip: Trip): Direction | null {
  const stated = statedTimes(trip);
  if (stated.length < 2) return null;
  return stated[stated.length - 1]! > stated[0]! ? "shaharga" : "qishloqqa";
}

/**
 * Reysning uzluksiz pozitsiyasi (0 .. bekatlar_soni−1).
 * Hali boshlanmagan yoki tugagan bo'lsa — null.
 * Bitta formula ikkala yo'nalish uchun ham to'g'ri, chunki interpolyatsiya
 * vaqt oralig'i bo'yicha bajariladi.
 */
export function tripPosition(trip: Trip, now: Date): number | null {
  const current = minutesOfDay(now);

  for (let i = 0; i < trip.times.length - 1; i += 1) {
    const first = trip.times[i];
    const second = trip.times[i + 1];
    if (first == null || second == null) continue;

    const start = parseTime(first);
    const end = parseTime(second);
    if (start === end) continue;

    const low = Math.min(start, end);
    const high = Math.max(start, end);
    if (current < low || current > high) continue;

    return i + (current - start) / (end - start);
  }

  return null;
}

/** Qarama-qarshi yo'nalishdagi yaqin avtobuslarni juftlab belgilaydi. */
export function markMeetings(
  buses: readonly Omit<ActiveBus, "meetingWith">[],
  stopCount: number,
): ActiveBus[] {
  const threshold = (stopCount - 1) * MEETING_THRESHOLD_RATIO;
  const partners = new Map<string, string>();

  for (let i = 0; i < buses.length; i += 1) {
    for (let j = i + 1; j < buses.length; j += 1) {
      const a = buses[i]!;
      const b = buses[j]!;
      if (a.direction === b.direction) continue;
      if (Math.abs(a.position - b.position) <= threshold) {
        partners.set(a.busId, b.busId);
        partners.set(b.busId, a.busId);
      }
    }
  }

  return buses.map((bus) => ({ ...bus, meetingWith: partners.get(bus.busId) ?? null }));
}

/** Hozir yo'lda bo'lgan barcha avtobuslar. */
export function activeBuses(route: Route, now: Date): ActiveBus[] {
  const moving: Omit<ActiveBus, "meetingWith">[] = [];

  for (const trip of route.trips) {
    const direction = tripDirection(trip);
    const position = tripPosition(trip, now);
    if (direction === null || position === null) continue;
    moving.push({ busId: trip.bus_id, direction, position });
  }

  return markMeetings(moving, route.stops.length);
}

/** Bekatdagi barcha jo'nashlar, yo'nalish bo'yicha ajratilgan va tartiblangan. */
export function departuresAt(
  route: Route,
  stopIndex: number,
): Record<Direction, TimeString[]> {
  const result: Record<Direction, TimeString[]> = { shaharga: [], qishloqqa: [] };
  if (stopIndex < 0 || stopIndex >= route.stops.length) return result;

  for (const trip of route.trips) {
    const direction = tripDirection(trip);
    const time = trip.times[stopIndex];
    if (direction === null || time == null) continue;
    result[direction].push(time);
  }

  for (const times of Object.values(result)) {
    times.sort();
  }
  return result;
}

/** Bekatdagi keyingi jo'nashlar (har yo'nalishdan `limit` tadan). */
export function nextDeparturesAt(
  route: Route,
  stopIndex: number,
  now: Date,
  limit = 3,
): Record<Direction, Departure[]> {
  const current = minutesOfDay(now);
  const all = departuresAt(route, stopIndex);
  const result: Record<Direction, Departure[]> = { shaharga: [], qishloqqa: [] };

  for (const direction of DIRECTIONS) {
    result[direction] = all[direction]
      .map((time) => ({ time, direction, minutesAway: parseTime(time) - current }))
      .filter((departure) => departure.minutesAway >= 0)
      .slice(0, limit);
  }

  return result;
}

/** Bir yo'nalish bo'yicha bugungi birinchi reys (kun tugaganda ko'rsatiladi). */
export function firstDepartureOfDay(
  route: Route,
  stopIndex: number,
  direction: Direction,
): TimeString | null {
  return departuresAt(route, stopIndex)[direction][0] ?? null;
}

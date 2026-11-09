/**
 * Avtobuslar parki: har bir avtobus (1, 2, 3 ...) hozir qayerda va nima qilyapti.
 *
 * `schedule.ts` reyslar bilan ishlaydi; bu modul ularni `trip.bus` bo'yicha
 * avtobuslarga yig'adi. Shu tufayli reyslar orasida (masalan, Siyob bozorida
 * qaytish vaqtini kutib turganda) ham avtobus xaritada ko'rinadi.
 *
 * React'siz, sof funksiyalar — Node muhitida to'g'ridan-to'g'ri testlanadi.
 */
import type { Direction, Route, Trip } from "@/types/route";
import { tripDirection, tripPosition } from "@/lib/schedule";
import { exactMinutesOfDay, parseTime } from "@/lib/time";

export type BusStatus = "moving" | "waiting" | "finished";

export interface BusState {
  /** Avtobus raqami (yoki eski formatda reys kodi). */
  readonly bus: string;
  readonly status: BusStatus;
  /** 0 dan (bekatlar soni − 1) gacha uzluksiz pozitsiya. */
  readonly position: number;
  /** Harakat yoki keyingi harakat yo'nalishi. */
  readonly direction: Direction;
  /** Hozirgi reys (harakatda) yoki keyingi reys (kutayotgan bo'lsa). */
  readonly trip: Trip | null;
  /** Keyingi reys boshlanish vaqti, daqiqa (kutayotgan bo'lsa). */
  readonly departsAt: number | null;
}

/** Bekatdagi bitta o'tish (yoki oxirgi bekatga kelish). */
export interface StopVisit {
  readonly index: number;
  readonly minute: number;
}

/** Reysning bekatlari, harakat tartibida (`null` — to'xtamaydigan bekatlar tashlab ketiladi). */
export function tripVisits(trip: Trip): StopVisit[] {
  const visits: StopVisit[] = [];
  trip.times.forEach((time, index) => {
    if (time !== null) visits.push({ index, minute: parseTime(time) });
  });
  return tripDirection(trip) === "qishloqqa" ? visits.reverse() : visits;
}

export const tripStart = (trip: Trip): number => tripVisits(trip)[0]?.minute ?? 0;
export const tripEnd = (trip: Trip): number => tripVisits(trip).at(-1)?.minute ?? 0;

/** Reys qaysi avtobusga tegishli. Eski formatda (`bus` yo'q) har bir reys alohida. */
export const busKey = (trip: Trip): string => (trip.bus != null ? String(trip.bus) : trip.bus_id);

/** Avtobuslar ro'yxati va har birining reyslari (vaqt bo'yicha tartiblangan). */
export function tripsByBus(route: Route): Map<string, Trip[]> {
  const result = new Map<string, Trip[]>();
  for (const trip of route.trips) {
    if (tripDirection(trip) === null) continue;
    const key = busKey(trip);
    const list = result.get(key) ?? [];
    list.push(trip);
    result.set(key, list);
  }
  for (const list of result.values()) list.sort((a, b) => tripStart(a) - tripStart(b));
  return new Map([...result.entries()].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })));
}

/** Har bir avtobusning hozirgi holati. */
export function fleetState(route: Route, now: Date): BusState[] {
  const current = exactMinutesOfDay(now);
  const states: BusState[] = [];

  for (const [bus, trips] of tripsByBus(route)) {
    const active = trips.find((trip) => tripStart(trip) <= current && current <= tripEnd(trip));
    if (active) {
      const position = tripPosition(active, now);
      if (position !== null) {
        states.push({
          bus,
          status: "moving",
          position,
          direction: tripDirection(active)!,
          trip: active,
          departsAt: null,
        });
        continue;
      }
    }

    const next = trips.find((trip) => tripStart(trip) > current) ?? null;
    const previous = [...trips].reverse().find((trip) => tripEnd(trip) < current) ?? null;
    // Kutayotgan avtobus oxirgi reysi tugagan joyda (yoki ertalab — birinchi reys boshida) turadi
    const anchorTrip = previous ?? next;
    if (!anchorTrip) continue;
    const anchorVisit = previous ? tripVisits(previous).at(-1) : tripVisits(anchorTrip)[0];
    if (!anchorVisit) continue;

    states.push({
      bus,
      status: next ? "waiting" : "finished",
      position: anchorVisit.index,
      direction: tripDirection(next ?? anchorTrip)!,
      trip: next,
      departsAt: next ? tripStart(next) : null,
    });
  }

  return states;
}

/** Reysdagi keyingi bekat (hozirgi vaqtdan keyin birinchi). */
export function nextVisit(trip: Trip, now: Date): StopVisit | null {
  const current = exactMinutesOfDay(now);
  return tripVisits(trip).find((visit) => visit.minute >= current) ?? null;
}

/** Bekatdan keyingi o'tishlar — barcha avtobuslar bo'yicha. */
export interface UpcomingVisit {
  readonly trip: Trip;
  readonly bus: string;
  readonly direction: Direction;
  readonly minute: number;
  /** Bekat bu reys uchun oxirgi — ya'ni avtobus bu yerga keladi va to'xtaydi. */
  readonly isArrival: boolean;
}

export function upcomingAtStop(
  route: Route,
  stopIndex: number,
  now: Date,
  limit = 8,
): UpcomingVisit[] {
  const current = exactMinutesOfDay(now);
  const result: UpcomingVisit[] = [];

  for (const trip of route.trips) {
    const direction = tripDirection(trip);
    const time = trip.times[stopIndex];
    if (direction === null || time == null) continue;
    const minute = parseTime(time);
    if (minute < current - 0.5) continue;
    const visits = tripVisits(trip);
    result.push({
      trip,
      bus: busKey(trip),
      direction,
      minute,
      isArrival: visits.at(-1)?.index === stopIndex,
    });
  }

  return result.sort((a, b) => a.minute - b.minute).slice(0, limit);
}

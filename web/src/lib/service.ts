/**
 * Kunga qarab jadval tanlash: ish kunlari, yakshanba, bayramlar.
 */
import type { Route, Timetable } from "@/types/route";

/** Shahar soatidagi sana → "YYYY-MM-DD" va hafta kuni (0 — dushanba). */
function dayInfo(cityNow: Date): { iso: string; weekday: number } {
  const iso = `${cityNow.getFullYear()}-${String(cityNow.getMonth() + 1).padStart(2, "0")}-${String(cityNow.getDate()).padStart(2, "0")}`;
  return { iso, weekday: (cityNow.getDay() + 6) % 7 };
}

export function timetables(route: Route): readonly Timetable[] {
  return route.timetables ?? (route.timetable ? [route.timetable] : []);
}

/** Bugun ishlaydigan jadval (bayramda — yakshanbaniki). */
export function timetableFor(route: Route, cityNow: Date): Timetable | null {
  const all = timetables(route);
  if (all.length === 0) return null;
  const { iso, weekday } = dayInfo(cityNow);
  const day = route.holidays?.includes(iso) ? 6 : weekday;
  return all.find((t) => t.days?.includes(day)) ?? all[0]!;
}

/** Faqat bugungi reyslar qoldirilgan yo'nalish. */
export function routeForDay(route: Route, cityNow: Date): Route {
  const table = timetableFor(route, cityNow);
  if (!table?.id) return route;
  return {
    ...route,
    trips: route.trips.filter((trip) => !trip.service || trip.service === table.id),
    timetable: table,
  };
}

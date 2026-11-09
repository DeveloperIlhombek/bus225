/**
 * `data/route.json` faylining tiplari.
 * Python tomondagi `bot/models.py` bilan bir xil tuzilishni ifodalaydi.
 */

/** "HH:MM" formatidagi vaqt. `null` — avtobus bu bekatda to'xtamaydi. */
export type TimeString = string;
export type OptionalTime = TimeString | null;

export type Direction = "shaharga" | "qishloqqa";

export interface Stop {
  /** Barqaror identifikator (masalan, "siyob"). */
  readonly id?: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

export interface Trip {
  /** Reysning noyob kodi, masalan "04S" — 4-qator, shaharga. */
  readonly bus_id: string;
  /** Reysni bajaradigan avtobus raqami (1, 2, 3 ...). */
  readonly bus?: number;
  /** Qaysi jadvalga tegishli ("weekday", "sunday"). Yo'q bo'lsa — har kuni. */
  readonly service?: string;
  /** `stops` bilan bir xil uzunlik va tartibda. */
  readonly times: readonly OptionalTime[];
}

/** [kenglik, uzunlik] — GeoJSON'dan farqli o'laroq lat birinchi (Leaflet tartibi). */
export type LatLngTuple = readonly [lat: number, lng: number];

/**
 * Yo'lning haqiqiy geometriyasi.
 *
 * `legs[i]` — `stops[i]` dan `stops[i+1]` gacha bo'lgan yo'l nuqtalari,
 * ya'ni uzunligi doimo `stops.length - 1` ga teng. Geometriya bir marta
 * hisoblanib faylga yoziladi, shuning uchun ilova ishlayotganda hech qanday
 * routing API yoki kalit kerak emas.
 *
 * Maydon ixtiyoriy: bo'lmasa bekatlar to'g'ri chiziq bilan bog'lanadi.
 */
export interface RouteGeometry {
  readonly legs: readonly (readonly LatLngTuple[])[];
}

/** Plakatdagi jadval ustuni: qaysi bekatdan qaysi tomonga jo'nash vaqti. */
export interface TimetableColumn {
  readonly stop: number;
  readonly direction: Direction;
  readonly label: string;
}

/** Plakatdagi bitta qator — bitta aylanma reys. */
export interface TimetableRow {
  readonly bus: number;
  readonly cells: readonly (string | null)[];
}

export interface Timetable {
  readonly id?: string;
  readonly label?: string;
  /** Hafta kunlari: 0 — dushanba … 6 — yakshanba. */
  readonly days?: readonly number[];
  readonly buses?: number;
  readonly columns: readonly TimetableColumn[];
  readonly rows: readonly TimetableRow[];
}

export interface Route {
  readonly route_id: string;
  readonly route_name: string;
  readonly telegram_group?: string;
  /** Shahar vaqt mintaqasi (Toshkent — 5). Jadval shu vaqt bo'yicha. */
  readonly timezone_offset_hours?: number;
  /** Yo'nalishdagi avtobuslar soni. */
  readonly buses?: number;
  readonly stops: readonly Stop[];
  readonly trips: readonly Trip[];
  /** Eski format: bitta jadval. */
  readonly timetable?: Timetable;
  /** Bir nechta jadval: ish kunlari, yakshanba ... */
  readonly timetables?: readonly Timetable[];
  /** Yakshanba jadvali ishlaydigan bayram kunlari, "YYYY-MM-DD". */
  readonly holidays?: readonly string[];
  readonly geometry?: RouteGeometry;
}

/** Ayni damda yo'lda bo'lgan avtobus. */
export interface ActiveBus {
  readonly busId: string;
  readonly direction: Direction;
  /** 0 dan (bekatlar soni − 1) gacha uzluksiz qiymat. */
  readonly position: number;
  /** Qarama-qarshi yo'nalishdagi yaqin avtobusning id'si. */
  readonly meetingWith: string | null;
}

/** Bir bekatdagi bitta jo'nash. */
export interface Departure {
  readonly time: TimeString;
  readonly direction: Direction;
  readonly minutesAway: number;
}

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export interface NearestStop {
  readonly index: number;
  readonly stop: Stop;
  readonly distanceMeters: number;
}

/**
 * `data/route.json` faylining tiplari.
 * Python tomondagi `bot/models.py` bilan bir xil tuzilishni ifodalaydi.
 */

/** "HH:MM" formatidagi vaqt. `null` — avtobus bu bekatda to'xtamaydi. */
export type TimeString = string;
export type OptionalTime = TimeString | null;

export type Direction = "shaharga" | "qishloqqa";

export interface Stop {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

export interface Trip {
  readonly bus_id: string;
  /** `stops` bilan bir xil uzunlik va tartibda. */
  readonly times: readonly OptionalTime[];
}

export interface Route {
  readonly route_id: string;
  readonly route_name: string;
  readonly telegram_group?: string;
  readonly stops: readonly Stop[];
  readonly trips: readonly Trip[];
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

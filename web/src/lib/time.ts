import type { TimeString } from "@/types/route";

/** "HH:MM" -> yarim tundan boshlab o'tgan daqiqa. Noto'g'ri qiymatda xato. */
export function parseTime(value: TimeString): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new TypeError(`Vaqt formati noto'g'ri: "${value}" ("HH:MM" kutilgan)`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new RangeError(`Vaqt chegaradan tashqarida: "${value}"`);
  }
  return hours * 60 + minutes;
}

/** Sana obyektidan yarim tundan boshlab o'tgan daqiqa. */
export function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Daqiqani "1 soat 15 daqiqa" ko'rinishida o'zbekcha yozadi. */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "hozir";
  if (totalMinutes < 60) return `${totalMinutes} daqiqa`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} soat` : `${hours} soat ${minutes} daqiqa`;
}

export function formatClock(now: Date): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

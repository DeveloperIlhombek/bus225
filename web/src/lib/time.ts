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

/** Sana obyektidan yarim tundan boshlab o'tgan butun daqiqa. */
export function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Soniyalari bilan aniq daqiqa (masalan 8:15:30 → 495.5).
 * Avtobuslar xaritada daqiqa ichida ham silliq siljishi uchun kerak.
 */
export function exactMinutesOfDay(now: Date): number {
  return (
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60_000
  );
}

/**
 * Shahar vaqtidagi "soat" — qurilmaning vaqt mintaqasidan qat'i nazar.
 *
 * Qaytgan Date obyektining `getHours()`/`getMinutes()` qiymatlari shahar
 * (masalan, Toshkent, UTC+5) vaqtini ko'rsatadi. Shu tufayli jadval
 * funksiyalari o'zgarishsiz qoladi, foydalanuvchi telefoni boshqa mintaqaga
 * sozlangan bo'lsa ham avtobuslar to'g'ri joyda ko'rinadi.
 */
export function cityClock(utcOffsetHours: number, epochMs: number = Date.now()): Date {
  const deviceOffsetMinutes = new Date(epochMs).getTimezoneOffset(); // UTC − mahalliy
  return new Date(epochMs + (utcOffsetHours * 60 + deviceOffsetMinutes) * 60_000);
}

/** Daqiqani "1 soat 15 daqiqa" ko'rinishida o'zbekcha yozadi. */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "hozir";
  if (totalMinutes < 60) return `${totalMinutes} daqiqa`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} soat` : `${hours} soat ${minutes} daqiqa`;
}

/** Qisqa ko'rinish: "hozir", "7 daq", "1 soat 5 daq". */
export function formatShortDuration(totalMinutes: number): string {
  const m = Math.round(totalMinutes);
  if (m <= 0) return "hozir";
  if (m < 60) return `${m} daq`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${hours} soat` : `${hours} soat ${rest} daq`;
}

export function formatClock(now: Date): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

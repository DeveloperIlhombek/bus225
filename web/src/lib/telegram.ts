/**
 * Telegram Mini App SDK ustidagi ingichka, tipizatsiyalangan qatlam.
 *
 * SDK skript sifatida yuklanadi va brauzerda (Telegram'dan tashqarida)
 * umuman mavjud bo'lmaydi — shu sabab har bir chaqiruv himoyalangan.
 */

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  readonly colorScheme: "light" | "dark";
  readonly themeParams: TelegramThemeParams;
  readonly initDataUnsafe?: { user?: { first_name?: string } };
  setHeaderColor?(color: string): void;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export const isInsideTelegram = (): boolean => getWebApp() !== null;

/** Mini App'ni to'liq ekranga ochadi va tayyor deb belgilaydi. */
export function initTelegram(): TelegramWebApp | null {
  const webApp = getWebApp();
  if (!webApp) return null;

  webApp.ready();
  webApp.expand();
  return webApp;
}

/** Yengil taktil javob — tugma bosilganda. */
export function hapticTap(): void {
  getWebApp()?.HapticFeedback?.impactOccurred("light");
}

/*
 * SDK skript sifatida asinxron yuklanadi, ya'ni u React uchun tashqi manba.
 * Quyidagi kichik obuna mexanizmi `useSyncExternalStore` ga skript yuklanib
 * bo'lganini bildiradi — shu tufayli hidratsiya paytida DOM o'zgarmaydi va
 * server bilan klient HTML'i bir xil bo'ladi.
 */
const listeners = new Set<() => void>();

export function subscribeToTelegram(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Skript yuklangach chaqiriladi — obunachilarni xabardor qiladi. */
export function notifyTelegramLoaded(): void {
  for (const listener of listeners) listener();
}

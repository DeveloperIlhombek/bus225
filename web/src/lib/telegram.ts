/**
 * Telegram Mini App SDK ustidagi ingichka, tipizatsiyalangan qatlam.
 *
 * SDK skript sifatida yuklanadi va brauzerda (Telegram'dan tashqarida)
 * `initData` bo'sh bo'ladi — shu sabab har bir chaqiruv himoyalangan.
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

interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

interface TelegramLocationData {
  latitude: number;
  longitude: number;
}

interface TelegramLocationManager {
  readonly isInited: boolean;
  readonly isLocationAvailable: boolean;
  readonly isAccessRequested: boolean;
  readonly isAccessGranted: boolean;
  init(callback?: () => void): void;
  getLocation(callback: (data: TelegramLocationData | null) => void): void;
  openSettings(): void;
}

export interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  readonly initData: string;
  readonly platform: string;
  readonly version: string;
  readonly colorScheme: "light" | "dark";
  readonly themeParams: TelegramThemeParams;
  readonly initDataUnsafe?: { user?: { first_name?: string } };
  isVersionAtLeast?(version: string): boolean;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
  readonly BackButton?: TelegramBackButton;
  readonly LocationManager?: TelegramLocationManager;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy"): void;
    selectionChanged(): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** SDK — faqat haqiqatan Telegram ichida ochilganda (aks holda null). */
export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  const webApp = window.Telegram?.WebApp;
  return webApp && webApp.initData ? webApp : null;
}

export const isInsideTelegram = (): boolean => getWebApp() !== null;

const atLeast = (webApp: TelegramWebApp, version: string): boolean =>
  webApp.isVersionAtLeast?.(version) ?? false;

/** Ishlamasa jim o'tib ketadigan chaqiruv — eski Telegram versiyalari uchun. */
function attempt(action: () => void): void {
  try {
    action();
  } catch {
    /* bu versiyada mavjud emas */
  }
}

/**
 * Mini App'ni sozlaydi: to'liq balandlik, oq sarlavha, xaritani pastga
 * surganda ilova yopilib qolmasligi, telefonda — to'liq ekran.
 */
export function initTelegram(): TelegramWebApp | null {
  const webApp = getWebApp();
  if (!webApp) return null;

  webApp.ready();
  webApp.expand();
  if (atLeast(webApp, "6.1")) {
    attempt(() => webApp.setHeaderColor?.("#ffffff"));
    attempt(() => webApp.setBackgroundColor?.("#ffffff"));
  }
  if (atLeast(webApp, "7.10")) attempt(() => webApp.setBottomBarColor?.("#ffffff"));
  if (atLeast(webApp, "7.7")) attempt(() => webApp.disableVerticalSwipes?.());
  const isPhone = webApp.platform === "android" || webApp.platform === "ios";
  if (isPhone && atLeast(webApp, "8.0") && !window.location.search.includes("nofs")) {
    attempt(() => webApp.requestFullscreen?.());
  }
  return webApp;
}

/** Yengil taktil javob — tugma bosilganda. */
export function hapticTap(): void {
  attempt(() => getWebApp()?.HapticFeedback?.selectionChanged());
}

/** Telegram'ning tizim "Orqaga" tugmasi. */
export function setBackButton(visible: boolean, onClick: () => void): () => void {
  const button = getWebApp()?.BackButton;
  if (!button) return () => {};
  if (visible) {
    button.onClick(onClick);
    button.show();
  } else {
    button.hide();
  }
  return () => button.offClick(onClick);
}

/**
 * Telegram 8.0+ joylashuv menejeri orqali joylashuv (ruxsat Telegram ichida
 * so'raladi). Mavjud bo'lmasa `null` — chaqiruvchi brauzer geolokatsiyasiga o'tadi.
 */
export function telegramLocation(): Promise<TelegramLocationData | null> | null {
  const webApp = getWebApp();
  const manager = webApp?.LocationManager;
  if (!webApp || !manager || !atLeast(webApp, "8.0")) return null;

  return new Promise((resolve) => {
    const read = () => {
      if (!manager.isLocationAvailable) return resolve(null);
      manager.getLocation((data) => {
        if (!data && manager.isAccessRequested && !manager.isAccessGranted) {
          attempt(() => manager.openSettings());
        }
        resolve(data);
      });
    };
    if (manager.isInited) read();
    else manager.init(read);
  });
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

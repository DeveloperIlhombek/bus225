"use client";

import { useSyncExternalStore } from "react";
import type { TelegramWebApp } from "@/lib/telegram";
import { getWebApp, subscribeToTelegram } from "@/lib/telegram";

interface TelegramState {
  readonly webApp: TelegramWebApp | null;
  readonly colorScheme: "light" | "dark";
  readonly isInsideTelegram: boolean;
}

/**
 * Telegram Mini App SDK'si holati.
 *
 * SDK <TelegramScript /> tomonidan hidratsiyadan keyin yuklanadi, shuning
 * uchun u tashqi manba sifatida obuna orqali o'qiladi. Oddiy brauzerda
 * `webApp` doimo null bo'ladi — sahifa baribir to'liq ishlaydi.
 */
export function useTelegram(): TelegramState {
  const webApp = useSyncExternalStore(subscribeToTelegram, getWebApp, () => null);

  return {
    webApp,
    colorScheme: webApp?.colorScheme ?? "light",
    isInsideTelegram: webApp !== null,
  };
}

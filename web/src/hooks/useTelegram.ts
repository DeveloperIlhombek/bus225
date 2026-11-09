"use client";

import { useSyncExternalStore } from "react";
import type { TelegramWebApp } from "@/lib/telegram";
import { getWebApp, subscribeToTelegram } from "@/lib/telegram";

/**
 * Telegram Mini App SDK'si (Telegram'dan tashqarida — null).
 * SDK hidratsiyadan keyin yuklanadi, shuning uchun obuna orqali o'qiladi.
 */
export function useTelegram(): TelegramWebApp | null {
  return useSyncExternalStore(subscribeToTelegram, getWebApp, () => null);
}

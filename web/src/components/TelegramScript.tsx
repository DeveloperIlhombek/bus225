"use client";

import Script from "next/script";
import { initTelegram, notifyTelegramLoaded } from "@/lib/telegram";

/**
 * Telegram Mini App SDK'sini yuklaydi.
 *
 * `afterInteractive` ataylab tanlangan: SDK <html> elementiga o'zining
 * --tg-viewport-* uslublarini qo'shadi, va agar bu hidratsiyadan OLDIN
 * sodir bo'lsa, React server HTML'i bilan farqni aniqlab ogohlantiradi.
 * Keyin yuklanganda esa hech qanday nomuvofiqlik bo'lmaydi.
 */
export function TelegramScript() {
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onLoad={() => {
        initTelegram();
        notifyTelegramLoaded();
      }}
    />
  );
}

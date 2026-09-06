"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage — React'dan tashqaridagi manba, shuning uchun u obuna orqali
 * o'qiladi. Serverda va gidratsiya paytida `null` qaytadi, ya'ni server bilan
 * klient HTML'i bir xil bo'ladi va faqat shundan keyin saqlangan qiymat
 * qo'llanadi.
 *
 * Bir sahifadagi bir nechta komponent bir xil kalitni kuzatishi mumkin, shu
 * sabab o'zgarish qo'lda e'lon qilinadi — brauzerning `storage` hodisasi
 * faqat BOSHQA yorliqlarda ishlaydi.
 */
const listeners = new Map<string, Set<() => void>>();

function notify(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener();
}

export function usePersistedString(key: string): [string | null, (value: string) => void] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let forKey = listeners.get(key);
      if (!forKey) {
        forKey = new Set();
        listeners.set(key, forKey);
      }
      forKey.add(onStoreChange);
      window.addEventListener("storage", onStoreChange);

      return () => {
        forKey.delete(onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    [key],
  );

  // Maxfiy rejim yoki o'chirilgan saqlash — o'qish ham, yozish ham xato berishi mumkin.
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const setValue = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // Saqlab bo'lmasa ham ilova ishlashda davom etadi.
      }
      notify(key);
    },
    [key],
  );

  return [value, setValue];
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute } from "@/hooks/useRoute";
import { useTelegram } from "@/hooks/useTelegram";
import { distanceMeters } from "@/lib/geo";
import { API_URL, driverRequest } from "@/lib/live";
import { hapticTap } from "@/lib/telegram";

interface Me {
  readonly user_id: number;
  readonly is_driver: boolean;
  readonly buses: readonly number[];
}

/** Joylashuv shu oraliqdan tez-tez yuborilmaydi (trafik va batareya). */
const SEND_EVERY_MS = 5000;
const BUS_KEY = "bus225:driver-bus";

type Sharing = "off" | "starting" | "on" | "denied";

function readStoredBus(): number | null {
  try {
    const value = Number(window.localStorage.getItem(BUS_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Haydovchi / pul teruvchi paneli (Telegram ichida /driver/).
 *
 * Ochiq turganda telefon GPS'ini har 5 soniyada serverga yuboradi va ekranni
 * o'chirmaydi. Panel yopilsa — Telegram'ning "jonli joylashuv"i ishlayveradi.
 * Zaxira: bekat tugmalari — bosilganda avtobus o'sha bekatga qo'yiladi va
 * guruhga xabar ketadi.
 */
export function DriverScreen() {
  const telegram = useTelegram();
  const { route } = useRoute();
  const initData = telegram?.initData ?? "";

  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bus, setBus] = useState<number | null>(null);
  const [sharing, setSharing] = useState<Sharing>("off");
  const [lastSent, setLastSent] = useState<{ at: number; accuracy: number; lat: number; lng: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const watchRef = useRef<number | null>(null);
  const lastSendRef = useRef(0);
  const wakeRef = useRef<{ release(): Promise<void> } | null>(null);

  // ---------------------------------------------------------------- kim ekanini bilish
  useEffect(() => {
    if (!initData || !API_URL) return;
    driverRequest<Me>("/api/driver/me", initData)
      .then((data) => {
        setMe(data);
        const stored = readStoredBus();
        setBus(stored && data.buses.includes(stored) ? stored : (data.buses.length === 1 ? data.buses[0]! : null));
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Xato"));
  }, [initData]);

  const chooseBus = (value: number) => {
    hapticTap();
    setBus(value);
    try {
      window.localStorage.setItem(BUS_KEY, String(value));
    } catch {
      /* saqlanmasa ham ishlaydi */
    }
  };

  // ---------------------------------------------------------------- GPS
  const stopSharing = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    void wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
    setSharing("off");
  }, []);

  const startSharing = useCallback(async () => {
    if (bus === null || !("geolocation" in navigator)) return;
    hapticTap();
    setSharing("starting");
    try {
      const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
      wakeRef.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      /* ekran o'chishi mumkin — Telegram jonli joylashuvi baribir ishlaydi */
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setSharing("on");
        const now = Date.now();
        if (now - lastSendRef.current < SEND_EVERY_MS) return;
        lastSendRef.current = now;
        const { latitude, longitude, heading, speed, accuracy } = position.coords;
        driverRequest("/api/driver/location", initData, {
          bus,
          lat: latitude,
          lng: longitude,
          heading: heading !== null && !Number.isNaN(heading) ? heading : null,
          speed: speed ?? null,
        })
          .then(() => setLastSent({ at: now, accuracy, lat: latitude, lng: longitude }))
          .catch((caught: unknown) => setNotice(caught instanceof Error ? caught.message : "Yuborilmadi"));
      },
      (failure) => {
        setSharing(failure.code === 1 ? "denied" : "off");
        if (failure.code !== 1) setNotice("GPS topilmadi — ochiq joyga chiqing");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20_000 },
    );
  }, [bus, initData]);

  useEffect(() => stopSharing, [stopSharing]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const markStop = async (index: number) => {
    if (bus === null) return;
    hapticTap();
    try {
      await driverRequest("/api/driver/stop", initData, { bus, stop: index });
      setNotice(`✅ ${route?.stops[index]?.name} belgilandi`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Yuborilmadi");
    }
  };

  const finish = async () => {
    if (bus === null) return;
    stopSharing();
    try {
      await driverRequest("/api/driver/finish", initData, { bus });
      setNotice("Reys tugatildi — xaritada avtobus yana jadval bo'yicha ko'rinadi");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Xato");
    }
  };

  // ---------------------------------------------------------------- render
  const nearestStop =
    route && lastSent
      ? route.stops
          .map((stop, index) => ({ index, meters: distanceMeters(lastSent, stop) }))
          .sort((a, b) => a.meters - b.meters)[0]
      : null;

  if (!API_URL) return <Message emoji="⚙️" title="Server manzili sozlanmagan" text="NEXT_PUBLIC_API_URL kerak." />;
  if (!telegram)
    return <Message emoji="✈️" title="Telegram orqali oching" text="Haydovchi paneli faqat bot ichida ishlaydi: /haydovchi" />;
  if (error) return <Message emoji="⚠️" title="Ulanib bo'lmadi" text={error} />;
  if (!me) return <Message emoji="⏳" title="Yuklanmoqda…" />;
  if (!me.is_driver)
    return (
      <Message
        emoji="🔒"
        title="Siz haydovchilar ro'yxatida yo'qsiz"
        text={`Telegram ID: ${me.user_id}. Shu raqamni adminga yuboring.`}
      />
    );

  return (
    <main className="driver">
      <header className="driver-head">
        <h1>🚌 Haydovchi paneli</h1>
        <p>225 · Siyob bozori — G&apos;o&apos;bdin</p>
      </header>

      <section className="driver-card">
        <div className="section-title">Avtobus</div>
        <div className="bus-pick">
          {me.buses.map((value) => (
            <button
              key={value}
              type="button"
              className={value === bus ? "pick sel" : "pick"}
              onClick={() => chooseBus(value)}
              disabled={sharing === "on"}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      <section className="driver-card">
        {sharing === "on" || sharing === "starting" ? (
          <>
            <div className="share-status on">
              <span className="dot" /> Joylashuv yuborilmoqda
            </div>
            <p className="muted">
              {lastSent
                ? `Oxirgi: ${new Date(lastSent.at).toLocaleTimeString("uz-UZ")} · aniqlik ±${Math.round(lastSent.accuracy)} m`
                : "GPS qidirilmoqda…"}
              {nearestStop && nearestStop.meters < 400 ? ` · ${route?.stops[nearestStop.index]?.name} yonida` : ""}
            </p>
            <button type="button" className="big secondary" onClick={stopSharing}>
              ⏸ To&apos;xtatish
            </button>
          </>
        ) : (
          <>
            <button type="button" className="big" disabled={bus === null} onClick={() => void startSharing()}>
              ▶ Reysni boshlash
            </button>
            <p className="muted">
              {sharing === "denied"
                ? "Joylashuvga ruxsat berilmadi — telefon sozlamalarida Telegram'ga ruxsat bering."
                : bus === null
                  ? "Avval avtobusni tanlang."
                  : "Panel ochiq turganda joylashuv har 5 soniyada yuboriladi, ekran o'chmaydi."}
            </p>
          </>
        )}
        <p className="tip">
          💡 Panelni yopsangiz ham ishlashi uchun botda 📎 → Joylashuv → <b>Jonli joylashuvni ulashish (8 soat)</b>.
        </p>
      </section>

      <section className="driver-card">
        <div className="section-title">Bekatda turibman (zaxira)</div>
        <div className="stop-grid">
          {route?.stops.map((stop, index) => (
            <button
              key={stop.name}
              type="button"
              className={nearestStop?.index === index && nearestStop.meters < 400 ? "stop-btn near" : "stop-btn"}
              disabled={bus === null}
              onClick={() => void markStop(index)}
            >
              {stop.name}
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="big danger" disabled={bus === null} onClick={() => void finish()}>
        ⏹ Reysni tugatish
      </button>

      <div className={notice ? "toast show" : "toast"} role="status">
        {notice}
      </div>
    </main>
  );
}

function Message({ emoji, title, text }: { emoji: string; title: string; text?: string }) {
  return (
    <main className="fatal">
      <p className="fatal-emoji">{emoji}</p>
      <h1>{title}</h1>
      {text ? <p>{text}</p> : null}
    </main>
  );
}

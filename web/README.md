# Bus 225 — Mini App (Next.js 16)

225-yo'nalish avtobuslarining jadval bo'yicha jonli xaritasi. Telegram Mini App
sifatida ham, oddiy brauzerda ham ishlaydi.

## Ishga tushirish

```bash
npm install
npm run dev          # http://localhost:3000/?t=07:30
```

`predev`/`prebuild` skripti `../data/route.json` ni `public/route.json` ga
ko'chiradi — ma'lumot manbai bitta.

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Lokal server |
| `npm run build` | Statik eksport → `out/` (GitHub Pages uchun `BASE_PATH=/bus225`) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Vitest — `lib/` dagi sof mantiq |

## Struktura

```
src/
├── app/                      layout, sahifa, xato ekranlari
├── components/
│   ├── TransitScreen.tsx     yagona ekran: holat, navigatsiya, sarlavha, tugmalar
│   ├── TransitMap.tsx        Leaflet xarita: burilgan avtobuslar, silliq harakat
│   ├── sheets.tsx            pastki panel: bosh sahifa, qidiruv, bekat, avtobus, jadval
│   └── ui.tsx                kichik ko'rinish bloklari
├── hooks/                    useRoute, useCityClock, useLocate, useTelegram
├── lib/                      sof mantiq (React'siz, to'liq testlangan)
│   ├── schedule.ts           reyslar: yo'nalish, pozitsiya, jo'nashlar
│   ├── fleet.ts              avtobuslar: harakatda / bekatda kutmoqda / kun tugadi
│   ├── path.ts               pozitsiya → xaritadagi nuqta va yo'nalish (azimut)
│   ├── describe.ts           foydalanuvchi matnlari
│   ├── time.ts, geo.ts       vaqt (Toshkent), masofa
│   └── telegram.ts           Telegram SDK: to'liq ekran, Orqaga tugmasi, joylashuv
└── types/route.ts            route.json tiplari
```

## Muhim qarorlar

* **Vaqt — shahar vaqti.** `useCityClock` qurilma mintaqasidan qat'i nazar
  Toshkent vaqtini beradi (`route.json` → `timezone_offset_hours`).
* **Silliq harakat.** Pozitsiya har soniyada (soniyalari bilan) hisoblanadi,
  `TransitMap` esa ikki holat orasini har kadrda to'ldiradi va avtobusni yo'l
  yo'nalishiga buradi. Leaflet bevosita boshqariladi — har kadrda React
  render bo'lmaydi.
* **Kutayotgan avtobuslar ham ko'rinadi.** `fleet.ts` reyslarni `trip.bus`
  bo'yicha yig'adi: reyslar orasida avtobus oxirgi bekatda turadi va keyingi
  yuradigan tomonga qaraydi.
* **Xarita** — OpenStreetMap (kalitsiz). Ranglar CSS'da yumshatilgan
  (`.tiles-soft`). Atribut majburiy.
* **Telegram** — to'liq ekran (Bot API 8.0+, telefonda), xaritani surganda
  ilova yopilmaydi (`disableVerticalSwipes`), tizim "Orqaga" tugmasi, joylashuv
  Telegram'ning `LocationManager` orqali.

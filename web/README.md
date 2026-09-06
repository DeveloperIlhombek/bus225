# Bus 225 — Mini App (Next.js 16.2)

225-yo'nalish avtobuslarining jonli holati. Telegram Mini App sifatida ham,
oddiy brauzerda ham ishlaydi.

## Ishga tushirish

```bash
npm install
npm run dev
```

`predev` skripti `../data/route.json` ni `public/route.json` ga ko'chiradi —
loyihada yagona ma'lumot manbai shu tufayli saqlanadi.

## Buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Lokal server (http://localhost:3000) |
| `npm run build` | Statik eksport → `out/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (sof mantiq testlari) |

## Struktura

```
src/
├── app/          Next.js App Router — layout, sahifa, xato ekranlari
├── components/   Ko'rinish qatlami (holatsiz, prop qabul qiladi)
├── hooks/        React holati: route, vaqt, geolokatsiya, Telegram
├── lib/          Sof mantiq — React'siz, to'liq testlangan
└── types/        route.json tiplari
```

Muhim qoida: `lib/` ichida React ham, brauzer API'lari ham yo'q. Shu sabab
u to'g'ridan-to'g'ri Node muhitida testlanadi va Python tomondagi
`bot/services/schedule.py` bilan bir xil algoritmni takrorlaydi.

## Xarita

Ikki ko'rinish bor, foydalanuvchi 🗺/📊 tugmasi bilan almashtiradi va tanlovi
`localStorage` da saqlanadi:

- **Sxematik** (`RouteMap.tsx`) — gorizontal chiziq, SVG. Yengil, tashqi
  so'rovsiz darhol chiziladi. Gidratsiyagacha ham shu ko'rsatiladi.
- **Haqiqiy xarita** (`LeafletRouteMap.tsx`) — Leaflet + OpenStreetMap.

**Nega OpenStreetMap:** kalit ham, hisob ham, karta ham talab qilmaydi —
Google, Mapbox va boshqalardan farqli o'laroq haqiqatan tekin. Tile manzili
`LeafletRouteMap.tsx` ning boshida bitta konstantada; trafik ortsa boshqa
provayderga almashtirish bir qatorlik o'zgarish. Atribut ko'rsatish OSM
shartlariga ko'ra majburiy.

Leaflet DOM'ga bevosita murojaat qiladi, shuning uchun `MapPanel.tsx` uni
`next/dynamic` bilan `ssr: false` rejimida yuklaydi — statik eksport buzilmaydi
va foydalanuvchi sxemani tanlagan bo'lsa Leaflet umuman yuklanmaydi.

Avtobusning xaritadagi joyi `lib/path.ts` orqali hisoblanadi: uzluksiz
pozitsiya (0 .. bekatlar_soni−1) yo'l chizig'idagi nuqtaga aylantiriladi.
Taqsimot masofa bo'yicha, nuqtalar soni bo'yicha emas — aks holda yo'l zich
chizilgan burilishlarda avtobus sekinlashib qolardi.

## Deploy (statik)

```bash
# Ildiz domenda (Vercel, Netlify, o'z domeningiz)
npm run build

# GitHub Pages — repo nomi yo'lga qo'shiladi
BASE_PATH=/bus225 npm run build
```

Natija `out/` papkasida. HTTPS majburiy — Telegram Mini App talabi.

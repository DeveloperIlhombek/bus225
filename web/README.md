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

## Deploy (statik)

```bash
# Ildiz domenda (Vercel, Netlify, o'z domeningiz)
npm run build

# GitHub Pages — repo nomi yo'lga qo'shiladi
BASE_PATH=/bus225 npm run build
```

Natija `out/` papkasida. HTTPS majburiy — Telegram Mini App talabi.

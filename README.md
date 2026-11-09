# 🚌 Bus 225

225-sonli **"Siyob bozori — G'o'bdin qishlog'i"** yo'nalishi uchun Telegram bot
va Yandex Transport uslubidagi jonli xarita (Mini App).

Avtobuslar GPS'siz, **plakatdagi jadval bo'yicha** xaritada harakatlanadi:
3 ta avtobus reyslarni navbat bilan bajaradi, oraliq bekatlar vaqti yo'l
masofasidan hisoblanadi.

| Qism | Texnologiya | Vazifasi |
|---|---|---|
| `data/timetable.json` | — | **Qo'lda tahrirlanadigan manba**: bekatlar, plakat jadvali, yo'l chizig'i |
| `tools/build_route.py` | Python | Manbadan `data/route.json` ni hisoblaydi |
| `data/route.json` | — | Avtomatik yaratiladi — bot va Mini App shuni o'qiydi |
| `bot/` | Python 3.11+ · aiogram 3 | Telegram bot — bekat bo'yicha keyingi avtobuslar, `/jadval` |
| `web/` | Next.js 16 · React 19 · Leaflet | Mini App — jonli xarita |

---

## Jadval qanday ishlaydi

Plakatda har bir qator — bitta aylanma reys: **G'o'bdin → Siyob bozori → G'o'bdin**.

```
Avt   G'o'bdindan    Jomboy ichidan    Siyob
      shaharga       qishloqqa         bozoridan
 1    06:00          07:50 (Shayman)   07:10
 2    06:40          08:30             08:10
 3    07:20          09:50             —
 1    08:35          11:35             11:00     ← 06:00 dagi avtobus qaytib, 08:35 da yana chiqadi
 ...
```

* Qatorlar avtobuslarga navbat bilan beriladi: **1 → 2 → 3 → 1 …**
* Plakatda yo'q vaqtlar `tools/build_route.py` da hisoblanadi:
  * ikki ma'lum vaqt orasidagi bekatlar — yo'l masofasiga mutanosib;
  * oxirgi ma'lum vaqtdan keyin — o'rtacha tezlik (`speed_kmh`, 40 km/soat);
  * bo'sh katak (3-qatorda Siyob) — keyingi ma'lum vaqtdan orqaga;
  * avtobus keyingi reysiga ulgurmasa — reysning oxirgi qismi siqiladi.
* Barcha vaqtlar **Toshkent vaqti** (UTC+5) bo'yicha — server yoki telefon
  boshqa mintaqada bo'lsa ham.

## Jadvalni yoki bekatni o'zgartirish

1. `data/timetable.json` ni tahrirlang:
   * `timetable.rows` — plakatdagi qatorlar, aynan plakatdagidek
     (`"Shaymandan 07:50"` kabi izohlar ham mumkin, bo'sh katak — `null`);
   * `stops` — bekatlar **qishloqdan shaharga** tartibda, Google Maps'dan olingan koordinatalar;
   * `path` — yo'l chizig'i (OpenStreetMap yo'llari bo'yicha, qishloqdan shaharga).
2. Hisoblang:
   ```bash
   python -m tools.build_route
   ```
   Skript bekat yo'ldan uzoqda bo'lsa yoki tartib noto'g'ri bo'lsa aniq xato beradi.
3. Commit qiling — GitHub Actions testlarni o'tkazadi va Mini App'ni qayta joylaydi.

`data/route.json` ni qo'lda tahrirlamang: CI `--check` bilan uning manbaga
mosligini tekshiradi.

---

## Mini App (Telegram'da ochiladigan xarita)

Yandex Transport uslubida: butun ekran xarita, ko'k avtobuslar harakat
yo'nalishiga burilib silliq yuradi, pastda panel — "Qayerga?" qidiruvi, eng
yaqin bekatlar, bekat bo'yicha keyingi avtobuslar, avtobusning joriy reysi va
plakatdagi to'liq jadval.

**Joylashtirish** — `master` ga push qilinganda avtomatik (`.github/workflows/pages.yml`):

* manzil: **https://developerilhombek.github.io/bus225/**
* bir martalik sozlash: GitHub → Settings → Pages → Source: **GitHub Actions**

**Telegram'ga ulash** (bot ishlamayotgan bo'lsa ham ishlaydi):

@BotFather → `/mybots` → bot → **Bot Settings → Menu Button** → URL:
`https://developerilhombek.github.io/bus225/`

Sinov uchun URL parametrlari: `?t=07:30` (soatni shu vaqtdan boshlash),
`?x=30` (vaqtni tezlatish), `?nofs` (Telegram'da to'liq ekransiz).

Lokal ishga tushirish: [`web/README.md`](web/README.md).

---

## Bot

```bash
pip install -e ".[dev]"
cp .env.example .env        # BOT_TOKEN va WEBAPP_URL
python -m bot
```

Windows PowerShell:

```powershell
$env:BOT_TOKEN = "sizning_tokeningiz"
$env:WEBAPP_URL = "https://developerilhombek.github.io/bus225/"
python -m bot
```

Buyruqlar: `/start` — bekatlar (keyingi avtobuslar, avtobus raqami bilan),
`/jadval` — plakatdagi jadval, `/help`.

---

## Testlar

```bash
python -m tools.build_route --check   # route.json dolzarbmi
ruff check bot tools tests && mypy && pytest
cd web && npm run typecheck && npm run lint && npm test
```

## Struktura

```
data/timetable.json   ← QO'LDA tahrirlanadi
data/route.json       ← avtomatik (python -m tools.build_route)
tools/build_route.py  Jadval → har bir bekat vaqti, yo'l bo'laklari
bot/                  Telegram bot (aiogram 3)
web/                  Mini App (Next.js, statik eksport)
tests/                Bot va generator testlari
legacy/index.html     Birinchi prototip — faqat tarix uchun
```

## Keyingi qadamlar

- [ ] Haqiqiy oraliq vaqtlar: haydovchilardan bekatlar orasidagi daqiqalarni
      olib, `speed_kmh` o'rniga aniq qiymatlar berish
- [ ] Eslatma: avtobus kelishiga 5 daqiqa qolganda xabar
- [ ] GPS (ixtiyoriy): haydovchi telefonidan jonli joylashuv

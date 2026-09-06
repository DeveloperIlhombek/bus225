# 🚌 Bus 225

225-sonli **"Siyob bozori — G'o'bdin qishlog'i"** yo'nalishi uchun jadval boti
va jonli xarita.

Ikki mustaqil dastur, **bitta ma'lumot manbai**:

| Qism | Texnologiya | Vazifasi |
|---|---|---|
| `bot/` | Python 3.11+ · aiogram 3 | Telegram bot — bekat bo'yicha keyingi avtobuslar |
| `web/` | Next.js 16.2 · React 19 · TypeScript | Mini App — jonli xarita va jadval |
| `data/route.json` | — | **Yagona ma'lumot manbai** |

---

## Struktura

```
bus/
├── data/
│   └── route.json           ← YAGONA manba: bekatlar, reyslar, koordinatalar
├── bot/                     Telegram bot (Python paketi)
│   ├── __main__.py          Kirish nuqtasi: python -m bot
│   ├── config.py            Muhit o'zgaruvchilari, validatsiya
│   ├── models.py            Route / Stop / Trip — tipizatsiyalangan modellar
│   ├── texts.py             Foydalanuvchi matnlari (bitta joyda)
│   ├── data/repository.py   route.json ni o'qish va keshlash
│   ├── services/schedule.py Sof mantiq: yo'nalish, pozitsiya, uchrashuv
│   ├── keyboards/inline.py  Inline klaviaturalar, CallbackData
│   └── handlers/            Routerlar: /start, /help, bekatlar
├── web/                     Next.js Mini App (o'z README'si bor)
├── tests/                   Bot testlari (pytest)
├── legacy/index.html        Birinchi prototip — faqat tarix uchun
├── pyproject.toml
└── .env.example
```

**Asosiy qoida:** jadval mantiqi (`bot/services/schedule.py` va
`web/src/lib/schedule.ts`) Telegram'dan ham, React'dan ham mustaqil — sof
funksiyalar. Shu sabab ikkala tomon ham to'liq testlangan va bir xil
natija beradi.

---

## Ma'lumot formati — `data/route.json`

```json
{
  "route_id": "225",
  "route_name": "225-sonli \"Siyob bozori - G'o'bdin qishlog'i\"",
  "stops": [
    { "name": "G'o'bdin qishlog'i", "lat": 39.7010, "lng": 66.8600 }
  ],
  "trips": [
    { "bus_id": "A1", "times": ["06:00", "06:12", "06:25", "06:30", "07:10"] }
  ]
}
```

Qoidalar:

1. **`stops`** — bitta kanonik ro'yxat, **qishloqdan shaharga** tartibda.
2. **`trips[].times`** — `stops` bilan **bir xil uzunlik va tartibda**.
   Avtobus biror bekatda to'xtamasa — o'sha o'ringa `null`.
3. **Yo'nalish qo'lda yozilmaydi.** Vaqt index bo'yicha oshsa — avtobus
   shaharga, kamaysa — qishloqqa ketmoqda deb dastur o'zi aniqlaydi.
4. Yangi avtobus qo'shish uchun `trips` ga bitta obyekt qo'shish kifoya.

Fayl noto'g'ri bo'lsa bot **ishga tushmaydi** — xato aniq matn bilan
ko'rsatiladi (uzunliklar mos emas, `bus_id` takrorlangan, vaqt formati buzuq).

---

## Botni ishga tushirish

```bash
pip install -e ".[dev]"
cp .env.example .env        # BOT_TOKEN ni to'ldiring
python -m bot
```

Windows PowerShell:

```powershell
$env:BOT_TOKEN = "sizning_tokeningiz"; python -m bot
```

Sozlamalar (`.env.example` ga qarang): `BOT_TOKEN` (majburiy),
`WEBAPP_URL`, `ROUTE_FILE`, `NEXT_LIMIT`.

### Buyruqlar

- `/start` — bekatlar ro'yxati + 🗺 Jonli xarita tugmasi
- `/help` — qisqa yordam
- Bekat tanlansa — keyingi avtobuslar 🏙 shaharga va 🏡 qishloqqa
  yo'nalishlari bo'yicha alohida, "25 daqiqadan keyin" ko'rinishida

---

## Mini App

Batafsil: [`web/README.md`](web/README.md)

```bash
cd web
npm install
npm run dev
```

---

## Testlar

```bash
python -m pytest        # bot mantiqi
cd web && npm test      # frontend mantiqi
```

---

## Keyingi qadamlar

- [ ] **Haqiqiy koordinatalar** — `data/route.json` dagi `lat`/`lng` hozircha
      namuna. Google Maps'da har bir bekatni uzoq bosib (long-press) aniq
      qiymatni oling. Ularsiz "eng yaqin bekat" noto'g'ri ishlaydi.
- [ ] **Oraliq bekat vaqtlari** — 17-maktab, G'azira, Pushkin uchun vaqtlar
      interpolyatsiya qilingan, haqiqiysi bilan almashtirilishi kerak.
- [ ] Mini App'ni HTTPS'ga joylashtirish va `WEBAPP_URL` ni yozish
- [ ] Eslatma: avtobus kelishiga 5 daqiqa qolganda xabar
- [ ] Admin panel: jadvalni Telegram orqali yangilash

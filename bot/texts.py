"""Foydalanuvchiga ko'rinadigan barcha matnlar — bitta joyda.

Kelajakda ko'p tillilik qo'shilsa, faqat shu modul ko'payadi.
"""

from __future__ import annotations

import re
from datetime import datetime

from bot.models import Direction, Route, Stop
from bot.services import Departure, first_departure, upcoming_departures

DIRECTION_LABEL: dict[Direction, str] = {
    Direction.TO_CITY: "🏙 Shaharga",
    Direction.TO_VILLAGE: "🏡 Qishloqqa",
}

BTN_LIVE_MAP = "🗺 Jonli xarita"
BTN_BACK_TO_STOPS = "⬅️ Bekatlar ro'yxatiga"
BTN_REFRESH = "🔄 Yangilash"
BTN_TIMETABLE = "🗓 To'liq jadval"

PROMPT_PICK_STOP = "Bekatni tanlang:"


def greeting(route: Route) -> str:
    return (
        f"👋 Salom! Bu bot <b>{route.route_name}</b> jadvali bo'yicha "
        f"ma'lumot beradi.\n\n{PROMPT_PICK_STOP}"
    )


def _format_departure(departure: Departure, now: datetime) -> str:
    from bot.services.schedule import minutes_until

    remaining = minutes_until(departure.time, now)
    bus = f" · {departure.trip.bus_label}" if departure.trip.bus is not None else ""
    head = f"   🕒 <b>{departure.time}</b>"
    if remaining <= 0:
        return f"{head} — hozir{bus}"
    if remaining < 60:
        return f"{head} — {remaining} daqiqadan keyin{bus}"
    hours, minutes = divmod(remaining, 60)
    if minutes == 0:
        return f"{head} — {hours} soatdan keyin{bus}"
    return f"{head} — {hours} soat {minutes} daqiqadan keyin{bus}"


def stop_schedule(route: Route, stop_index: int, now: datetime, limit: int) -> str:
    """Bekat uchun keyingi avtobuslar ro'yxati (HTML formatida)."""
    stop: Stop = route.stop_at(stop_index)
    upcoming = upcoming_departures(route, stop_index, now, limit)

    lines = [f"🚌 <b>{route.route_name}</b>", f"📍 <b>{stop.name}</b>", ""]

    for direction in Direction:
        first = first_departure(route, stop_index, direction)
        if first is None:  # bu bekatdan shu tomonga jo'nash yo'q (oxirgi bekat)
            continue

        lines.append(DIRECTION_LABEL[direction])
        if upcoming[direction]:
            lines.extend(_format_departure(d, now) for d in upcoming[direction])
        else:
            lines.append(f"   ⚠️ Bugungi reyslar tugadi. Ertaga birinchisi: <b>{first}</b>")
        lines.append("")

    lines.append(f"<i>Yangilangan: {now:%H:%M}</i>")
    return "\n".join(lines)


def timetable(route: Route) -> str:
    """Plakatdagi jadval — xuddi plakatdagidek, avtobus raqamlari bilan."""
    table = route.timetable
    if table is None:
        return "Jadval mavjud emas."

    def cell(value: str | None) -> str:
        if value is None:
            return "  —  "
        match = re.search(r"(\d{1,2})[:.](\d{2})", value)
        return f"{int(match.group(1)):02d}:{match.group(2)}" if match else value

    head = "Avt  " + "  ".join(f"{i + 1}-ustun" for i in range(len(table.labels)))
    legend = "\n".join(f"{i + 1}-ustun — {label}" for i, label in enumerate(table.labels))
    rows = "\n".join(
        f" {row.bus if row.bus is not None else '-'}   " + "    ".join(cell(c) for c in row.cells)
        for row in table.rows
    )
    return (
        f"🚌 <b>{route.route_name}</b>\n\n{legend}\n\n<pre>{head}\n{rows}</pre>\n"
        "Qatorlar avtobuslarga navbat bilan beriladi: 1 → 2 → 3 → 1 …"
    )


ERROR_GENERIC = "⚠️ Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring."
ERROR_UNKNOWN_STOP = "⚠️ Bunday bekat topilmadi. /start bosing."
NOTICE_NO_CHANGE = "Hozircha o'zgarish yo'q"

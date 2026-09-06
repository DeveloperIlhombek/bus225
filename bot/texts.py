"""Foydalanuvchiga ko'rinadigan barcha matnlar — bitta joyda.

Kelajakda ko'p tillilik qo'shilsa, faqat shu modul ko'payadi.
"""

from __future__ import annotations

from datetime import datetime

from bot.models import Direction, Route, Stop, TimeStr
from bot.services import departures_at, next_departures

DIRECTION_LABEL: dict[Direction, str] = {
    Direction.TO_CITY: "🏙 Shaharga",
    Direction.TO_VILLAGE: "🏡 Qishloqqa",
}

BTN_LIVE_MAP = "🗺 Jonli xarita"
BTN_BACK_TO_STOPS = "⬅️ Bekatlar ro'yxatiga"
BTN_REFRESH = "🔄 Yangilash"

PROMPT_PICK_STOP = "Bekatni tanlang:"


def greeting(route: Route) -> str:
    return (
        f"👋 Salom! Bu bot <b>{route.route_name}</b> jadvali bo'yicha "
        f"ma'lumot beradi.\n\n{PROMPT_PICK_STOP}"
    )


def _format_departure(departure: TimeStr, now: datetime) -> str:
    from bot.services.schedule import minutes_until

    remaining = minutes_until(departure, now)
    if remaining <= 0:
        return f"   🕒 <b>{departure}</b> — hozir"
    if remaining < 60:
        return f"   🕒 <b>{departure}</b> — {remaining} daqiqadan keyin"
    hours, minutes = divmod(remaining, 60)
    if minutes == 0:
        return f"   🕒 <b>{departure}</b> — {hours} soatdan keyin"
    return f"   🕒 <b>{departure}</b> — {hours} soat {minutes} daqiqadan keyin"


def stop_schedule(route: Route, stop_index: int, now: datetime, limit: int) -> str:
    """Bekat uchun keyingi avtobuslar ro'yxati (HTML formatida)."""
    stop: Stop = route.stop_at(stop_index)
    departures = departures_at(route, stop_index)

    lines = [f"🚌 <b>{route.route_name}</b>", f"📍 <b>{stop.name}</b>", ""]

    for direction in Direction:
        times = departures[direction]
        if not times:
            continue

        lines.append(DIRECTION_LABEL[direction])
        upcoming = next_departures(times, now, limit)
        if upcoming:
            lines.extend(_format_departure(t, now) for t in upcoming)
        else:
            lines.append(f"   ⚠️ Bugungi reyslar tugadi. Ertaga birinchisi: <b>{times[0]}</b>")
        lines.append("")

    lines.append(f"<i>Yangilangan: {now:%H:%M}</i>")
    return "\n".join(lines)


ERROR_GENERIC = "⚠️ Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring."
ERROR_UNKNOWN_STOP = "⚠️ Bunday bekat topilmadi. /start bosing."
NOTICE_NO_CHANGE = "Hozircha o'zgarish yo'q"

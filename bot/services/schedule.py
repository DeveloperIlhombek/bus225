"""Jadval hisob-kitoblari — Telegram'dan mustaqil, sof funksiyalar.

Bu modul `bot/` ichida ham, kelajakdagi API/admin panelda ham qayta
ishlatiladi. Shu sabab bu yerda aiogram importlari YO'Q.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time

from bot.models import Direction, Route, TimeStr, Trip, parse_time

# Ikki avtobus "uchrashdi" deb hisoblanadigan masofa —
# chiziq uzunligining ulushi. Frontend (web/src/lib/schedule.ts) bilan bir xil.
MEETING_THRESHOLD_RATIO = 0.06


def _now_minutes(now: datetime | time) -> int:
    return now.hour * 60 + now.minute


def departures_at(route: Route, stop_index: int) -> dict[Direction, list[TimeStr]]:
    """Bekatdagi barcha reys vaqtlarini yo'nalish bo'yicha ajratadi.

    Har bir ro'yxat o'sish tartibida qaytariladi.
    """
    if not 0 <= stop_index < route.stop_count:
        raise IndexError(f"Bekat indeksi chegaradan tashqarida: {stop_index}")

    result: dict[Direction, list[TimeStr]] = {d: [] for d in Direction}
    for trip in route.trips:
        direction = trip.direction
        departure = trip.time_at(stop_index)
        if direction is None or departure is None:
            continue
        result[direction].append(departure)

    for times in result.values():
        times.sort()
    return result


def next_departures(times: list[TimeStr], now: datetime, limit: int = 3) -> list[TimeStr]:
    """Hozirgi vaqtdan keyingi eng yaqin `limit` ta jo'nashni qaytaradi.

    Kunlik reyslar tugagan bo'lsa — bo'sh ro'yxat.
    """
    current = _now_minutes(now)
    return [t for t in times if parse_time(t) >= current][:limit]


def minutes_until(departure: TimeStr, now: datetime) -> int:
    """Jo'nashgacha necha daqiqa qolgani (o'tib ketgan bo'lsa — manfiy)."""
    return parse_time(departure) - _now_minutes(now)


def trip_position(trip: Trip, now: datetime) -> float | None:
    """Reysning hozirgi uzluksiz pozitsiyasi (0 .. bekatlar_soni-1).

    Reys hali boshlanmagan yoki allaqachon tugagan bo'lsa — None.
    Ikkala yo'nalish uchun ham bitta formula ishlaydi, chunki interpolyatsiya
    vaqt oralig'i bo'yicha, bekat indeksi bo'yicha emas.
    """
    current = _now_minutes(now)
    times = trip.times

    for i in range(len(times) - 1):
        first, second = times[i], times[i + 1]
        if first is None or second is None:
            continue

        start, end = parse_time(first), parse_time(second)
        low, high = min(start, end), max(start, end)
        if not (low <= current <= high) or start == end:
            continue

        progress = (current - start) / (end - start)
        return i + progress

    return None


@dataclass(frozen=True, slots=True)
class ActiveBus:
    """Ayni damda yo'lda bo'lgan avtobus."""

    bus_id: str
    direction: Direction
    position: float
    meeting_with: str | None = None

    @property
    def is_meeting(self) -> bool:
        return self.meeting_with is not None


def active_buses(route: Route, now: datetime) -> list[ActiveBus]:
    """Hozir harakatdagi barcha avtobuslar, uchrashuvlari belgilangan holda."""
    buses: list[ActiveBus] = []
    for trip in route.trips:
        position = trip_position(trip, now)
        if position is None or trip.direction is None:
            continue
        buses.append(ActiveBus(bus_id=trip.bus_id, direction=trip.direction, position=position))

    return find_meetings(buses, route.stop_count)


def find_meetings(buses: list[ActiveBus], stop_count: int) -> list[ActiveBus]:
    """Qarama-qarshi yo'nalishdagi yaqin avtobuslarni juftlab belgilaydi."""
    threshold = (stop_count - 1) * MEETING_THRESHOLD_RATIO
    partners: dict[str, str] = {}

    for i, first in enumerate(buses):
        for second in buses[i + 1:]:
            if first.direction is second.direction:
                continue
            if abs(first.position - second.position) <= threshold:
                partners[first.bus_id] = second.bus_id
                partners[second.bus_id] = first.bus_id

    return [
        ActiveBus(
            bus_id=bus.bus_id,
            direction=bus.direction,
            position=bus.position,
            meeting_with=partners.get(bus.bus_id),
        )
        for bus in buses
    ]

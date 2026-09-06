"""Yo'nalish ma'lumotlarining tipizatsiyalangan modeli.

`data/route.json` — butun loyihaning yagona ma'lumot manbai. Bu yerdagi
sinflar shu faylni o'qib, tekshirilgan (validated) obyektlarga aylantiradi.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Sequence

# "HH:MM" formatidagi vaqt yoki None (avtobus bu bekatda to'xtamaydi)
TimeStr = str
OptionalTime = TimeStr | None


class RouteDataError(ValueError):
    """route.json tuzilishi noto'g'ri bo'lganda ko'tariladi."""


class Direction(str, Enum):
    """Avtobus harakat yo'nalishi.

    `stops` ro'yxati QISHLOQDAN SHAHARGA tartibda yozilgani uchun yo'nalishni
    qo'lda ko'rsatish shart emas — u reys vaqtlaridan aniqlanadi.
    """

    TO_CITY = "shaharga"
    TO_VILLAGE = "qishloqqa"

    @property
    def opposite(self) -> "Direction":
        return Direction.TO_VILLAGE if self is Direction.TO_CITY else Direction.TO_CITY


def parse_time(value: str) -> int:
    """'HH:MM' ni yarim tundan boshlab o'tgan daqiqaga aylantiradi."""
    try:
        hours, minutes = (int(part) for part in value.split(":"))
    except (ValueError, AttributeError) as exc:
        raise RouteDataError(f"Vaqt formati noto'g'ri: {value!r} ('HH:MM' kutilgan)") from exc
    if not (0 <= hours < 24 and 0 <= minutes < 60):
        raise RouteDataError(f"Vaqt chegaradan tashqarida: {value!r}")
    return hours * 60 + minutes


@dataclass(frozen=True, slots=True)
class Stop:
    name: str
    lat: float
    lng: float

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Stop":
        try:
            return cls(name=str(raw["name"]), lat=float(raw["lat"]), lng=float(raw["lng"]))
        except (KeyError, TypeError, ValueError) as exc:
            raise RouteDataError(f"Bekat yozuvi noto'g'ri: {raw!r}") from exc


@dataclass(frozen=True, slots=True)
class Trip:
    """Bitta avtobusning bitta reysi."""

    bus_id: str
    times: tuple[OptionalTime, ...]

    @classmethod
    def from_dict(cls, raw: dict[str, Any], stop_count: int) -> "Trip":
        try:
            bus_id = str(raw["bus_id"])
            times = tuple(raw["times"])
        except (KeyError, TypeError) as exc:
            raise RouteDataError(f"Reys yozuvi noto'g'ri: {raw!r}") from exc

        if len(times) != stop_count:
            raise RouteDataError(
                f"{bus_id} reysida {len(times)} ta vaqt bor, "
                f"lekin {stop_count} ta bekat mavjud — ular teng bo'lishi shart."
            )
        for value in times:
            if value is not None:
                parse_time(value)  # faqat tekshirish uchun

        trip = cls(bus_id=bus_id, times=times)
        if trip.direction is None:
            raise RouteDataError(
                f"{bus_id} reysida kamida 2 ta vaqt bo'lishi kerak — "
                "aks holda yo'nalishni aniqlab bo'lmaydi."
            )
        return trip

    @property
    def stated_times(self) -> list[TimeStr]:
        """None bo'lmagan vaqtlar, bekat tartibida."""
        return [t for t in self.times if t is not None]

    @property
    def direction(self) -> Direction | None:
        """Vaqt index bo'yicha oshsa shaharga, kamaysa qishloqqa."""
        stated = self.stated_times
        if len(stated) < 2:
            return None
        return Direction.TO_CITY if stated[-1] > stated[0] else Direction.TO_VILLAGE

    def time_at(self, stop_index: int) -> OptionalTime:
        return self.times[stop_index]


@dataclass(frozen=True, slots=True)
class Route:
    route_id: str
    route_name: str
    telegram_group: str | None
    stops: tuple[Stop, ...]
    trips: tuple[Trip, ...]

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Route":
        raw_stops = raw.get("stops")
        raw_trips = raw.get("trips")
        if not isinstance(raw_stops, list) or len(raw_stops) < 2:
            raise RouteDataError("'stops' kamida 2 ta bekatdan iborat ro'yxat bo'lishi kerak.")
        if not isinstance(raw_trips, list) or not raw_trips:
            raise RouteDataError("'trips' bo'sh bo'lmagan ro'yxat bo'lishi kerak.")

        stops = tuple(Stop.from_dict(item) for item in raw_stops)
        trips = tuple(Trip.from_dict(item, len(stops)) for item in raw_trips)

        seen: set[str] = set()
        for trip in trips:
            if trip.bus_id in seen:
                raise RouteDataError(f"bus_id takrorlangan: {trip.bus_id}")
            seen.add(trip.bus_id)

        return cls(
            route_id=str(raw.get("route_id", "")),
            route_name=str(raw.get("route_name", "Avtobus yo'nalishi")),
            telegram_group=raw.get("telegram_group"),
            stops=stops,
            trips=trips,
        )

    @property
    def stop_count(self) -> int:
        return len(self.stops)

    def stop_at(self, index: int) -> Stop:
        return self.stops[index]

    def trips_in(self, direction: Direction) -> Sequence[Trip]:
        return [t for t in self.trips if t.direction is direction]

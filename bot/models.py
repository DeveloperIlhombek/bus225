"""Yo'nalish ma'lumotlarining tipizatsiyalangan modeli.

`data/route.json` — butun loyihaning yagona ma'lumot manbai. Bu yerdagi
sinflar shu faylni o'qib, tekshirilgan (validated) obyektlarga aylantiradi.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from datetime import date, datetime, timedelta, timezone
from enum import StrEnum
from typing import Any

# "HH:MM" formatidagi vaqt yoki None (avtobus bu bekatda to'xtamaydi)
TimeStr = str
OptionalTime = TimeStr | None


class RouteDataError(ValueError):
    """route.json tuzilishi noto'g'ri bo'lganda ko'tariladi."""


class Direction(StrEnum):
    """Avtobus harakat yo'nalishi.

    `stops` ro'yxati QISHLOQDAN SHAHARGA tartibda yozilgani uchun yo'nalishni
    qo'lda ko'rsatish shart emas — u reys vaqtlaridan aniqlanadi.
    """

    TO_CITY = "shaharga"
    TO_VILLAGE = "qishloqqa"

    @property
    def opposite(self) -> Direction:
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
    def from_dict(cls, raw: dict[str, Any]) -> Stop:
        try:
            return cls(name=str(raw["name"]), lat=float(raw["lat"]), lng=float(raw["lng"]))
        except (KeyError, TypeError, ValueError) as exc:
            raise RouteDataError(f"Bekat yozuvi noto'g'ri: {raw!r}") from exc


@dataclass(frozen=True, slots=True)
class RouteGeometry:
    """Yo'lning haqiqiy geometriyasi.

    `legs[i]` — `stops[i]` dan `stops[i+1]` gacha bo'lgan yo'l nuqtalari,
    ya'ni uzunligi doimo `stop_count - 1` ga teng. Geometriya bir marta
    hisoblanib faylga yoziladi — ilova ishlayotganda routing API kerak emas.

    Bot bu ma'lumotni ishlatmaydi, lekin uni TEKSHIRADI: fayl yagona manba
    bo'lgani uchun buzuq geometriya Mini App'ga yetib bormasligi kerak.
    """

    legs: tuple[tuple[tuple[float, float], ...], ...]

    @classmethod
    def from_dict(cls, raw: Any, stop_count: int) -> RouteGeometry:
        raw_legs = raw.get("legs") if isinstance(raw, dict) else None
        if not isinstance(raw_legs, list):
            raise RouteDataError("'geometry.legs' ro'yxat bo'lishi kerak.")

        expected = stop_count - 1
        if len(raw_legs) != expected:
            raise RouteDataError(
                f"'geometry.legs' da {len(raw_legs)} ta oraliq bor, "
                f"lekin {stop_count} ta bekat uchun {expected} ta kerak."
            )

        legs: list[tuple[tuple[float, float], ...]] = []
        for index, raw_leg in enumerate(raw_legs):
            if not isinstance(raw_leg, list):
                raise RouteDataError(f"'geometry.legs[{index}]' ro'yxat bo'lishi kerak.")
            points: list[tuple[float, float]] = []
            for point in raw_leg:
                try:
                    lat, lng = (float(value) for value in point)
                except (TypeError, ValueError) as exc:
                    raise RouteDataError(
                        f"'geometry.legs[{index}]' ichida noto'g'ri nuqta: {point!r} "
                        "([lat, lng] kutilgan)"
                    ) from exc
                points.append((lat, lng))
            legs.append(tuple(points))

        return cls(legs=tuple(legs))


@dataclass(frozen=True, slots=True)
class Trip:
    """Bitta avtobusning bitta (bir tomonlama) reysi."""

    bus_id: str
    times: tuple[OptionalTime, ...]
    # Reysni bajaradigan avtobus raqami (1, 2, 3 ...). Eski formatda bo'lmasligi mumkin.
    bus: int | None = None
    # Qaysi jadvalga tegishli: "weekday", "sunday" ... (eski formatda — None, har kuni)
    service: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any], stop_count: int) -> Trip:
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

        raw_bus = raw.get("bus")
        try:
            bus = int(raw_bus) if raw_bus is not None else None
        except (TypeError, ValueError) as exc:
            raise RouteDataError(
                f"{bus_id} reysida 'bus' butun son bo'lishi kerak: {raw_bus!r}"
            ) from exc

        service = raw.get("service")
        trip = cls(bus_id=bus_id, times=times, bus=bus, service=str(service) if service else None)
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

    @property
    def last_stop_index(self) -> int:
        """Reys tugaydigan bekat (harakat tartibida oxirgi to'xtash)."""
        indices = [i for i, t in enumerate(self.times) if t is not None]
        return indices[-1] if self.direction is Direction.TO_CITY else indices[0]

    @property
    def bus_label(self) -> str:
        return f"{self.bus}-avtobus" if self.bus is not None else self.bus_id


@dataclass(frozen=True, slots=True)
class TimetableRow:
    """Plakatdagi bitta qator: qaysi avtobus va kataklar (aynan plakatdagidek)."""

    bus: int | None
    cells: tuple[str | None, ...]


@dataclass(frozen=True, slots=True)
class Timetable:
    labels: tuple[str, ...]
    rows: tuple[TimetableRow, ...]
    id: str = "weekday"
    label: str = ""
    days: tuple[int, ...] = (0, 1, 2, 3, 4, 5, 6)  # 0 — dushanba

    @classmethod
    def from_dict(cls, raw: Any) -> Timetable | None:
        if not isinstance(raw, dict):
            return None
        try:
            labels = tuple(str(c["label"]) for c in raw["columns"])
            rows = tuple(
                TimetableRow(bus=r.get("bus"), cells=tuple(r["cells"])) for r in raw["rows"]
            )
        except (KeyError, TypeError) as exc:
            raise RouteDataError(f"'timetable' tuzilishi noto'g'ri: {exc}") from exc
        return cls(
            labels=labels,
            rows=rows,
            id=str(raw.get("id", "weekday")),
            label=str(raw.get("label", "")),
            days=tuple(int(d) for d in raw.get("days", range(7))),
        )


@dataclass(frozen=True, slots=True)
class Route:
    route_id: str
    route_name: str
    telegram_group: str | None
    stops: tuple[Stop, ...]
    trips: tuple[Trip, ...]
    geometry: RouteGeometry | None = None
    timetables: tuple[Timetable, ...] = ()
    holidays: frozenset[str] = frozenset()
    # Jadval qaysi vaqt mintaqasida yozilgan (Toshkent — UTC+5, yozgi vaqt yo'q)
    utc_offset_hours: float = 5
    _tz: timezone = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "_tz", timezone(timedelta(hours=self.utc_offset_hours)))

    @property
    def timetable(self) -> Timetable | None:
        """Asosiy (birinchi) jadval."""
        return self.timetables[0] if self.timetables else None

    def service_for(self, day: date) -> str | None:
        """Shu kuni qaysi jadval ishlaydi (bayramda — yakshanbaniki)."""
        if not self.timetables:
            return None
        weekday = 6 if day.isoformat() in self.holidays else day.weekday()
        for table in self.timetables:
            if weekday in table.days:
                return table.id
        return self.timetables[0].id

    def timetable_for(self, day: date) -> Timetable | None:
        service = self.service_for(day)
        return next((t for t in self.timetables if t.id == service), self.timetable)

    def for_day(self, day: date) -> Route:
        """Faqat shu kuni ishlaydigan reyslar bilan yo'nalish nusxasi."""
        service = self.service_for(day)
        if service is None:
            return self
        trips = tuple(t for t in self.trips if t.service in (None, service))
        return replace(self, trips=trips)

    def now(self) -> datetime:
        """Shahar vaqti — server qaysi mamlakatda bo'lishidan qat'i nazar."""
        return datetime.now(self._tz)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> Route:
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

        raw_geometry = raw.get("geometry")
        geometry = (
            RouteGeometry.from_dict(raw_geometry, len(stops))
            if raw_geometry is not None
            else None
        )

        return cls(
            route_id=str(raw.get("route_id", "")),
            route_name=str(raw.get("route_name", "Avtobus yo'nalishi")),
            telegram_group=raw.get("telegram_group"),
            stops=stops,
            trips=trips,
            geometry=geometry,
            timetables=tuple(
                t
                for t in (
                    Timetable.from_dict(item)
                    for item in (raw.get("timetables") or [raw.get("timetable")])
                )
                if t is not None
            ),
            holidays=frozenset(str(d) for d in raw.get("holidays", [])),
            utc_offset_hours=float(raw.get("timezone_offset_hours", 5)),
        )

    @property
    def stop_count(self) -> int:
        return len(self.stops)

    def stop_at(self, index: int) -> Stop:
        return self.stops[index]

    def trips_in(self, direction: Direction) -> Sequence[Trip]:
        return [t for t in self.trips if t.direction is direction]

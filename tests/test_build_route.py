"""data/timetable.json → data/route.json generatori testlari."""

from __future__ import annotations

import copy
import json
from itertools import pairwise
from pathlib import Path

import pytest

from bot.models import Direction, Route, parse_time
from tools import build_route
from tools.build_route import BuildError, build

PROJECT_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def source() -> dict:
    return json.loads((PROJECT_ROOT / "data" / "timetable.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def built(source: dict) -> Route:
    return Route.from_dict(build(source))


def test_route_json_is_up_to_date() -> None:
    """route.json qo'lda tahrirlanmagan va timetable.json bilan mos."""
    assert build_route.main(["--check"]) == 0


def test_buses_rotate_by_row(built: Route) -> None:
    city = [t for t in built.trips if t.direction is Direction.TO_CITY]
    assert [t.bus for t in city] == [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2]


def test_poster_times_are_kept(source: dict, built: Route) -> None:
    ids = [s["id"] for s in source["stops"]]
    columns = source["timetable"]["columns"]
    for k, row in enumerate(source["timetable"]["rows"]):
        for column, cell in zip(columns, row, strict=True):
            if cell is None:
                continue
            suffix = "S" if column["direction"] == "shaharga" else "Q"
            trip = next(t for t in built.trips if t.bus_id == f"{k + 1:02d}{suffix}")
            expected = cell.split()[-1]
            assert trip.time_at(ids.index(column["stop"])) == expected, (k + 1, cell)


def test_times_are_monotonic_along_travel(built: Route) -> None:
    for trip in built.trips:
        minutes = [parse_time(t) for t in trip.times if t is not None]
        if trip.direction is Direction.TO_VILLAGE:
            minutes.reverse()
        assert minutes == sorted(minutes), trip.bus_id


def test_bus_never_in_two_places(built: Route) -> None:
    """Bitta avtobusning reyslari bir-biriga ustma-ust tushmaydi."""
    by_bus: dict[int | None, list[tuple[int, int]]] = {}
    for trip in built.trips:
        minutes = [parse_time(t) for t in trip.times if t is not None]
        by_bus.setdefault(trip.bus, []).append((min(minutes), max(minutes)))
    for spans in by_bus.values():
        spans.sort()
        for (_, end), (start, _) in pairwise(spans):
            assert end < start


def test_missing_cell_is_back_computed(built: Route) -> None:
    """3-qatorda Siyob vaqti yo'q — u Jomboy (Shayman) vaqtidan oldin bo'ladi."""
    trip = next(t for t in built.trips if t.bus_id == "03Q")
    assert parse_time(trip.times[-1]) < parse_time("09:50")  # type: ignore[arg-type]


def test_wrong_stop_order_is_rejected(source: dict) -> None:
    broken = copy.deepcopy(source)
    broken["stops"][1], broken["stops"][2] = broken["stops"][2], broken["stops"][1]
    with pytest.raises(BuildError, match="tartibi"):
        build(broken)


def test_stop_far_from_path_is_rejected(source: dict) -> None:
    broken = copy.deepcopy(source)
    broken["stops"][3]["lat"] += 0.05
    with pytest.raises(BuildError, match="uzoqda"):
        build(broken)

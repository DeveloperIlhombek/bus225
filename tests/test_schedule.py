from __future__ import annotations

from datetime import datetime

import pytest

from bot.models import Direction, Route
from bot.services import (
    active_buses,
    departures_at,
    find_meetings,
    next_departures,
    trip_position,
)
from bot.services.schedule import ActiveBus, minutes_until


class TestDeparturesAt:
    def test_splits_by_direction(self, toy_route: Route) -> None:
        result = departures_at(toy_route, 0)
        assert result[Direction.TO_CITY] == ["08:00", "10:00"]
        assert result[Direction.TO_VILLAGE] == ["09:00"]

    def test_null_stop_is_skipped(self, toy_route: Route) -> None:
        result = departures_at(toy_route, 1)
        assert "SKIP" not in str(result)
        assert result[Direction.TO_CITY] == ["08:30"]

    def test_results_are_sorted(self, real_route: Route) -> None:
        for times in departures_at(real_route, 2).values():
            assert times == sorted(times)

    def test_out_of_range_raises(self, toy_route: Route) -> None:
        with pytest.raises(IndexError):
            departures_at(toy_route, 99)


class TestNextDepartures:
    def test_filters_past_times(self, at_0815: datetime) -> None:
        times = ["08:00", "08:30", "09:00", "09:30"]
        assert next_departures(times, at_0815, limit=2) == ["08:30", "09:00"]

    def test_includes_exact_current_minute(self, at_0815: datetime) -> None:
        assert next_departures(["08:15"], at_0815) == ["08:15"]

    def test_empty_when_day_is_over(self) -> None:
        assert next_departures(["08:00"], datetime(2026, 9, 5, 23, 0)) == []

    def test_minutes_until(self, at_0815: datetime) -> None:
        assert minutes_until("09:00", at_0815) == 45
        assert minutes_until("08:00", at_0815) == -15


class TestTripPosition:
    def test_midpoint_of_first_leg(self, toy_route: Route) -> None:
        up = toy_route.trips[0]  # 08:00 08:30 09:00
        assert trip_position(up, datetime(2026, 9, 5, 8, 15)) == pytest.approx(0.5)

    def test_second_leg(self, toy_route: Route) -> None:
        up = toy_route.trips[0]
        assert trip_position(up, datetime(2026, 9, 5, 8, 45)) == pytest.approx(1.5)

    def test_reverse_trip_uses_same_formula(self, toy_route: Route) -> None:
        down = toy_route.trips[1]  # 09:00 08:30 08:00
        # 08:45 — birinchi oraliqning (09:00 -> 08:30) yarmi
        assert trip_position(down, datetime(2026, 9, 5, 8, 45)) == pytest.approx(0.5)

    def test_none_before_start(self, toy_route: Route) -> None:
        assert trip_position(toy_route.trips[0], datetime(2026, 9, 5, 7, 0)) is None

    def test_none_after_end(self, toy_route: Route) -> None:
        assert trip_position(toy_route.trips[0], datetime(2026, 9, 5, 22, 0)) is None


class TestMeetings:
    def test_opposite_and_close_buses_meet(self) -> None:
        buses = [
            ActiveBus("A", Direction.TO_CITY, 2.0),
            ActiveBus("B", Direction.TO_VILLAGE, 2.05),
        ]
        result = {b.bus_id: b.meeting_with for b in find_meetings(buses, stop_count=5)}
        assert result == {"A": "B", "B": "A"}

    def test_same_direction_never_meets(self) -> None:
        buses = [
            ActiveBus("A", Direction.TO_CITY, 2.0),
            ActiveBus("B", Direction.TO_CITY, 2.0),
        ]
        assert all(not b.is_meeting for b in find_meetings(buses, stop_count=5))

    def test_far_apart_buses_do_not_meet(self) -> None:
        buses = [
            ActiveBus("A", Direction.TO_CITY, 0.5),
            ActiveBus("B", Direction.TO_VILLAGE, 3.5),
        ]
        assert all(not b.is_meeting for b in find_meetings(buses, stop_count=5))


class TestActiveBuses:
    def test_only_moving_buses_returned(self, real_route: Route) -> None:
        buses = active_buses(real_route, datetime(2026, 9, 5, 8, 45))
        assert buses, "08:45 da yo'lda avtobus bo'lishi kerak"
        for bus in buses:
            assert 0 <= bus.position <= real_route.stop_count - 1

    def test_empty_at_night(self, real_route: Route) -> None:
        assert active_buses(real_route, datetime(2026, 9, 5, 3, 0)) == []

from __future__ import annotations

import pytest

from bot.models import Direction, Route, RouteDataError, Trip, parse_time


class TestParseTime:
    @pytest.mark.parametrize(("value", "expected"), [("00:00", 0), ("06:12", 372), ("23:59", 1439)])
    def test_valid(self, value: str, expected: int) -> None:
        assert parse_time(value) == expected

    @pytest.mark.parametrize("value", ["24:00", "12:60", "abc", "6:1:2", ""])
    def test_invalid(self, value: str) -> None:
        with pytest.raises(RouteDataError):
            parse_time(value)


class TestTripDirection:
    def test_increasing_times_go_to_city(self) -> None:
        trip = Trip.from_dict({"bus_id": "A", "times": ["06:00", "06:30", "07:00"]}, 3)
        assert trip.direction is Direction.TO_CITY

    def test_decreasing_times_go_to_village(self) -> None:
        trip = Trip.from_dict({"bus_id": "B", "times": ["09:00", "08:30", "08:00"]}, 3)
        assert trip.direction is Direction.TO_VILLAGE

    def test_nulls_are_ignored_when_detecting(self) -> None:
        trip = Trip.from_dict({"bus_id": "C", "times": [None, "06:30", "07:00"]}, 3)
        assert trip.direction is Direction.TO_CITY
        assert trip.stated_times == ["06:30", "07:00"]

    def test_opposite(self) -> None:
        assert Direction.TO_CITY.opposite is Direction.TO_VILLAGE
        assert Direction.TO_VILLAGE.opposite is Direction.TO_CITY


class TestRouteValidation:
    def test_times_length_must_match_stop_count(self) -> None:
        with pytest.raises(RouteDataError, match="teng bo'lishi shart"):
            Trip.from_dict({"bus_id": "X", "times": ["06:00", "06:30"]}, 3)

    def test_single_time_has_no_direction(self) -> None:
        with pytest.raises(RouteDataError, match="kamida 2 ta vaqt"):
            Trip.from_dict({"bus_id": "X", "times": ["06:00", None, None]}, 3)

    def test_duplicate_bus_id_rejected(self) -> None:
        with pytest.raises(RouteDataError, match="takrorlangan"):
            Route.from_dict(
                {
                    "stops": [
                        {"name": "a", "lat": 1, "lng": 1},
                        {"name": "b", "lat": 2, "lng": 2},
                    ],
                    "trips": [
                        {"bus_id": "A1", "times": ["06:00", "07:00"]},
                        {"bus_id": "A1", "times": ["08:00", "09:00"]},
                    ],
                }
            )

    def test_needs_at_least_two_stops(self) -> None:
        with pytest.raises(RouteDataError, match="kamida 2 ta bekat"):
            Route.from_dict({"stops": [{"name": "a", "lat": 1, "lng": 1}], "trips": []})


class TestRealRouteFile:
    def test_loads(self, real_route: Route) -> None:
        assert real_route.stop_count == 5
        assert len(real_route.trips) == 14

    def test_seven_trips_each_way(self, real_route: Route) -> None:
        assert len(real_route.trips_in(Direction.TO_CITY)) == 7
        assert len(real_route.trips_in(Direction.TO_VILLAGE)) == 7

    def test_a_prefixed_buses_head_to_city(self, real_route: Route) -> None:
        for trip in real_route.trips:
            expected = Direction.TO_CITY if trip.bus_id.startswith("A") else Direction.TO_VILLAGE
            assert trip.direction is expected, trip.bus_id

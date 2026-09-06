from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pytest

from bot.models import Route

PROJECT_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def real_route() -> Route:
    """Loyihaning haqiqiy data/route.json fayli."""
    raw = json.loads((PROJECT_ROOT / "data" / "route.json").read_text(encoding="utf-8"))
    return Route.from_dict(raw)


@pytest.fixture
def toy_route() -> Route:
    """3 bekat, 2 reys — qo'lda tekshirish oson bo'lgan kichik yo'nalish."""
    return Route.from_dict(
        {
            "route_id": "T",
            "route_name": "Test yo'nalishi",
            "stops": [
                {"name": "Qishloq", "lat": 39.70, "lng": 66.86},
                {"name": "O'rta", "lat": 39.68, "lng": 66.84},
                {"name": "Shahar", "lat": 39.66, "lng": 66.98},
            ],
            "trips": [
                {"bus_id": "UP", "times": ["08:00", "08:30", "09:00"]},
                {"bus_id": "DOWN", "times": ["09:00", "08:30", "08:00"]},
                {"bus_id": "SKIP", "times": ["10:00", None, "11:00"]},
            ],
        }
    )


@pytest.fixture
def at_0815() -> datetime:
    return datetime(2026, 9, 5, 8, 15)

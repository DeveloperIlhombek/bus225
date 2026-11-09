"""Avtobuslarning jonli holati: haydovchidan kelgan joylashuv yoki bekat belgisi.

Xotirada saqlanadi va diskka (JSON) yoziladi — bot qayta ishga tushsa ham
oxirgi holat yo'qolmaydi. Eskirgan yozuvlar (`STALE_SECONDS`) avtomatik
e'tiborsiz qoldiriladi: Mini App bunday avtobusni yana jadval bo'yicha ko'rsatadi.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

logger = logging.getLogger(__name__)

# Shuncha vaqt yangilanmasa — jonli ma'lumot hisoblanmaydi
STALE_SECONDS = 180

Source = Literal["gps", "stop"]


@dataclass(frozen=True, slots=True)
class LiveBus:
    bus: int
    lat: float
    lng: float
    source: Source
    ts: float  # unix vaqt, soniya
    heading: float | None = None
    speed: float | None = None  # m/s
    stop_index: int | None = None
    driver_id: int | None = None

    def public(self) -> dict[str, object]:
        """Yo'lovchilarga ko'rinadigan qism (haydovchi ID'si chiqmaydi)."""
        data = asdict(self)
        data.pop("driver_id")
        return data


class LiveStore:
    def __init__(self, path: Path | None = None) -> None:
        self._path = path
        self._buses: dict[int, LiveBus] = {}
        self._load()

    def update(self, item: LiveBus) -> None:
        self._buses[item.bus] = item
        self._save()

    def clear(self, bus: int) -> None:
        if self._buses.pop(bus, None) is not None:
            self._save()

    def fresh(self, now: float | None = None) -> list[LiveBus]:
        now = time.time() if now is None else now
        return [b for b in self._buses.values() if now - b.ts <= STALE_SECONDS]

    def get(self, bus: int) -> LiveBus | None:
        return self._buses.get(bus)

    # ------------------------------------------------------------------ disk
    def _load(self) -> None:
        if not self._path or not self._path.is_file():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            self._buses = {int(k): LiveBus(**v) for k, v in raw.items()}
        except (ValueError, TypeError) as exc:
            logger.warning("live.json o'qilmadi (%s) — bo'sh holatdan boshlanadi", exc)

    def _save(self) -> None:
        if not self._path:
            return
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps({k: asdict(v) for k, v in self._buses.items()}, ensure_ascii=False),
            encoding="utf-8",
        )
        tmp.replace(self._path)

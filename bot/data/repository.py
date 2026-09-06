"""route.json faylini o'qish va keshlash."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from bot.models import Route, RouteDataError

logger = logging.getLogger(__name__)


class RouteRepository:
    """Yo'nalish faylini o'qiydi va xotirada saqlaydi.

    Fayl o'zgarsa `reload()` chaqiriladi — bu admin panel yoki fayl kuzatuvchisi
    qo'shilganda botni qayta ishga tushirmasdan jadvalni yangilash imkonini beradi.
    """

    def __init__(self, route_file: Path) -> None:
        self._route_file = route_file
        self._route: Route | None = None

    @property
    def route_file(self) -> Path:
        return self._route_file

    def get(self) -> Route:
        if self._route is None:
            self._route = self._read()
        return self._route

    def reload(self) -> Route:
        self._route = self._read()
        return self._route

    def _read(self) -> Route:
        logger.info("Yo'nalish fayli o'qilmoqda: %s", self._route_file)
        try:
            raw = json.loads(self._route_file.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise RouteDataError(f"Fayl topilmadi: {self._route_file}") from exc
        except json.JSONDecodeError as exc:
            raise RouteDataError(f"JSON xatosi ({self._route_file}): {exc}") from exc

        route = Route.from_dict(raw)
        logger.info(
            "Yuklandi: %s — %d bekat, %d reys",
            route.route_name, route.stop_count, len(route.trips),
        )
        return route

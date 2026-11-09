"""Haydovchi (pul teruvchi) amallari — API ham, bot ham shu yerdan foydalanadi."""

from __future__ import annotations

import logging
import time

from aiogram import Bot

from bot.config import Settings
from bot.data import RouteRepository
from bot.live import LiveBus, LiveStore

logger = logging.getLogger(__name__)


class DriverError(PermissionError):
    pass


class DriverService:
    def __init__(
        self, repository: RouteRepository, store: LiveStore, settings: Settings, bot: Bot | None
    ) -> None:
        self.repository = repository
        self.store = store
        self.settings = settings
        self.bot = bot
        # Haydovchi botda oxirgi tanlagan avtobus (jonli joylashuv qaysi avtobusga yozilsin)
        self.chosen: dict[int, int] = {}

    def bus_of(self, user_id: int) -> int | None:
        """Haydovchining avtobusi: biriktirilgan yoki oxirgi tanlagani."""
        assigned = self.settings.drivers.get(user_id)
        return assigned if assigned is not None else self.chosen.get(user_id)

    def buses(self) -> list[int]:
        route = self.repository.get()
        numbers = sorted({t.bus for t in route.trips if t.bus is not None})
        return numbers or [1]

    def check(self, user_id: int, bus: int) -> None:
        if bus not in self.buses():
            raise DriverError(f"{bus}-avtobus yo'q")
        if not self.settings.may_drive(user_id, bus):
            raise DriverError("Sizga bu avtobus biriktirilmagan")

    def report_location(
        self,
        user_id: int,
        bus: int,
        lat: float,
        lng: float,
        heading: float | None = None,
        speed: float | None = None,
    ) -> LiveBus:
        self.check(user_id, bus)
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise ValueError("Koordinata noto'g'ri")
        item = LiveBus(
            bus=bus, lat=lat, lng=lng, source="gps", ts=time.time(),
            heading=heading, speed=speed, driver_id=user_id,
        )
        self.store.update(item)
        return item

    async def report_stop(self, user_id: int, bus: int, stop_index: int) -> LiveBus:
        """Avtobus shu bekatda — xaritada joyini qo'yadi va guruhga xabar yuboradi."""
        self.check(user_id, bus)
        route = self.repository.get()
        if not 0 <= stop_index < route.stop_count:
            raise ValueError("Bekat topilmadi")
        stop = route.stop_at(stop_index)
        previous = self.store.get(bus)
        item = LiveBus(
            bus=bus, lat=stop.lat, lng=stop.lng, source="stop", ts=time.time(),
            heading=previous.heading if previous else None, stop_index=stop_index,
            driver_id=user_id,
        )
        self.store.update(item)
        await self._announce(f"📍 <b>{bus}-avtobus</b> — {stop.name} ({route.now():%H:%M})")
        return item

    def finish(self, user_id: int, bus: int) -> None:
        self.check(user_id, bus)
        self.store.clear(bus)

    async def _announce(self, text: str) -> None:
        if self.bot is None or self.settings.group_chat_id is None:
            return
        try:
            await self.bot.send_message(self.settings.group_chat_id, text, parse_mode="HTML")
        except Exception:  # guruhga yozib bo'lmasa ham joylashuv saqlanadi
            logger.exception("Guruhga xabar yuborilmadi")

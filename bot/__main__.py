"""Kirish nuqtasi: `python -m bot`.

Sozlamalar muhit o'zgaruvchilaridan o'qiladi, repository va settings esa
aiogram workflow_data orqali barcha handlerlarga uzatiladi (dependency
injection) — global o'zgaruvchilar ishlatilmaydi.
"""

from __future__ import annotations

import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot.config import ConfigError, Settings
from bot.data import RouteRepository
from bot.handlers import build_router
from bot.models import RouteDataError

logger = logging.getLogger("bot")


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )
    logging.getLogger("aiogram.event").setLevel(logging.WARNING)


async def run(settings: Settings) -> None:
    repository = RouteRepository(settings.route_file)
    route = repository.get()  # ishga tushishdan oldin ma'lumotni tekshiramiz

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dispatcher = Dispatcher(repository=repository, settings=settings)
    dispatcher.include_router(build_router())

    if settings.webapp_url is None:
        logger.warning("WEBAPP_URL o'rnatilmagan — 🗺 Jonli xarita tugmasi ko'rsatilmaydi.")

    logger.info(
        "Bot ishga tushdi: %s (%d bekat, %d reys)",
        route.route_name, route.stop_count, len(route.trips),
    )
    try:
        await dispatcher.start_polling(bot)
    finally:
        await bot.session.close()


def main() -> int:
    configure_logging()
    try:
        settings = Settings.from_env()
    except ConfigError as exc:
        logger.error("Sozlama xatosi: %s", exc)
        return 2

    try:
        asyncio.run(run(settings))
    except RouteDataError as exc:
        logger.error("Ma'lumot xatosi: %s", exc)
        return 3
    except (KeyboardInterrupt, SystemExit):
        logger.info("To'xtatildi.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Bekat tanlash va jadval ko'rsatish."""

from __future__ import annotations

import logging
from datetime import datetime

from aiogram import Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import CallbackQuery

from bot import texts
from bot.config import Settings
from bot.data import RouteRepository
from bot.keyboards.inline import StopCallback, back_to_stops_keyboard

logger = logging.getLogger(__name__)
router = Router(name="stops")


@router.callback_query(StopCallback.filter())
async def show_stop(
    call: CallbackQuery,
    callback_data: StopCallback,
    repository: RouteRepository,
    settings: Settings,
) -> None:
    route = repository.get()
    index = callback_data.index

    if not 0 <= index < route.stop_count:
        logger.warning("Noma'lum bekat indeksi: %s", index)
        await call.answer(texts.ERROR_UNKNOWN_STOP, show_alert=True)
        return

    body = texts.stop_schedule(route, index, datetime.now(), settings.next_limit)

    if call.message is None:
        await call.answer()
        return

    try:
        await call.message.edit_text(
            body,
            parse_mode="HTML",
            reply_markup=back_to_stops_keyboard(index),
        )
    except TelegramBadRequest as exc:
        # "message is not modified" — 🔄 Yangilash bosilganda, lekin
        # daqiqa o'zgarmagan bo'lsa yuz beradi. Bu xato emas.
        if "message is not modified" not in str(exc):
            raise
        await call.answer(texts.NOTICE_NO_CHANGE)
        return

    await call.answer()

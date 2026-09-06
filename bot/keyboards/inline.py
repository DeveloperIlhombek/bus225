"""Inline klaviaturalar va callback ma'lumotlari."""

from __future__ import annotations

from aiogram.filters.callback_data import CallbackData
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

from bot import texts
from bot.models import Route


class StopCallback(CallbackData, prefix="stop"):
    """Bekat tanlanganda yuboriladigan callback."""

    index: int


class NavCallback(CallbackData, prefix="nav"):
    """Navigatsiya harakatlari."""

    action: str  # "stops"


def stops_keyboard(route: Route, webapp_url: str | None = None) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for index, stop in enumerate(route.stops):
        builder.button(text=stop.name, callback_data=StopCallback(index=index))
    builder.adjust(1)

    if webapp_url:
        builder.row(
            InlineKeyboardButton(text=texts.BTN_LIVE_MAP, web_app=WebAppInfo(url=webapp_url))
        )
    return builder.as_markup()


def back_to_stops_keyboard(stop_index: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BTN_REFRESH, callback_data=StopCallback(index=stop_index))
    builder.button(text=texts.BTN_BACK_TO_STOPS, callback_data=NavCallback(action="stops"))
    builder.adjust(1)
    return builder.as_markup()

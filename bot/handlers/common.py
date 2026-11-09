"""Umumiy buyruqlar: /start, /help va navigatsiya."""

from __future__ import annotations

import logging

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, Message

from bot import texts
from bot.config import Settings
from bot.data import RouteRepository
from bot.keyboards.inline import NavCallback, stops_keyboard

logger = logging.getLogger(__name__)
router = Router(name="common")


@router.message(CommandStart())
async def cmd_start(
    message: Message, repository: RouteRepository, settings: Settings
) -> None:
    route = repository.get()
    await message.answer(
        texts.greeting(route),
        parse_mode="HTML",
        reply_markup=stops_keyboard(route, settings.webapp_url),
    )


def _timetable_text(repository: RouteRepository) -> str:
    route = repository.get()
    return texts.timetable(route, route.now().date())


@router.message(Command("jadval"))
async def cmd_timetable(message: Message, repository: RouteRepository) -> None:
    await message.answer(_timetable_text(repository), parse_mode="HTML")


@router.callback_query(NavCallback.filter(F.action == "timetable"))
async def show_timetable(call: CallbackQuery, repository: RouteRepository) -> None:
    if isinstance(call.message, Message):
        await call.message.answer(_timetable_text(repository), parse_mode="HTML")
    await call.answer()


@router.message(Command("help"))
async def cmd_help(message: Message, repository: RouteRepository) -> None:
    route = repository.get()
    group = f"\n\n💬 Guruh: {route.telegram_group}" if route.telegram_group else ""
    await message.answer(
        f"🚌 <b>{route.route_name}</b>\n\n"
        "/start — bekatlar ro'yxati\n"
        "/jadval — to'liq jadval (plakatdagidek)\n"
        "/help — shu yordam\n\n"
        "Bekatni tanlasangiz, bot hozirgi vaqtga qarab keyingi avtobuslarni "
        "ikkala yo'nalish bo'yicha alohida ko'rsatadi."
        f"{group}",
        parse_mode="HTML",
    )


@router.callback_query(NavCallback.filter(F.action == "stops"))
async def back_to_stops(
    call: CallbackQuery, repository: RouteRepository, settings: Settings
) -> None:
    route = repository.get()
    if isinstance(call.message, Message):
        await call.message.edit_text(
            texts.PROMPT_PICK_STOP,
            reply_markup=stops_keyboard(route, settings.webapp_url),
        )
    await call.answer()

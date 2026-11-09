"""Haydovchi (pul teruvchi) uchun: panel, jonli joylashuv, bekat tugmalari."""

from __future__ import annotations

import logging

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.filters.callback_data import CallbackData
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder

from bot.config import Settings
from bot.services.driver import DriverError, DriverService

logger = logging.getLogger(__name__)
router = Router(name="driver")


class BusPick(CallbackData, prefix="dbus"):
    bus: int


class StopMark(CallbackData, prefix="dstop"):
    bus: int
    stop: int


HOW_TO_SHARE = (
    "📡 <b>Jonli joylashuv</b> (eng aniq usul):\n"
    "📎 → Joylashuv → <b>Jonli joylashuvni ulashish</b> → <b>8 soat</b>.\n"
    "Telefon cho'ntakda tursa ham ishlayveradi. Android'da Telegram uchun "
    "batareya cheklovini o'chirib qo'ying.\n\n"
    "📍 Zaxira: pastdagi bekat tugmalarini bosing — bekat xaritada belgilanadi."
)


def driver_panel_url(settings: Settings) -> str | None:
    if not settings.webapp_url:
        return None
    return settings.webapp_url.rstrip("/") + "/driver/"


def stops_markup(service: DriverService, bus: int, settings: Settings) -> InlineKeyboardMarkup:
    route = service.repository.get()
    builder = InlineKeyboardBuilder()
    for index, stop in enumerate(route.stops):
        builder.button(text=f"📍 {stop.name}", callback_data=StopMark(bus=bus, stop=index))
    builder.adjust(2)
    url = driver_panel_url(settings)
    if url:
        builder.row(InlineKeyboardButton(text="🚌 Haydovchi paneli", web_app=WebAppInfo(url=url)))
    return builder.as_markup()


@router.message(Command("myid"))
async def cmd_myid(message: Message) -> None:
    if message.from_user is None:
        return
    text = (
        f"Sizning Telegram ID: <code>{message.from_user.id}</code>\n"
        "Haydovchi bo'lish uchun shu raqamni adminga yuboring."
    )
    if message.chat.type in ("group", "supergroup"):
        text += f"\n\nShu guruh ID'si (GROUP_CHAT_ID): <code>{message.chat.id}</code>"
    await message.answer(text, parse_mode="HTML")


@router.message(Command("haydovchi"))
async def cmd_driver(message: Message, settings: Settings, driver_service: DriverService) -> None:
    user = message.from_user
    if user is None or not settings.is_driver(user.id):
        await message.answer("Bu bo'lim faqat haydovchilar uchun. /myid — ID'ingizni bilish.")
        return
    bus = driver_service.bus_of(user.id)
    if bus is None:
        builder = InlineKeyboardBuilder()
        for number in driver_service.buses():
            builder.button(text=f"🚌 {number}-avtobus", callback_data=BusPick(bus=number))
        builder.adjust(3)
        await message.answer("Qaysi avtobusdasiz?", reply_markup=builder.as_markup())
        return
    await message.answer(
        f"🚌 <b>{bus}-avtobus</b>\n\n{HOW_TO_SHARE}",
        parse_mode="HTML",
        reply_markup=stops_markup(driver_service, bus, settings),
    )


@router.callback_query(BusPick.filter())
async def pick_bus(
    call: CallbackQuery, callback_data: BusPick, settings: Settings, driver_service: DriverService
) -> None:
    try:
        driver_service.check(call.from_user.id, callback_data.bus)
    except DriverError as exc:
        await call.answer(str(exc), show_alert=True)
        return
    driver_service.chosen[call.from_user.id] = callback_data.bus
    if isinstance(call.message, Message):
        await call.message.edit_text(
            f"🚌 <b>{callback_data.bus}-avtobus</b>\n\n{HOW_TO_SHARE}",
            parse_mode="HTML",
            reply_markup=stops_markup(driver_service, callback_data.bus, settings),
        )
    await call.answer()


@router.callback_query(StopMark.filter())
async def mark_stop(
    call: CallbackQuery, callback_data: StopMark, driver_service: DriverService
) -> None:
    try:
        await driver_service.report_stop(call.from_user.id, callback_data.bus, callback_data.stop)
    except (DriverError, ValueError) as exc:
        await call.answer(str(exc), show_alert=True)
        return
    stop = driver_service.repository.get().stop_at(callback_data.stop)
    await call.answer(f"✅ {stop.name} belgilandi")


@router.message(F.location)
@router.edited_message(F.location)
async def on_location(message: Message, settings: Settings, driver_service: DriverService) -> None:
    """Haydovchining (jonli) joylashuvi — har yangilanishda keladi."""
    user = message.from_user
    if user is None or message.location is None or not settings.is_driver(user.id):
        return
    bus = driver_service.bus_of(user.id)
    if bus is None:
        if message.edit_date is None:
            await message.answer("Avval avtobusni tanlang: /haydovchi")
        return
    loc = message.location
    try:
        driver_service.report_location(
            user.id, bus, loc.latitude, loc.longitude,
            float(loc.heading) if loc.heading else None, None,
        )
    except (DriverError, ValueError) as exc:
        logger.warning("Joylashuv rad etildi: %s", exc)
        return
    if message.edit_date is None:
        live = "jonli " if loc.live_period else ""
        await message.answer(f"✅ {bus}-avtobusning {live}joylashuvi qabul qilindi.")

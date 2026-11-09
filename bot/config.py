"""Muhit o'zgaruvchilaridan o'qiladigan sozlamalar."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ROUTE_FILE = PROJECT_ROOT / "data" / "route.json"


class ConfigError(RuntimeError):
    """Sozlamalar noto'g'ri yoki yetishmayotganda ko'tariladi."""


def _parse_drivers(raw: str) -> dict[int, int | None]:
    """'111:1, 222:2, 333' → {111: 1, 222: 2, 333: None} (None — istalgan avtobus)."""
    drivers: dict[int, int | None] = {}
    for part in raw.replace(";", ",").split(","):
        part = part.strip()
        if not part:
            continue
        user, _, bus = part.partition(":")
        try:
            drivers[int(user)] = int(bus) if bus else None
        except ValueError as exc:
            raise ConfigError(
                f"DRIVERS noto'g'ri: {part!r} ('telegram_id:avtobus' kutilgan)"
            ) from exc
    return drivers


@dataclass(frozen=True, slots=True)
class Settings:
    bot_token: str
    webapp_url: str | None
    route_file: Path
    next_limit: int
    # Haydovchi / pul teruvchilar: Telegram ID → avtobus raqami (None — istalgan)
    drivers: dict[int, int | None] = field(default_factory=dict)
    # Bekat xabarlari yuboriladigan guruh (masalan, -1001234567890). None — yubormaydi.
    group_chat_id: int | None = None
    # Jonli joylashuv API'si (nginx orqasida)
    api_host: str = "127.0.0.1"
    api_port: int = 8080
    cors_origins: tuple[str, ...] = ("https://developerilhombek.github.io",)
    live_file: Path = PROJECT_ROOT / "data" / "live.json"

    def is_driver(self, user_id: int) -> bool:
        return user_id in self.drivers

    def may_drive(self, user_id: int, bus: int) -> bool:
        """Foydalanuvchi shu avtobus nomidan joylashuv yubora oladimi."""
        if user_id not in self.drivers:
            return False
        assigned = self.drivers[user_id]
        return assigned is None or assigned == bus

    @classmethod
    def from_env(cls) -> Settings:
        token = os.getenv("BOT_TOKEN", "").strip()
        if not token:
            raise ConfigError(
                "BOT_TOKEN o'rnatilmagan. @BotFather dan token oling va "
                "muhit o'zgaruvchisiga yozing (.env.example fayliga qarang)."
            )

        webapp_url = os.getenv("WEBAPP_URL", "").strip() or None
        if webapp_url and not webapp_url.startswith("https://"):
            raise ConfigError(
                f"WEBAPP_URL https:// bilan boshlanishi shart (Telegram talabi): {webapp_url}"
            )

        route_file = Path(os.getenv("ROUTE_FILE", DEFAULT_ROUTE_FILE)).resolve()
        if not route_file.is_file():
            raise ConfigError(f"Yo'nalish fayli topilmadi: {route_file}")

        try:
            next_limit = int(os.getenv("NEXT_LIMIT", "3"))
        except ValueError as exc:
            raise ConfigError("NEXT_LIMIT butun son bo'lishi kerak.") from exc
        if next_limit < 1:
            raise ConfigError("NEXT_LIMIT kamida 1 bo'lishi kerak.")

        group = os.getenv("GROUP_CHAT_ID", "").strip()
        try:
            group_chat_id = int(group) if group else None
            api_port = int(os.getenv("API_PORT", "8080"))
        except ValueError as exc:
            raise ConfigError("GROUP_CHAT_ID va API_PORT butun son bo'lishi kerak.") from exc

        origins = tuple(
            o.strip().rstrip("/")
            for o in os.getenv("CORS_ORIGINS", "https://developerilhombek.github.io").split(",")
            if o.strip()
        )

        return cls(
            bot_token=token,
            webapp_url=webapp_url,
            route_file=route_file,
            next_limit=next_limit,
            drivers=_parse_drivers(os.getenv("DRIVERS", "")),
            group_chat_id=group_chat_id,
            api_host=os.getenv("API_HOST", "127.0.0.1"),
            api_port=api_port,
            cors_origins=origins,
            live_file=Path(os.getenv("LIVE_FILE", PROJECT_ROOT / "data" / "live.json")).resolve(),
        )

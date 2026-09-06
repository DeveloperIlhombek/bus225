"""Muhit o'zgaruvchilaridan o'qiladigan sozlamalar."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ROUTE_FILE = PROJECT_ROOT / "data" / "route.json"


class ConfigError(RuntimeError):
    """Sozlamalar noto'g'ri yoki yetishmayotganda ko'tariladi."""


@dataclass(frozen=True, slots=True)
class Settings:
    bot_token: str
    webapp_url: str | None
    route_file: Path
    next_limit: int

    @classmethod
    def from_env(cls) -> "Settings":
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

        return cls(
            bot_token=token,
            webapp_url=webapp_url,
            route_file=route_file,
            next_limit=next_limit,
        )

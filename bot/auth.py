"""Telegram Mini App `initData` imzosini tekshirish.

Haydovchi panelidan kelgan so'rov haqiqatan Telegram ichidan, shu bot orqali
ochilganini va foydalanuvchi kimligini bilish uchun ishlatiladi.
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

# initData shuncha vaqtdan eski bo'lsa — rad etiladi
MAX_AGE_SECONDS = 24 * 3600


class AuthError(ValueError):
    pass


def validate_init_data(
    init_data: str, bot_token: str, now: float | None = None
) -> dict[str, object]:
    """Imzo to'g'ri bo'lsa foydalanuvchi ma'lumotini qaytaradi, aks holda AuthError."""
    pairs = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=False))
    received = pairs.pop("hash", None)
    if not received:
        raise AuthError("initData'da imzo yo'q")

    check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        raise AuthError("initData imzosi noto'g'ri")

    auth_date = int(pairs.get("auth_date", "0") or 0)
    if (time.time() if now is None else now) - auth_date > MAX_AGE_SECONDS:
        raise AuthError("initData eskirgan — Mini App'ni qayta oching")

    try:
        user = json.loads(pairs.get("user", "{}"))
    except ValueError as exc:
        raise AuthError("initData'da foydalanuvchi yo'q") from exc
    if not isinstance(user, dict) or "id" not in user:
        raise AuthError("initData'da foydalanuvchi yo'q")
    return user

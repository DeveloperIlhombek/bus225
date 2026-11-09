"""Jonli joylashuv HTTP API'si (aiohttp, bot bilan bitta jarayonda).

GET  /api/live              — yo'lovchilar xaritasi uchun: avtobuslarning jonli holati
GET  /api/driver/me         — haydovchi panelini ochgan foydalanuvchi kim
POST /api/driver/location   — {bus, lat, lng, heading?, speed?}
POST /api/driver/stop       — {bus, stop}  (bekat indeksi)
POST /api/driver/finish     — {bus}

Haydovchi so'rovlari `Authorization: tma <initData>` bilan imzolanadi.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

from aiohttp import web

from bot.auth import AuthError, validate_init_data
from bot.services.driver import DriverError, DriverService

logger = logging.getLogger(__name__)

Handler = Callable[[web.Request], Awaitable[web.StreamResponse]]
SERVICE = web.AppKey("driver_service", DriverService)


def _cors(allowed: tuple[str, ...]) -> Any:
    @web.middleware
    async def middleware(request: web.Request, handler: Handler) -> web.StreamResponse:
        if request.method == "OPTIONS":
            response: web.StreamResponse = web.Response(status=204)
        else:
            try:
                response = await handler(request)
            except web.HTTPException as exc:
                response = exc
        origin = request.headers.get("Origin", "")
        if origin in allowed or "*" in allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        return response

    return middleware


def _error(status: int, message: str) -> web.Response:
    return web.json_response({"ok": False, "error": message}, status=status)


def _user_id(request: web.Request) -> int:
    service = request.app[SERVICE]
    header = request.headers.get("Authorization", "")
    if not header.startswith("tma "):
        raise AuthError("Telegram orqali oching")
    user = validate_init_data(header[4:], service.settings.bot_token)
    return int(str(user["id"]))


async def live(request: web.Request) -> web.Response:
    service = request.app[SERVICE]
    return web.json_response(
        {"now": time.time(), "buses": [b.public() for b in service.store.fresh()]},
        headers={"Cache-Control": "no-store"},
    )


async def me(request: web.Request) -> web.Response:
    service = request.app[SERVICE]
    try:
        user_id = _user_id(request)
    except AuthError as exc:
        return _error(401, str(exc))
    assigned = service.settings.drivers.get(user_id)
    allowed = (
        [b for b in service.buses() if assigned is None or b == assigned]
        if service.settings.is_driver(user_id)
        else []
    )
    route = service.repository.get()
    return web.json_response(
        {
            "ok": True,
            "user_id": user_id,
            "is_driver": bool(allowed),
            "buses": allowed,
            "stops": [s.name for s in route.stops],
        }
    )


async def _payload(request: web.Request) -> dict[str, Any]:
    try:
        data = await request.json()
    except ValueError as exc:
        raise ValueError("JSON kutilgan") from exc
    if not isinstance(data, dict):
        raise ValueError("JSON obyekt kutilgan")
    return data


def _opt_float(value: Any) -> float | None:
    return None if value is None else float(value)


async def _driver_action(request: web.Request, action: str) -> web.Response:
    service = request.app[SERVICE]
    try:
        user_id = _user_id(request)
        data = await _payload(request)
        bus = int(data["bus"])
        if action == "location":
            item = service.report_location(
                user_id, bus, float(data["lat"]), float(data["lng"]),
                _opt_float(data.get("heading")), _opt_float(data.get("speed")),
            )
            return web.json_response({"ok": True, "bus": item.public()})
        if action == "stop":
            item = await service.report_stop(user_id, bus, int(data["stop"]))
            return web.json_response({"ok": True, "bus": item.public()})
        service.finish(user_id, bus)
        return web.json_response({"ok": True})
    except AuthError as exc:
        return _error(401, str(exc))
    except DriverError as exc:
        return _error(403, str(exc))
    except (KeyError, TypeError, ValueError) as exc:
        return _error(400, f"Noto'g'ri so'rov: {exc}")


async def location(request: web.Request) -> web.Response:
    return await _driver_action(request, "location")


async def stop(request: web.Request) -> web.Response:
    return await _driver_action(request, "stop")


async def finish(request: web.Request) -> web.Response:
    return await _driver_action(request, "finish")


async def health(_: web.Request) -> web.Response:
    return web.json_response({"ok": True})


def build_app(service: DriverService) -> web.Application:
    app = web.Application(middlewares=[_cors(service.settings.cors_origins)])
    app[SERVICE] = service
    app.router.add_get("/api/health", health)
    app.router.add_get("/api/live", live)
    app.router.add_get("/api/driver/me", me)
    app.router.add_post("/api/driver/location", location)
    app.router.add_post("/api/driver/stop", stop)
    app.router.add_post("/api/driver/finish", finish)
    for path in ("/api/live", "/api/driver/me", "/api/driver/location", "/api/driver/stop",
                 "/api/driver/finish"):
        app.router.add_route("OPTIONS", path, health)
    return app

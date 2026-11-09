"""Haydovchi API'si: initData imzosi, ruxsatlar, jonli holat."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from pathlib import Path
from urllib.parse import urlencode

import pytest
from aiohttp.test_utils import TestClient, TestServer

from bot.api import build_app
from bot.auth import AuthError, validate_init_data
from bot.config import Settings
from bot.data import RouteRepository
from bot.live import STALE_SECONDS, LiveStore
from bot.services.driver import DriverService

TOKEN = "123456:TEST-token"
ROOT = Path(__file__).resolve().parent.parent


def sign(user_id: int, auth_date: int | None = None, token: str = TOKEN) -> str:
    fields = {
        "auth_date": str(auth_date or int(time.time())),
        "query_id": "AAE",
        "user": json.dumps({"id": user_id, "first_name": "Test"}),
    }
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


class TestInitData:
    def test_valid(self) -> None:
        assert validate_init_data(sign(42), TOKEN)["id"] == 42

    def test_wrong_token(self) -> None:
        with pytest.raises(AuthError, match="imzosi"):
            validate_init_data(sign(42, token="other:token"), TOKEN)

    def test_expired(self) -> None:
        with pytest.raises(AuthError, match="eskirgan"):
            validate_init_data(sign(42, auth_date=1), TOKEN)


@pytest.fixture
def service(tmp_path: Path) -> DriverService:
    settings = Settings(
        bot_token=TOKEN,
        webapp_url=None,
        route_file=ROOT / "data" / "route.json",
        next_limit=3,
        drivers={111: 1, 222: None},
        cors_origins=("https://example.github.io",),
    )
    return DriverService(
        RouteRepository(settings.route_file), LiveStore(tmp_path / "live.json"), settings, None
    )


async def client_for(service: DriverService) -> TestClient:  # type: ignore[type-arg]
    client = TestClient(TestServer(build_app(service)))
    await client.start_server()
    return client


async def test_driver_flow(service: DriverService) -> None:
    client = await client_for(service)
    try:
        auth = {"Authorization": f"tma {sign(111)}"}
        me = await (await client.get("/api/driver/me", headers=auth)).json()
        assert me["is_driver"] and me["buses"] == [1]

        r = await client.post(
            "/api/driver/location", headers=auth, json={"bus": 1, "lat": 39.8, "lng": 67.1}
        )
        assert r.status == 200

        # Boshqa avtobus nomidan — ruxsat yo'q
        r = await client.post(
            "/api/driver/location", headers=auth, json={"bus": 2, "lat": 39.8, "lng": 67.1}
        )
        assert r.status == 403

        r = await client.post("/api/driver/stop", headers=auth, json={"bus": 1, "stop": 0})
        assert (await r.json())["bus"]["source"] == "stop"

        live = await (await client.get("/api/live")).json()
        assert [(b["bus"], b["stop_index"]) for b in live["buses"]] == [(1, 0)]
        assert "driver_id" not in live["buses"][0]
    finally:
        await client.close()


async def test_unsigned_and_strangers_are_rejected(service: DriverService) -> None:
    client = await client_for(service)
    try:
        r = await client.post("/api/driver/location", json={"bus": 1, "lat": 1, "lng": 1})
        assert r.status == 401
        stranger = {"Authorization": f"tma {sign(999)}"}
        me = await (await client.get("/api/driver/me", headers=stranger)).json()
        assert me["is_driver"] is False
        r = await client.post(
            "/api/driver/location", headers=stranger, json={"bus": 1, "lat": 1, "lng": 1}
        )
        assert r.status == 403
    finally:
        await client.close()


async def test_cors_only_for_allowed_origin(service: DriverService) -> None:
    client = await client_for(service)
    try:
        ok = await client.get("/api/live", headers={"Origin": "https://example.github.io"})
        assert ok.headers.get("Access-Control-Allow-Origin") == "https://example.github.io"
        bad = await client.get("/api/live", headers={"Origin": "https://evil.example"})
        assert "Access-Control-Allow-Origin" not in bad.headers
    finally:
        await client.close()


def test_stale_entries_are_hidden(tmp_path: Path, service: DriverService) -> None:
    service.report_location(222, 3, 39.8, 67.1)
    assert len(service.store.fresh()) == 1
    assert service.store.fresh(now=time.time() + STALE_SECONDS + 1) == []
    # Diskdan qayta o'qiladi
    assert LiveStore(service.store._path).get(3) is not None

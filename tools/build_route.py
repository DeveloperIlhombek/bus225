"""`data/timetable.json` (qo'lda tahrirlanadi) → `data/route.json` (bot va Mini App o'qiydi).

Ishga tushirish:  python -m tools.build_route          # route.json ni qayta yozadi
                  python -m tools.build_route --check  # faqat dolzarbligini tekshiradi (CI)

Manba faylda plakatdagi jadval bor: har bir qator — bitta aylanma reys
(qishloq → shahar → qishloq), qatorlar avtobuslarga navbat bilan beriladi
(1, 2, 3, 1, 2, 3 ...). Plakatda faqat 2-3 ta bekatning vaqti yozilgan,
qolgan bekatlar vaqtini shu skript hisoblaydi:

* ikki ma'lum vaqt orasidagi bekatlar — yo'l masofasiga mutanosib;
* oxirgi ma'lum vaqtdan keyingi bekatlar — o'rtacha tezlik (`speed_kmh`) bo'yicha;
* plakatda bo'sh katak bo'lsa (masalan, Siyobdan jo'nash) — keyingi ma'lum
  vaqtdan tezlik bo'yicha orqaga hisoblanadi;
* avtobus keyingi reysiga ulgurmasa — reysning oxirgi qismi siqiladi.

Natijadagi har bir bir tomonlama reys `route.json` ning odatiy formatida
(`times` — har bir bekat uchun "HH:MM"), shuning uchun bot ham, Mini App ham
hech qanday qo'shimcha mantiqsiz ishlaydi.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from dataclasses import dataclass, field
from itertools import pairwise
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "timetable.json"
TARGET = ROOT / "data" / "route.json"

TO_CITY = "shaharga"
TO_VILLAGE = "qishloqqa"
TIME_RE = re.compile(r"(\d{1,2})[:.](\d{2})")


class BuildError(ValueError):
    """Manba faylda xato."""


# --------------------------------------------------------------------------- geometriya
def _meters_xy(lat: float) -> tuple[float, float]:
    return 111_320 * math.cos(math.radians(lat)), 110_540


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    kx, ky = _meters_xy((a[0] + b[0]) / 2)
    return math.hypot((a[1] - b[1]) * kx, (a[0] - b[0]) * ky)


@dataclass(frozen=True)
class Projection:
    s: float  # chiziq boshidan masofa, m
    offset: float  # chiziqdan chetlanish, m
    segment: int  # qaysi kesmada
    point: tuple[float, float]


def project(
    path: list[tuple[float, float]], cum: list[float], p: tuple[float, float]
) -> Projection:
    kx, ky = _meters_xy(p[0])
    best: Projection | None = None
    for i in range(len(path) - 1):
        a, b = path[i], path[i + 1]
        ax, ay = (a[1] - p[1]) * kx, (a[0] - p[0]) * ky
        dx, dy = (b[1] - a[1]) * kx, (b[0] - a[0]) * ky
        l2 = dx * dx + dy * dy
        t = max(0.0, min(1.0, -(ax * dx + ay * dy) / l2)) if l2 else 0.0
        off = math.hypot(ax + dx * t, ay + dy * t)
        if best is None or off < best.offset:
            point = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            best = Projection(cum[i] + math.sqrt(l2) * t, off, i, point)
    assert best is not None
    return best


def split_legs(
    path: list[tuple[float, float]], projections: list[Projection]
) -> list[list[list[float]]]:
    """Yo'l chizig'ini bekatlar orasidagi bo'laklarga ajratadi (`geometry.legs`)."""
    legs = []
    for a, b in pairwise(projections):
        points = [a.point, *path[a.segment + 1 : b.segment + 1], b.point]
        clean: list[tuple[float, float]] = []
        for p in points:
            if not clean or _dist(clean[-1], p) > 0.5:
                clean.append(p)
        if len(clean) < 2:
            clean = [a.point, b.point]
        legs.append([[round(lat, 5), round(lng, 5)] for lat, lng in clean])
    return legs


# --------------------------------------------------------------------------- vaqt
def parse_cell(cell: Any) -> tuple[float | None, str]:
    """'07:50', 'Shaymandan 07:50', null → (daqiqa, izoh)."""
    if cell is None:
        return None, ""
    text = str(cell)
    m = TIME_RE.search(text)
    if not m:
        raise BuildError(f"Jadval katagida vaqt topilmadi: {cell!r}")
    hours, minutes = int(m.group(1)), int(m.group(2))
    if not (0 <= hours < 24 and 0 <= minutes < 60):
        raise BuildError(f"Vaqt chegaradan tashqarida: {cell!r}")
    note = (text[: m.start()] + text[m.end() :]).strip()
    return float(hours * 60 + minutes), note


def fmt(minutes: float) -> str:
    m = round(minutes) % 1440
    return f"{m // 60:02d}:{m % 60:02d}"


def fill_leg(
    order: list[int],
    s: list[float],
    anchors: dict[int, float],
    speed: float,
) -> dict[int, float]:
    """Bir tomonlama reys bo'yicha har bir bekat vaqtini hisoblaydi.

    `order` — bekat indekslari harakat tartibida, `anchors` — plakatdagi
    ma'lum vaqtlar (bekat indeksi → daqiqa), `speed` — metr/daqiqa.
    """
    known = [i for i in order if i in anchors]
    if not known:
        raise BuildError("Reysda birorta ham ma'lum vaqt yo'q.")
    pos = {stop: k for k, stop in enumerate(order)}

    def dist(a: int, b: int) -> float:
        return abs(s[a] - s[b])

    times: dict[int, float] = {}
    # Birinchi ma'lum vaqtgacha bo'lgan bekatlar — tezlik bo'yicha orqaga
    first = known[0]
    for stop in order[: pos[first]]:
        times[stop] = anchors[first] - dist(stop, first) / speed
    # Ma'lum vaqtlar orasidagilar — masofaga mutanosib
    for a, b in pairwise(known):
        if anchors[b] < anchors[a]:
            raise BuildError("Plakatdagi vaqtlar harakat tartibida o'smayapti.")
        total = dist(a, b) or 1.0
        for stop in order[pos[a] : pos[b] + 1]:
            times[stop] = anchors[a] + (anchors[b] - anchors[a]) * dist(a, stop) / total
    # Oxirgi ma'lum vaqtdan keyingilar — tezlik bo'yicha
    last = known[-1]
    for stop in order[pos[last] :]:
        times[stop] = anchors[last] + dist(last, stop) / speed
    return times


def squeeze_tail(
    times: dict[int, float], order: list[int], anchors: set[int], limit: float
) -> None:
    """Reys `limit` dan kech tugasa — oxirgi ma'lum vaqtdan keyingi qismini siqadi."""
    end = times[order[-1]]
    if end <= limit:
        return
    known = [i for i in order if i in anchors]
    t0 = times[known[-1]] if known else times[order[0]]
    if end - t0 <= 0 or limit <= t0:
        raise BuildError(f"Reys {fmt(t0)} dan keyin {fmt(limit)} gacha tugashi mumkin emas.")
    k = (limit - t0) / (end - t0)
    for stop in order[order.index(known[-1]) + 1 :] if known else order:
        times[stop] = t0 + (times[stop] - t0) * k


@dataclass
class Round:
    """Plakatdagi bitta qator — bitta aylanma reys."""

    row: int
    bus: int
    anchors: dict[str, dict[int, float]]
    up: dict[int, float] | None = field(default=None)
    down: dict[int, float] | None = field(default=None)


# --------------------------------------------------------------------------- asosiy
def build(source: dict[str, Any]) -> dict[str, Any]:
    stops = source["stops"]
    if len(stops) < 2:
        raise BuildError("Kamida 2 ta bekat kerak.")
    ids = [st["id"] for st in stops]
    if len(set(ids)) != len(ids):
        raise BuildError("Bekat id'lari takrorlanmasligi kerak.")
    index = {sid: i for i, sid in enumerate(ids)}
    n = len(stops)

    # Yo'l chizig'i (qishloqdan shaharga). Bo'lmasa — bekatlar to'g'ri chiziq bilan.
    raw_path = source.get("path") or [[st["lat"], st["lng"]] for st in stops]
    path = [(float(a), float(b)) for a, b in raw_path]
    cum = [0.0]
    for a, b in pairwise(path):
        cum.append(cum[-1] + _dist(a, b))
    projections = [project(path, cum, (st["lat"], st["lng"])) for st in stops]
    for st, pr in zip(stops, projections, strict=True):
        if pr.offset > 150:
            raise BuildError(f"{st['name']} yo'l chizig'idan {pr.offset:.0f} m uzoqda.")
    s = [pr.s for pr in projections]
    for i in range(n - 1):
        if s[i + 1] <= s[i]:
            raise BuildError(
                f"Bekatlar tartibi yo'l bo'yicha emas: {stops[i]['name']} → {stops[i + 1]['name']}"
            )

    speed = float(source.get("speed_kmh", 40)) * 1000 / 60  # m/daqiqa
    buses = int(source.get("buses", 1))
    columns = source["timetable"]["columns"]
    rows = source["timetable"]["rows"]
    for col in columns:
        if col["stop"] not in index:
            raise BuildError(f"Jadval ustunidagi bekat topilmadi: {col['stop']}")
        if col["direction"] not in (TO_CITY, TO_VILLAGE):
            raise BuildError(f"Yo'nalish noto'g'ri: {col['direction']}")

    up = list(range(n))  # qishloqdan shaharga
    down = list(reversed(up))  # shahardan qishloqqa

    rounds: list[Round] = []
    table_rows = []
    for k, row in enumerate(rows):
        if len(row) != len(columns):
            raise BuildError(f"{k + 1}-qatorda {len(row)} ta katak, {len(columns)} ta kerak.")
        anchors: dict[str, dict[int, float]] = {TO_CITY: {}, TO_VILLAGE: {}}
        for col, cell in zip(columns, row, strict=True):
            minute, _note = parse_cell(cell)
            if minute is not None:
                anchors[col["direction"]][index[col["stop"]]] = minute
        rounds.append(Round(row=k + 1, bus=k % buses + 1, anchors=anchors))
        table_rows.append({"bus": k % buses + 1, "cells": row})

    # Har bir aylanma reysni hisoblaymiz
    for r in rounds:
        to_city, to_village = r.anchors[TO_CITY], r.anchors[TO_VILLAGE]
        r.up = fill_leg(up, s, to_city, speed) if to_city else None
        r.down = fill_leg(down, s, to_village, speed) if to_village else None
        if r.up and r.down:
            # Shaharga yetib kelish qaytishdagi jo'nashdan kech bo'lmasin
            squeeze_tail(r.up, up, set(to_city), r.down[down[0]] - 1)

    # Avtobus keyingi aylanma reysiga ulgursin
    for i, r in enumerate(rounds):
        nxt = next((q for q in rounds[i + 1 :] if q.bus == r.bus), None)
        if nxt and r.down and nxt.up:
            squeeze_tail(r.down, down, set(r.anchors[TO_VILLAGE]), nxt.up[up[0]] - 1)

    trips = []
    for r in rounds:
        for suffix, times in (("S", r.up), ("Q", r.down)):
            if times:
                trips.append(
                    {
                        "bus_id": f"{r.row:02d}{suffix}",
                        "bus": r.bus,
                        "times": [fmt(times[i]) for i in range(n)],
                    }
                )

    return {
        "_izoh": "AVTOMATIK YARATILGAN — qo'lda tahrirlamang. Manba: data/timetable.json, "
        "buyruq: python -m tools.build_route",
        "route_id": source["route_id"],
        "route_name": source["route_name"],
        "telegram_group": source.get("telegram_group"),
        "timezone_offset_hours": source.get("timezone_offset_hours", 5),
        "buses": buses,
        "stops": [
            {"id": st["id"], "name": st["name"], "lat": st["lat"], "lng": st["lng"]} for st in stops
        ],
        "trips": trips,
        "timetable": {
            "columns": [
                {"stop": index[c["stop"]], "direction": c["direction"], "label": c["label"]}
                for c in columns
            ],
            "rows": table_rows,
        },
        "geometry": {"legs": split_legs(path, projections)},
    }


def render(route: dict[str, Any]) -> str:
    """Odam o'qiy oladigan, lekin ixcham JSON: har bir reys/oraliq bitta qatorda."""
    text = json.dumps(route, ensure_ascii=False, indent=2)
    # [ ... ] ichidagi qisqa elementlarni bitta qatorga yig'amiz
    text = re.sub(
        r"\[\s*((?:\"[^\"\n]*\"|null|-?[\d.]+)"
        r"(?:,\s*(?:\"[^\"\n]*\"|null|-?[\d.]+))*)\s*\]",
        lambda m: "[" + re.sub(r",\s*", ", ", m.group(1)) + "]",
        text,
    )
    text = re.sub(
        r"\[\s*(\[[\d., -]+\](?:,\s*\[[\d., -]+\])*)\s*\]",
        lambda m: "[" + re.sub(r"\s+", "", m.group(1)) + "]",
        text,
    )
    text = re.sub(
        r"\{\s*(\"(?:id|stop|bus_id|bus)\"[^{}\[\]]*?(?:\[[^\[\]]*\])?[^{}\[\]]*?)\s*\}",
        lambda m: "{" + re.sub(r"\s*\n\s*", " ", m.group(1)) + "}",
        text,
    )
    return text + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="faqat tekshirish, yozmaslik")
    args = parser.parse_args(argv)
    try:
        source = json.loads(SOURCE.read_text(encoding="utf-8"))
        text = render(build(source))
    except (BuildError, KeyError) as exc:
        print(f"✗ {SOURCE.name}: {exc}", file=sys.stderr)
        return 2
    if args.check:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != text:
            print(
                "✗ data/route.json eskirgan — `python -m tools.build_route` ni ishga tushiring.",
                file=sys.stderr,
            )
            return 1
        print("✓ data/route.json dolzarb")
        return 0
    TARGET.write_text(text, encoding="utf-8")
    print(f"✓ {TARGET.relative_to(ROOT)} yozildi")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

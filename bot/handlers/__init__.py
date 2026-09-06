"""Barcha handler routerlari shu yerda yig'iladi."""

from aiogram import Router

from .common import router as common_router
from .stops import router as stops_router


def build_router() -> Router:
    root = Router(name="root")
    root.include_router(common_router)
    root.include_router(stops_router)
    return root


__all__ = ["build_router"]

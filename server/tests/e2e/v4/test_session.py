"""E2E skeleton: Session artifact lifecycle (get — used by activity page)."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page

pytestmark = [pytest.mark.e2e]


def test_session_lifecycle(page: Page, base_url: str) -> None:
    """Session lifecycle: get detail → verify on activity page."""
    pytest.skip("Skeleton — not yet implemented")

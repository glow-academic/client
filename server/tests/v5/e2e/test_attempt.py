"""E2E skeleton: Attempt artifact lifecycle (get, archive, certificate)."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page

pytestmark = [pytest.mark.e2e]


def test_attempt_lifecycle(page: Page, base_url: str) -> None:
    """Attempt lifecycle: get detail → verify chat history → archive."""
    pytest.skip("Skeleton — not yet implemented")

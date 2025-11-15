"""Playwright fixtures for local E2E tests with signed headers."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
from typing import Dict, Generator

import pytest
from dotenv import load_dotenv
from playwright.sync_api import Browser, BrowserContext, Page

logger = logging.getLogger(__name__)

load_dotenv()

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")
PROFILE_ID = os.getenv("E2E_PROFILE_ID", "965bd24f-dfae-4063-b370-e1373df46322")
SECRET = os.getenv("AUTH_SECRET", "test_secret_key_for_integration_tests")
STORAGE_STATE = os.getenv("E2E_STORAGE", "")


def _build_test_headers(profile_id: str, effective_profile_id: str) -> Dict[str, str]:
    logger.info(
        "Building test headers for profile_id=%s effective_profile_id=%s",
        profile_id,
        effective_profile_id,
    )
    payload = f"{profile_id}|{effective_profile_id}".encode("utf-8")
    signature = hmac.new(SECRET.encode("utf-8"), payload, hashlib.sha256).digest()
    encoded_signature = base64.b64encode(signature).decode("ascii")

    return {
        "X-Test-Profile-Id": profile_id,
        "X-Test-Effective-Profile-Id": effective_profile_id,
        "X-Test-Signature": encoded_signature,
    }


@pytest.fixture(scope="session")
def base_url() -> str:
    """Return the base URL for tests."""
    return BASE_URL


@pytest.fixture(scope="function")
def context(
    browser: Browser, request: pytest.FixtureRequest
) -> Generator[BrowserContext, None, None]:
    """Provide a fresh browser context for each test."""
    storage_state = STORAGE_STATE
    if storage_state:
        ctx = browser.new_context(storage_state=storage_state)
    else:
        ctx = browser.new_context()
    yield ctx
    ctx.close()


@pytest.fixture(scope="function")
def test_profile_headers(request: pytest.FixtureRequest) -> Dict[str, str]:
    """Return signed test headers, override via marker if needed."""

    profile_id = PROFILE_ID
    effective_profile_id = PROFILE_ID

    marker = request.node.get_closest_marker("test_profile_id")
    if marker:
        profile_id = (
            marker.args[0]
            if marker.args
            else marker.kwargs.get("profile_id", profile_id)
        )
        effective_profile_id = marker.kwargs.get("effective_profile_id", profile_id)
    else:
        marker = request.node.get_closest_marker("test_profile_ids")
        if marker:
            profile_id = marker.kwargs.get("profile_id", profile_id)
            effective_profile_id = marker.kwargs.get("effective_profile_id", profile_id)

    return _build_test_headers(profile_id, effective_profile_id)


@pytest.fixture(scope="function")
def page(context: BrowserContext, test_profile_headers: Dict[str, str]) -> Page:
    """Provide a new page with sensible defaults."""
    p = context.new_page()
    extra_headers = {"X-Bypass-Cache": "1", **test_profile_headers}
    p.set_extra_http_headers(extra_headers)
    p.set_default_timeout(10_000)
    return p

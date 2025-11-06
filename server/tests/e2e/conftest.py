"""Playwright fixtures for local E2E tests."""

import os

import pytest
from playwright.sync_api import BrowserContext, Page

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


@pytest.fixture(scope="session")
def base_url() -> str:
    """Return the base URL for tests."""
    return BASE_URL


@pytest.fixture(scope="function")
def context(browser, request) -> BrowserContext:  # type: ignore[arg-type]
    """Provide a fresh browser context for each test."""
    storage_state = os.getenv("E2E_STORAGE")
    if storage_state:
        ctx = browser.new_context(storage_state=storage_state)
    else:
        ctx = browser.new_context()
    yield ctx
    ctx.close()


@pytest.fixture(scope="function")
def page(context: BrowserContext) -> Page:
    """Provide a new page with sensible defaults."""
    p = context.new_page()
    p.set_extra_http_headers({"X-Bypass-Cache": "1"})
    p.set_default_timeout(10_000)
    return p


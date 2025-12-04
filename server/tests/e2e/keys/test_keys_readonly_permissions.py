"""E2E test validating read-only key guardrails."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.keys.helpers import fetch_keys_list

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_key_readonly_permissions(page: Page, base_url: str) -> None:
    """Verify read-only keys hide editing controls and disable inputs."""
    data = fetch_keys_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    keys = data.get("keys", [])
    readonly_key = next(
        (k for k in keys if not k.get("can_edit") and k.get("key_id")), None
    )
    if not readonly_key:
        pytest.skip("No read-only key available in current dataset")

    key_id = readonly_key["key_id"]
    key_name = readonly_key["name"]

    page.goto(f"{base_url}/system/keys")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("keys-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(key_name)
    page.wait_for_timeout(250)

    key_card = page.locator(
        f"[data-testid='key-card'][data-key-id='{key_id}']"
    )
    expect(key_card).to_be_visible()

    # Verify edit button is not visible, view button is
    expect(key_card.get_by_test_id(f"edit-{key_id}")).to_have_count(0)
    view_button = key_card.get_by_test_id(f"view-{key_id}")
    expect(view_button).to_be_visible()

    # Verify delete button is not visible if permissions don't allow
    if not readonly_key.get("can_delete"):
        expect(key_card.get_by_test_id(f"delete-{key_id}")).to_have_count(0)

    view_button.click()

    page.wait_for_url(f"{base_url}/system/keys/k/{key_id}")
    page.wait_for_load_state("networkidle")

    # Verify page attributes
    container = page.locator("[data-page='key-edit']").first
    expect(container).to_be_visible()
    expect(container).to_have_attribute("data-key-id", key_id)

    # Verify form inputs are disabled (if they exist)
    name_input = page.get_by_test_id("input-key-name")
    if name_input.count():
        expect(name_input).to_be_disabled()

    key_input = page.get_by_test_id("input-key-value")
    if key_input.count():
        expect(key_input).to_be_disabled()

    # Verify department picker is disabled
    department_picker = page.get_by_test_id("picker-department")
    if department_picker.count():
        picker_trigger = department_picker.locator("button").first
        if picker_trigger.count():
            expect(picker_trigger).to_be_disabled()

    # Verify active switch is disabled
    active_switch = page.get_by_test_id("switch-key-active")
    if active_switch.count():
        expect(active_switch).to_be_disabled()

    # Verify submit button is not visible
    submit_button = page.get_by_test_id("btn-submit-key")
    expect(submit_button).to_have_count(0)


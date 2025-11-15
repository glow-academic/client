"""E2E test validating read-only parameter guardrails."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.parameters.helpers import fetch_parameters_list

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_parameter_readonly_permissions(page: Page, base_url: str) -> None:
    """Verify read-only parameters hide editing controls and disable inputs."""
    data = fetch_parameters_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    parameters = data.get("parameters", [])
    readonly_parameter = next(
        (p for p in parameters if not p.get("can_edit") and p.get("parameter_id")),
        None,
    )
    if not readonly_parameter:
        pytest.skip("No read-only parameter available in current dataset")

    parameter_id = readonly_parameter["parameter_id"]
    parameter_name = readonly_parameter["name"]

    page.goto(f"{base_url}/management/parameters")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("parameters-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(parameter_name)
    page.wait_for_timeout(250)

    parameter_card = page.locator(
        f"[data-testid='parameter-card'][data-parameter-id='{parameter_id}']"
    )
    expect(parameter_card).to_be_visible()

    expect(parameter_card.get_by_test_id("btn-edit-parameter")).to_have_count(0)
    view_button = parameter_card.get_by_test_id("btn-view-parameter")
    expect(view_button).to_be_visible()

    view_button.click()

    page.wait_for_url(f"{base_url}/management/parameters/p/{parameter_id}")
    page.wait_for_load_state("networkidle")

    name_input = page.get_by_test_id("input-parameter-name")
    expect(name_input).to_be_disabled()

    description_input = page.get_by_test_id("input-parameter-description")
    expect(description_input).to_be_disabled()

    # Verify switches are disabled
    active_switch = page.get_by_test_id("switch-parameter-active")
    if active_switch.count():
        expect(active_switch).to_be_disabled()

    numerical_switch = page.get_by_test_id("switch-parameter-numerical")
    if numerical_switch.count():
        expect(numerical_switch).to_be_disabled()

    # Verify submit button is disabled or not visible
    submit_button = page.get_by_test_id("btn-submit-parameter")
    if submit_button.count():
        expect(submit_button).to_be_disabled()

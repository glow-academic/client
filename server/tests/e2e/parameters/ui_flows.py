"""Reusable UI flow functions for parameter E2E tests."""

from __future__ import annotations

import re
import sys

from playwright.sync_api import Page

from server.tests.e2e.parameters.helpers import generate_unique_parameter_name


def create_parameter_via_ui(
    page: Page,
    base_url: str,
    *,
    name: str | None = None,
    description: str = "Parameter created via UI flow.",
    numerical: bool = False,
    active: bool = True,
    document_parameter: bool = False,
    practice_parameter: bool = False,
) -> tuple[str, str]:
    """Create a parameter via UI and return (parameter_name, parameter_id)."""
    parameter_name = name or generate_unique_parameter_name("UI Parameter")

    page.goto(f"{base_url}/management/parameters/new")
    page.wait_for_load_state("networkidle")

    name_input = page.get_by_test_id("input-parameter-name")
    name_input.wait_for(state="visible", timeout=15000)
    name_input.fill(parameter_name)

    description_input = page.get_by_test_id("input-parameter-description")
    description_input.wait_for(state="visible", timeout=15000)
    description_input.fill(description)

    # Toggle switches if needed
    if active:
        active_switch = page.get_by_test_id("switch-parameter-active")
        if active_switch.count() and not active_switch.is_checked():
            active_switch.click()

    if numerical:
        numerical_switch = page.get_by_test_id("switch-parameter-numerical")
        if numerical_switch.count() and not numerical_switch.is_checked():
            numerical_switch.click()

    if document_parameter:
        document_switch = page.get_by_test_id("switch-parameter-document")
        if document_switch.count() and not document_switch.is_checked():
            document_switch.click()

    if practice_parameter:
        practice_switch = page.get_by_test_id("switch-parameter-practice")
        if practice_switch.count() and not practice_switch.is_checked():
            practice_switch.click()

    submit_button = page.get_by_test_id("btn-submit-parameter")
    submit_button.click()

    page.wait_for_url(re.compile(r".*/management/parameters.*"), timeout=20000)
    page.wait_for_load_state("networkidle")
    print(f"[E2E] Landed on URL after parameter create: {page.url}", file=sys.stdout)
    page.wait_for_selector("[data-testid='parameters-grid']", timeout=10000)

    search_input = page.get_by_test_id("parameters-search")
    search_input.fill(parameter_name)
    page.wait_for_timeout(500)

    parameter_card = (
        page.get_by_test_id("parameter-card").filter(has_text=parameter_name).first
    )
    parameter_card.wait_for(state="visible", timeout=10000)

    parameter_id = parameter_card.get_attribute("data-parameter-id")
    if not parameter_id:
        raise AssertionError(
            "Created parameter card missing data-parameter-id attribute"
        )

    return parameter_name, parameter_id

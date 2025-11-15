"""UI flow helpers for provider and model E2E tests."""

from __future__ import annotations

import re
import sys

from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import (
    generate_unique_model_name,
    generate_unique_provider_name,
)


def create_provider_via_ui(
    page: Page,
    base_url: str,
    *,
    name: str | None = None,
    description: str = "Provider created via UI flow.",
    api_key: str = "test-api-key-12345",
    base_url_opt: str | None = None,
) -> tuple[str, str]:
    """Create a provider through the UI and return (name, provider_id)."""
    provider_name = name or generate_unique_provider_name("UI Provider")

    page.goto(f"{base_url}/system/providers/new")
    page.wait_for_load_state("networkidle")

    name_input = page.get_by_test_id("input-provider-name")
    name_input.wait_for(state="visible", timeout=15000)
    name_input.fill(provider_name)

    description_input = page.get_by_test_id("input-provider-description")
    description_input.wait_for(state="visible", timeout=15000)
    description_input.fill(description)

    api_key_input = page.get_by_test_id("input-provider-api-key")
    api_key_input.wait_for(state="visible", timeout=15000)
    api_key_input.fill(api_key)

    if base_url_opt:
        base_url_input = page.get_by_test_id("input-provider-base-url")
        base_url_input.wait_for(state="visible", timeout=15000)
        base_url_input.fill(base_url_opt)

    submit_button = page.get_by_test_id("btn-submit-provider")
    submit_button.click()

    page.wait_for_url(re.compile(r".*/system/providers.*"), timeout=20000)
    page.wait_for_load_state("networkidle")
    print(f"[E2E] Landed on URL after provider create: {page.url}", file=sys.stdout)
    page.wait_for_selector("[data-testid='providers-grid']", timeout=10000)

    search_input = page.get_by_test_id("providers-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(provider_name)
    page.wait_for_timeout(500)

    provider_card = (
        page.get_by_test_id("provider-card").filter(has_text=provider_name).first
    )
    expect(provider_card).to_be_visible()

    provider_id = provider_card.get_attribute("data-provider-id")
    if not provider_id:
        raise AssertionError("Created provider card missing data-provider-id attribute")

    return provider_name, provider_id


def create_model_via_ui(
    page: Page,
    base_url: str,
    provider_id: str,
    *,
    name: str | None = None,
    description: str = "Model created via UI flow.",
    input_ppm: float = 3.0,
    output_ppm: float = 15.0,
) -> tuple[str, str]:
    """Create a model through the UI and return (name, model_id)."""
    model_name = name or generate_unique_model_name("UI Model")

    page.goto(f"{base_url}/system/providers/p/{provider_id}/new")
    page.wait_for_load_state("networkidle")

    name_input = page.get_by_test_id("input-model-name")
    name_input.wait_for(state="visible", timeout=15000)
    name_input.fill(model_name)

    description_input = page.get_by_test_id("input-model-description")
    description_input.wait_for(state="visible", timeout=15000)
    description_input.fill(description)

    input_ppm_input = page.get_by_test_id("input-model-input-ppm")
    input_ppm_input.wait_for(state="visible", timeout=15000)
    input_ppm_input.fill(str(input_ppm))

    output_ppm_input = page.get_by_test_id("input-model-output-ppm")
    output_ppm_input.wait_for(state="visible", timeout=15000)
    output_ppm_input.fill(str(output_ppm))

    submit_button = page.get_by_test_id("btn-submit-model")
    submit_button.click()

    page.wait_for_url(re.compile(r".*/system/providers.*"), timeout=20000)
    page.wait_for_load_state("networkidle")
    print(f"[E2E] Landed on URL after model create: {page.url}", file=sys.stdout)
    page.wait_for_selector("[data-testid='providers-grid']", timeout=10000)

    search_input = page.get_by_test_id("providers-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(model_name)
    page.wait_for_timeout(500)

    model_card = page.get_by_test_id("model-card").filter(has_text=model_name).first
    expect(model_card).to_be_visible()

    model_id = model_card.get_attribute("data-model-id")
    if not model_id:
        raise AssertionError("Created model card missing data-model-id attribute")

    return model_name, model_id


def edit_provider_via_ui(
    page: Page,
    base_url: str,
    provider_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
    base_url_opt: str | None = None,
) -> None:
    """Edit a provider through the UI."""
    page.goto(f"{base_url}/system/providers/p/{provider_id}")
    page.wait_for_load_state("networkidle")

    container = page.locator("[data-page='provider-edit']").first
    container.wait_for(state="visible", timeout=15000)

    if name is not None:
        name_input = page.get_by_test_id("input-provider-name")
        name_input.wait_for(state="visible", timeout=10000)
        name_input.fill(name)

    if description is not None:
        description_input = page.get_by_test_id("input-provider-description")
        description_input.wait_for(state="visible", timeout=10000)
        description_input.fill(description)

    if base_url_opt is not None:
        base_url_input = page.get_by_test_id("input-provider-base-url")
        base_url_input.wait_for(state="visible", timeout=10000)
        base_url_input.fill(base_url_opt)

    submit_button = page.get_by_test_id("btn-submit-provider")
    submit_button.click()

    page.wait_for_url(re.compile(r".*/system/providers.*"), timeout=20000)
    page.wait_for_load_state("networkidle")


def edit_model_via_ui(
    page: Page,
    base_url: str,
    provider_id: str,
    model_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
    input_ppm: float | None = None,
    output_ppm: float | None = None,
    active: bool | None = None,
    custom_model: bool | None = None,
) -> None:
    """Edit a model through the UI."""
    page.goto(f"{base_url}/system/providers/p/{provider_id}/m/{model_id}")
    page.wait_for_load_state("networkidle")

    container = page.locator("[data-page='model-edit']").first
    container.wait_for(state="visible", timeout=15000)

    if name is not None:
        name_input = page.get_by_test_id("input-model-name")
        name_input.wait_for(state="visible", timeout=10000)
        name_input.fill(name)

    if description is not None:
        description_input = page.get_by_test_id("input-model-description")
        description_input.wait_for(state="visible", timeout=10000)
        description_input.fill(description)

    if input_ppm is not None:
        input_ppm_input = page.get_by_test_id("input-model-input-ppm")
        input_ppm_input.wait_for(state="visible", timeout=10000)
        input_ppm_input.fill(str(input_ppm))

    if output_ppm is not None:
        output_ppm_input = page.get_by_test_id("input-model-output-ppm")
        output_ppm_input.wait_for(state="visible", timeout=10000)
        output_ppm_input.fill(str(output_ppm))

    if active is not None:
        active_switch = page.get_by_test_id("switch-model-active")
        active_switch.wait_for(state="visible", timeout=10000)
        current_state = active_switch.is_checked()
        if current_state != active:
            active_switch.click()

    if custom_model is not None:
        custom_switch = page.get_by_test_id("switch-model-custom")
        custom_switch.wait_for(state="visible", timeout=10000)
        current_state = custom_switch.is_checked()
        if current_state != custom_model:
            custom_switch.click()

    submit_button = page.get_by_test_id("btn-submit-model")
    submit_button.click()

    page.wait_for_url(re.compile(r".*/system/providers.*"), timeout=20000)
    page.wait_for_load_state("networkidle")

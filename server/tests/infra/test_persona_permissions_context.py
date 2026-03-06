"""Tests for infra.persona_permissions_context — lightweight permission checks.

resolve_persona_permissions_context is tested with mocked black-box fetchers.
Tests verify: exists detection, department_ids extraction, and active scenario counting.
"""

from datetime import datetime, UTC
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.persona_permissions_context import (
    PersonaPermissionsContext,
    resolve_persona_permissions_context,
)

NOW = datetime.now(UTC)
MODULE = "app.infra.persona_permissions_context"


# ── Helpers ──────────────────────────────────────────────────────────────────


class _FakeArtifact:
    """Minimal stand-in for GetPersonasResponse with only the fields we need."""

    def __init__(self, *, department_ids=None, persona_ids=None):
        self.department_ids = department_ids
        self.persona_ids = persona_ids


# ═══════════════════════════════════════════════════════════════════════════
# resolve_persona_permissions_context tests
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolvePersonaPermissionsContext:
    async def test_not_found(self):
        """Returns exists=False when artifact not found."""
        persona_id = uuid4()

        with (
            patch(
                f"{MODULE}.get_persona_artifacts",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            result = await resolve_persona_permissions_context(None, persona_id)

        assert result.exists is False
        assert result.department_ids == []
        assert result.active_scenario_count == 0

    async def test_exists_with_departments(self):
        """Returns department_ids from the artifact."""
        persona_id = uuid4()
        dept_id_1 = uuid4()
        dept_id_2 = uuid4()

        artifact = _FakeArtifact(
            department_ids=[dept_id_1, dept_id_2],
            persona_ids=[],
        )

        with (
            patch(
                f"{MODULE}.get_persona_artifacts",
                new_callable=AsyncMock,
                return_value=[artifact],
            ),
            patch(
                f"{MODULE}.search_scenarios",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            result = await resolve_persona_permissions_context(None, persona_id)

        assert result.exists is True
        assert result.department_ids == [dept_id_1, dept_id_2]
        assert result.active_scenario_count == 0

    async def test_active_scenarios_counted(self):
        """Returns active_scenario_count from search_scenarios."""
        persona_id = uuid4()
        personas_resource_id = uuid4()
        scenario_id = uuid4()

        artifact = _FakeArtifact(
            department_ids=[],
            persona_ids=[personas_resource_id],
        )

        with (
            patch(
                f"{MODULE}.get_persona_artifacts",
                new_callable=AsyncMock,
                return_value=[artifact],
            ),
            patch(
                f"{MODULE}.search_scenarios",
                new_callable=AsyncMock,
                return_value=[scenario_id],
            ) as mock_scenarios,
        ):
            result = await resolve_persona_permissions_context(None, persona_id)

        assert result.active_scenario_count == 1
        mock_scenarios.assert_called_once_with(
            None,
            persona_ids=[personas_resource_id],
            active_only=True,
            limit_count=1,
        )

    async def test_no_personas_resource_skips_scenario_search(self):
        """When artifact has no persona_ids, search_scenarios is not called."""
        persona_id = uuid4()

        artifact = _FakeArtifact(
            department_ids=[uuid4()],
            persona_ids=[],
        )

        with (
            patch(
                f"{MODULE}.get_persona_artifacts",
                new_callable=AsyncMock,
                return_value=[artifact],
            ),
            patch(
                f"{MODULE}.search_scenarios",
                new_callable=AsyncMock,
            ) as mock_scenarios,
        ):
            result = await resolve_persona_permissions_context(None, persona_id)

        mock_scenarios.assert_not_called()
        assert result.active_scenario_count == 0

    async def test_none_department_ids_becomes_empty_list(self):
        """Artifact with None department_ids returns empty list."""
        persona_id = uuid4()

        artifact = _FakeArtifact(
            department_ids=None,
            persona_ids=None,
        )

        with (
            patch(
                f"{MODULE}.get_persona_artifacts",
                new_callable=AsyncMock,
                return_value=[artifact],
            ),
        ):
            result = await resolve_persona_permissions_context(None, persona_id)

        assert result.exists is True
        assert result.department_ids == []
        assert result.active_scenario_count == 0

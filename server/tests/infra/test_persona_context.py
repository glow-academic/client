"""Tests for infra.persona_context — persona artifact context resolution.

resolve_persona_context is tested with mocked black-box fetchers.
Tests verify: junction merging, draft overrides, and resource pair assembly.
"""

from datetime import datetime, UTC
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.persona_context import (
    resolve_persona_context,
    _merge_junction_ids,
    _MergedIds,
)
from app.infra.types import ArtifactContext, ResourcePair
from app.routes.v5.tools.artifacts.persona.types import GetPersonasResponse
from app.routes.v5.tools.entries.persona_drafts.types import GetPersonaDraftResponse


NOW = datetime.now(UTC)
MODULE = "app.infra.persona_context"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _persona_artifact(
    *,
    persona_id=None,
    name_ids=None,
    description_ids=None,
    color_ids=None,
    department_ids=None,
    example_ids=None,
    flag_ids=None,
    icon_ids=None,
    instruction_ids=None,
    parameter_field_ids=None,
    persona_ids=None,
    voice_ids=None,
    active=True,
) -> GetPersonasResponse:
    return GetPersonasResponse(
        id=persona_id or uuid4(),
        created_at=NOW,
        updated_at=NOW,
        generated=False,
        mcp=False,
        active=active,
        name_ids=name_ids,
        description_ids=description_ids,
        color_ids=color_ids,
        department_ids=department_ids,
        example_ids=example_ids,
        flag_ids=flag_ids,
        icon_ids=icon_ids,
        instruction_ids=instruction_ids,
        parameter_field_ids=parameter_field_ids,
        persona_ids=persona_ids,
        voice_ids=voice_ids,
    )


def _draft(
    *,
    draft_id=None,
    group_id=None,
    session_id=None,
    version=1,
    name_ids=None,
    description_ids=None,
    color_ids=None,
    department_ids=None,
    example_ids=None,
    flag_ids=None,
    icon_ids=None,
    instruction_ids=None,
    parameter_field_ids=None,
    profile_ids=None,
    voice_ids=None,
) -> GetPersonaDraftResponse:
    return GetPersonaDraftResponse(
        id=draft_id or uuid4(),
        version=version,
        created_at=NOW,
        generated=False,
        mcp=False,
        active=True,
        group_id=group_id or uuid4(),
        session_id=session_id or uuid4(),
        color_ids=color_ids or [],
        department_ids=department_ids or [],
        description_ids=description_ids or [],
        example_ids=example_ids or [],
        flag_ids=flag_ids or [],
        icon_ids=icon_ids or [],
        instruction_ids=instruction_ids or [],
        name_ids=name_ids or [],
        parameter_field_ids=parameter_field_ids or [],
        profile_ids=profile_ids or [],
        voice_ids=voice_ids or [],
    )


def _mock_all_fetchers():
    """Return a context manager that mocks all get/search fetchers to return []."""
    return _MultiPatch({
        f"{MODULE}.get_persona_artifacts": [],
        f"{MODULE}.get_persona_drafts": [],
        f"{MODULE}.get_names": [],
        f"{MODULE}.search_names": [],
        f"{MODULE}.get_descriptions": [],
        f"{MODULE}.search_descriptions": [],
        f"{MODULE}.get_colors": [],
        f"{MODULE}.search_colors": [],
        f"{MODULE}.get_icons": [],
        f"{MODULE}.search_icons": [],
        f"{MODULE}.get_instructions": [],
        f"{MODULE}.search_instructions": [],
        f"{MODULE}.get_flags": [],
        f"{MODULE}.search_flags": [],
        f"{MODULE}.get_departments": [],
        f"{MODULE}.search_departments": [],
        f"{MODULE}.get_parameter_fields": [],
        f"{MODULE}.search_parameter_fields": [],
        f"{MODULE}.get_examples": [],
        f"{MODULE}.search_examples": [],
        f"{MODULE}.get_voices": [],
        f"{MODULE}.search_voices": [],
        f"{MODULE}.get_parameters": [],
        f"{MODULE}.search_parameters": [],
        f"{MODULE}.search_fields": [],
        f"{MODULE}.search_scenarios": [],
    })


class _MultiPatch:
    """Context manager that patches multiple targets with AsyncMock return values."""

    def __init__(self, targets: dict):
        self._targets = targets
        self._patchers = []
        self._mocks: dict[str, AsyncMock] = {}

    def override(self, target: str, return_value):
        """Override a specific mock's return value."""
        self._mocks[target].return_value = return_value
        return self

    def __enter__(self):
        for target, return_value in self._targets.items():
            p = patch(target, new_callable=AsyncMock, return_value=return_value)
            mock = p.start()
            self._patchers.append(p)
            self._mocks[target] = mock
        return self

    def __exit__(self, *args):
        for p in self._patchers:
            p.stop()


# ═══════════════════════════════════════════════════════════════════════════
# _merge_junction_ids — pure unit tests
# ═══════════════════════════════════════════════════════════════════════════


class TestMergeJunctionIds:
    def test_artifact_only(self):
        name_id = uuid4()
        dept_id = uuid4()
        artifact = _persona_artifact(name_ids=[name_id], department_ids=[dept_id])

        result = _merge_junction_ids(artifact, None)

        assert result.name_ids == [name_id]
        assert result.department_ids == [dept_id]

    def test_draft_overrides_single_select(self):
        published_name = uuid4()
        draft_name = uuid4()
        artifact = _persona_artifact(name_ids=[published_name])
        draft = _draft(name_ids=[draft_name])

        result = _merge_junction_ids(artifact, draft)

        assert result.name_ids == [draft_name]

    def test_draft_overrides_multi_select(self):
        pub_dept1, pub_dept2 = uuid4(), uuid4()
        draft_dept = uuid4()
        artifact = _persona_artifact(department_ids=[pub_dept1, pub_dept2])
        draft = _draft(department_ids=[draft_dept])

        result = _merge_junction_ids(artifact, draft)

        assert result.department_ids == [draft_dept]

    def test_draft_empty_keeps_published(self):
        """Draft with empty lists does NOT override — only non-empty overrides."""
        name_id = uuid4()
        artifact = _persona_artifact(name_ids=[name_id])
        draft = _draft(name_ids=[])  # empty

        result = _merge_junction_ids(artifact, draft)

        assert result.name_ids == [name_id]

    def test_no_artifact_no_draft(self):
        result = _merge_junction_ids(None, None)

        assert result.name_ids == []
        assert result.department_ids == []
        assert result.example_ids == []

    def test_draft_only_no_artifact(self):
        """Create mode — no published artifact, only draft."""
        draft_name = uuid4()
        draft = _draft(name_ids=[draft_name])

        result = _merge_junction_ids(None, draft)

        assert result.name_ids == [draft_name]

    def test_all_fields_override(self):
        """Draft overrides every field when all are populated."""
        pub = {f: [uuid4()] for f in [
            "name_ids", "description_ids", "color_ids", "icon_ids",
            "instruction_ids", "flag_ids", "department_ids",
            "parameter_field_ids", "example_ids", "voice_ids",
        ]}
        draft_vals = {f: [uuid4()] for f in pub}

        artifact = _persona_artifact(**pub)
        draft = _draft(**draft_vals)

        result = _merge_junction_ids(artifact, draft)

        assert result.name_ids == draft_vals["name_ids"]
        assert result.description_ids == draft_vals["description_ids"]
        assert result.color_ids == draft_vals["color_ids"]
        assert result.department_ids == draft_vals["department_ids"]
        assert result.voice_ids == draft_vals["voice_ids"]


# ═══════════════════════════════════════════════════════════════════════════
# resolve_persona_context — mocked black-box tests
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolvePersonaContextEmpty:
    async def test_create_mode_no_artifact(self):
        """persona_id=None (create mode) returns context with empty resources."""
        group_id = uuid4()

        with _mock_all_fetchers():
            result = await resolve_persona_context(
                None, None, persona_id=None, group_id=group_id,
            )

        assert result.artifact_id is None
        assert result.group_id == group_id
        assert result.resources["names"].selected == []
        assert result.resources["names"].suggestions == []
        assert result.draft_version is None
        assert result.entries["personas_resource_ids"] == []
        assert result.entries["has_active_scenarios"] is False

    async def test_existing_persona_no_draft(self):
        """Fetch published artifact, no draft overlay — verify IDs flow to fetchers."""
        persona_id = uuid4()
        group_id = uuid4()
        name_id = uuid4()

        artifact = _persona_artifact(persona_id=persona_id, name_ids=[name_id])
        selected_name = object()  # sentinel

        with _mock_all_fetchers() as m:
            m.override(f"{MODULE}.get_persona_artifacts", [artifact])
            m.override(f"{MODULE}.get_names", [selected_name])

            result = await resolve_persona_context(
                None, None, persona_id=persona_id, group_id=group_id,
            )

        # Verify artifact fetcher called with correct persona_id
        mock_artifacts = m._mocks[f"{MODULE}.get_persona_artifacts"]
        assert mock_artifacts.call_args[0][1] == [persona_id]

        # Verify get_names called with merged name_ids from artifact
        mock_names = m._mocks[f"{MODULE}.get_names"]
        assert mock_names.call_args[0][1] == [name_id]

        # Verify search_names called with exclude_ids matching selected
        mock_search_names = m._mocks[f"{MODULE}.search_names"]
        assert mock_search_names.call_args.kwargs["exclude_ids"] == [name_id]

        assert result.artifact_id == persona_id
        assert result.resources["names"].selected == [selected_name]
        assert result.draft_version is None
        assert result.active is True


@pytest.mark.asyncio
class TestResolvePersonaContextDraft:
    async def test_draft_overrides_published(self):
        """Draft name_ids override published — get_names called with draft ID, not published."""
        persona_id = uuid4()
        group_id = uuid4()
        published_name_id = uuid4()
        draft_name_id = uuid4()
        draft_id = uuid4()

        artifact = _persona_artifact(
            persona_id=persona_id, name_ids=[published_name_id],
        )
        draft = _draft(draft_id=draft_id, name_ids=[draft_name_id], version=3)
        draft_name_obj = object()

        with _mock_all_fetchers() as m:
            m.override(f"{MODULE}.get_persona_artifacts", [artifact])
            m.override(f"{MODULE}.get_persona_drafts", [draft])
            m.override(f"{MODULE}.get_names", [draft_name_obj])

            result = await resolve_persona_context(
                None, None,
                persona_id=persona_id,
                group_id=group_id,
                draft_id=draft_id,
            )

        # Key assertion: get_names received draft_name_id, NOT published_name_id
        mock_names = m._mocks[f"{MODULE}.get_names"]
        assert mock_names.call_args[0][1] == [draft_name_id]

        # Draft fetcher called with correct draft_id
        mock_drafts = m._mocks[f"{MODULE}.get_persona_drafts"]
        assert mock_drafts.call_args[0][1] == [draft_id]

        assert result.draft_version == 3
        assert result.resources["names"].selected == [draft_name_obj]


@pytest.mark.asyncio
class TestResolvePersonaContextResources:
    async def test_selected_and_suggestions_separate(self):
        """Selected and suggestions are returned in separate lists."""
        persona_id = uuid4()
        group_id = uuid4()
        name_id = uuid4()

        artifact = _persona_artifact(persona_id=persona_id, name_ids=[name_id])
        selected_obj = object()
        suggestion_obj = object()

        with _mock_all_fetchers() as m:
            m.override(f"{MODULE}.get_persona_artifacts", [artifact])
            m.override(f"{MODULE}.get_names", [selected_obj])
            m.override(f"{MODULE}.search_names", [suggestion_obj])

            result = await resolve_persona_context(
                None, None, persona_id=persona_id, group_id=group_id,
            )

        assert result.resources["names"].selected == [selected_obj]
        assert result.resources["names"].suggestions == [suggestion_obj]

    async def test_all_resource_pairs_populated(self):
        """Every resource type returns a ResourcePair."""
        group_id = uuid4()

        with _mock_all_fetchers():
            result = await resolve_persona_context(
                None, None, persona_id=None, group_id=group_id,
            )

        resource_names = [
            "names", "descriptions", "colors", "icons", "instructions",
            "flags", "departments", "parameter_fields", "examples",
            "voices", "parameters", "fields",
        ]
        for rname in resource_names:
            pair = result.resources[rname]
            assert isinstance(pair, ResourcePair), f"{rname} should be a ResourcePair"
            assert isinstance(pair.selected, list), f"{rname}.selected should be list"
            assert isinstance(pair.suggestions, list), f"{rname}.suggestions should be list"

    async def test_inactive_artifact(self):
        persona_id = uuid4()
        group_id = uuid4()
        artifact = _persona_artifact(persona_id=persona_id, active=False)

        with _mock_all_fetchers() as m:
            m.override(f"{MODULE}.get_persona_artifacts", [artifact])

            result = await resolve_persona_context(
                None, None, persona_id=persona_id, group_id=group_id,
            )

        assert result.active is False

    async def test_flags_filtered_to_persona_types(self):
        """Only persona-specific flag types should appear in suggestions."""
        persona_id = uuid4()
        group_id = uuid4()

        class FakeFlag:
            def __init__(self, type_val):
                self.type = type_val

        persona_flag = FakeFlag("persona_active")
        other_flag = FakeFlag("scenario_active")

        with _mock_all_fetchers() as m:
            m.override(f"{MODULE}.search_flags", [persona_flag, other_flag])

            result = await resolve_persona_context(
                None, None, persona_id=persona_id, group_id=group_id,
            )

        assert len(result.resources["flags"].suggestions) == 1
        assert result.resources["flags"].suggestions[0].type == "persona_active"

    async def test_has_active_scenarios_true(self):
        """Persona with active scenarios sets has_active_scenarios=True."""
        persona_id = uuid4()
        group_id = uuid4()
        personas_resource_id = uuid4()
        scenario_id = uuid4()

        artifact = _persona_artifact(
            persona_id=persona_id, persona_ids=[personas_resource_id],
        )

        with _mock_all_fetchers() as m:
            m.override(f"{MODULE}.get_persona_artifacts", [artifact])
            m.override(f"{MODULE}.search_scenarios", [scenario_id])

            result = await resolve_persona_context(
                None, None, persona_id=persona_id, group_id=group_id,
            )

        assert result.entries["has_active_scenarios"] is True
        assert result.entries["personas_resource_ids"] == [personas_resource_id]

        # Verify search_scenarios called with the personas_resource_ids
        mock_scenarios = m._mocks[f"{MODULE}.search_scenarios"]
        assert mock_scenarios.call_args.kwargs["persona_ids"] == [personas_resource_id]

    async def test_has_active_scenarios_false_when_none(self):
        """Persona with no active scenarios sets has_active_scenarios=False."""
        persona_id = uuid4()
        group_id = uuid4()
        personas_resource_id = uuid4()

        artifact = _persona_artifact(
            persona_id=persona_id, persona_ids=[personas_resource_id],
        )

        with _mock_all_fetchers() as m:
            m.override(f"{MODULE}.get_persona_artifacts", [artifact])
            # search_scenarios returns empty — no active scenarios

            result = await resolve_persona_context(
                None, None, persona_id=persona_id, group_id=group_id,
            )

        assert result.entries["has_active_scenarios"] is False

"""Resolve group_id from draft or create fresh.

Extracted from auth/group.py for use by artifact GET endpoints
that need to derive group_id server-side instead of receiving
it from the client.
"""

from __future__ import annotations

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.sessions.create import create_session

# Draft function dispatch map: artifact_type → get_X_drafts(conn, ids)
# Lazy import to avoid circular dependencies — populated on first call.
_DRAFT_FN_MAP: dict[str, object] | None = None


def _get_draft_fn_map() -> dict[str, object]:
    global _DRAFT_FN_MAP
    if _DRAFT_FN_MAP is not None:
        return _DRAFT_FN_MAP

    from app.routes.v5.tools.entries.agent_drafts.get import get_agent_drafts
    from app.routes.v5.tools.entries.auth_drafts.get import get_auth_drafts
    from app.routes.v5.tools.entries.chat_drafts.get import get_chat_drafts
    from app.routes.v5.tools.entries.cohort_drafts.get import get_cohort_drafts
    from app.routes.v5.tools.entries.department_drafts.get import get_department_drafts
    from app.routes.v5.tools.entries.document_drafts.get import get_document_drafts
    from app.routes.v5.tools.entries.eval_drafts.get import get_eval_drafts
    from app.routes.v5.tools.entries.field_drafts.get import get_field_drafts
    from app.routes.v5.tools.entries.invocation_drafts.get import get_invocation_drafts
    from app.routes.v5.tools.entries.model_drafts.get import get_model_drafts
    from app.routes.v5.tools.entries.parameter_drafts.get import get_parameter_drafts
    from app.routes.v5.tools.entries.persona_drafts.get import get_persona_drafts
    from app.routes.v5.tools.entries.profile_drafts.get import get_profile_drafts
    from app.routes.v5.tools.entries.provider_drafts.get import get_provider_drafts
    from app.routes.v5.tools.entries.rubric_drafts.get import get_rubric_drafts
    from app.routes.v5.tools.entries.scenario_drafts.get import get_scenario_drafts
    from app.routes.v5.tools.entries.setting_drafts.get import get_setting_drafts
    from app.routes.v5.tools.entries.simulation_drafts.get import get_simulation_drafts
    from app.routes.v5.tools.entries.tool_drafts.get import get_tool_drafts

    _DRAFT_FN_MAP = {
        "agent": get_agent_drafts,
        "auth": get_auth_drafts,
        "chat": get_chat_drafts,
        "cohort": get_cohort_drafts,
        "department": get_department_drafts,
        "document": get_document_drafts,
        "eval": get_eval_drafts,
        "field": get_field_drafts,
        "invocation": get_invocation_drafts,
        "model": get_model_drafts,
        "parameter": get_parameter_drafts,
        "persona": get_persona_drafts,
        "profile": get_profile_drafts,
        "provider": get_provider_drafts,
        "rubric": get_rubric_drafts,
        "scenario": get_scenario_drafts,
        "setting": get_setting_drafts,
        "simulation": get_simulation_drafts,
        "tool": get_tool_drafts,
    }
    return _DRAFT_FN_MAP


async def resolve_group_for_artifact(
    pool: asyncpg.Pool,
    *,
    draft_id: UUID | None,
    artifact_type: str,
    profiles_id: UUID,
) -> UUID:
    """Resolve group_id from draft or create a fresh session + group.

    Priority:
      1. draft_id → look up draft → extract group_id
      2. fallback → create fresh session + group
    """
    async with pool.acquire() as conn:
        # Try resolving from draft
        if draft_id is not None:
            fn_map = _get_draft_fn_map()
            draft_fn = fn_map.get(artifact_type)
            if draft_fn:
                drafts = await draft_fn(conn, [draft_id])
                if drafts and drafts[0].group_id:
                    return drafts[0].group_id

        # Create fresh session + group
        session = await create_session(conn, profile_id=profiles_id)
        group = await create_group(conn, session_id=session.id)
        return group.id

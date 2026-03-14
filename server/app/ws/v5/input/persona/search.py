"""Input: persona.search"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.persona.search import search_persona_impl
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket

internal_sio = get_internal_sio()


class PersonaSearchPayload(BaseModel):
    """Payload for persona.search socket event."""

    search: str | None = Field(None)
    scenario_ids: list[UUID] | None = Field(None)
    field_ids: list[UUID] | None = Field(None)
    filter_department_ids: list[UUID] | None = Field(None)
    scenario_search: str | None = Field(None)
    field_search: str | None = Field(None)
    department_search: str | None = Field(None)
    color_search: str | None = Field(None)
    icon_search: str | None = Field(None)
    voice_search: str | None = Field(None)
    instruction_search: str | None = Field(None)
    page_size: int = Field(12)
    page_offset: int = Field(0)


@sio.on("persona.search")  # type: ignore
async def persona_search(sid: str, data: dict[str, Any]) -> None:
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    profile_id = UUID(profile_id_str)

    try:
        payload = PersonaSearchPayload(**data)
    except Exception as e:
        await internal_sio.emit("persona.search.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": str(e),
            "error_type": "validation",
        })
        return

    pool = get_pool()
    redis = get_redis_client()

    await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="persona",
        operation="search",
        profile_id=profile_id,
        sid=sid,
        rooms=[sid],
        runner=lambda: search_persona_impl(
            pool,
            redis,
            profile_id=profile_id,
            search=payload.search,
            scenario_ids=payload.scenario_ids,
            field_ids=payload.field_ids,
            filter_department_ids=payload.filter_department_ids,
            scenario_search=payload.scenario_search,
            field_search=payload.field_search,
            department_search=payload.department_search,
            color_search=payload.color_search,
            icon_search=payload.icon_search,
            voice_search=payload.voice_search,
            instruction_search=payload.instruction_search,
            page_size=payload.page_size,
            page_offset=payload.page_offset,
        ),
        arguments=payload.model_dump(mode="json"),
    )

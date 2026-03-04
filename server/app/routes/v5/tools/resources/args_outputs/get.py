"""Args Outputs Resource GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.resources.args_outputs.types import GetArgOutputResponse
from app.utils.cache import CacheFns
from app.utils.cache.cache_key import cache_key


async def get_args_outputs(
    conn: asyncpg.Connection,
    ids: list[UUID],
    cache: CacheFns | None = None,
) -> list[GetArgOutputResponse]:
    """Fetch args_outputs_resource entries by IDs."""
    if not ids:
        return []

    tags = ["resources", "args_outputs"]
    key = cache_key("/api/v5/resources/args_outputs/get", {"ids": [str(id) for id in ids]})

    if cache:
        get_fn, _ = cache
        cached = await get_fn(key)
        if cached:
            return [GetArgOutputResponse.model_validate(item) for item in cached.get("items", [])]

    rows = await conn.fetch("""
        SELECT id, args_id, name, template,
               created_at, active, mcp, generated
        FROM args_outputs_resource
        WHERE id = ANY($1)
        ORDER BY array_position($1, id)
    """, ids)

    items = [
        GetArgOutputResponse(
            id=r["id"],
            args_id=r["args_id"],
            name=r["name"],
            template=r["template"],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]

    if cache:
        _, set_fn = cache
        await set_fn(key, {"items": [i.model_dump(mode="json") for i in items]}, 60, tags)

    return items

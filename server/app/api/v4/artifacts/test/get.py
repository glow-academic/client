"""Benchmark test artifact detail endpoint."""

import asyncio
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.test.permissions import compute_test_status
from app.api.v4.artifacts.test.types import (
    GetTestArtifactRequest,
    GetTestArtifactResponse,
)
from app.api.v4.views.benchmark.chats.get import get_benchmark_chats_internal
from app.api.v4.views.benchmark.messages.get import get_benchmark_messages_internal
from app.api.v4.views.benchmark.tests.get import get_benchmark_tests_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/get",
    response_model=GetTestArtifactResponse,
    dependencies=[
        audit_activity(
            "artifacts.test.get",
            "{{ actor.name }} fetched test artifact data",
        )
    ],
)
async def get_test_artifact(
    request: GetTestArtifactRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestArtifactResponse:
    """Get benchmark test artifact details with tests/chats/messages in parallel."""
    tags = ["artifacts", "test"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        async def fetch_tests() -> list:
            async with pool.acquire() as c:
                result = await get_benchmark_tests_internal(
                    conn=c,
                    test_ids=[request.test_id],
                    bypass_cache=bypass_cache,
                    page_limit=1,
                    page_offset=0,
                )
                return result.items

        async def fetch_chats() -> list:
            async with pool.acquire() as c:
                return await get_benchmark_chats_internal(
                    conn=c,
                    test_id=request.test_id,
                    bypass_cache=bypass_cache,
                )

        async def fetch_messages() -> list:
            async with pool.acquire() as c:
                return await get_benchmark_messages_internal(
                    conn=c,
                    test_id=request.test_id,
                    bypass_cache=bypass_cache,
                )

        tests, chats, messages = await asyncio.gather(
            fetch_tests(), fetch_chats(), fetch_messages()
        )

        test = tests[0] if tests else None
        if not test:
            raise HTTPException(status_code=404, detail="Benchmark test not found")

        status = compute_test_status(test.num_chats, test.num_chats_completed)

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestArtifactResponse(
            test=test,
            chats=chats,
            messages=messages,
            status=status,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_test_get",
            request=http_request,
        )

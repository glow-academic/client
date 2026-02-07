"""Keys decrypt endpoint - decrypt encrypted key value."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetKeyForDecryptApiRequest,
    GetKeyForDecryptApiResponse,
    GetKeyForDecryptSqlParams,
    GetKeyForDecryptSqlRow,
    load_sql_query,
)
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/keys/get_key_for_decrypt_complete.sql"


router = APIRouter()


@router.post(
    "/keys/decrypt",
    response_model=GetKeyForDecryptApiResponse,
    dependencies=[
        audit_activity(
            "key.decrypted", "{{ actor.name }} decrypted key '{{ key.name }}'"
        )
    ],
)
async def decrypt_key(
    request: GetKeyForDecryptApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetKeyForDecryptApiResponse:
    """Decrypt a key's encrypted value."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        # Use double star pattern: **request.model_dump()
        params = GetKeyForDecryptSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            GetKeyForDecryptSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result or not result.key:
            raise HTTPException(
                status_code=400, detail=f"Key not found: {request.key_id}"
            )

        # Decrypt the key
        try:
            decrypted_key = decrypt_api_key(result.key)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        # Set audit context
        if result.actor_name and result.name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                key={"name": result.name, "id": str(request.key_id)},
            )

        # Convert SQL result to API response
        api_response = GetKeyForDecryptApiResponse.model_validate(
            {
                "key": decrypted_key,
            }
        )

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="decrypt_key",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

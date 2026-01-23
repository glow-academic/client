"""Setting delete endpoint - v4 API following DHH principles.

TODO: Implement setting deletion functionality.
"""

# TODO: Uncomment when SQL file and types are created
# from typing import Annotated, Any, cast

# import asyncpg  # type: ignore
# from app.infra.v4.activity.audit import audit_activity, audit_set
# from app.infra.v4.error.handle_route_error import handle_route_error
# from app.main import get_db, transaction
# from app.sql.types import (DeleteSettingApiRequest, DeleteSettingApiResponse,
#                            DeleteSettingSqlParams, DeleteSettingSqlRow,
#                            load_sql_query)
from fastapi import APIRouter  # , Depends, HTTPException, Request, Response

# from utils.cache.invalidate_tags import invalidate_tags
# from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
# TODO: Create SQL file for setting deletion
# SQL_PATH = "app/sql/v4/queries/settings/delete_setting_complete.sql"

router = APIRouter()

# TODO: Uncomment when SQL file and types are created
# @router.post(
#     "/delete",
#     response_model=DeleteSettingApiResponse,
#     dependencies=[
#         audit_activity(
#             "setting.deleted",
#             "{{ actor.name }} deleted setting '{{ setting.name }}'",
#         )
#     ],
# )
# async def delete_setting(
#     request: DeleteSettingApiRequest,
#     http_request: Request,
#     response: Response,
#     conn: Annotated[asyncpg.Connection, Depends(get_db)],
# ) -> DeleteSettingApiResponse:
#     """Delete a setting - TODO: Implement functionality."""
#     tags = ["settings"]  # From router tags
#
#     sql_query = load_sql_query(SQL_PATH)
#     sql_params: tuple[Any, ...] | None = None
#
#     try:
#         # Get profile_id from header (set by router-level dependency)
#         profile_id = http_request.state.profile_id
#         if not profile_id:
#             raise HTTPException(
#                 status_code=401,
#                 detail="Profile ID is required. Please sign in again.",
#             )
#
#         # Convert API request to SQL params (add profile_id from header)
#         params = DeleteSettingSqlParams(**request.model_dump(), profile_id=profile_id)
#         sql_params = params.to_tuple()
#
#         # Use transaction for delete operation
#         async with transaction(conn):
#             # Execute query with typed helper - automatically detects and calls function if present
#             result = cast(
#                 DeleteSettingSqlRow,
#                 await execute_sql_typed(
#                     conn,
#                     SQL_PATH,
#                     params=params,
#                 ),
#             )
#
#         # Set audit context
#         if result.actor_name:
#             audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})
#
#         # Convert SQL result to API response
#         api_response = DeleteSettingApiResponse.model_validate(result.model_dump())
#
#         # Invalidate cache tags
#         await invalidate_tags(tags)
#
#         return api_response
#     except HTTPException:
#         raise
#     except Exception as e:
#         handle_route_error(
#             error=e,
#             route_path=http_request.url.path,
#             operation="delete_setting",
#             sql_query=sql_query,
#             sql_params=sql_params,
#             request=http_request,
#         )

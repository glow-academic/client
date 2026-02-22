"""Staff process CSV endpoint - process CSV file and map columns to target fields."""

import csv
import uuid
from io import StringIO
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    ProcessCsvApiRequest,
    ProcessCsvApiResponse,
    ProcessCsvSqlParams,
    ProcessCsvSqlRow,
    QProcessCsvV4CsvRowError,
    QProcessCsvV4ProcessedRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/staff/process_csv_complete.sql"

router = APIRouter()


@router.post(
    "/process",
    response_model=ProcessCsvApiResponse,
    dependencies=[
        audit_activity("staff.process", "{{ actor.name }} processed staff CSV")
    ],
)
async def process_staff(
    request: ProcessCsvApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProcessCsvApiResponse:
    """Process CSV file and map columns to target fields."""
    tags = ["staff"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ProcessCsvApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
        else:
            actor_name = None

        # Parse CSV content
        csv_file = StringIO(request.csv_content)
        reader = csv.DictReader(csv_file)
        headers = reader.fieldnames or []

        # Build mapping dict for quick lookup
        column_to_field: dict[str, str | None] = {}
        for mapping in request.column_mappings:
            if mapping.csv_column is not None:
                column_to_field[mapping.csv_column] = mapping.target_field

        processed_rows: list[QProcessCsvV4ProcessedRow] = []
        row_index = 0

        for csv_row in reader:
            row_index += 1
            errors: list[QProcessCsvV4CsvRowError] = []

            # Extract values based on mappings (snake_case field names)
            name = None
            emails: list[str] = []
            role = None
            department_ids: list[str] = []

            for header in headers:
                field = column_to_field.get(header)
                value = csv_row.get(header, "").strip() if header else ""

                if field == "name":
                    name = value if value else None
                elif field == "email":
                    # Support comma-separated emails
                    if value:
                        email_values = [
                            e.strip().lower() for e in value.split(",") if e.strip()
                        ]
                        emails.extend(email_values)
                elif field == "role":
                    role = value if value else None
                elif field == "department":
                    # Support comma-separated values for multiple departments
                    if value:
                        dept_values = [d.strip() for d in value.split(",") if d.strip()]
                        department_ids.extend(dept_values)

            # Validate required fields
            if not name:
                errors.append(
                    QProcessCsvV4CsvRowError(
                        row_index=row_index,
                        field="name",
                        message="Name is required",
                    )
                )
            if len(emails) == 0:
                errors.append(
                    QProcessCsvV4CsvRowError(
                        row_index=row_index,
                        field="emails",
                        message="At least one email is required",
                    )
                )

            # Default role to 'member' if not provided
            if not role:
                role = "member"

            processed_rows.append(
                QProcessCsvV4ProcessedRow(
                    row_index=row_index,
                    name=name,
                    emails=emails if emails else None,
                    primary_email_index=0,  # First email is primary by default
                    role=role,
                    department_ids=department_ids if department_ids else None,
                    errors=errors if errors else None,
                )
            )

        # Call SQL function to get actor_name (function accepts csv_content and column_mappings for type generation)
        params = ProcessCsvSqlParams(
            csv_content=request.csv_content,
            column_mappings=request.column_mappings,
            profile_id=uuid.UUID(profile_id),
        )
        sql_params = params.to_tuple()

        result = cast(
            ProcessCsvSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Construct API response with parsed data + actor_name from SQL
        api_response = ProcessCsvApiResponse(
            success=True,
            headers=list(headers),
            rows=processed_rows,
            actor_name=actor_name,
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="process_staff",
            sql_query=None,  # No SQL query - CSV processing only
            sql_params=None,
            request=http_request,
        )

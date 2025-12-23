"""Staff process CSV endpoint - process CSV file and map columns to target fields."""

import csv
from io import StringIO
from typing import Annotated

import asyncpg
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached

router = APIRouter()


class CSVColumnMapping(BaseModel):
    """Mapping of CSV column to target field."""

    csv_column: str
    target_field: str | None  # firstName, lastName, email, department, cohort


class CSVRowError(BaseModel):
    """Error for a specific CSV row."""

    row_index: int
    field: str
    message: str


class ProcessCSVRequest(BaseModel):
    """Request to process CSV file."""

    csv_content: str
    column_mappings: list[CSVColumnMapping]


class ProcessedCSVRow(BaseModel):
    """Processed row from CSV."""

    row_index: int
    firstName: str | None
    lastName: str | None
    emails: list[str] = []  # Array of emails (parsed from comma-separated values)
    primary_email_index: int = 0  # Index of primary email (defaults to 0)
    role: str | None
    department_ids: list[str] = []  # Array for multi-select support
    cohort_ids: list[str] = []  # Array for multi-select support
    errors: list[CSVRowError]


class ProcessCSVResponse(BaseModel):
    """Response from CSV processing."""

    success: bool
    rows: list[ProcessedCSVRow]
    headers: list[str]


@router.post(
    "/csv",
    response_model=ProcessCSVResponse,
    dependencies=[audit_activity("staff.csv", "{{ actor.name }} processed staff CSV")],
)
async def process_csv(
    request: ProcessCSVRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProcessCSVResponse:
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
        return ProcessCSVResponse.model_validate(cached["data"])

    try:
        # Parse CSV content
        csv_file = StringIO(request.csv_content)
        reader = csv.DictReader(csv_file)
        headers = reader.fieldnames or []

        # Build mapping dict for quick lookup
        column_to_field: dict[str, str | None] = {}
        for mapping in request.column_mappings:
            column_to_field[mapping.csv_column] = mapping.target_field

        rows: list[ProcessedCSVRow] = []
        row_index = 0

        for csv_row in reader:
            row_index += 1
            errors: list[CSVRowError] = []

            # Extract values based on mappings
            firstName = None
            lastName = None
            emails: list[str] = []
            role = None
            department_ids: list[str] = []
            cohort_ids: list[str] = []

            for header in headers:
                field = column_to_field.get(header)
                value = csv_row.get(header, "").strip() if header else ""

                if field == "firstName":
                    firstName = value if value else None
                elif field == "lastName":
                    lastName = value if value else None
                elif field == "email":
                    # Support comma-separated emails
                    if value:
                        email_values = [
                            e.strip().lower() for e in value.split(",") if e.strip()
                        ]
                        emails.extend(email_values)
                    # If no emails found, emails stays empty
                elif field == "role":
                    role = value if value else None
                elif field == "department":
                    # Support comma-separated values for multiple departments
                    if value:
                        dept_values = [d.strip() for d in value.split(",") if d.strip()]
                        department_ids.extend(dept_values)
                elif field == "cohort":
                    # Support comma-separated values for multiple cohorts
                    if value:
                        cohort_values = [
                            c.strip() for c in value.split(",") if c.strip()
                        ]
                        cohort_ids.extend(cohort_values)

            # Validate required fields
            if not firstName:
                errors.append(
                    CSVRowError(
                        row_index=row_index,
                        field="firstName",
                        message="First name is required",
                    )
                )
            if not lastName:
                errors.append(
                    CSVRowError(
                        row_index=row_index,
                        field="lastName",
                        message="Last name is required",
                    )
                )
            if len(emails) == 0:
                errors.append(
                    CSVRowError(
                        row_index=row_index,
                        field="emails",
                        message="At least one email is required",
                    )
                )

            # Default role to 'member' if not provided
            if not role:
                role = "member"

            rows.append(
                ProcessedCSVRow(
                    row_index=row_index,
                    firstName=firstName,
                    lastName=lastName,
                    emails=emails,
                    primary_email_index=0,  # First email is primary by default
                    role=role,
                    department_ids=department_ids,
                    cohort_ids=cohort_ids,
                    errors=errors,
                )
            )

        response_data = ProcessCSVResponse(
            success=True, rows=rows, headers=list(headers)
        )

        # Fetch actor_name separately
        profile_id = http_request.state.profile_id
        actor_name_row = None
        if profile_id:
            actor_name_row = await conn.fetchrow(
                "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
                profile_id,
            )
        actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="process_csv",
            sql_query=None,  # No SQL query - CSV processing only
            sql_params=None,
            request=http_request,
        )

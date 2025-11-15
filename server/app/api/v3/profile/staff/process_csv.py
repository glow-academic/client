"""Staff process CSV endpoint - process CSV file and map columns to target fields."""

import csv
from io import StringIO
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class CSVColumnMapping(BaseModel):
    """Mapping of CSV column to target field."""

    csv_column: str
    target_field: str | None  # firstName, lastName, alias, department, cohort


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
    alias: str | None
    role: str | None
    department_ids: list[str] = []  # Array for multi-select support
    cohort_ids: list[str] = []  # Array for multi-select support
    errors: list[CSVRowError]


class ProcessCSVResponse(BaseModel):
    """Response from CSV processing."""

    success: bool
    rows: list[ProcessedCSVRow]
    headers: list[str]


@router.post("/process-csv", response_model=ProcessCSVResponse)
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
            alias = None
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
                elif field == "alias":
                    alias = value if value else None
                    # Extract alias from email if needed
                    if alias and "@" in alias:
                        alias = alias.split("@")[0].strip()
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
            if not alias:
                errors.append(
                    CSVRowError(
                        row_index=row_index, field="alias", message="Alias is required"
                    )
                )

            # Default role to 'ta' if not provided
            if not role:
                role = "ta"

            rows.append(
                ProcessedCSVRow(
                    row_index=row_index,
                    firstName=firstName,
                    lastName=lastName,
                    alias=alias,
                    role=role,
                    department_ids=department_ids,
                    cohort_ids=cohort_ids,
                    errors=errors,
                )
            )

        response_data = ProcessCSVResponse(
            success=True, rows=rows, headers=list(headers)
        )

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

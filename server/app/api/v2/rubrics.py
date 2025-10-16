"""Rubrics v2 API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.repositories.rubric_repository import get_rubric_repository
from app.schemas.rubrics import (CreateRubricRequest, CreateRubricResponse,
                                 DeleteRubricRequest, DeleteRubricResponse,
                                 DuplicateRubricRequest,
                                 DuplicateRubricResponse,
                                 RubricDetailDefaultRequest,
                                 RubricDetailRequest, RubricDetailResponse,
                                 RubricsFilters, RubricsListResponse,
                                 UpdateRubricRequest, UpdateRubricResponse)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/rubrics", tags=["rubrics"])


@router.post("/list", response_model=RubricsListResponse)
async def get_rubrics_list(
    filters: RubricsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RubricsListResponse:
    """Get rubrics list with hierarchical structure and permissions."""
    try:
        repo = get_rubric_repository(conn)
        return await repo.get_rubrics_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=RubricDetailResponse)
async def get_rubric_detail(
    request: RubricDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RubricDetailResponse:
    """Get detailed rubric information."""
    try:
        repo = get_rubric_repository(conn)
        return await repo.get_rubric_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=RubricDetailResponse)
async def get_rubric_detail_default(
    request: RubricDetailDefaultRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RubricDetailResponse:
    """Get default rubric details for a profile."""
    try:
        repo = get_rubric_repository(conn)
        return await repo.get_rubric_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateRubricResponse)
async def create_rubric(
    request: CreateRubricRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateRubricResponse:
    """Create a new rubric with nested structure."""
    try:
        repo = get_rubric_repository(conn)
        return await repo.create_rubric(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateRubricResponse)
async def update_rubric(
    request: UpdateRubricRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateRubricResponse:
    """Update an existing rubric (replaces entire hierarchy)."""
    try:
        repo = get_rubric_repository(conn)
        return await repo.update_rubric(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicateRubricResponse)
async def duplicate_rubric(
    request: DuplicateRubricRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateRubricResponse:
    """Duplicate a rubric with entire hierarchy."""
    try:
        repo = get_rubric_repository(conn)
        return await repo.duplicate_rubric(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteRubricResponse)
async def delete_rubric(
    request: DeleteRubricRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteRubricResponse:
    """Delete a rubric."""
    try:
        repo = get_rubric_repository(conn)
        return await repo.delete_rubric(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

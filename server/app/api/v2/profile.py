"""Profile v2 API endpoints - unified auth and staff operations."""

from typing import Annotated

from app.db import get_session
from app.repositories.auth_repository import AuthRepository
from app.repositories.staff_repository import get_staff_repository
from app.schemas.auth import (AuthorizeEmulationRequest,
                              AuthorizeEmulationResponse,
                              ProfileContextRequest, ProfileContextResponse,
                              ProfileDetailRequest, ProfileDetailResponse,
                              UpdateProfileRequest, UpdateProfileResponse)
from app.schemas.staff import (BulkDeleteStaffRequest, BulkDeleteStaffResponse,
                               BulkUpdateStaffRequest, BulkUpdateStaffResponse,
                               DeleteStaffRequest, DeleteStaffResponse,
                               StaffDetailBulkRequest, StaffDetailBulkResponse,
                               StaffDetailRequest, StaffDetailResponse,
                               StaffFilters, StaffListResponse,
                               UpdateStaffRequest, UpdateStaffResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/profile", tags=["profile"])


# ============================================================================
# PROFILE LIST & BASIC OPERATIONS (from staff)
# ============================================================================


@router.post("/list", response_model=StaffListResponse)
async def get_profile_list(
    filters: StaffFilters,
    db: Annotated[Session, Depends(get_session)],
) -> StaffListResponse:
    """Get profile/staff list with permissions and relationships."""
    try:
        repo = get_staff_repository(db)
        return repo.get_staff_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=StaffDetailResponse)
async def get_profile_detail_staff(
    request: StaffDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> StaffDetailResponse:
    """Get detailed profile information (staff version with permissions)."""
    try:
        repo = get_staff_repository(db)
        return repo.get_staff_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-bulk", response_model=StaffDetailBulkResponse)
async def get_profile_detail_bulk(
    request: StaffDetailBulkRequest,
    db: Annotated[Session, Depends(get_session)],
) -> StaffDetailBulkResponse:
    """Get bulk profile detail information."""
    try:
        repo = get_staff_repository(db)
        return repo.get_staff_detail_bulk(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PROFILE UPDATE OPERATIONS
# ============================================================================


@router.post("/update", response_model=UpdateStaffResponse)
async def update_profile(
    request: UpdateStaffRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateStaffResponse:
    """Update a profile."""
    try:
        repo = get_staff_repository(db)
        return repo.update_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-update", response_model=BulkUpdateStaffResponse)
async def bulk_update_profile(
    request: BulkUpdateStaffRequest,
    db: Annotated[Session, Depends(get_session)],
) -> BulkUpdateStaffResponse:
    """Bulk update profiles."""
    try:
        repo = get_staff_repository(db)
        return repo.bulk_update_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PROFILE DELETE OPERATIONS
# ============================================================================


@router.post("/delete", response_model=DeleteStaffResponse)
async def delete_profile(
    request: DeleteStaffRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteStaffResponse:
    """Delete a profile."""
    try:
        repo = get_staff_repository(db)
        return repo.delete_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-delete", response_model=BulkDeleteStaffResponse)
async def bulk_delete_profile(
    request: BulkDeleteStaffRequest,
    db: Annotated[Session, Depends(get_session)],
) -> BulkDeleteStaffResponse:
    """Bulk delete profiles."""
    try:
        repo = get_staff_repository(db)
        return repo.bulk_delete_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PROFILE AUTH OPERATIONS (from auth)
# ============================================================================


@router.post("/detail-simple", response_model=ProfileDetailResponse)
async def get_profile_detail_simple(
    request: ProfileDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> ProfileDetailResponse:
    """Get simple profile by ID (auth version without permissions)."""
    try:
        repo = AuthRepository(db)
        profile = repo.get_profile(request.profileId)

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        return ProfileDetailResponse(profile=profile)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-simple", response_model=UpdateProfileResponse)
async def update_profile_simple(
    request: UpdateProfileRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateProfileResponse:
    """Update profile fields (simple auth version)."""
    try:
        repo = AuthRepository(db)

        # Extract updates from request, excluding profileId and None values
        updates = request.model_dump(exclude={"profileId"}, exclude_none=True)

        profile = repo.update_profile(request.profileId, updates)

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        return UpdateProfileResponse(profile=profile)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# EMULATION OPERATIONS (from auth)
# ============================================================================


@router.post("/authorize-emulation", response_model=AuthorizeEmulationResponse)
async def authorize_emulation(
    request: AuthorizeEmulationRequest,
    db: Annotated[Session, Depends(get_session)],
) -> AuthorizeEmulationResponse:
    """Check if emulation is authorized."""
    try:
        repo = AuthRepository(db)
        allowed, reason = repo.authorize_emulation(
            request.requesterProfileId,
            request.targetProfileId,
            request.departmentIds,
        )

        return AuthorizeEmulationResponse(allowed=allowed, reason=reason)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PROFILE CONTEXT (from auth)
# ============================================================================


@router.post("/context", response_model=ProfileContextResponse)
async def get_profile_context(
    request: ProfileContextRequest,
    db: Annotated[Session, Depends(get_session)],
) -> ProfileContextResponse:
    """Get consolidated profile context (profile, departments, cohorts, breadcrumbs)."""
    try:
        repo = AuthRepository(db)
        return repo.get_profile_context(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


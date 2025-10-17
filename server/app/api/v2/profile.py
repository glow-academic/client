"""Profile v2 API endpoints - unified auth and staff operations."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.profile import (AuthorizeEmulationRequest,
                                 AuthorizeEmulationResponse,
                                 MarkChatCompleteRequest,
                                 MarkIntroCompleteRequest,
                                 MarkTourStepResponse, ProfileByAliasRequest,
                                 ProfileContextRequest, ProfileContextResponse,
                                 ProfileDetailRequest, ProfileDetailResponse,
                                 UpdateProfileRequest, UpdateProfileResponse)
from app.schemas.staff import (BulkCreateStaffRequest, BulkCreateStaffResponse,
                               BulkDeleteStaffRequest, BulkDeleteStaffResponse,
                               BulkUpdateStaffRequest, BulkUpdateStaffResponse,
                               CreateStaffRequest, CreateStaffResponse,
                               DeleteStaffRequest, DeleteStaffResponse,
                               StaffDetailBulkRequest, StaffDetailBulkResponse,
                               StaffDetailRequest, StaffDetailResponse,
                               StaffFilters, StaffListResponse,
                               UpdateStaffRequest, UpdateStaffResponse)
from app.services.profile_service import ProfileService
from app.services.staff_service import get_staff_service
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/profile", tags=["profile"])


# ============================================================================
# PROFILE LIST & BASIC OPERATIONS (from staff)
# ============================================================================


@router.post("/list", response_model=StaffListResponse)
async def get_profile_list(
    filters: StaffFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StaffListResponse:
    """Get profile/staff list with permissions and relationships."""
    try:
        service = get_staff_service(conn)
        return await service.get_staff_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=StaffDetailResponse)
async def get_profile_detail_staff(
    request: StaffDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StaffDetailResponse:
    """Get detailed profile information (staff version with permissions)."""
    try:
        service = get_staff_service(conn)
        return await service.get_staff_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-bulk", response_model=StaffDetailBulkResponse)
async def get_profile_detail_bulk(
    request: StaffDetailBulkRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StaffDetailBulkResponse:
    """Get bulk profile detail information."""
    try:
        service = get_staff_service(conn)
        return await service.get_staff_detail_bulk(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PROFILE CREATE OPERATIONS
# ============================================================================


@router.post("/create", response_model=CreateStaffResponse)
async def create_profile(
    request: CreateStaffRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateStaffResponse:
    """Create a new profile."""
    try:
        service = get_staff_service(conn)
        return await service.create_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-create", response_model=BulkCreateStaffResponse)
async def bulk_create_profile(
    request: BulkCreateStaffRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkCreateStaffResponse:
    """Bulk create profiles."""
    try:
        service = get_staff_service(conn)
        return await service.bulk_create_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PROFILE UPDATE OPERATIONS
# ============================================================================


@router.post("/update", response_model=UpdateStaffResponse)
async def update_profile(
    request: UpdateStaffRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateStaffResponse:
    """Update a profile."""
    try:
        service = get_staff_service(conn)
        return await service.update_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-update", response_model=BulkUpdateStaffResponse)
async def bulk_update_profile(
    request: BulkUpdateStaffRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkUpdateStaffResponse:
    """Bulk update profiles."""
    try:
        service = get_staff_service(conn)
        return await service.bulk_update_staff(request)
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteStaffResponse:
    """Delete a profile."""
    try:
        service = get_staff_service(conn)
        return await service.delete_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-delete", response_model=BulkDeleteStaffResponse)
async def bulk_delete_profile(
    request: BulkDeleteStaffRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteStaffResponse:
    """Bulk delete profiles."""
    try:
        service = get_staff_service(conn)
        return await service.bulk_delete_staff(request)
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfileDetailResponse:
    """Get simple profile by ID (auth version without permissions)."""
    try:
        service = ProfileService(conn)
        profile = await service.get_profile(request.profileId)

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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateProfileResponse:
    """Update profile fields (simple auth version)."""
    try:
        service = ProfileService(conn)

        # Extract updates from request, excluding profileId and None values
        updates = request.model_dump(exclude={"profileId"}, exclude_none=True)

        profile = await service.update_profile(request.profileId, updates)

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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AuthorizeEmulationResponse:
    """Check if emulation is authorized."""
    try:
        service = ProfileService(conn)
        allowed, reason = await service.authorize_emulation(
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfileContextResponse:
    """Get consolidated profile context (profile, departments, cohorts, breadcrumbs)."""
    try:
        service = ProfileService(conn)
        return await service.get_profile_context(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TOUR COMPLETION OPERATIONS
# ============================================================================


@router.post("/mark-intro-complete", response_model=MarkTourStepResponse)
async def mark_intro_complete(
    request: MarkIntroCompleteRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MarkTourStepResponse:
    """Mark intro tour step as complete."""
    try:
        service = ProfileService(conn)
        success = await service.mark_intro_complete(request.profileId)

        if not success:
            raise HTTPException(status_code=404, detail="Profile not found")

        return MarkTourStepResponse(
            success=True,
            message=f"Profile {request.profileId} intro marked complete",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mark-chat-complete", response_model=MarkTourStepResponse)
async def mark_chat_complete(
    request: MarkChatCompleteRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MarkTourStepResponse:
    """Mark chat tour step as complete."""
    try:
        service = ProfileService(conn)
        success = await service.mark_chat_complete(request.profileId)

        if not success:
            raise HTTPException(status_code=404, detail="Profile not found")

        return MarkTourStepResponse(
            success=True,
            message=f"Profile {request.profileId} chat marked complete",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PROFILE BY ALIAS OPERATIONS
# ============================================================================


@router.post("/by-alias", response_model=ProfileDetailResponse)
async def get_profile_by_alias(
    request: ProfileByAliasRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfileDetailResponse:
    """Get profile by alias (for auth operations)."""
    try:
        service = ProfileService(conn)
        profile = await service.get_profile_by_alias(request.alias)

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        return ProfileDetailResponse(profile=profile)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



"""Profile v2 API endpoints - unified auth and staff operations."""

from typing import Annotated

import asyncpg
from app.db import get_db
from app.repositories.profile_repository import ProfileRepository
from app.repositories.staff_repository import get_staff_repository
from app.schemas.profile import (AuthorizeEmulationRequest,
                                 AuthorizeEmulationResponse,
                                 CreateUserProfileRequest,
                                 CreateUserProfileResponse,
                                 ListUserProfilesByProfileRequest,
                                 ListUserProfilesByUserRequest,
                                 MarkChatCompleteRequest,
                                 MarkIntroCompleteRequest,
                                 MarkTourStepResponse, ProfileByAliasRequest,
                                 ProfileContextRequest, ProfileContextResponse,
                                 ProfileDetailRequest, ProfileDetailResponse,
                                 UpdateProfileRequest, UpdateProfileResponse,
                                 UserProfilesListResponse)
from app.schemas.staff import (BulkCreateStaffRequest, BulkCreateStaffResponse,
                               BulkDeleteStaffRequest, BulkDeleteStaffResponse,
                               BulkUpdateStaffRequest, BulkUpdateStaffResponse,
                               CreateStaffRequest, CreateStaffResponse,
                               DeleteStaffRequest, DeleteStaffResponse,
                               StaffDetailBulkRequest, StaffDetailBulkResponse,
                               StaffDetailRequest, StaffDetailResponse,
                               StaffFilters, StaffListResponse,
                               UpdateStaffRequest, UpdateStaffResponse)
from fastapi import APIRouter, Depends, HTTPException

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
# PROFILE CREATE OPERATIONS
# ============================================================================


@router.post("/create", response_model=CreateStaffResponse)
async def create_profile(
    request: CreateStaffRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CreateStaffResponse:
    """Create a new profile."""
    try:
        repo = get_staff_repository(db)
        return repo.create_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-create", response_model=BulkCreateStaffResponse)
async def bulk_create_profile(
    request: BulkCreateStaffRequest,
    db: Annotated[Session, Depends(get_session)],
) -> BulkCreateStaffResponse:
    """Bulk create profiles."""
    try:
        repo = get_staff_repository(db)
        return repo.bulk_create_staff(request)
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfileDetailResponse:
    """Get simple profile by ID (auth version without permissions)."""
    try:
        repo = ProfileRepository(conn)
        profile = await repo.get_profile(request.profileId)

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
        repo = ProfileRepository(conn)

        # Extract updates from request, excluding profileId and None values
        updates = request.model_dump(exclude={"profileId"}, exclude_none=True)

        profile = await repo.update_profile(request.profileId, updates)

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
        repo = ProfileRepository(conn)
        allowed, reason = await repo.authorize_emulation(
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
        repo = ProfileRepository(conn)
        return await repo.get_profile_context(request)
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
        repo = ProfileRepository(conn)
        success = await repo.mark_intro_complete(request.profileId)

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
        repo = ProfileRepository(conn)
        success = await repo.mark_chat_complete(request.profileId)

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
        repo = ProfileRepository(conn)
        profile = await repo.get_profile_by_alias(request.alias)

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        return ProfileDetailResponse(profile=profile)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# USER PROFILES OPERATIONS (Junction Table)
# ============================================================================


@router.post("/user-profiles/list-by-user", response_model=UserProfilesListResponse)
async def list_user_profiles_by_user(
    request: ListUserProfilesByUserRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UserProfilesListResponse:
    """List user_profiles by user ID."""
    try:
        repo = ProfileRepository(conn)
        user_profiles = await repo.list_user_profiles_by_user(request.userId)

        return UserProfilesListResponse(userProfiles=user_profiles)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/user-profiles/list-by-profile", response_model=UserProfilesListResponse
)
async def list_user_profiles_by_profile(
    request: ListUserProfilesByProfileRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UserProfilesListResponse:
    """List user_profiles by profile ID."""
    try:
        repo = ProfileRepository(conn)
        user_profiles = await repo.list_user_profiles_by_profile(request.profileId)

        return UserProfilesListResponse(userProfiles=user_profiles)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user-profiles/create", response_model=CreateUserProfileResponse)
async def create_user_profile(
    request: CreateUserProfileRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateUserProfileResponse:
    """Create a user_profile link."""
    try:
        repo = ProfileRepository(conn)
        user_profile = await repo.create_user_profile(
            request.userId, request.profileId, request.isPrimary, request.active
        )

        return CreateUserProfileResponse(userProfile=user_profile)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


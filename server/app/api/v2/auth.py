"""Auth v2 API endpoints for profile and emulation operations."""

from typing import Annotated

from app.db import get_session
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import (AuthorizeEmulationRequest,
                              AuthorizeEmulationResponse,
                              ProfileContextRequest, ProfileContextResponse,
                              ProfileDetailRequest, ProfileDetailResponse,
                              SimulatableProfilesRequest,
                              SimulatableProfilesResponse,
                              UpdateProfileRequest, UpdateProfileResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/auth", tags=["auth"])


# ============================================================================
# PROFILE OPERATIONS
# ============================================================================


@router.post("/profile/detail", response_model=ProfileDetailResponse)
async def get_profile_detail(
    request: ProfileDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> ProfileDetailResponse:
    """Get profile by ID."""
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


@router.post("/profile/update", response_model=UpdateProfileResponse)
async def update_profile(
    request: UpdateProfileRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateProfileResponse:
    """Update profile fields."""
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
# EMULATION OPERATIONS
# ============================================================================


@router.post("/simulatable-profiles", response_model=SimulatableProfilesResponse)
async def get_simulatable_profiles(
    request: SimulatableProfilesRequest,
    db: Annotated[Session, Depends(get_session)],
) -> SimulatableProfilesResponse:
    """Get profiles that the requester can emulate."""
    try:
        repo = AuthRepository(db)
        profiles = repo.get_simulatable_profiles(
            request.profileId,
            request.departmentIds,
        )

        return SimulatableProfilesResponse(profiles=profiles)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@router.post("/profile-context", response_model=ProfileContextResponse)
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


"""Auth V2 API schemas for profile and emulation operations."""

from typing import Dict, List, Optional

from pydantic import BaseModel

# ============================================================================
# PROFILE OPERATIONS
# ============================================================================


class ProfileDetailRequest(BaseModel):
    """Request to get profile details."""

    profileId: str


class ProfileItem(BaseModel):
    """Profile data item."""

    id: str
    firstName: str
    lastName: str
    alias: str
    role: str  # 'superadmin' | 'admin' | 'instructional' | 'ta' | 'guest'
    active: bool
    viewedIntro: bool
    viewedChat: bool
    defaultProfile: bool
    reqPerDay: Optional[int]
    lastLogin: str  # ISO datetime
    lastActive: Optional[str]  # ISO datetime
    createdAt: str  # ISO datetime
    updatedAt: str  # ISO datetime


class ProfileDetailResponse(BaseModel):
    """Response containing profile details."""

    profile: ProfileItem


class UpdateProfileRequest(BaseModel):
    """Request to update profile fields."""

    profileId: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    viewedIntro: Optional[bool] = None
    viewedChat: Optional[bool] = None
    reqPerDay: Optional[int] = None


class UpdateProfileResponse(BaseModel):
    """Response containing updated profile."""

    profile: ProfileItem


class ProfileByAliasRequest(BaseModel):
    """Request to get profile by alias."""

    alias: str


# ============================================================================
# USER PROFILES OPERATIONS (Junction Table)
# ============================================================================


class UserProfileItem(BaseModel):
    """User profile link data item."""

    userId: int
    profileId: str
    isPrimary: bool
    active: bool
    createdAt: str  # ISO datetime
    updatedAt: str  # ISO datetime


class ListUserProfilesByUserRequest(BaseModel):
    """Request to list user_profiles by user ID."""

    userId: int


class ListUserProfilesByProfileRequest(BaseModel):
    """Request to list user_profiles by profile ID."""

    profileId: str


class UserProfilesListResponse(BaseModel):
    """Response containing list of user profiles."""

    userProfiles: List[UserProfileItem]


class CreateUserProfileRequest(BaseModel):
    """Request to create a user profile link."""

    userId: int
    profileId: str
    isPrimary: bool
    active: bool


class CreateUserProfileResponse(BaseModel):
    """Response containing created user profile."""

    userProfile: UserProfileItem


# ============================================================================
# TOUR COMPLETION OPERATIONS
# ============================================================================


class MarkIntroCompleteRequest(BaseModel):
    """Request to mark intro tour step as complete."""

    profileId: str


class MarkChatCompleteRequest(BaseModel):
    """Request to mark chat tour step as complete."""

    profileId: str


class MarkTourStepResponse(BaseModel):
    """Response from marking a tour step complete."""

    success: bool
    message: str


# ============================================================================
# EMULATION OPERATIONS
# ============================================================================


class AuthorizeEmulationRequest(BaseModel):
    """Request to authorize emulation."""

    requesterProfileId: str
    targetProfileId: str
    departmentIds: List[str]


class AuthorizeEmulationResponse(BaseModel):
    """Response indicating if emulation is allowed."""

    allowed: bool
    reason: Optional[str] = None


# ============================================================================
# PROFILE CONTEXT OPERATIONS (Consolidated Layout Data)
# ============================================================================


class ProfileContextRequest(BaseModel):
    """Request to get consolidated profile context."""

    userId: str
    effectiveProfileId: str
    pathname: str


class BreadcrumbItem(BaseModel):
    """Breadcrumb item with resolved title."""

    segment: str
    title: str
    context: Optional[str] = None


class CohortItem(BaseModel):
    """Cohort item."""

    id: str
    title: str
    description: Optional[str] = None
    departmentId: str
    active: bool
    createdAt: str
    updatedAt: str


class DepartmentItem(BaseModel):
    """Department item."""

    id: str
    title: str
    description: Optional[str] = None
    active: bool
    createdAt: str
    updatedAt: str


class CohortsData(BaseModel):
    """Cohorts data with member counts."""

    items: List[CohortItem]
    memberCounts: Dict[str, int]


class SimulationContextItem(BaseModel):
    """Simplified simulation item for profile context."""

    id: str
    name: str
    description: str
    departmentId: str
    timeLimit: Optional[int]
    active: bool
    practiceSimulation: bool
    defaultSimulation: bool


class SimulationsData(BaseModel):
    """Simulations data."""

    items: List[SimulationContextItem]


class ProfileContextResponse(BaseModel):
    """Response with consolidated profile context data."""

    actualProfile: ProfileItem
    effectiveProfile: ProfileItem
    departments: List[DepartmentItem]
    departmentIds: List[str]
    cohorts: CohortsData
    cohortIds: List[str]
    simulations: SimulationsData
    simulationIds: List[str]
    breadcrumbs: List[BreadcrumbItem]
    simulatableProfiles: List[ProfileItem]


"""Auth V2 API schemas for profile and emulation operations."""

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
    reqPerDay: int | None
    lastLogin: str  # ISO datetime
    lastActive: str | None  # ISO datetime
    createdAt: str  # ISO datetime
    updatedAt: str  # ISO datetime
    primaryDepartmentId: str | None  # UUID of primary department


class ProfileDetailResponse(BaseModel):
    """Response containing profile details."""

    profile: ProfileItem


class UpdateProfileRequest(BaseModel):
    """Request to update profile fields."""

    profileId: str
    firstName: str | None = None
    lastName: str | None = None
    lastLogin: str | None = None  # ISO datetime
    role: str | None = None
    active: bool | None = None
    viewedIntro: bool | None = None
    viewedChat: bool | None = None
    reqPerDay: int | None = None


class UpdateProfileResponse(BaseModel):
    """Response containing updated profile."""

    profile: ProfileItem


class ProfileByAliasRequest(BaseModel):
    """Request to get profile by alias."""

    alias: str


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


class AuthorizeEmulationResponse(BaseModel):
    """Response indicating if emulation is allowed."""

    allowed: bool
    reason: str | None = None


# ============================================================================
# PROFILE CONTEXT OPERATIONS (Consolidated Layout Data)
# ============================================================================


class ProfileContextRequest(BaseModel):
    """Request to get consolidated profile context."""

    actualProfileId: str  # The logged-in user's profile ID
    effectiveProfileId: str  # Could be same as actual, or emulated profile ID
    pathname: str  # Current path for breadcrumb generation


class CohortItem(BaseModel):
    """Cohort item."""

    id: str
    title: str
    description: str | None = None
    departmentIds: list[str] | None = None
    active: bool
    createdAt: str
    updatedAt: str


class DepartmentItem(BaseModel):
    """Department item."""

    id: str
    title: str
    description: str | None = None
    active: bool
    createdAt: str
    updatedAt: str


class CohortsData(BaseModel):
    """Cohorts data with member counts."""

    items: list[CohortItem]
    memberCounts: dict[str, int]


class SimulationContextItem(BaseModel):
    """Simplified simulation item for profile context."""

    id: str
    name: str
    description: str
    departmentIds: list[str] | None = None
    timeLimit: int | None
    active: bool
    practiceSimulation: bool


class SimulationsData(BaseModel):
    """Simulations data."""

    items: list[SimulationContextItem]


class ProfileContextResponse(BaseModel):
    """Response with consolidated profile context data."""

    actualProfile: ProfileItem
    effectiveProfile: ProfileItem
    departments: list[DepartmentItem]
    departmentIds: list[str]
    cohorts: CohortsData
    cohortIds: list[str]
    simulations: SimulationsData
    simulationIds: list[str]
    simulatableProfiles: list[ProfileItem]
    earliestAttemptDate: str | None  # ISO datetime of earliest simulation attempt
    availableSections: list[str]  # Sections available to the effective profile's role
    redirectPath: str  # Default redirect path for the effective profile's role

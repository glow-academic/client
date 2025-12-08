"""Common schemas for v3 API - extracted from schemas/base.py.

These are shared schemas used across multiple resources.
Resource-specific schemas should be defined inline in route files.
"""

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class MappingItem(BaseModel):
    """
    Standard mapping item with name and description
    Used universally across ALL resources for consistency
    - For scenarios: description = problem_statement
    - For models: description = model description or empty string
    - For all others: description = natural description
    """

    name: str
    description: str


# Explicit mapping item classes for each resource
# All inherit from MappingItem by default but can be extended in the future
class DepartmentMappingItem(MappingItem):
    """Department mapping item - extends MappingItem with optional entity ID arrays"""

    scenario_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    persona_ids: list[str] | None = None
    document_ids: list[str] | None = None
    rubric_ids: list[str] | None = None
    parameter_ids: list[str] | None = None
    parameter_item_ids: list[str] | None = None
    agent_ids: list[str] | None = None
    staff_ids: list[str] | None = None
    cohort_ids: list[str] | None = None


class PersonaMappingItem(MappingItem):
    """Persona mapping item with custom color and icon fields"""

    color: str
    icon: str
    image_model: bool | None = (
        None  # Optional: indicates if persona's model supports images
    )


class RubricMappingItem(MappingItem):
    """Rubric mapping item - extends MappingItem"""

    pass


class SimulationMappingItem(MappingItem):
    """Simulation mapping item - extends MappingItem with time_limit"""

    time_limit: int | None = None
    department_ids: list[str] | None = None  # None = cross-department (all departments)


class ParameterMappingItem(MappingItem):
    """Parameter mapping item - extends MappingItem"""

    numerical: bool
    document_parameter: bool
    persona_parameter: bool
    scenario_parameter: bool = False
    video_parameter: bool = False


class ParameterItemMappingItem(MappingItem):
    """Parameter item mapping item - extends MappingItem with parameter context"""

    parameter_id: str
    parameter_name: str
    value: str


class CohortMappingItem(MappingItem):
    """Cohort mapping item - extends MappingItem"""

    pass


class DocumentMappingItem(MappingItem):
    """Document mapping item - extends MappingItem with file metadata"""

    filePath: str | None = None
    mimeType: str | None = None


class StaffMappingItem(MappingItem):
    """Staff/Profile mapping item - extends MappingItem"""

    pass


class AgentMappingItem(MappingItem):
    """Agent mapping item - extends MappingItem with role information"""

    roles: list[str]  # List of roles this agent has been used for


class ProviderMappingItem(MappingItem):
    """Provider mapping item - extends MappingItem"""

    pass


class ScenarioMappingItem(BaseModel):
    """Scenario mapping item with extended fields for nested data"""

    name: str
    description: str
    persona_ids: list[str]
    persona_mapping: "PersonaMapping"
    document_mapping: "DocumentMapping"
    parameter_item_mapping: "ParameterItemMapping"
    parameter_item_ids: list[str]
    document_ids: list[str]


class ModelMappingItem(MappingItem):
    """Model mapping item - extends MappingItem"""

    pass


class ReasoningMappingItem(MappingItem):
    """Reasoning mapping item - extends MappingItem"""

    pass


class ObjectiveMappingItem(MappingItem):
    """Objective mapping item - extends MappingItem"""

    pass


class ProfileMappingItem(MappingItem):
    """Profile mapping item - extends MappingItem"""

    pass


class StandardGroupMappingItem(MappingItem):
    """Standard group mapping item with rubric context"""

    points: int
    passPoints: int


class StandardMappingItem(MappingItem):
    """Standard mapping item with points"""

    points: int


# Type aliases for Dict mappings (id -> item)
DepartmentMapping = dict[str, DepartmentMappingItem]
PersonaMapping = dict[str, PersonaMappingItem]
RubricMapping = dict[str, RubricMappingItem]
SimulationMapping = dict[str, SimulationMappingItem]
ParameterMapping = dict[str, ParameterMappingItem]
ParameterItemMapping = dict[str, ParameterItemMappingItem]
CohortMapping = dict[str, CohortMappingItem]
DocumentMapping = dict[str, DocumentMappingItem]
StaffMapping = dict[str, StaffMappingItem]
AgentMapping = dict[str, AgentMappingItem]
ProviderMapping = dict[str, ProviderMappingItem]
ScenarioMapping = dict[str, ScenarioMappingItem]
ModelMapping = dict[str, ModelMappingItem]
ReasoningMapping = dict[str, ReasoningMappingItem]
ObjectiveMapping = dict[str, ObjectiveMappingItem]
ProfileMapping = dict[str, ProfileMappingItem]
StandardGroupsMapping = dict[str, StandardGroupMappingItem]
StandardsMapping = dict[str, StandardMappingItem]

# ============================================================================
# Analytics Schemas (used across multiple v3 routes)
# ============================================================================


# Enums
class Method(str, Enum):
    """Analytics computation methods."""

    AVG = "avg"
    MAX = "max"
    SUM = "sum"
    RATE = "rate"
    COUNT_DISTINCT = "countDistinct"
    MIN = "min"
    SLOPE = "slope"


class SimulationFilter(str, Enum):
    """Simulation filter types."""

    GENERAL = "general"
    PRACTICE = "practice"
    ARCHIVED = "archived"


# Request Schemas
# Response Schemas
class TrendData(BaseModel):
    """Trend data point."""

    date: str
    value: float
    count: int


class DataPoint(BaseModel):
    """Individual data point."""

    profileId: str
    date: str | None = None
    value: float | None = None
    attemptId: str | None = None
    simulationId: str | None = None
    scenarioId: str | None = None
    count: int | None = None


class MetricResponse(BaseModel):
    """Standard metric response."""

    hasData: bool
    method: Method
    currentValue: int
    status: Literal["success", "warning", "danger", "neutral"]
    trendAnalysis: str | None = None
    valueField: str | None = None
    keyField: str | None = None
    trendData: list[TrendData]
    dataPoints: list[DataPoint]
    hover: dict[str, Any] | None = None


# ============================================================================
# History Schemas (used across multiple v3 routes)
# ============================================================================


class AttemptHistoryRow(BaseModel):
    """Attempt history row - shared across dashboard, home, reports, and practice history endpoints."""

    model_config = ConfigDict(populate_by_name=True)

    attemptId: str
    date: str
    profileId: str
    profileName: str
    simulationName: str
    numScenarios: int | None = None
    numScenariosCompleted: int
    infiniteMode: bool
    timeLimit: int | None = None
    personaNames: list[str]
    personaColors: list[str]
    score: int | None = None
    scoreStatus: str | None = None  # "high" | "medium" | "low" | None
    simulation_id: str
    scenario_ids: list[str]
    scenario_titles: list[str]
    isArchived: bool
    showView: bool
    showContinue: bool
    practiceSimulation: bool
    passPct: int | None = None
    department_ids: list[str] | None = None
    cohortNames: list[str]
    practiceScenarioId: str | None = None

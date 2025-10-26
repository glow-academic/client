"""
Base schemas and types for v2 API
Centralized mapping types used across all resources
"""

from pydantic import BaseModel


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
    """Department mapping item - extends MappingItem"""

    pass


class PersonaMappingItem(MappingItem):
    """Persona mapping item with custom color and icon fields"""

    color: str
    icon: str


class RubricMappingItem(MappingItem):
    """Rubric mapping item - extends MappingItem"""

    pass


class SimulationMappingItem(MappingItem):
    """Simulation mapping item - extends MappingItem with time_limit"""

    time_limit: int | None = None


class ParameterMappingItem(MappingItem):
    """Parameter mapping item - extends MappingItem"""

    pass


class ParameterItemMappingItem(MappingItem):
    """Parameter item mapping item - extends MappingItem with parameter context"""

    parameter_id: str
    parameter_name: str


class CohortMappingItem(MappingItem):
    """Cohort mapping item - extends MappingItem"""

    pass


class DocumentMappingItem(MappingItem):
    """Document mapping item - extends MappingItem"""

    pass


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
    persona_id: str | None
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

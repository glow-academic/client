"""
Base schemas and types for v2 API
Centralized mapping types used across all resources
"""

from typing import Dict

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
    """Simulation mapping item - extends MappingItem"""
    pass


class ParameterMappingItem(MappingItem):
    """Parameter mapping item - extends MappingItem"""
    pass


class ParameterItemMappingItem(MappingItem):
    """Parameter item mapping item - extends MappingItem"""
    pass


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
    """Agent mapping item - extends MappingItem"""
    pass


class ProviderMappingItem(MappingItem):
    """Provider mapping item - extends MappingItem"""
    pass


class ScenarioMappingItem(MappingItem):
    """Scenario mapping item - extends MappingItem"""
    pass


class ModelMappingItem(MappingItem):
    """Model mapping item - extends MappingItem"""
    pass


class ObjectiveMappingItem(MappingItem):
    """Objective mapping item - extends MappingItem"""
    pass


class ProfileMappingItem(MappingItem):
    """Profile mapping item - extends MappingItem"""
    pass


class StandardGroupMappingItem(MappingItem):
    """Standard group mapping item - extends MappingItem"""
    pass


class StandardMappingItem(MappingItem):
    """Standard mapping item - extends MappingItem"""
    pass


# Type aliases for Dict mappings (id -> item)
DepartmentMapping = Dict[str, DepartmentMappingItem]
PersonaMapping = Dict[str, PersonaMappingItem]
RubricMapping = Dict[str, RubricMappingItem]
SimulationMapping = Dict[str, SimulationMappingItem]
ParameterMapping = Dict[str, ParameterMappingItem]
ParameterItemMapping = Dict[str, ParameterItemMappingItem]
CohortMapping = Dict[str, CohortMappingItem]
DocumentMapping = Dict[str, DocumentMappingItem]
StaffMapping = Dict[str, StaffMappingItem]
AgentMapping = Dict[str, AgentMappingItem]
ProviderMapping = Dict[str, ProviderMappingItem]
ScenarioMapping = Dict[str, ScenarioMappingItem]
ModelMapping = Dict[str, ModelMappingItem]
ObjectiveMapping = Dict[str, ObjectiveMappingItem]
ProfileMapping = Dict[str, ProfileMappingItem]
StandardGroupsMapping = Dict[str, StandardGroupMappingItem]
StandardsMapping = Dict[str, StandardMappingItem]

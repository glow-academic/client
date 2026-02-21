"""Domain registry package — static metadata for artifacts, relations, and routes."""

from app.registry.artifacts import ARTIFACTS, ArtifactKind, ArtifactMeta
from app.registry.entries import ENTRY_SCHEMAS
from app.registry.relations import (
    ARTIFACT_FLAGS,
    ARTIFACT_RESOURCES,
    ARTIFACT_ROLES,
    ARTIFACT_VIEWS,
    ENTRY_RESOURCES,
    RESOURCE_ENTRIES,
    RESOURCE_MODALITIES,
    VIEW_ENTRIES,
    VIEW_RESOURCES,
)
from app.registry.resources import RESOURCE_SCHEMAS
from app.registry.routes import ARTIFACT_ROUTES, ROLE_ARTIFACTS

__all__ = [
    "ARTIFACT_FLAGS",
    "ARTIFACT_RESOURCES",
    "ARTIFACT_ROLES",
    "ARTIFACT_ROUTES",
    "ARTIFACT_VIEWS",
    "ARTIFACTS",
    "ArtifactKind",
    "ArtifactMeta",
    "ENTRY_RESOURCES",
    "ENTRY_SCHEMAS",
    "RESOURCE_ENTRIES",
    "RESOURCE_MODALITIES",
    "RESOURCE_SCHEMAS",
    "ROLE_ARTIFACTS",
    "VIEW_ENTRIES",
    "VIEW_RESOURCES",
]

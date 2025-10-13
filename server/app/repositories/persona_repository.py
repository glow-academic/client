"""Persona repository for database operations.

This repository delegates to the persona service layer.
"""

from typing import Optional

from app.db import get_session
from app.schemas.personas import (CreatePersonaRequest, CreatePersonaResponse,
                                  DeletePersonaRequest, DeletePersonaResponse,
                                  DuplicatePersonaRequest,
                                  DuplicatePersonaResponse,
                                  PersonaDetailDefaultRequest,
                                  PersonaDetailRequest, PersonaDetailResponse,
                                  PersonasFilters, PersonasListResponse,
                                  UpdatePersonaRequest, UpdatePersonaResponse)
from app.services.persona_service import PersonaService
from sqlalchemy.orm import Session


class PersonaRepository:
    """
    Repository for persona operations.
    
    This repository delegates to the persona service layer.
    """

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.db = db
        self.service = PersonaService(db)

    def get_personas_list(self, filters: PersonasFilters) -> PersonasListResponse:
        """Get personas list."""
        return self.service.get_personas_list(filters)

    def get_persona_detail(
        self, request: PersonaDetailRequest
    ) -> PersonaDetailResponse:
        """Get persona detail."""
        return self.service.get_persona_detail(request)

    def get_persona_detail_default(
        self, request: PersonaDetailDefaultRequest
    ) -> PersonaDetailResponse:
        """Get default persona detail."""
        return self.service.get_persona_detail_default(request)

    def duplicate_persona(
        self, request: DuplicatePersonaRequest
    ) -> DuplicatePersonaResponse:
        """Duplicate persona."""
        return self.service.duplicate_persona(request)

    def delete_persona(
        self, request: DeletePersonaRequest
    ) -> DeletePersonaResponse:
        """Delete persona."""
        return self.service.delete_persona(request)

    def create_persona(
        self, request: CreatePersonaRequest
    ) -> CreatePersonaResponse:
        """Create persona."""
        return self.service.create_persona(request)

    def update_persona(
        self, request: UpdatePersonaRequest
    ) -> UpdatePersonaResponse:
        """Update persona."""
        return self.service.update_persona(request)


def get_persona_repository(db: Optional[Session] = None) -> PersonaRepository:
    """Get persona repository instance."""
    if db is None:
        db = next(get_session())
    return PersonaRepository(db)


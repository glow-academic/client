"""Persona service layer - business logic for persona operations."""

from typing import TYPE_CHECKING, Any, Dict, List, Optional

import asyncpg  # type: ignore
from app.db import transaction
from app.queries.persona_queries import PersonaQueries
from app.schemas.base import (DepartmentMappingItem, ModelMappingItem,
                              ScenarioMappingItem)
from app.schemas.personas import (CreatePersonaRequest, CreatePersonaResponse,
                                  DebugInfoItem, DeletePersonaRequest,
                                  DeletePersonaResponse,
                                  DuplicatePersonaRequest,
                                  DuplicatePersonaResponse,
                                  PersonaDetailDefaultRequest,
                                  PersonaDetailRequest, PersonaDetailResponse,
                                  PersonaItem, PersonasFilters,
                                  PersonasListResponse, UpdatePersonaRequest,
                                  UpdatePersonaResponse)

if TYPE_CHECKING:
    from app.services.scenario_service import ScenarioService


class PersonaService:
    """Service layer for persona operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        self.conn = conn
        self.queries = PersonaQueries()
        self.scenario_service: Optional['ScenarioService'] = None  # Lazy init to avoid circular import

    async def get_personas_list(self, filters: PersonasFilters) -> PersonasListResponse:
        """Get personas list with permissions and scenario details using dynamic SQL."""

        # Get query from query builder
        query, params = self.queries.list_personas(
            filters.departmentIds, filters.profileId
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        personas = []
        scenario_mapping = {}
        model_mapping = {}

        for row in result:
            # Convert UUID arrays to string arrays
            scenario_ids = [str(sid) for sid in (row['scenario_ids'] or [])]

            personas.append(
                PersonaItem(
                    persona_id=str(row['persona_id']),
                    name=row['persona_name'],  # Added name
                    description=row['description'],
                    color=row['color'],
                    icon=row['icon'],
                    scenario_ids=scenario_ids,
                    model_id=str(row['model_id']),
                    reasoning=row['reasoning'],
                    temperature=float(row['temperature']),
                    active=row['active'],
                    num_scenarios=row['num_scenarios'],
                    can_edit=row['can_edit'],
                    can_duplicate=row['can_duplicate'],
                    can_delete=row['can_delete'],
                )
            )

            if row['model_id'] and row['model_name']:
                model_mapping[str(row['model_id'])] = ModelMappingItem(
                    name=row['model_name'],
                    description=getattr(row, 'model_description', '') or ''
                )

        # Get scenario mapping with enhanced data
        if scenario_ids_to_fetch := list(
            set([sid for p in personas for sid in p.scenario_ids])
        ):
            if self.scenario_service is None:
                from app.services.scenario_service import ScenarioService
                self.scenario_service = ScenarioService(self.conn)
            scenario_mapping = await self.scenario_service.build_enhanced_scenario_mapping(
                scenario_ids_to_fetch
            )

        return PersonasListResponse(
            personas=personas,
            scenario_mapping=scenario_mapping,
            model_mapping=model_mapping,
        )

    async def duplicate_persona(
        self, request: DuplicatePersonaRequest
    ) -> DuplicatePersonaResponse:
        """Duplicate a persona using dynamic SQL."""

        # Get original persona data
        query, params = self.queries.get_persona_for_duplicate(request.personaId)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Persona not found: {request.personaId}")

        # Insert duplicate with positional params
        duplicate_query = self.queries.insert_duplicate_persona()
        new_persona = await self.conn.fetchrow(
            duplicate_query,
            result['name'],
            result['description'],
            result['system_prompt'],
            result['temperature'],
            result['reasoning'],
            result['model_id'],
            result['department_id'],
            result['color'],
            result['icon'],
        )

        if not new_persona:
            raise ValueError("Failed to create duplicate persona")

        return DuplicatePersonaResponse(
            success=True,
            personaId=str(new_persona['id']),
            message=f"Persona '{result['name']}' duplicated successfully",
        )

    async def delete_persona(self, request: DeletePersonaRequest) -> DeletePersonaResponse:
        """Delete a persona using dynamic SQL."""

        # Check if persona is in use
        query, params = self.queries.check_persona_usage(request.personaId)
        usage = await self.conn.fetchrow(query, *params)

        if not usage:
            raise ValueError("Failed to check persona usage")

        if usage.usage_count > 0:
            raise ValueError("Cannot delete persona that is in use by scenarios")

        # Get persona name
        query, params = self.queries.get_persona_name(request.personaId)
        persona = await self.conn.fetchrow(query, *params)

        if not persona:
            raise ValueError(f"Persona not found: {request.personaId}")

        # Delete persona
        query, params = self.queries.delete_persona(request.personaId)
        await self.conn.execute(query, *params)

        return DeletePersonaResponse(
            success=True, message=f"Persona '{persona['name']}' deleted successfully"
        )

    async def get_persona_detail(
        self, request: PersonaDetailRequest
    ) -> PersonaDetailResponse:
        """Get detailed persona information using dynamic SQL."""

        # Get persona basic info
        query, params = self.queries.get_persona_by_id(request.personaId)
        persona = await self.conn.fetchrow(query, *params)

        if not persona:
            raise ValueError(f"Persona not found: {request.personaId}")

        # Get user's accessible department IDs based on profile
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        valid_department_ids = [
            str(row['id']) for row in await self.conn.fetch(query, *params)
        ]

        # Get models with mapping
        query, params = self.queries.get_valid_models()
        models_result = await self.conn.fetch(query, *params)

        valid_model_ids = [str(row['id']) for row in models_result]
        model_mapping = {
            str(row['id']): ModelMappingItem(name=row['name'], description=row['description'])
            for row in models_result
        }

        # Get departments with mapping
        query, params = self.queries.get_departments_mapping(valid_department_ids)
        departments_result = await self.conn.fetch(query, *params)

        department_mapping = {
            str(row['id']): DepartmentMappingItem(
                name=row['name'], description=row['description'] or ''
            )
            for row in departments_result
        }

        # Get persona usage in scenarios
        usage_query, usage_params = self.queries.check_persona_usage(request.personaId)
        usage_result = await self.conn.fetchrow(usage_query, *usage_params)
        scenario_count = int(usage_result['usage_count']) if usage_result else 0
        in_use = scenario_count > 0

        # Get profile role for permissions
        role_query, role_params = self.queries.get_profile_role(request.profileId)
        role_result = await self.conn.fetchrow(role_query, *role_params)
        user_role = role_result['role'] if role_result else "student"

        # Calculate permissions
        is_superadmin = user_role == "superadmin"
        is_admin = user_role in ("admin", "superadmin")
        is_default = persona['default_persona']

        # Edit permission: superadmin can edit everything, non-default can be edited by admins
        can_edit = is_superadmin or (is_admin and not is_default)
        
        # Duplicate permission: everyone can duplicate
        can_duplicate = True
        
        # Delete permission: can delete if not in use
        can_delete = not in_use

        # Get debug info (placeholder - adjust based on actual debug table)
        debug_info: List[DebugInfoItem] = []
        # Optional: implement debug log fetching if table exists

        # Define constants/presets
        preset_colors = [
            "#ef4444",
            "#f97316",
            "#f59e0b",
            "#eab308",
            "#84cc16",
            "#22c55e",
            "#10b981",
            "#14b8a6",
            "#06b6d4",
            "#0ea5e9",
            "#3b82f6",
            "#6366f1",
            "#8b5cf6",
            "#a855f7",
            "#d946ef",
            "#ec4899",
            "#f43f5e",
        ]

        suggested_icons = [
            "Brain",
            "User",
            "Users",
            "Sparkles",
            "Zap",
            "Heart",
            "Star",
            "MessageSquare",
            "Bot",
            "GraduationCap",
        ]

        valid_icons = [
            "Brain",
            "User",
            "Users",
            "Sparkles",
            "Zap",
            "Heart",
            "Star",
            "MessageSquare",
            "Bot",
            "GraduationCap",
            "Lightbulb",
            "Target",
            "Award",
            "BookOpen",
            "Code",
            "Cpu",
            "Database",
            "FileText",
            "Globe",
            "Mail",
            "Mic",
            "Monitor",
            "Phone",
            "Radio",
            "Search",
            "Settings",
            "Shield",
            "Video",
            "Wifi",
        ]

        reasoning_options = ["minimal", "low", "medium", "high"]

        return PersonaDetailResponse(
            # Basic fields
            name=persona['name'],
            description=persona['description'],
            department_id=str(persona['department_id']),
            active=persona['active'],
            default_persona=persona['default_persona'],
            color=persona['color'],
            icon=persona['icon'],
            model_id=str(persona['model_id']),
            reasoning=persona['reasoning'],
            temperature=float(persona['temperature']),
            system_prompt=persona['system_prompt'],
            # Usage and permissions
            in_use=in_use,
            scenario_count=scenario_count,
            can_edit=can_edit,
            can_duplicate=can_duplicate,
            can_delete=can_delete,
            # Metadata
            preset_colors=preset_colors,
            suggested_icons=suggested_icons,
            valid_icons=valid_icons,
            valid_model_ids=valid_model_ids,
            reasoning_options=reasoning_options,
            valid_department_ids=valid_department_ids,
            temperature_lower=0.0,
            temperature_upper=2.0,
            # Mappings
            model_mapping=model_mapping,
            department_mapping=department_mapping,
            # Debug info
            debug_info=debug_info,
        )

    async def get_persona_detail_default(
        self, request: PersonaDetailDefaultRequest
    ) -> PersonaDetailResponse:
        """Get default persona details based on profile."""

        # Get default persona for profile
        query, params = self.queries.get_default_persona(request.profileId)
        persona = await self.conn.fetchrow(query, *params)

        if not persona:
            raise ValueError("No personas found for user's departments")

        # Reuse the detail logic with the found persona_id
        detail_request = PersonaDetailRequest(
            personaId=str(persona['id']), profileId=request.profileId
        )

        return await self.get_persona_detail(detail_request)

    async def create_persona(self, request: CreatePersonaRequest) -> CreatePersonaResponse:
        """Create a new persona using dynamic SQL."""

        query = self.queries.create_persona()
        result = await self.conn.fetchrow(
            query,
            request.name,
            request.description,
            request.department_id,
            request.active,
            request.default_persona,
            request.color,
            request.icon,
            request.model_id,
            request.reasoning,
            request.temperature,
            request.system_prompt,
        )

        if not result:
            raise ValueError("Failed to create persona")

        return CreatePersonaResponse(
            success=True,
            personaId=str(result['id']),
            message=f"Persona '{request.name}' created successfully",
        )

    async def update_persona(self, request: UpdatePersonaRequest) -> UpdatePersonaResponse:
        """Update an existing persona using dynamic SQL."""

        # Check if persona exists
        query, params = self.queries.get_persona_name(request.personaId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Persona not found: {request.personaId}")

        # Update persona
        query = self.queries.update_persona()
        await self.conn.execute(
            query,
            request.personaId,
            request.name,
            request.description,
            request.department_id,
            request.active,
            request.default_persona,
            request.color,
            request.icon,
            request.model_id,
            request.reasoning,
            request.temperature,
            request.system_prompt,
        )

        return UpdatePersonaResponse(
            success=True, message=f"Persona '{request.name}' updated successfully"
        )


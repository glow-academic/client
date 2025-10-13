"""Persona service layer - business logic for persona operations."""

from typing import Any, Dict, List

from app.schemas.personas import (CreatePersonaRequest, CreatePersonaResponse,
                                  DebugInfoItem, DeletePersonaRequest,
                                  DeletePersonaResponse, DepartmentMappingItem,
                                  DuplicatePersonaRequest,
                                  DuplicatePersonaResponse,
                                  PersonaDetailDefaultRequest,
                                  PersonaDetailRequest, PersonaDetailResponse,
                                  PersonaItem, PersonasFilters,
                                  PersonasListResponse, UpdatePersonaRequest,
                                  UpdatePersonaResponse)
from sqlalchemy import text
from sqlalchemy.orm import Session


class PersonaService:
    """Service layer for persona operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db

    def get_personas_list(self, filters: PersonasFilters) -> PersonasListResponse:
        """Get personas list with permissions and scenario details using dynamic SQL."""

        query = text("""
        WITH persona_scenarios AS (
            SELECT 
                sp.persona_id,
                ARRAY_AGG(sp.scenario_id ORDER BY s.name) as scenario_ids,
                ARRAY_AGG(s.name ORDER BY s.name) as scenario_names,
                COUNT(sp.scenario_id) as num_scenarios
            FROM scenario_personas sp
            JOIN scenarios s ON s.id = sp.scenario_id
            WHERE sp.active = true
            GROUP BY sp.persona_id
        ),
        persona_data AS (
            SELECT 
                p.id as persona_id,
                p.name as persona_name,
                p.description,
                p.color,
                p.icon,
                p.model_id,
                p.reasoning,
                p.temperature,
                p.default_persona,
                COALESCE(ps.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
                COALESCE(ps.num_scenarios, 0) as num_scenarios,
                m.name as model_name
            FROM personas p
            LEFT JOIN persona_scenarios ps ON ps.persona_id = p.id
            LEFT JOIN models m ON m.id = p.model_id
            WHERE p.department_id = ANY(:department_ids)
        ),
        user_profile AS (
            SELECT role
            FROM profiles
            WHERE id = :profile_id
        )
        SELECT 
            pd.*,
            CASE 
                WHEN up.role = 'superadmin' THEN true
                WHEN pd.default_persona = true THEN false
                WHEN up.role = 'admin' THEN true
                ELSE false
            END as can_edit,
            true as can_duplicate,
            CASE 
                WHEN pd.num_scenarios > 0 THEN false
                ELSE true
            END as can_delete
        FROM persona_data pd
        CROSS JOIN user_profile up
        ORDER BY pd.persona_name
        """)

        params = {
            "department_ids": filters.departmentIds,
            "profile_id": filters.profileId,
        }

        result = self.db.execute(query, params).fetchall()

        # Build response
        personas = []
        scenario_mapping = {}
        model_mapping = {}

        for row in result:
            # Convert UUID arrays to string arrays
            scenario_ids = [str(sid) for sid in (row.scenario_ids or [])]

            personas.append(
                PersonaItem(
                    persona_id=str(row.persona_id),
                    name=row.persona_name,  # Added name
                    description=row.description,
                    color=row.color,
                    icon=row.icon,
                    scenario_ids=scenario_ids,
                    model_id=str(row.model_id),
                    reasoning=row.reasoning,
                    temperature=float(row.temperature),
                    num_scenarios=row.num_scenarios,
                    can_edit=row.can_edit,
                    can_duplicate=row.can_duplicate,
                    can_delete=row.can_delete,
                )
            )

            if row.model_id and row.model_name:
                model_mapping[str(row.model_id)] = row.model_name

        # Get scenario names for mapping
        if scenario_ids_to_fetch := list(
            set([sid for p in personas for sid in p.scenario_ids])
        ):
            scenario_query = text("""
                SELECT id, name 
                FROM scenarios 
                WHERE id = ANY(:scenario_ids)
            """)
            scenario_result = self.db.execute(
                scenario_query, {"scenario_ids": scenario_ids_to_fetch}
            ).fetchall()

            for row in scenario_result:
                scenario_mapping[str(row.id)] = row.name

        return PersonasListResponse(
            personas=personas,
            scenario_mapping=scenario_mapping,
            model_mapping=model_mapping,
        )

    def duplicate_persona(
        self, request: DuplicatePersonaRequest
    ) -> DuplicatePersonaResponse:
        """Duplicate a persona using dynamic SQL."""

        # First, get the original persona data
        query = text("""
        SELECT 
            name,
            description,
            system_prompt,
            temperature,
            reasoning,
            model_id,
            department_id,
            color,
            icon
        FROM personas
        WHERE id = :persona_id
        """)

        result = self.db.execute(query, {"persona_id": request.personaId}).fetchone()

        if not result:
            raise ValueError(f"Persona not found: {request.personaId}")

        # Insert duplicate with modified name
        duplicate_query = text("""
        INSERT INTO personas (
            name,
            description,
            system_prompt,
            temperature,
            reasoning,
            model_id,
            department_id,
            color,
            icon,
            active,
            default_persona
        )
        VALUES (
            :name || ' Copy',
            :description,
            :system_prompt,
            :temperature,
            :reasoning,
            :model_id,
            :department_id,
            :color,
            :icon,
            false,
            false
        )
        RETURNING id
        """)

        new_persona = self.db.execute(
            duplicate_query,
            {
                "name": result.name,
                "description": result.description,
                "system_prompt": result.system_prompt,
                "temperature": result.temperature,
                "reasoning": result.reasoning,
                "model_id": result.model_id,
                "department_id": result.department_id,
                "color": result.color,
                "icon": result.icon,
            },
        ).fetchone()

        if not new_persona:
            raise ValueError("Failed to create duplicate persona")

        self.db.commit()

        return DuplicatePersonaResponse(
            success=True,
            personaId=str(new_persona.id),
            message=f"Persona '{result.name}' duplicated successfully",
        )

    def delete_persona(self, request: DeletePersonaRequest) -> DeletePersonaResponse:
        """Delete a persona using dynamic SQL."""

        # Check if persona is in use
        check_query = text("""
        SELECT COUNT(*) as usage_count
        FROM scenario_personas
        WHERE persona_id = :persona_id AND active = true
        """)

        usage = self.db.execute(
            check_query, {"persona_id": request.personaId}
        ).fetchone()

        if not usage:
            raise ValueError("Failed to check persona usage")

        if usage.usage_count > 0:
            raise ValueError("Cannot delete persona that is in use by scenarios")

        # Get persona name for response message
        name_query = text("""
        SELECT name FROM personas WHERE id = :persona_id
        """)

        persona = self.db.execute(
            name_query, {"persona_id": request.personaId}
        ).fetchone()

        if not persona:
            raise ValueError(f"Persona not found: {request.personaId}")

        # Delete persona
        delete_query = text("""
        DELETE FROM personas WHERE id = :persona_id
        """)

        self.db.execute(delete_query, {"persona_id": request.personaId})
        self.db.commit()

        return DeletePersonaResponse(
            success=True, message=f"Persona '{persona.name}' deleted successfully"
        )

    def get_persona_detail(
        self, request: PersonaDetailRequest
    ) -> PersonaDetailResponse:
        """Get detailed persona information using dynamic SQL."""

        # Get persona basic info
        persona_query = text("""
        SELECT 
            p.name,
            p.description,
            p.department_id,
            p.active,
            p.default_persona,
            p.color,
            p.icon,
            p.model_id,
            p.reasoning,
            p.temperature,
            p.system_prompt
        FROM personas p
        WHERE p.id = :persona_id
        """)

        persona = self.db.execute(
            persona_query, {"persona_id": request.personaId}
        ).fetchone()

        if not persona:
            raise ValueError(f"Persona not found: {request.personaId}")

        # Get user's accessible department IDs based on profile
        user_dept_query = text("""
        SELECT DISTINCT d.id
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = :profile_id AND d.active = true
        ORDER BY d.name
        """)

        valid_department_ids = [
            str(row.id)
            for row in self.db.execute(
                user_dept_query, {"profile_id": request.profileId}
            ).fetchall()
        ]

        # Get models with mapping
        models_query = text("""
        SELECT id, name FROM models WHERE active = true ORDER BY name
        """)
        models_result = self.db.execute(models_query).fetchall()

        valid_model_ids = [str(row.id) for row in models_result]
        model_mapping = {str(row.id): row.name for row in models_result}

        # Get departments with mapping
        departments_query = text("""
        SELECT id, name, description 
        FROM departments 
        WHERE id = ANY(:dept_ids)
        ORDER BY name
        """)
        departments_result = self.db.execute(
            departments_query, {"dept_ids": valid_department_ids}
        ).fetchall()

        department_mapping = {
            str(row.id): DepartmentMappingItem(
                name=row.name, description=row.description
            )
            for row in departments_result
        }

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
            name=persona.name,
            description=persona.description,
            department_id=str(persona.department_id),
            active=persona.active,
            default_persona=persona.default_persona,
            color=persona.color,
            icon=persona.icon,
            model_id=str(persona.model_id),
            reasoning=persona.reasoning,
            temperature=float(persona.temperature),
            system_prompt=persona.system_prompt,
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

    def get_persona_detail_default(
        self, request: PersonaDetailDefaultRequest
    ) -> PersonaDetailResponse:
        """Get default persona details based on profile."""

        # Business logic: Get the first active, non-default persona from user's departments
        # Or get the first default persona if no custom personas exist
        persona_query = text("""
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = :profile_id
        ),
        user_personas AS (
            SELECT p.*
            FROM personas p
            JOIN user_departments ud ON ud.department_id = p.department_id
            WHERE p.active = true
            ORDER BY p.default_persona ASC, p.created_at DESC
            LIMIT 1
        )
        SELECT 
            id,
            name,
            description,
            department_id,
            active,
            default_persona,
            color,
            icon,
            model_id,
            reasoning,
            temperature,
            system_prompt
        FROM user_personas
        """)

        persona = self.db.execute(
            persona_query, {"profile_id": request.profileId}
        ).fetchone()

        if not persona:
            raise ValueError("No personas found for user's departments")

        # Reuse the detail logic with the found persona_id
        detail_request = PersonaDetailRequest(
            personaId=str(persona.id), profileId=request.profileId
        )

        return self.get_persona_detail(detail_request)

    def create_persona(self, request: CreatePersonaRequest) -> CreatePersonaResponse:
        """Create a new persona using dynamic SQL."""

        create_query = text("""
        INSERT INTO personas (
            name,
            description,
            department_id,
            active,
            default_persona,
            color,
            icon,
            model_id,
            reasoning,
            temperature,
            system_prompt
        )
        VALUES (
            :name,
            :description,
            :department_id,
            :active,
            :default_persona,
            :color,
            :icon,
            :model_id,
            :reasoning,
            :temperature,
            :system_prompt
        )
        RETURNING id
        """)

        result = self.db.execute(
            create_query,
            {
                "name": request.name,
                "description": request.description,
                "department_id": request.department_id,
                "active": request.active,
                "default_persona": request.default_persona,
                "color": request.color,
                "icon": request.icon,
                "model_id": request.model_id,
                "reasoning": request.reasoning,
                "temperature": request.temperature,
                "system_prompt": request.system_prompt,
            },
        ).fetchone()

        if not result:
            raise ValueError("Failed to create persona")

        self.db.commit()

        return CreatePersonaResponse(
            success=True,
            personaId=str(result.id),
            message=f"Persona '{request.name}' created successfully",
        )

    def update_persona(self, request: UpdatePersonaRequest) -> UpdatePersonaResponse:
        """Update an existing persona using dynamic SQL."""

        # Check if persona exists
        check_query = text("""
        SELECT name FROM personas WHERE id = :persona_id
        """)

        existing = self.db.execute(
            check_query, {"persona_id": request.personaId}
        ).fetchone()

        if not existing:
            raise ValueError(f"Persona not found: {request.personaId}")

        # Update persona
        update_query = text("""
        UPDATE personas SET
            name = :name,
            description = :description,
            department_id = :department_id,
            active = :active,
            default_persona = :default_persona,
            color = :color,
            icon = :icon,
            model_id = :model_id,
            reasoning = :reasoning,
            temperature = :temperature,
            system_prompt = :system_prompt,
            updated_at = NOW()
        WHERE id = :persona_id
        """)

        self.db.execute(
            update_query,
            {
                "persona_id": request.personaId,
                "name": request.name,
                "description": request.description,
                "department_id": request.department_id,
                "active": request.active,
                "default_persona": request.default_persona,
                "color": request.color,
                "icon": request.icon,
                "model_id": request.model_id,
                "reasoning": request.reasoning,
                "temperature": request.temperature,
                "system_prompt": request.system_prompt,
            },
        )

        self.db.commit()

        return UpdatePersonaResponse(
            success=True, message=f"Persona '{request.name}' updated successfully"
        )


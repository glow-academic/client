"""Persona service layer - business logic for persona operations."""

import json
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.persona_queries import PersonaQueries
from app.schemas.base import (DepartmentMappingItem, ModelMappingItem,
                              ReasoningMappingItem)
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
from app.services.base_service import BaseService, with_cache
from app.utils.search import build_fuzzy_conditions, normalize_text, tokenize


class PersonaService(BaseService):
    """Service layer for persona operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        super().__init__(conn)
        self.queries = PersonaQueries()

    @with_cache(lambda self, filters: keys.persona_list(filters))
    async def get_personas_list(self, filters: PersonasFilters) -> PersonasListResponse:
        """Get personas list with permissions and scenario details using dynamic SQL."""
        # Get query from query builder
        query, params = self.queries.list_personas(
            filters.profileId
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        personas = []
        scenario_mapping = {}
        model_mapping = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}

        # Parse scenario_mapping from first row (same across all rows)
        if result:
            first_row = result[0]

            # Parse scenario mapping from JSONB with type safety (may be string or dict)
            scenario_mapping_data = first_row.get("scenario_mapping")
            if isinstance(scenario_mapping_data, str):
                scenario_mapping_data = json.loads(scenario_mapping_data)
            if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
                for sid, sdata in scenario_mapping_data.items():
                    if isinstance(sdata, dict):
                        from app.schemas.base import ScenarioMappingItem

                        scenario_mapping[sid] = ScenarioMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            persona_id=None,
                            persona_mapping={},
                            document_mapping={},
                            parameter_item_mapping={},
                            parameter_item_ids=[],
                            document_ids=[],
                        )

            # Parse department_mapping from JSONB with type safety (may be string or dict)
            department_mapping_data = first_row.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                for did, ddata in department_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Build persona items
        for row in result:
            # Convert UUID arrays to string arrays
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            personas.append(
                PersonaItem(
                    persona_id=str(row["persona_id"]),
                    name=row["persona_name"],  # Added name
                    description=row["description"],
                    color=row["color"],
                    icon=row["icon"],
                    department_ids=dept_ids,
                    scenario_ids=scenario_ids,
                    model_id=str(row["model_id"]),
                    reasoning=row["reasoning"],
                    temperature=float(row["temperature"]),
                    active=row["active"],
                    num_scenarios=row["num_scenarios"],
                    can_edit=row["can_edit"],
                    can_duplicate=row["can_duplicate"],
                    can_delete=row["can_delete"],
                )
            )

            if row["model_id"] and row["model_name"]:
                model_mapping[str(row["model_id"])] = ModelMappingItem(
                    name=row["model_name"], description=row["model_description"] or ""
                )

        return PersonasListResponse(
            personas=personas,
            scenario_mapping=scenario_mapping,
            model_mapping=model_mapping,
            department_mapping=department_mapping,
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

        async with self.conn.transaction():
            # Duplicate persona (without system_prompt)
            duplicate_query = self.queries.insert_duplicate_persona()
            new_persona = await self.conn.fetchrow(
                duplicate_query,
                result["name"],
                result["description"],
                result["temperature"],
                result["reasoning"] or "none",  # Default to "none" if None
                result["model_id"],
                result["color"],
                result["icon"],
            )

            if not new_persona:
                raise ValueError("Failed to create duplicate persona")

            persona_id = str(new_persona["id"])

            # Create new prompt from original persona's prompt
            if result["system_prompt"]:
                prompt_query, prompt_params = self.queries.create_prompt(
                    result["system_prompt"]
                )
                prompt_row = await self.conn.fetchrow(prompt_query, *prompt_params)
                if prompt_row:
                    prompt_id = prompt_row["prompt_id"]
                    # Link persona to prompt via persona_prompts junction
                    persona_prompt_query, persona_prompt_params = (
                        self.queries.create_persona_prompt(persona_id, prompt_id)
                    )
                    await self.conn.execute(persona_prompt_query, *persona_prompt_params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_persona_all(),
                keys.tag_analytics_all(),
            ]
        )

        return DuplicatePersonaResponse(
            success=True,
            personaId=persona_id,
            message=f"Persona '{result['name']}' duplicated successfully",
        )

    async def delete_persona(
        self, request: DeletePersonaRequest
    ) -> DeletePersonaResponse:
        """Delete a persona using dynamic SQL."""

        # Check if persona is in use
        query, params = self.queries.check_persona_usage(request.personaId)
        usage = await self.conn.fetchrow(query, *params)

        if not usage:
            raise ValueError("Failed to check persona usage")

        usage_count = usage["usage_count"] if "usage_count" in usage else usage.get("count", 0)
        if usage_count > 0:
            raise ValueError("Cannot delete persona that is in use by scenarios")

        # Get persona name
        query, params = self.queries.get_persona_name(request.personaId)
        persona = await self.conn.fetchrow(query, *params)

        if not persona:
            raise ValueError(f"Persona not found: {request.personaId}")

        # Delete persona
        query, params = self.queries.delete_persona(request.personaId)
        await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_persona_by_id(request.personaId),
                keys.tag_persona_all(),
                keys.tag_analytics_all(),
            ]
        )

        return DeletePersonaResponse(
            success=True, message=f"Persona '{persona['name']}' deleted successfully"
        )

    @with_cache(
        lambda self, request: keys.persona_by_id(request.personaId, request.profileId)
    )
    async def get_persona_detail(
        self, request: PersonaDetailRequest
    ) -> PersonaDetailResponse:
        """Get detailed persona information using dynamic SQL."""
        return await self._fetch_persona_detail(request)

    async def _fetch_persona_detail(
        self, request: PersonaDetailRequest
    ) -> PersonaDetailResponse:
        """Internal method to fetch persona detail from database."""
        # Get all persona data with mappings in a single query
        query, params = self.queries.get_persona_detail_complete(
            request.personaId, request.profileId
        )
        persona = await self.conn.fetchrow(query, *params)

        if not persona:
            raise ValueError(f"Persona not found: {request.personaId}")

        # Parse valid_department_ids from array
        valid_department_ids = persona["valid_department_ids"] or []

        # Parse valid_model_ids from array
        valid_model_ids = persona["valid_model_ids"] or []

        # Parse model_mapping from JSONB with type safety (may be string or dict)
        model_mapping = {}
        model_mapping_data = persona.get("model_mapping")
        if isinstance(model_mapping_data, str):
            model_mapping_data = json.loads(model_mapping_data)
        if model_mapping_data and isinstance(model_mapping_data, dict):
            for model_id, mdata in model_mapping_data.items():
                if isinstance(mdata, dict):
                    model_mapping[model_id] = ModelMappingItem(
                        name=mdata.get("name", ""),
                        description=mdata.get("description", ""),
                    )

        # Parse department_mapping from JSONB with type safety (may be string or dict)
        department_mapping = {}
        dept_mapping_data = persona.get("dept_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for dept_id, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    # Persona form doesn't need any ID arrays, just name/description
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Get usage and permissions from query result
        # Query now handles permission logic based on cross-dept status
        scenario_count = (
            int(persona["usage_count"]) if persona.get("usage_count") else 0
        )
        in_use = scenario_count > 0

        # Permissions come from query (which checks role and cross-dept status)
        can_edit = persona.get("can_edit", False)
        can_duplicate = persona.get("can_duplicate", True)
        can_delete = persona.get("can_delete", not in_use)

        # Get debug info (placeholder - adjust based on actual debug table)
        debug_info: list[DebugInfoItem] = []
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

        # Build reasoning_mapping following the reasoning_effort enum
        # Matches database enum: ('none', 'minimal', 'low', 'medium', 'high')
        reasoning_mapping = {
            "none": ReasoningMappingItem(
                name="None", description="No extended reasoning"
            ),
            "minimal": ReasoningMappingItem(
                name="Minimal", description="Basic reasoning for straightforward tasks"
            ),
            "low": ReasoningMappingItem(
                name="Low", description="Light reasoning for simple problem-solving"
            ),
            "medium": ReasoningMappingItem(
                name="Medium", description="Balanced reasoning for moderate complexity"
            ),
            "high": ReasoningMappingItem(
                name="High",
                description="Deep reasoning for complex, multi-step problems",
            ),
        }

        # Parse department_ids from query (None = cross-department)
        department_ids = persona.get("department_ids")
        if department_ids:
            department_ids = [str(d) for d in department_ids]

        # Parse prompt_mapping from JSONB (may be string or dict)
        from app.schemas.personas import PromptInfo
        prompt_mapping: dict[str, PromptInfo] = {}
        prompt_mapping_data = persona.get("prompt_mapping")
        if isinstance(prompt_mapping_data, str):
            prompt_mapping_data = json.loads(prompt_mapping_data)
        if prompt_mapping_data and isinstance(prompt_mapping_data, dict):
            for prompt_id, prompt_data in prompt_mapping_data.items():
                if isinstance(prompt_data, dict):
                    dept_ids = prompt_data.get("department_ids")
                    if isinstance(dept_ids, list):
                        dept_ids = [str(did) for did in dept_ids if did]
                    elif dept_ids is None:
                        dept_ids = None
                    else:
                        dept_ids = None
                    prompt_mapping[prompt_id] = PromptInfo(
                        system_prompt=prompt_data.get("system_prompt", ""),
                        created_at=prompt_data.get("created_at", ""),
                        updated_at=prompt_data.get("updated_at", ""),
                        department_ids=dept_ids,
                    )

        # Parse prompt_id
        prompt_id = persona.get("prompt_id")
        if prompt_id:
            prompt_id = str(prompt_id)

        # Parse department_prompt_links from JSONB (may be string or dict)
        department_prompt_links: dict[str, str] = {}
        department_prompt_links_data = persona.get("department_prompt_links")
        if isinstance(department_prompt_links_data, str):
            department_prompt_links_data = json.loads(department_prompt_links_data)
        if department_prompt_links_data and isinstance(department_prompt_links_data, dict):
            department_prompt_links = {
                str(dept_id): str(prompt_id)
                for dept_id, prompt_id in department_prompt_links_data.items()
            }

        return PersonaDetailResponse(
            # Basic fields
            name=persona["name"],
            description=persona["description"],
            department_ids=department_ids,  # None or list of department IDs
            active=persona["active"],
            color=persona["color"],
            icon=persona["icon"],
            model_id=str(persona["model_id"]),
            reasoning=persona["reasoning"],
            temperature=float(persona["temperature"]),
            system_prompt=persona["system_prompt"],
            prompt_id=prompt_id,
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
            # Prompt version history
            prompt_mapping=prompt_mapping,
            # Mappings
            model_mapping=model_mapping,
            reasoning_mapping=reasoning_mapping,
            department_mapping=department_mapping,
            department_prompt_links=department_prompt_links,
            # Debug info
            debug_info=debug_info,
        )

    @with_cache(lambda self, request: keys.persona_default(request.profileId))
    async def get_persona_detail_default(
        self, request: PersonaDetailDefaultRequest
    ) -> PersonaDetailResponse:
        """Get default persona details based on profile."""
        return await self._fetch_persona_detail_default(request)

    async def _fetch_persona_detail_default(
        self, request: PersonaDetailDefaultRequest
    ) -> PersonaDetailResponse:
        """Internal method to fetch default persona detail from database."""
        # Get valid mappings and IDs only (for form population), return empty defaults for creation
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        ),
        valid_depts AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        d.id::text,
                        jsonb_build_object(
                            'name', d.title,
                            'description', COALESCE(d.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as dept_mapping,
                array_agg(d.id::text ORDER BY d.title) as dept_ids
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $1 AND d.active = true
        ),
        valid_models AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        m.id::text,
                        jsonb_build_object(
                            'name', m.name,
                            'description', COALESCE(m.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as model_mapping,
                array_agg(m.id::text ORDER BY m.name) as model_ids
            FROM models m 
            WHERE m.active = true
        )
        SELECT 
            vd.dept_mapping,
            vd.dept_ids as valid_department_ids,
            vm.model_mapping,
            vm.model_ids as valid_model_ids
        FROM valid_depts vd
        CROSS JOIN valid_models vm
        """
        result = await self.conn.fetchrow(query, request.profileId)

        if not result:
            raise ValueError("Failed to fetch default persona data")

        valid_department_ids = result["valid_department_ids"] or []
        valid_model_ids = result["valid_model_ids"] or []

        if not valid_department_ids:
            raise ValueError("No accessible departments found for user")

        # Parse department_mapping from JSONB
        department_mapping_data = result.get("dept_mapping")
        if isinstance(department_mapping_data, str):
            department_mapping_data = json.loads(department_mapping_data)

        department_mapping: dict[str, DepartmentMappingItem] = {}
        if department_mapping_data and isinstance(department_mapping_data, dict):
            for dept_id, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse model_mapping from JSONB
        model_mapping_data = result.get("model_mapping")
        if isinstance(model_mapping_data, str):
            model_mapping_data = json.loads(model_mapping_data)

        model_mapping: dict[str, ModelMappingItem] = {}
        if model_mapping_data and isinstance(model_mapping_data, dict):
            for model_id, mdata in model_mapping_data.items():
                if isinstance(mdata, dict):
                    model_mapping[model_id] = ModelMappingItem(
                        name=mdata.get("name", ""),
                        description=mdata.get("description", ""),
                    )

        # Hardcoded metadata
        preset_colors = [
            "#EF4444",  # Red
            "#F97316",  # Orange
            "#F59E0B",  # Amber
            "#10B981",  # Green
            "#3B82F6",  # Blue
            "#6366F1",  # Indigo
            "#8B5CF6",  # Purple
            "#EC4899",  # Pink
        ]

        suggested_icons = ["Sparkles", "Zap", "Star", "Heart", "Users"]

        valid_icons = [
            "Activity",
            "Anchor",
            "Award",
            "Bell",
            "Book",
            "Briefcase",
            "Calendar",
            "Camera",
            "ChevronRight",
            "Clock",
            "Cloud",
            "Code",
            "Compass",
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

        reasoning_mapping = {
            "none": ReasoningMappingItem(
                name="None", description="No extended reasoning"
            ),
            "minimal": ReasoningMappingItem(
                name="Minimal", description="Basic reasoning for straightforward tasks"
            ),
            "low": ReasoningMappingItem(
                name="Low", description="Light reasoning for simple problem-solving"
            ),
            "medium": ReasoningMappingItem(
                name="Medium", description="Balanced reasoning for moderate complexity"
            ),
            "high": ReasoningMappingItem(
                name="High",
                description="Deep reasoning for complex, multi-step problems",
            ),
        }

        # Get default model ID (first valid model)
        default_model_id = valid_model_ids[0] if valid_model_ids else None
        if not default_model_id:
            raise ValueError("No valid models found")

        return PersonaDetailResponse(
            # Basic fields (empty defaults for creation)
            name="",
            description="",
            department_ids=None,  # None = cross-department (user can select)
            active=True,
            color=preset_colors[0] if preset_colors else "#3B82F6",
            icon=suggested_icons[0] if suggested_icons else "Sparkles",
            model_id=default_model_id,
            reasoning="none",
            temperature=0.0,
            system_prompt="",
            prompt_id=None,
            # Usage and permissions
            in_use=False,
            scenario_count=0,
            can_edit=True,  # Can edit when creating
            can_duplicate=False,  # Can't duplicate non-existent persona
            can_delete=False,  # Can't delete non-existent persona
            # Metadata
            preset_colors=preset_colors,
            suggested_icons=suggested_icons,
            valid_icons=valid_icons,
            valid_model_ids=valid_model_ids,
            reasoning_options=reasoning_options,
            valid_department_ids=valid_department_ids,
            temperature_lower=0.0,
            temperature_upper=2.0,
            # Prompt version history
            prompt_mapping={},
            # Mappings
            model_mapping=model_mapping,
            reasoning_mapping=reasoning_mapping,
            department_mapping=department_mapping,
            department_prompt_links={},
            # Debug info
            debug_info=[],
        )

    async def create_persona(
        self, request: CreatePersonaRequest
    ) -> CreatePersonaResponse:
        """Create a new persona using dynamic SQL."""

        async with self.conn.transaction():
            # Create persona (without system_prompt)
            query = self.queries.create_persona()
            result = await self.conn.fetchrow(
                query,
                request.name,
                request.description,
                request.active,
                request.color,
                request.icon,
                request.model_id,
                request.reasoning or "none",  # Default to "none" if None
                request.temperature,
            )

            if not result:
                raise ValueError("Failed to create persona")

            persona_id = str(result["id"])

            # Handle prompt creation/linking
            prompt_id = None
            if request.prompt_id:
                # Use existing prompt
                prompt_id = request.prompt_id
            elif request.system_prompt:
                # Create new prompt
                prompt_query, prompt_params = self.queries.create_prompt(
                    request.system_prompt
                )
                prompt_row = await self.conn.fetchrow(prompt_query, *prompt_params)
                if not prompt_row:
                    raise ValueError("Failed to create prompt")
                prompt_id = prompt_row["prompt_id"]

            # Link persona to prompt (set personas.prompt_id)
            if prompt_id:
                persona_prompt_query, persona_prompt_params = (
                    self.queries.create_persona_prompt(persona_id, prompt_id)
                )
                await self.conn.execute(persona_prompt_query, *persona_prompt_params)

            # Insert department links if department_ids provided
            # Note: prompt_id is required for persona_departments
            if request.department_ids and prompt_id:
                insert_dept_query, insert_dept_params = (
                    self.queries.create_persona_departments(
                        persona_id, request.department_ids, prompt_id
                    )
                )
                await self.conn.execute(insert_dept_query, *insert_dept_params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_persona_all(),
                keys.tag_analytics_all(),  # Personas affect persona performance metrics
            ]
        )

        return CreatePersonaResponse(
            success=True,
            personaId=str(result["id"]),
            message=f"Persona '{request.name}' created successfully",
        )

    async def update_persona(
        self, request: UpdatePersonaRequest
    ) -> UpdatePersonaResponse:
        """Update an existing persona using dynamic SQL."""

        # Check if persona exists
        query, params = self.queries.get_persona_name(request.personaId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Persona not found: {request.personaId}")

        async with self.conn.transaction():
            # Update persona basic fields (without system_prompt)
            query = self.queries.update_persona()
            await self.conn.execute(
                query,
                request.personaId,
                request.name,
                request.description,
                request.active,
                request.color,
                request.icon,
                request.model_id,
                request.reasoning or "none",  # Default to "none" if None
                request.temperature,
            )

            # Handle prompt update
            # Always create a new prompt entry when system_prompt is provided (preserves version history)
            # Only use prompt_id when selecting from version history (no system_prompt provided)
            prompt_id = None
            if request.system_prompt:
                # Create new prompt entry (for version history)
                prompt_query, prompt_params = self.queries.create_prompt(
                    request.system_prompt
                )
                prompt_row = await self.conn.fetchrow(prompt_query, *prompt_params)
                if not prompt_row:
                    raise ValueError("Failed to create prompt")
                prompt_id = prompt_row["prompt_id"]
            elif request.prompt_id:
                # Use existing prompt (selecting from version history)
                prompt_id = request.prompt_id

            # Handle department-specific prompt or default prompt
            if request.department_id and prompt_id:
                # Update department-specific prompt via persona_departments
                dept_prompt_query, dept_prompt_params = (
                    self.queries.create_or_update_persona_department_prompt(
                        request.personaId, request.department_id, prompt_id
                    )
                )
                await self.conn.execute(dept_prompt_query, *dept_prompt_params)
            elif prompt_id:
                # Link persona to prompt via persona_prompts junction (deactivates old, activates new)
                # Only do this if NOT updating a department-specific prompt
                persona_prompt_query, persona_prompt_params = (
                    self.queries.create_persona_prompt(request.personaId, prompt_id)
                )
                await self.conn.execute(persona_prompt_query, *persona_prompt_params)

            # Get the persona's current prompt_id for persona_departments
            # Use the updated prompt_id if set, otherwise get from persona_prompts junction table
            persona_prompt_id = prompt_id
            if not persona_prompt_id:
                persona_prompt_row = await self.conn.fetchrow(
                    "SELECT prompt_id FROM persona_prompts WHERE persona_id = $1::uuid AND active = true",
                    request.personaId
                )
                if persona_prompt_row:
                    persona_prompt_id = persona_prompt_row["prompt_id"]

            # Update persona-department links (DELETE + INSERT pattern)
            delete_dept_query, delete_dept_params = (
                self.queries.delete_persona_departments(request.personaId)
            )
            await self.conn.execute(delete_dept_query, *delete_dept_params)

            # Insert new department links if department_ids provided
            # Note: prompt_id is required for persona_departments
            if request.department_ids and persona_prompt_id:
                insert_dept_query, insert_dept_params = (
                    self.queries.create_persona_departments(
                        request.personaId, request.department_ids, persona_prompt_id
                    )
                )
                await self.conn.execute(insert_dept_query, *insert_dept_params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_persona_by_id(request.personaId),
                keys.tag_persona_all(),
                keys.tag_analytics_all(),  # Persona changes affect analytics
            ]
        )

        return UpdatePersonaResponse(
            success=True, message=f"Persona '{request.name}' updated successfully"
        )

    @with_cache(lambda self, query, limit: keys.persona_search(query, limit))
    async def search_personas(
        self, query: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        """
        Fuzzy search personas by name.
        Returns scored and sorted results.

        Args:
            query: Search query string
            limit: Maximum number of results to return

        Returns:
            List of persona dictionaries with scores
        """
        q_norm = normalize_text(query)
        if not q_norm:
            return []

        toks = tokenize(query)

        # Build fuzzy search conditions
        where_clause, params, param_idx = build_fuzzy_conditions(["p.name"], query)

        # Build and execute query
        query_template, _ = self.queries.search_personas_fuzzy(where_clause, limit * 5)
        sql = query_template.replace("{param_count}", str(param_idx))
        params.append(limit * 5)  # Candidate pool

        personas = await self.conn.fetch(sql, *params)

        # Score and build results
        results = []
        for persona in personas:
            score = self._score_persona(q_norm, toks, persona["name"])
            results.append(
                {
                    "id": str(persona["id"]),
                    "name": persona["name"],
                    "description": persona["description"],
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["name"] or ""))
        return results[:limit]

    def _score_persona(self, q_norm: str, toks: list[str], name: str | None) -> int:
        """
        Score persona relevance based on name matching.

        Args:
            q_norm: Normalized query string
            toks: Query tokens
            name: Persona name

        Returns:
            Relevance score (higher is better)
        """
        n_norm = normalize_text(name or "")
        score = 0

        # Whole-string exact
        if n_norm == q_norm:
            score += 100

        # Whole-string prefix
        if n_norm.startswith(q_norm):
            score += 60

        # Per-token boosts
        for tok in toks:
            if n_norm.startswith(tok):
                score += 25
            if tok in n_norm:
                score += 10

        # Whole query appears anywhere
        if q_norm in n_norm:
            score += 5

        # Length proximity bonus (prefer shorter closer names)
        gap = abs(len(n_norm) - len(q_norm))
        score += max(0, 10 - gap)

        return score

    # ===== Analytics Methods for MCP Tools =====

    @with_cache(
        lambda self, persona_id, window_days=30: keys.persona_response_times(
            persona_id, window_days
        )
    )
    async def get_persona_response_times(
        self, persona_id: str, window_days: int = 30
    ) -> dict[str, Any]:
        """Get persona response time analysis.

        Analyze response times for a specific persona across its scenarios.

        Args:
            persona_id: UUID string of the persona
            window_days: Analysis window in days (default: 30)

        Returns:
            Dict with structure: {"persona": {...}, "stats": {...}, "recent_responses": [...]}
            or {"error": "..."}
        """
        from datetime import datetime, timedelta

        try:
            persona_uuid = __import__("uuid").UUID(persona_id)
        except ValueError:
            return {"error": f"Invalid persona_id format: {persona_id}"}

        try:
            # Get all data in ONE consolidated query (C2 consolidation)
            cutoff_date = datetime.now() - timedelta(days=window_days)
            query, params = self.queries.get_persona_response_times_complete(
                str(persona_uuid), cutoff_date
            )
            result = await self.conn.fetchrow(query, *params)

            if not result:
                return {"error": f"Persona not found: {persona_id}"}

            # Parse scenarios from JSONB
            scenarios = result["scenarios"] if result["scenarios"] else []

            if not scenarios or len(scenarios) == 0:
                return {
                    "persona": {
                        "id": str(result["persona_id"]),
                        "name": result["persona_name"],
                        "description": result["persona_description"],
                    },
                    "stats": {"message": "No scenarios found for this persona"},
                    "recent_responses": [],
                }

            # Parse response data from JSONB
            import json

            response_data_raw = result["response_data"]
            if isinstance(response_data_raw, str):
                response_data = json.loads(response_data_raw)
            else:
                response_data = response_data_raw if response_data_raw else []

            # Sort by response_time_seconds descending (since removed from SQL for DISTINCT compatibility)
            if response_data:
                response_data = sorted(
                    response_data,
                    key=lambda x: x.get("response_time_seconds", 0),
                    reverse=True,
                )

            response_times: list[float] = []
            recent_responses: list[dict[str, Any]] = []

            for row in response_data:
                response_time_seconds = float(row["response_time_seconds"])
                response_times.append(response_time_seconds)

                # Handle datetime objects that may already be serialized
                query_time = row["query_time"]
                if hasattr(query_time, "isoformat"):
                    query_time = query_time.isoformat()
                elif not isinstance(query_time, str):
                    query_time = str(query_time)

                response_time = row["response_time"]
                if hasattr(response_time, "isoformat"):
                    response_time = response_time.isoformat()
                elif not isinstance(response_time, str):
                    response_time = str(response_time)

                recent_responses.append(
                    {
                        "chat_id": str(row["chat_id"]),
                        "scenario_name": row["scenario_name"],
                        "query_time": query_time,
                        "response_time": response_time,
                        "response_time_seconds": response_time_seconds,
                        "query_length": row["query_length"],
                        "response_length": row["response_length"],
                    }
                )

            # Calculate statistics
            if response_times:
                sorted_times = sorted(response_times)
                stats = {
                    "total_responses": len(response_times),
                    "avg_response_time": round(
                        sum(response_times) / len(response_times), 2
                    ),
                    "min_response_time": round(min(response_times), 2),
                    "max_response_time": round(max(response_times), 2),
                    "median_response_time": round(
                        sorted_times[len(sorted_times) // 2], 2
                    ),
                    "responses_under_5s": len([t for t in response_times if t < 5]),
                    "responses_under_10s": len([t for t in response_times if t < 10]),
                    "responses_over_30s": len([t for t in response_times if t > 30]),
                    "window_days": window_days,
                    "analysis_period": f"{cutoff_date.strftime('%Y-%m-%d')} to {datetime.now().strftime('%Y-%m-%d')}",
                }
            else:
                stats = {
                    "message": f"No response data found in the last {window_days} days",
                    "window_days": window_days,
                    "analysis_period": f"{cutoff_date.strftime('%Y-%m-%d')} to {datetime.now().strftime('%Y-%m-%d')}",
                }

            return {
                "persona": {
                    "id": str(result["persona_id"]),
                    "name": result["persona_name"],
                    "description": result["persona_description"],
                    "scenario_count": len(scenarios),
                },
                "stats": stats,
                "recent_responses": recent_responses[:20],  # Limit to 20 most recent
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}

    # ===== Overview Methods for MCP Tools =====

    @with_cache(lambda self, persona_id: keys.persona_overview(persona_id))
    async def get_persona_overview(self, persona_id: str) -> dict[str, Any]:
        """Get persona overview with all related data in ONE optimized query.

        Returns persona details and associated scenarios.

        Args:
            persona_id: UUID string of the persona

        Returns:
            Dict with persona overview data or {"error": "..."}
        """
        import uuid

        try:
            persona_uuid = uuid.UUID(persona_id)
        except ValueError:
            return {"error": f"Invalid persona_id format: {persona_id}"}

        try:
            query, params = self.queries.get_persona_overview_complete(persona_uuid)
            result = await self.conn.fetchrow(query, *params)

            if not result:
                return {"error": f"Persona not found: {persona_id}"}

            # Transform scenarios (jsonb array to list of dicts)
            scenario_list = []
            for scenario in result["scenarios"]:
                scenario_list.append(
                    {
                        "id": str(scenario["id"]),
                        "name": scenario["name"],
                        "problem_statement": scenario["problem_statement"],
                        "created_at": scenario["created_at"]
                        if scenario.get("created_at")
                        else None,
                    }
                )

            return {
                "id": str(result["id"]),
                "name": result["name"],
                "description": result["description"],
                "system_prompt": result["system_prompt"],
                "temperature": float(result["temperature"])
                if result["temperature"]
                else None,
                "created_at": result["created_at"].isoformat()
                if result["created_at"]
                else None,
                "updated_at": result["updated_at"].isoformat()
                if result["updated_at"]
                else None,
                "scenarios": scenario_list,
                "scenario_count": len(scenario_list),
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}


def get_persona_service(conn: asyncpg.Connection) -> PersonaService:
    """Get persona service instance."""
    return PersonaService(conn)

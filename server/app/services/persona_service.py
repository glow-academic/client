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
from app.utils.search import build_fuzzy_conditions, normalize_text, tokenize

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
                    description=row['model_description'] or ''
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

    async def search_personas(
        self, query: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
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
            results.append({
                "id": str(persona["id"]),
                "name": persona["name"],
                "description": persona["description"],
                "score": score,
            })

        results.sort(key=lambda r: (-r["score"], r["name"] or ""))
        return results[:limit]

    def _score_persona(
        self, q_norm: str, toks: List[str], name: str | None
    ) -> int:
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

    async def get_persona_response_times(
        self, persona_id: str, window_days: int = 30
    ) -> Dict[str, Any]:
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
            persona_uuid = __import__('uuid').UUID(persona_id)
        except ValueError:
            return {"error": f"Invalid persona_id format: {persona_id}"}

        try:
            # Get persona details with scenarios
            query, params = self.queries.get_persona_with_scenarios(str(persona_uuid))
            persona = await self.conn.fetchrow(query, *params)
            
            if not persona:
                return {"error": f"Persona not found: {persona_id}"}

            # Parse scenarios from JSON
            scenarios = persona["scenarios"] if persona["scenarios"] else []
            
            if not scenarios:
                return {
                    "persona": {
                        "id": str(persona["persona_id"]),
                        "name": persona["persona_name"],
                        "description": persona["persona_description"],
                    },
                    "stats": {"message": "No scenarios found for this persona"},
                    "recent_responses": [],
                }

            # Get recent response times for this persona's scenarios
            cutoff_date = datetime.now() - timedelta(days=window_days)
            scenario_ids = [str(s["id"]) for s in scenarios]

            # Get response time data
            query, params = self.queries.get_persona_response_time_data(
                scenario_ids, cutoff_date
            )
            response_data = await self.conn.fetch(query, *params)

            response_times: List[float] = []
            recent_responses: List[Dict[str, Any]] = []

            for row in response_data:
                response_time_seconds = float(row["response_time_seconds"])
                response_times.append(response_time_seconds)
                
                recent_responses.append({
                    "chat_id": str(row["chat_id"]),
                    "scenario_name": row["scenario_name"],
                    "query_time": row["query_time"].isoformat(),
                    "response_time": row["response_time"].isoformat(),
                    "response_time_seconds": response_time_seconds,
                    "query_length": row["query_length"],
                    "response_length": row["response_length"],
                })

            # Calculate statistics
            if response_times:
                sorted_times = sorted(response_times)
                stats = {
                    "total_responses": len(response_times),
                    "avg_response_time": round(sum(response_times) / len(response_times), 2),
                    "min_response_time": round(min(response_times), 2),
                    "max_response_time": round(max(response_times), 2),
                    "median_response_time": round(sorted_times[len(sorted_times) // 2], 2),
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
                    "id": str(persona["persona_id"]),
                    "name": persona["persona_name"],
                    "description": persona["persona_description"],
                    "scenario_count": len(scenarios),
                },
                "stats": stats,
                "recent_responses": recent_responses[:20],  # Limit to 20 most recent
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}

    # ===== Overview Methods for MCP Tools =====

    async def get_persona_overview(self, persona_id: str) -> Dict[str, Any]:
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
                scenario_list.append({
                    "id": str(scenario["id"]),
                    "name": scenario["name"],
                    "problem_statement": scenario["problem_statement"],
                    "default_scenario": scenario["default_scenario"],
                    "created_at": scenario["created_at"] if scenario.get("created_at") else None,
                })

            return {
                "id": str(result["id"]),
                "name": result["name"],
                "description": result["description"],
                "system_prompt": result["system_prompt"],
                "temperature": float(result["temperature"]) if result["temperature"] else None,
                "default_persona": result["default_persona"],
                "created_at": result["created_at"].isoformat() if result["created_at"] else None,
                "updated_at": result["updated_at"].isoformat() if result["updated_at"] else None,
                "scenarios": scenario_list,
                "scenario_count": len(scenario_list),
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}


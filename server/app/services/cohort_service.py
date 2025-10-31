"""Cohort service layer - business logic for cohort operations."""

import json
import os
import uuid
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.db import transaction
from app.queries.cohort_queries import CohortQueries
from app.queries.staff_queries import StaffQueries
from app.schemas.base import (CohortMapping, CohortMappingItem,
                              DepartmentMapping, DepartmentMappingItem,
                              ProfileMappingItem, SimulationMappingItem)
from app.schemas.cohorts import (AddProfilesToCohortRequest,
                                 AddProfilesToCohortResponse,
                                 CohortDetailDefaultRequest,
                                 CohortDetailRequest, CohortDetailResponse,
                                 CohortDetailWithProfilesRequest,
                                 CohortDetailWithProfilesResponse, CohortItem,
                                 CohortsFilters, CohortsListResponse,
                                 CreateCohortRequest, CreateCohortResponse,
                                 DeleteCohortRequest, DeleteCohortResponse,
                                 DuplicateCohortRequest,
                                 DuplicateCohortResponse, LeaveCohortRequest,
                                 LeaveCohortResponse,
                                 RemoveProfilesFromCohortRequest,
                                 RemoveProfilesFromCohortResponse,
                                 SimulationInCohort, UpdateCohortRequest,
                                 UpdateCohortResponse)
from app.schemas.staff import StaffItem
from app.services.base_service import BaseService, with_cache
from app.utils.search import build_fuzzy_conditions, normalize_text, tokenize
from dotenv import load_dotenv

load_dotenv()


class CohortService(BaseService):
    """Service layer for cohort operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        super().__init__(conn)
        self.queries = CohortQueries()
        self.staff_queries = StaffQueries()

    @with_cache(lambda self, filters: keys.cohort_list(filters))
    async def get_cohorts_list(self, filters: CohortsFilters) -> CohortsListResponse:
        """Get cohorts list with permissions and relationships."""
        return await self._execute_get_cohorts_list(filters)

    async def _execute_get_cohorts_list(
        self, filters: CohortsFilters
    ) -> CohortsListResponse:
        """Execute the actual cohorts list query."""
        # Get campus domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.com")

        # Get query from query builder (now includes mappings)
        query, params = self.queries.list_cohorts(
            filters.profileId, campus_domain
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        cohorts = []
        profile_mapping: dict[str, ProfileMappingItem] = {}
        simulation_mapping: dict[str, SimulationMappingItem] = {}

        for row in result:
            # Convert UUID arrays to string arrays
            profile_ids = [str(pid) for pid in (row["profile_ids"] or [])]
            simulation_ids = [str(sid) for sid in (row["simulation_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            cohorts.append(
                CohortItem(
                    cohort_id=str(row["cohort_id"]),
                    name=row["name"],
                    description=row["description"],
                    active=row["active"],
                    department_ids=dept_ids,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    can_leave=row["can_leave"],
                    profile_ids=profile_ids,
                    simulation_ids=simulation_ids,
                    num_members=row["num_members"],
                )
            )

            # Parse profile mapping from first row (same for all cohorts)
            if not profile_mapping and row["profile_mapping"]:
                # asyncpg returns JSONB as string or dict
                pm = row["profile_mapping"]
                if isinstance(pm, str):
                    pm = json.loads(pm)
                if isinstance(pm, dict):
                    for pid, pdata in pm.items():
                        if isinstance(pdata, dict):
                            profile_mapping[pid] = ProfileMappingItem(
                                name=pdata["name"], description=pdata["description"]
                            )

            # Parse simulation mapping from first row (same for all cohorts)
            if not simulation_mapping and row["simulation_mapping"]:
                # asyncpg returns JSONB as string or dict
                sm = row["simulation_mapping"]
                if isinstance(sm, str):
                    sm = json.loads(sm)
                if isinstance(sm, dict):
                    for sid, sdata in sm.items():
                        if isinstance(sdata, dict):
                            # Handle department_ids - may be array or null
                            dept_ids = sdata.get("department_ids")
                            if isinstance(dept_ids, str):
                                try:
                                    dept_ids = json.loads(dept_ids)
                                except (json.JSONDecodeError, ValueError):
                                    dept_ids = [dept_ids] if dept_ids else None
                            elif dept_ids is None:
                                dept_ids = None
                            elif not isinstance(dept_ids, list):
                                dept_ids = [dept_ids] if dept_ids else None
                            
                            simulation_mapping[sid] = SimulationMappingItem(
                                name=sdata["name"],
                                description=sdata["description"],
                                time_limit=sdata.get("time_limit"),
                                department_ids=dept_ids,
                            )

        return CohortsListResponse(
            cohorts=cohorts,
            profile_mapping=profile_mapping,
            simulation_mapping=simulation_mapping,
        )

    @with_cache(
        lambda self, request: keys.cohort_by_id(request.cohortId, request.profileId)
    )
    async def get_cohort_detail(
        self, request: CohortDetailRequest
    ) -> CohortDetailResponse:
        """Get detailed cohort information using dynamic SQL."""
        return await self._execute_get_cohort_detail(request)

    async def _execute_get_cohort_detail(
        self, request: CohortDetailRequest
    ) -> CohortDetailResponse:
        """Execute the actual cohort detail query."""
        # Get campus domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.com")

        # Get all cohort detail data in one query
        query, params = self.queries.get_cohort_detail_complete(
            request.cohortId, request.profileId, campus_domain
        )
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Parse simulation mapping from JSONB (may be string or dict)
        simulation_mapping = {}
        simulation_mapping_data = cohort["simulation_mapping"]
        if isinstance(simulation_mapping_data, str):
            simulation_mapping_data = json.loads(simulation_mapping_data)
        if simulation_mapping_data and isinstance(simulation_mapping_data, dict):
            for sid, sdata in simulation_mapping_data.items():
                if isinstance(sdata, dict):
                    simulation_mapping[sid] = SimulationMappingItem(
                        name=sdata["name"],
                        description=sdata["description"],
                        time_limit=sdata.get("time_limit"),
                        department_ids=sdata.get("department_ids"),
                    )

        # Parse profile mapping from JSONB (may be string or dict)
        profile_mapping = {}
        profile_mapping_data = cohort["profile_mapping"]
        if isinstance(profile_mapping_data, str):
            profile_mapping_data = json.loads(profile_mapping_data)
        if profile_mapping_data and isinstance(profile_mapping_data, dict):
            for pid, pdata in profile_mapping_data.items():
                if isinstance(pdata, dict):
                    profile_mapping[pid] = ProfileMappingItem(
                        name=pdata["name"], description=pdata["description"]
                    )

        # Parse department mapping from JSONB (may be string or dict)
        department_mapping = {}
        department_mapping_data = cohort["department_mapping"]
        if isinstance(department_mapping_data, str):
            department_mapping_data = json.loads(department_mapping_data)
        if department_mapping_data and isinstance(department_mapping_data, dict):
            for did, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    # Parse optional ID arrays (handle None, empty arrays, or missing keys)
                    # Cohort form needs: simulation_ids, staff_ids
                    dept_simulation_ids = ddata.get("simulation_ids")
                    dept_staff_ids = ddata.get("staff_ids")
                    
                    # Convert to list[str] if present, otherwise None
                    def to_str_list(value: Any) -> list[str] | None:
                        if value is None:
                            return None
                        if isinstance(value, list):
                            return [str(v) for v in value if v]
                        return None
                    
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata["name"],
                        description=ddata.get("description", ""),
                        simulation_ids=to_str_list(dept_simulation_ids),
                        staff_ids=to_str_list(dept_staff_ids),
                    )

        # Parse simulations list from JSONB (may be string or list)
        simulations_list: list[SimulationInCohort] = []
        simulations_list_data = cohort.get("simulations_list")
        if isinstance(simulations_list_data, str):
            simulations_list_data = json.loads(simulations_list_data)
        if simulations_list_data and isinstance(simulations_list_data, list):
            for sim_data in simulations_list_data:
                if isinstance(sim_data, dict):
                    simulations_list.append(
                        SimulationInCohort(
                            simulation_id=sim_data["simulation_id"],
                            name=sim_data["name"],
                            description=sim_data["description"],
                            time_limit=sim_data.get("time_limit"),
                            active=sim_data["active"],
                            usage_count=sim_data["usage_count"],
                            success_rate=sim_data["success_rate"],
                            last_used=sim_data.get("last_used"),
                            can_remove=sim_data["can_remove"],
                        )
                    )

        # Parse department_ids from query (None = cross-department)
        department_ids = cohort.get("department_ids")
        if department_ids:
            department_ids = [str(d) for d in department_ids]

        # Parse staff list from JSONB (may be string or list)
        staff_list: list[StaffItem] = []
        staff_data = cohort.get("staff")
        if isinstance(staff_data, str):
            staff_data = json.loads(staff_data)
        if staff_data and isinstance(staff_data, list):
            for staff_row in staff_data:
                if isinstance(staff_row, dict):
                    # Convert cohort_ids from array
                    cohort_ids_staff = staff_row.get("cohort_ids") or []
                    cohort_ids_staff = [str(cid) for cid in cohort_ids_staff]
                    # department_ids is already text[]
                    department_ids_staff = staff_row.get("department_ids") or []
                    # Convert lastActive timestamp (may be string from JSONB or datetime)
                    last_active = None
                    if staff_row.get("lastActive"):
                        last_active_val = staff_row["lastActive"]
                        if isinstance(last_active_val, str):
                            last_active = last_active_val
                        elif hasattr(last_active_val, "isoformat"):
                            last_active = last_active_val.isoformat()
                        else:
                            last_active = str(last_active_val)

                    staff_list.append(
                        StaffItem(
                            profile_id=str(staff_row["profile_id"]),
                            first_name=staff_row["first_name"],
                            last_name=staff_row["last_name"],
                            alias=staff_row["alias"],
                            name=staff_row["name"],
                            role=staff_row["role"],
                            email=staff_row["email"],
                            initials=staff_row["initials"],
                            active=staff_row["active"],
                            last_active=last_active,
                            cohort_ids=cohort_ids_staff,
                            department_ids=department_ids_staff,
                            requests_per_day=staff_row.get("requests_per_day"),
                            total_requests=staff_row.get("total_requests", 0),
                            default_profile=staff_row["default_profile"],
                            requests_in_last_day=staff_row.get("requests_in_last_day", 0),
                            can_edit=staff_row["can_edit"],
                            can_delete=staff_row["can_delete"],
                        )
                    )

        # Parse cohort mapping for staff (may be string or dict)
        cohort_mapping_for_staff: CohortMapping | None = None
        cohort_mapping_data = cohort.get("cohort_mapping_for_staff")
        if isinstance(cohort_mapping_data, str):
            cohort_mapping_data = json.loads(cohort_mapping_data)
        if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
            cohort_mapping_for_staff = {}
            for cid, cdata in cohort_mapping_data.items():
                if isinstance(cdata, dict):
                    cohort_mapping_for_staff[cid] = CohortMappingItem(
                        name=cdata.get("name", ""),
                        description=cdata.get("description", ""),
                    )

        # Parse department mapping for staff (may be string or dict)
        department_mapping_for_staff: DepartmentMapping | None = None
        dept_mapping_staff_data = cohort.get("department_mapping_for_staff")
        if isinstance(dept_mapping_staff_data, str):
            dept_mapping_staff_data = json.loads(dept_mapping_staff_data)
        if dept_mapping_staff_data and isinstance(dept_mapping_staff_data, dict):
            department_mapping_for_staff = {}
            for did, ddata in dept_mapping_staff_data.items():
                if isinstance(ddata, dict):
                    department_mapping_for_staff[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        return CohortDetailResponse(
            title=cohort["title"],
            description=cohort["description"],
            department_ids=department_ids,  # None or list of department IDs
            valid_department_ids=cohort["valid_department_ids"],
            active=cohort["active"],
            simulation_ids=cohort["simulation_ids"],
            valid_simulation_ids=cohort["valid_simulation_ids"],
            profile_ids=cohort["profile_ids"],
            valid_profile_ids=cohort["valid_profile_ids"],
            simulations=simulations_list,
            staff=staff_list,
            simulation_mapping=simulation_mapping,
            profile_mapping=profile_mapping,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping_for_staff,
            department_mapping_for_staff=department_mapping_for_staff,
        )

    @with_cache(lambda self, request: keys.cohort_default(request.profileId))
    async def get_cohort_detail_default(
        self, request: CohortDetailDefaultRequest
    ) -> CohortDetailResponse:
        """Get default cohort details based on profile."""
        return await self._execute_get_cohort_detail_default(request)

    async def _execute_get_cohort_detail_default(
        self, request: CohortDetailDefaultRequest
    ) -> CohortDetailResponse:
        """Execute the actual default cohort detail query."""
        # Get campus domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.com")

        # Get default cohort detail data in one query
        query, params = self.queries.get_cohort_detail_default_complete(
            request.profileId, campus_domain
        )
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError("No cohorts found for user's departments")

        # Parse simulation mapping from JSONB (may be string or dict)
        simulation_mapping = {}
        simulation_mapping_data = cohort["simulation_mapping"]
        if isinstance(simulation_mapping_data, str):
            simulation_mapping_data = json.loads(simulation_mapping_data)
        if simulation_mapping_data and isinstance(simulation_mapping_data, dict):
            for sid, sdata in simulation_mapping_data.items():
                if isinstance(sdata, dict):
                    simulation_mapping[sid] = SimulationMappingItem(
                        name=sdata["name"],
                        description=sdata["description"],
                        time_limit=sdata.get("time_limit"),
                        department_ids=sdata.get("department_ids"),
                    )

        # Parse profile mapping from JSONB (may be string or dict)
        profile_mapping = {}
        profile_mapping_data = cohort["profile_mapping"]
        if isinstance(profile_mapping_data, str):
            profile_mapping_data = json.loads(profile_mapping_data)
        if profile_mapping_data and isinstance(profile_mapping_data, dict):
            for pid, pdata in profile_mapping_data.items():
                if isinstance(pdata, dict):
                    profile_mapping[pid] = ProfileMappingItem(
                        name=pdata["name"], description=pdata["description"]
                    )

        # Parse department mapping from JSONB (may be string or dict)
        department_mapping = {}
        department_mapping_data = cohort["department_mapping"]
        if isinstance(department_mapping_data, str):
            department_mapping_data = json.loads(department_mapping_data)
        if department_mapping_data and isinstance(department_mapping_data, dict):
            for did, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    # Parse optional ID arrays (handle None, empty arrays, or missing keys)
                    # Cohort form needs: simulation_ids, staff_ids
                    dept_simulation_ids = ddata.get("simulation_ids")
                    dept_staff_ids = ddata.get("staff_ids")
                    
                    # Convert to list[str] if present, otherwise None
                    def to_str_list(value: Any) -> list[str] | None:
                        if value is None:
                            return None
                        if isinstance(value, list):
                            return [str(v) for v in value if v]
                        return None
                    
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata["name"],
                        description=ddata.get("description", ""),
                        simulation_ids=to_str_list(dept_simulation_ids),
                        staff_ids=to_str_list(dept_staff_ids),
                    )

        # Parse simulations list from JSONB (may be string or list)
        simulations_list: list[SimulationInCohort] = []
        simulations_list_data = cohort.get("simulations_list")
        if isinstance(simulations_list_data, str):
            simulations_list_data = json.loads(simulations_list_data)
        if simulations_list_data and isinstance(simulations_list_data, list):
            for sim_data in simulations_list_data:
                if isinstance(sim_data, dict):
                    simulations_list.append(
                        SimulationInCohort(
                            simulation_id=sim_data["simulation_id"],
                            name=sim_data["name"],
                            description=sim_data["description"],
                            time_limit=sim_data.get("time_limit"),
                            active=sim_data["active"],
                            usage_count=sim_data["usage_count"],
                            success_rate=sim_data["success_rate"],
                            last_used=sim_data.get("last_used"),
                            can_remove=sim_data["can_remove"],
                        )
                    )

        # Parse department_ids from query (None = cross-department)
        department_ids = cohort.get("department_ids")
        if department_ids:
            department_ids = [str(d) for d in department_ids]

        return CohortDetailResponse(
            title=cohort["title"],
            description=cohort["description"],
            department_ids=department_ids,  # None or list of department IDs
            valid_department_ids=cohort["valid_department_ids"],
            active=cohort["active"],
            simulation_ids=cohort["simulation_ids"],
            valid_simulation_ids=cohort["valid_simulation_ids"],
            profile_ids=cohort["profile_ids"],
            valid_profile_ids=cohort["valid_profile_ids"],
            simulations=simulations_list,
            simulation_mapping=simulation_mapping,
            profile_mapping=profile_mapping,
            department_mapping=department_mapping,
        )

    @with_cache(
        lambda self, request: keys.cohort_with_profiles(
            request.cohortId, request.departmentIds, request.currentProfileId
        )
    )
    async def get_cohort_detail_with_profiles(
        self, request: CohortDetailWithProfilesRequest
    ) -> CohortDetailWithProfilesResponse:
        """Get cohort detail with available profiles in one call."""
        return await self._execute_get_cohort_detail_with_profiles(request)

    async def _execute_get_cohort_detail_with_profiles(
        self, request: CohortDetailWithProfilesRequest
    ) -> CohortDetailWithProfilesResponse:
        """Execute the actual cohort detail with profiles query."""
        # Get campus email domain
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.edu")

        # Get all data in one query
        query, params = self.queries.get_cohort_with_profiles_complete(
            request.cohortId,
            request.departmentIds,
            request.currentProfileId,
            campus_domain,
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Parse available profiles from JSONB
        available_profiles = []
        if result["available_profiles"] and isinstance(
            result["available_profiles"], list
        ):
            for profile_data in result["available_profiles"]:
                if isinstance(profile_data, dict):
                    available_profiles.append(
                        StaffItem(
                            profile_id=profile_data["profile_id"],
                            first_name=profile_data["first_name"],
                            last_name=profile_data["last_name"],
                            alias=profile_data["alias"],
                            name=profile_data["name"],
                            role=profile_data["role"],
                            email=profile_data["email"],
                            initials=profile_data["initials"],
                            active=profile_data["active"],
                            last_active=profile_data["lastActive"],
                            cohort_ids=profile_data["cohort_ids"] or [],
                            requests_per_day=profile_data["requests_per_day"],
                            default_profile=profile_data["default_profile"],
                            requests_in_last_day=profile_data["requests_in_last_day"],
                            can_edit=profile_data["can_edit"],
                            can_delete=profile_data["can_delete"],
                        )
                    )

        # Parse department mapping from JSONB
        department_mapping: DepartmentMapping = {}
        if result["department_mapping"] and isinstance(
            result["department_mapping"], dict
        ):
            for did, ddata in result["department_mapping"].items():
                department_mapping[did] = DepartmentMappingItem(
                    name=ddata["name"], description=ddata["description"]
                )

        # Build cohort mapping (just this cohort)
        cohort_mapping: CohortMapping = {
            result["cohort_id"]: CohortMappingItem(
                name=result["title"], description=result["description"] or ""
            )
        }

        return CohortDetailWithProfilesResponse(
            cohort_id=result["cohort_id"],
            title=result["title"],
            description=result["description"],
            active=result["active"],
            current_profile_ids=result["current_profile_ids"],
            available_profiles=available_profiles,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
        )

    async def create_cohort(self, request: CreateCohortRequest) -> CreateCohortResponse:
        """Create a new cohort with relationships."""

        async with transaction(self.conn):
            # Create cohort
            # Note: create_cohort() query doesn't accept department_ids - handled separately
            query, _ = self.queries.create_cohort()
            result = await self.conn.fetchrow(
                query,
                request.title,
                request.description,
                request.active,
            )

            if not result:
                raise ValueError("Failed to create cohort")

            cohort_id = str(result["id"])

            # Insert department links if department_ids provided
            if request.department_ids:
                insert_dept_query, insert_dept_params = (
                    self.queries.create_cohort_departments(
                        cohort_id, request.department_ids
                    )
                )
                await self.conn.execute(insert_dept_query, *insert_dept_params)

            # Insert profile relationships
            query, _ = self.queries.insert_cohort_profile()
            for profile_id in request.profile_ids:
                await self.conn.execute(query, cohort_id, profile_id)

            # Insert simulation relationships (handle both string and object formats)
            for sim_item in request.simulation_ids:
                if isinstance(sim_item, str):
                    # Legacy format: just simulation ID (default active=True)
                    await self.conn.execute(
                        "INSERT INTO cohort_simulations (cohort_id, simulation_id, active) VALUES ($1, $2, $3)",
                        cohort_id,
                        sim_item,
                        True,
                    )
                else:
                    # New format: object with simulation_id and active
                    await self.conn.execute(
                        "INSERT INTO cohort_simulations (cohort_id, simulation_id, active) VALUES ($1, $2, $3)",
                        cohort_id,
                        sim_item.simulation_id,
                        sim_item.active,
                    )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_cohort_all(),
                keys.tag_profile_all(),  # Affects profile cohort lists
                keys.tag_analytics_all(),  # May affect analytics
            ]
        )

        return CreateCohortResponse(
            success=True,
            cohortId=cohort_id,
            message=f"Cohort '{request.title}' created successfully",
        )

    async def update_cohort(self, request: UpdateCohortRequest) -> UpdateCohortResponse:
        """Update an existing cohort."""

        # Check if cohort exists
        query, params = self.queries.get_cohort_title(request.cohortId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        async with transaction(self.conn):
            # Update cohort basic fields
            query, _ = self.queries.update_cohort()
            await self.conn.execute(
                query,
                request.cohortId,
                request.title,
                request.description,
                request.active,
            )

            # Update cohort-department links (DELETE + INSERT pattern)
            delete_dept_query, delete_dept_params = (
                self.queries.delete_cohort_departments(request.cohortId)
            )
            await self.conn.execute(delete_dept_query, *delete_dept_params)

            # Insert new department links if department_ids provided
            if request.department_ids:
                insert_dept_query, insert_dept_params = (
                    self.queries.create_cohort_departments(
                        request.cohortId, request.department_ids
                    )
                )
                await self.conn.execute(insert_dept_query, *insert_dept_params)

            # Delete existing relationships
            query, params = self.queries.delete_cohort_profiles(request.cohortId)
            await self.conn.execute(query, *params)

            query, params = self.queries.delete_cohort_simulations(request.cohortId)
            await self.conn.execute(query, *params)

            # Insert new relationships
            query, _ = self.queries.insert_cohort_profile()
            for profile_id in request.profile_ids:
                await self.conn.execute(query, request.cohortId, profile_id)

            # Insert simulation relationships (handle both string and object formats)
            for sim_item in request.simulation_ids:
                if isinstance(sim_item, str):
                    # Legacy format: just simulation ID (default active=True)
                    await self.conn.execute(
                        "INSERT INTO cohort_simulations (cohort_id, simulation_id, active) VALUES ($1, $2, $3)",
                        request.cohortId,
                        sim_item,
                        True,
                    )
                else:
                    # New format: object with simulation_id and active
                    await self.conn.execute(
                        "INSERT INTO cohort_simulations (cohort_id, simulation_id, active) VALUES ($1, $2, $3)",
                        request.cohortId,
                        sim_item.simulation_id,
                        sim_item.active,
                    )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_cohort_by_id(request.cohortId),
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return UpdateCohortResponse(
            success=True, message=f"Cohort '{request.title}' updated successfully"
        )

    async def duplicate_cohort(
        self, request: DuplicateCohortRequest
    ) -> DuplicateCohortResponse:
        """Duplicate a cohort with relationships."""

        # Get original cohort data
        query, params = self.queries.get_cohort_for_duplicate(request.cohortId)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        async with transaction(self.conn):
            # Insert duplicate - query handles department links
            query, _ = self.queries.insert_duplicate_cohort()
            new_cohort = await self.conn.fetchrow(
                query,
                request.cohortId,  # Original cohort ID to copy from
                result["title"],
                result["description"],
            )

            if not new_cohort:
                raise ValueError("Failed to create duplicate cohort")

            # Copy relationships
            copy_profiles_query, _ = self.queries.copy_cohort_profiles()
            await self.conn.execute(
                copy_profiles_query, new_cohort["id"], request.cohortId
            )

            copy_simulations_query, _ = self.queries.copy_cohort_simulations()
            await self.conn.execute(
                copy_simulations_query, new_cohort["id"], request.cohortId
            )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return DuplicateCohortResponse(
            success=True,
            cohortId=str(new_cohort["id"]),
            message=f"Cohort '{result['title']}' duplicated successfully",
        )

    async def delete_cohort(self, request: DeleteCohortRequest) -> DeleteCohortResponse:
        """Delete a cohort if not in use."""

        # Check if cohort is in use
        query, params = self.queries.check_cohort_usage(request.cohortId)
        usage = await self.conn.fetchrow(query, *params)

        if not usage:
            raise ValueError("Failed to check cohort usage")

        if usage["usage_count"] > 0:
            raise ValueError("Cannot delete cohort that has profiles with attempts")

        # Get cohort title
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Delete cohort
        query, params = self.queries.delete_cohort(request.cohortId)
        await self.conn.execute(query, *params)
        # Transaction handled

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_cohort_by_id(request.cohortId),
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return DeleteCohortResponse(
            success=True, message=f"Cohort '{cohort['title']}' deleted successfully"
        )

    async def leave_cohort(self, request: LeaveCohortRequest) -> LeaveCohortResponse:
        """Remove profile from cohort."""

        # Get cohort title
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Remove profile from cohort
        query, params = self.queries.leave_cohort(request.cohortId, request.profileId)
        await self.conn.execute(query, *params)
        # Transaction handled

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_cohort_by_id(request.cohortId),
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return LeaveCohortResponse(
            success=True, message=f"Left cohort '{cohort['title']}' successfully"
        )

    async def add_profiles_to_cohort(
        self, request: AddProfilesToCohortRequest
    ) -> AddProfilesToCohortResponse:
        """Add profiles to cohort (handles both existing and new profiles)."""

        # Check if cohort exists
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        profile_ids_to_add = []

        # Handle existing profile IDs
        if request.existingProfileIds:
            profile_ids_to_add.extend(request.existingProfileIds)

        # Handle new profiles (create them first)
        if request.newProfiles:
            for profile_req in request.newProfiles:
                # Check if alias already exists
                query, params = self.staff_queries.check_alias_exists(profile_req.alias)
                existing = await self.conn.fetchrow(query, *params)

                if existing:
                    raise ValueError(f"Alias '{profile_req.alias}' already exists")

                # Generate new profile ID
                profile_id = str(uuid.uuid4())
                profile_ids_to_add.append(profile_id)

                # Insert profile
                query, _ = self.staff_queries.create_profile()
                await self.conn.execute(
                    query,
                    profile_id,
                    profile_req.firstName,
                    profile_req.lastName,
                    profile_req.alias,
                    profile_req.role,
                    True,
                    False,
                    False,
                    False,
                    None,
                )

                # Insert profile-department relationships for all departments
                query, _ = self.staff_queries.insert_profile_department()
                for dept_id in request.departmentIds:
                    await self.conn.execute(query, profile_id, dept_id)

        # Add all profiles to cohort
        query, _ = self.queries.insert_cohort_profile()
        for profile_id in profile_ids_to_add:
            await self.conn.execute(query, request.cohortId, profile_id)

        # Transaction handled

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_cohort_by_id(request.cohortId),
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        total_count = len(profile_ids_to_add)
        new_count = len(request.newProfiles) if request.newProfiles else 0
        existing_count = (
            len(request.existingProfileIds) if request.existingProfileIds else 0
        )

        message = f"Added {total_count} profile(s) to cohort '{cohort['title']}'"
        if new_count > 0:
            message += f" ({new_count} newly created)"

        return AddProfilesToCohortResponse(success=True, message=message)

    async def remove_profiles_from_cohort(
        self, request: RemoveProfilesFromCohortRequest
    ) -> RemoveProfilesFromCohortResponse:
        """Remove profiles from cohort."""

        # Check if cohort exists
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Remove profiles from cohort by setting active = false
        query, params = self.queries.remove_cohort_profiles()
        await self.conn.execute(query, request.cohortId, request.profileIds)

        # Transaction handled

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_cohort_by_id(request.cohortId),
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return RemoveProfilesFromCohortResponse(
            success=True,
            message=f"Removed {len(request.profileIds)} profile(s) from cohort '{cohort['title']}' successfully",
        )

    @with_cache(lambda self, query, limit: keys.cohort_search(query, limit))
    async def search_cohorts(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """
        Fuzzy search cohorts by title and description.
        Returns scored and sorted results with profile counts.

        Args:
            query: Search query string
            limit: Maximum number of results to return

        Returns:
            List of cohort dictionaries with scores
        """
        return await self._execute_search_cohorts(query, limit)

    async def _execute_search_cohorts(
        self, query: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        """Execute the actual cohort search query."""
        q_norm = normalize_text(query)
        if not q_norm:
            return []

        toks = tokenize(query)

        # Build fuzzy search conditions
        where_clause, params, param_idx = build_fuzzy_conditions(
            ["c.title", "c.description"], query
        )

        # Build and execute query (now includes profile counts)
        query_template, _ = self.queries.search_cohorts_fuzzy(where_clause, limit * 5)
        sql = query_template.replace("{param_count}", str(param_idx))
        params.append(limit * 5)  # Candidate pool

        cohorts = await self.conn.fetch(sql, *params)

        if not cohorts:
            return []

        # Score and build results (profile_count now included in query)
        results = []
        for c in cohorts:
            score = self._score_cohort(q_norm, toks, c["title"], c["description"])
            results.append(
                {
                    "id": str(c["id"]),
                    "title": c["title"],
                    "active": c["active"],
                    "description": c["description"],
                    "profile_count": c["profile_count"],
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["title"] or ""))
        return results[:limit]

    def _score_cohort(
        self, q_norm: str, toks: list[str], title: str | None, desc: str | None
    ) -> int:
        """
        Rank cohort relevance. Title is much stronger than description.

        Args:
            q_norm: Normalized query string
            toks: Query tokens
            title: Cohort title
            desc: Cohort description

        Returns:
            Relevance score (higher is better)
        """
        t_norm = normalize_text(title or "")
        d_norm = normalize_text(desc or "")

        score = 0

        # Exact whole-title match
        if t_norm == q_norm:
            score += 100

        # Exact description match (rare, low weight)
        if d_norm and d_norm == q_norm:
            score += 40

        # Prefix on full query
        if t_norm.startswith(q_norm):
            score += 60
        if d_norm.startswith(q_norm):
            score += 20

        # Token boosts
        for tok in toks:
            if t_norm.startswith(tok):
                score += 25
            if tok in t_norm:
                score += 10

            if d_norm.startswith(tok):
                score += 8
            if tok in d_norm:
                score += 4

        # Whole query appears somewhere
        if q_norm in t_norm or q_norm in d_norm:
            score += 5

        # Length proximity bonus (favor tight title matches)
        gap = abs(len(t_norm) - len(q_norm))
        score += max(0, 10 - gap)

        return score

    # ===== Overview Methods for MCP Tools =====

    @with_cache(lambda self, cohort_id: keys.cohort_overview(cohort_id))
    async def get_cohort_overview(self, cohort_id: str) -> dict[str, Any]:
        """Get cohort overview with all related data in ONE optimized query.

        Returns cohort details, roster (profiles), and active simulations.

        Args:
            cohort_id: UUID string of the cohort

        Returns:
            Dict with cohort overview data or {"error": "..."}
        """
        return await self._execute_get_cohort_overview(cohort_id)

    async def _execute_get_cohort_overview(self, cohort_id: str) -> dict[str, Any]:
        """Execute the actual cohort overview query."""
        import uuid

        try:
            cohort_uuid = uuid.UUID(cohort_id)
        except ValueError:
            return {"error": f"Invalid cohort_id format: {cohort_id}"}

        try:
            query, params = self.queries.get_cohort_overview_complete(cohort_uuid)
            result = await self.conn.fetchrow(query, *params)

            if not result:
                return {"error": f"Cohort not found: {cohort_id}"}

            cohort_data = {
                "id": str(result["id"]),
                "title": result["title"],
                "description": result["description"],
                "active": result["active"],
                "created_at": result["created_at"].isoformat()
                if result["created_at"]
                else None,
            }

            # Transform roster (jsonb array to list of dicts)
            roster = []
            for profile in result["roster"]:
                roster.append(
                    {
                        "id": str(profile["id"]),
                        "first_name": profile["first_name"],
                        "last_name": profile["last_name"],
                        "alias": profile["alias"],
                        "role": profile["role"],
                    }
                )

            # Transform simulations (jsonb array to list of dicts)
            simulations_data = []
            for sim in result["simulations"]:
                simulations_data.append(
                    {
                        "id": str(sim["id"]),
                        "title": sim["title"],
                        "active": sim["active"],
                        "time_limit": sim["time_limit"],
                    }
                )

            return {
                "cohort": cohort_data,
                "roster": roster,
                "simulations": simulations_data,
                "stats": {
                    "total_students": len(roster),
                    "active_simulations": len(simulations_data),
                },
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}

    @with_cache(lambda self, cohort_id: keys.cohort_pass_matrix(cohort_id))
    async def get_cohort_pass_matrix(self, cohort_id: str) -> dict[str, Any]:
        """Get cohort pass/fail matrix across simulations.

        Show pass/fail rates for all students in a cohort.

        Args:
            cohort_id: UUID string of the cohort

        Returns:
            Dict with structure: {"cohort": {...}, "matrix": [...], "summary": {...}, "simulations": [...]}
            or {"error": "..."}
        """
        return await self._execute_get_cohort_pass_matrix(cohort_id)

    async def _execute_get_cohort_pass_matrix(self, cohort_id: str) -> dict[str, Any]:
        """Execute the actual cohort pass matrix query."""
        try:
            cohort_uuid = uuid.UUID(cohort_id)
        except ValueError:
            return {"error": f"Invalid cohort_id format: {cohort_id}"}

        try:
            # Get cohort with members, simulations, and all results in one query
            query, params = self.queries.get_cohort_with_members(str(cohort_uuid))
            cohort_data = await self.conn.fetchrow(query, *params)

            if not cohort_data:
                return {"error": f"Cohort not found: {cohort_id}"}

            # Parse JSON fields
            members = cohort_data["members"] if cohort_data["members"] else []
            simulations = (
                cohort_data["simulations"] if cohort_data["simulations"] else []
            )
            student_results = (
                cohort_data["student_results"] if cohort_data["student_results"] else {}
            )

            # Build pass/fail matrix from pre-fetched results
            matrix = []
            for student in members:
                student_id = str(student["id"])
                student_name = f"{student['first_name'] or ''} {student['last_name'] or ''}".strip()
                if not student_name:
                    student_name = student["alias"] or "Unknown"

                student_row: dict[str, Any] = {
                    "student_id": student_id,
                    "student_name": student_name,
                    "alias": student["alias"],
                    "simulations": {},
                }

                # Get pre-fetched results for this student
                student_sim_results = student_results.get(student_id, {})

                # Build results for each simulation
                for sim in simulations:
                    sim_id = str(sim["id"])
                    result_data = student_sim_results.get(sim_id)

                    if result_data:
                        student_row["simulations"][sim_id] = {
                            "score": result_data["score"],
                            "passed": result_data["passed"],
                            "time_taken": result_data["time_taken"],
                            "attempt_count": result_data["attempt_count"],
                            "last_attempt": result_data["last_attempt"],
                        }
                    else:
                        student_row["simulations"][sim_id] = None

                matrix.append(student_row)

            # Calculate summary statistics
            summary: dict[str, Any] = {
                "total_students": len(members),
                "total_simulations": len(simulations),
                "simulation_stats": {},
            }

            for sim in simulations:
                sim_id = str(sim["id"])
                passed_count = 0
                attempted_count = 0
                total_score = 0

                for student_result in matrix:
                    result = student_result["simulations"].get(sim_id)
                    if result:
                        attempted_count += 1
                        if result["passed"]:
                            passed_count += 1
                        total_score += result["score"]

                summary["simulation_stats"][sim_id] = {
                    "simulation_title": sim["title"],
                    "attempted_count": attempted_count,
                    "passed_count": passed_count,
                    "pass_rate": round(passed_count / attempted_count * 100, 1)
                    if attempted_count > 0
                    else 0,
                    "average_score": round(total_score / attempted_count, 1)
                    if attempted_count > 0
                    else 0,
                }

            return {
                "cohort": {
                    "id": str(cohort_data["id"]),
                    "title": cohort_data["title"],
                    "description": cohort_data["description"],
                    "active": cohort_data["active"],
                    "created_at": cohort_data["created_at"].isoformat()
                    if cohort_data["created_at"]
                    else None,
                },
                "matrix": matrix,
                "summary": summary,
                "simulations": [
                    {
                        "id": str(sim["id"]),
                        "title": sim["title"],
                        "active": sim["active"],
                        "time_limit": sim["time_limit"],
                    }
                    for sim in simulations
                ],
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}


def get_cohort_service(conn: asyncpg.Connection) -> CohortService:
    """Get cohort service instance."""
    return CohortService(conn)

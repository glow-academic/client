"""Department service with business logic and dynamic SQL."""

import json
from typing import Any

import asyncpg  # type: ignore

from app.cache import keys
from app.db import transaction
from app.queries.department_queries import DepartmentQueries
from app.schemas.base import AgentMapping, AgentMappingItem
from app.schemas.departments import (
    AgentRoles,
    CreateDepartmentRequest,
    CreateDepartmentResponse,
    DeleteDepartmentRequest,
    DeleteDepartmentResponse,
    DepartmentDetailRequest,
    DepartmentDetailResponse,
    DepartmentItem,
    DepartmentsFilters,
    DepartmentsListResponse,
    DuplicateDepartmentRequest,
    DuplicateDepartmentResponse,
    UpdateDepartmentRequest,
    UpdateDepartmentResponse,
)
from app.services.base import BaseService, with_cache


class DepartmentService(BaseService):
    """Service for department operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = DepartmentQueries()

    @with_cache(lambda self, filters: keys.department_list(filters))
    async def get_departments_list(
        self, filters: DepartmentsFilters
    ) -> DepartmentsListResponse:
        """
        Get list of departments with computed fields.

        Args:
            filters: Department filters

        Returns:
            DepartmentsListResponse
        """
        query, params = self.queries.get_departments_list(
            filters.departmentIds, filters.profileId
        )
        rows = await self.conn.fetch(query, *params)
        return self._build_departments_list(rows)

    def _build_departments_list(self, rows: list[Any]) -> DepartmentsListResponse:
        """Build departments list response from query rows."""
        departments: list[DepartmentItem] = []
        for row in rows:
            departments.append(
                DepartmentItem(
                    department_id=row["department_id"],
                    title=row["title"],
                    description=row["description"],
                    active=row["active"],
                    default_department=row["default_department"],
                    updated_at=row["updated_at"].isoformat(),
                    total_price_spent=float(row["total_price_spent"]),
                    staff_count=int(row["staff_count"]),
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )
        return DepartmentsListResponse(departments=departments)

    @with_cache(lambda self, request: keys.department_by_id(request.departmentId))
    async def get_department_detail(
        self, request: DepartmentDetailRequest
    ) -> DepartmentDetailResponse:
        """
        Get department detail with agent role assignments, permissions, and stats.

        Args:
            request: Detail request

        Returns:
            DepartmentDetailResponse
        """
        # Get complete department data with JSONB mappings (consolidated query)
        query, params = self.queries.get_department_detail_complete(
            request.departmentId, request.profileId
        )
        dept_row = await self.conn.fetchrow(query, *params)

        if not dept_row:
            raise ValueError(f"Department {request.departmentId} not found")

        # Parse JSONB agent_roles
        agent_roles_dict: dict[str, str] = {
            "title": "",
            "scenario": "",
            "classify": "",
            "assistant": "",
            "grade": "",
            "input_guardrail": "",
            "output_guardrail": "",
            "hint": "",
        }

        agent_roles_data = dept_row.get("agent_roles_json")
        if agent_roles_data and isinstance(agent_roles_data, dict):
            for role, agent_id in agent_roles_data.items():
                if role in agent_roles_dict:
                    agent_roles_dict[role] = agent_id

        # Parse JSONB agent_mapping
        valid_agent_ids: list[str] = []
        agent_mapping: AgentMapping = {}

        agent_mapping_data = dept_row.get("agent_mapping")
        if isinstance(agent_mapping_data, str):
            agent_mapping_data = json.loads(agent_mapping_data)
        if agent_mapping_data and isinstance(agent_mapping_data, dict):
            for agent_id, agent_info in agent_mapping_data.items():
                if isinstance(agent_info, dict):
                    valid_agent_ids.append(agent_id)
                    agent_mapping[agent_id] = AgentMappingItem(
                        name=agent_info.get("name", ""),
                        description=agent_info.get("description", ""),
                    )

        return DepartmentDetailResponse(
            title=dept_row["title"],
            description=dept_row["description"],
            active=dept_row["active"],
            agent_roles=AgentRoles(**agent_roles_dict),
            valid_agent_ids=valid_agent_ids,
            agent_mapping=agent_mapping,
            # Permissions
            can_edit=dept_row["can_edit"],
            can_duplicate=dept_row["can_duplicate"],
            can_delete=dept_row["can_delete"],
            # Usage/Stats
            in_use=dept_row["in_use"],
            staff_count=int(dept_row["staff_count"]),
            total_price_spent=float(dept_row["total_price_spent"]),
        )

    @with_cache(lambda self, profile_id: keys.department_default(profile_id))
    async def get_department_detail_default(
        self, profile_id: str
    ) -> DepartmentDetailResponse:
        """
        Get default department detail for creation mode.

        Args:
            profile_id: Profile ID

        Returns:
            DepartmentDetailResponse with defaults
        """
        # Get user role for permissions
        query, params = self.queries.get_profile_role(profile_id)
        profile_row = await self.conn.fetchrow(query, *params)

        if not profile_row:
            raise ValueError(f"Profile {profile_id} not found")

        is_superadmin = profile_row["role"] == "superadmin"

        # Get valid agents for selection
        query, params = self.queries.get_valid_agents()
        agent_rows = await self.conn.fetch(query, *params)

        valid_agent_ids: list[str] = []
        agent_mapping: AgentMapping = {}

        for row in agent_rows:
            valid_agent_ids.append(row["agent_id"])
            agent_mapping[row["agent_id"]] = AgentMappingItem(
                name=row["name"], description=row["description"]
            )

        # Return defaults for creation
        return DepartmentDetailResponse(
            title="",
            description="",
            active=True,
            agent_roles=AgentRoles(
                title="",
                scenario="",
                classify="",
                assistant="",
                grade="",
                input_guardrail="",
                output_guardrail="",
                hint="",
            ),
            valid_agent_ids=valid_agent_ids,
            agent_mapping=agent_mapping,
            # Permissions (only superadmin can create)
            can_edit=is_superadmin,
            can_duplicate=False,  # Can't duplicate when creating
            can_delete=False,  # Can't delete when creating
            # Usage/Stats (all zero for new department)
            in_use=False,
            staff_count=0,
            total_price_spent=0.0,
        )

    async def create_department(
        self, request: CreateDepartmentRequest
    ) -> CreateDepartmentResponse:
        """
        Create a new department with agent role assignments.

        Args:
            request: Create request

        Returns:
            CreateDepartmentResponse
        """
        # Validate all 8 agent roles are provided
        required_roles = [
            "title",
            "scenario",
            "classify",
            "assistant",
            "grade",
            "input_guardrail",
            "output_guardrail",
            "hint",
        ]
        agent_roles_dict = request.agent_roles.model_dump()

        for role in required_roles:
            if not agent_roles_dict.get(role):
                raise ValueError(f"Agent role {role} is required")

        async with transaction(self.conn):
            # Create department
            query, params = self.queries.create_department(
                request.title, request.description, request.active
            )
            dept_row = await self.conn.fetchrow(query, *params)

            if not dept_row:
                raise ValueError("Failed to create department")

            department_id = dept_row["department_id"]

            # Create all 8 agent role assignments
            for role in required_roles:
                agent_id = agent_roles_dict[role]
                query, params = self.queries.create_department_agent(
                    department_id, role, agent_id
                )
                await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_department_all(),
                keys.tag_profile_all(),
            ]
        )

        return CreateDepartmentResponse(
            success=True,
            departmentId=department_id,
            message="Department created successfully",
        )

    async def update_department(
        self, request: UpdateDepartmentRequest
    ) -> UpdateDepartmentResponse:
        """
        Update a department with agent role assignments.

        Args:
            request: Update request

        Returns:
            UpdateDepartmentResponse
        """
        # Validate all 8 agent roles are provided
        required_roles = [
            "title",
            "scenario",
            "classify",
            "assistant",
            "grade",
            "input_guardrail",
            "output_guardrail",
            "hint",
        ]
        agent_roles_dict = request.agent_roles.model_dump()

        for role in required_roles:
            if not agent_roles_dict.get(role):
                raise ValueError(f"Agent role {role} is required")

        async with transaction(self.conn):
            # Update department
            query, params = self.queries.update_department(
                request.departmentId, request.title, request.description, request.active
            )
            await self.conn.execute(query, *params)

            # Delete old agent role assignments
            query, params = self.queries.delete_department_agents(request.departmentId)
            await self.conn.execute(query, *params)

            # Create new agent role assignments (upsert pattern)
            for role in required_roles:
                agent_id = agent_roles_dict[role]
                query, params = self.queries.create_department_agent(
                    request.departmentId, role, agent_id
                )
                await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_department_by_id(request.departmentId),
                keys.tag_department_all(),
                keys.tag_profile_all(),
            ]
        )

        return UpdateDepartmentResponse(
            success=True, message="Department updated successfully"
        )

    async def duplicate_department(
        self, request: DuplicateDepartmentRequest
    ) -> DuplicateDepartmentResponse:
        """
        Duplicate a department with all agent role assignments.

        Args:
            request: Duplicate request

        Returns:
            DuplicateDepartmentResponse
        """
        # Get original department title
        query, params = self.queries.get_department_basic(request.departmentId)
        dept_row = await self.conn.fetchrow(query, *params)

        if not dept_row:
            raise ValueError(f"Department {request.departmentId} not found")

        new_title = f"{dept_row['title']} Copy"

        async with transaction(self.conn):
            # Duplicate department
            query, params = self.queries.duplicate_department(
                request.departmentId, new_title
            )
            new_dept_row = await self.conn.fetchrow(query, *params)

            if not new_dept_row:
                raise ValueError("Failed to duplicate department")

            new_department_id = new_dept_row["department_id"]

            # Duplicate agent role assignments
            query, params = self.queries.duplicate_department_agents(
                request.departmentId, new_department_id
            )
            await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_department_all(),
                keys.tag_profile_all(),
            ]
        )

        return DuplicateDepartmentResponse(
            success=True,
            departmentId=new_department_id,
            message="Department duplicated successfully",
        )

    async def delete_department(
        self, request: DeleteDepartmentRequest
    ) -> DeleteDepartmentResponse:
        """
        Delete a department (with usage check).

        Args:
            request: Delete request

        Returns:
            DeleteDepartmentResponse
        """
        # Check if department is in use
        query, params = self.queries.check_department_usage(request.departmentId)
        usage_row = await self.conn.fetchrow(query, *params)

        if not usage_row:
            raise ValueError(f"Department {request.departmentId} not found")

        total_usage = (
            usage_row["profile_count"]
            + usage_row["simulation_count"]
            + usage_row["scenario_count"]
            + usage_row["persona_count"]
            + usage_row["document_count"]
            + usage_row["cohort_count"]
        )

        if total_usage > 0:
            raise ValueError(
                f"Cannot delete department: in use by {total_usage} entities"
            )

        # Delete department (cascade deletes department_agents)
        query, params = self.queries.delete_department(request.departmentId)
        await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_department_by_id(request.departmentId),
                keys.tag_department_all(),
                keys.tag_profile_all(),
            ]
        )

        return DeleteDepartmentResponse(
            success=True, message="Department deleted successfully"
        )


def get_department_service(conn: asyncpg.Connection) -> DepartmentService:
    """Get department service instance."""
    return DepartmentService(conn)

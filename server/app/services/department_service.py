"""Department service with business logic and dynamic SQL."""

from typing import Any, Dict, List

from app.queries.department_queries import DepartmentQueries
from app.schemas.departments import (AgentRoles, CreateDepartmentRequest,
                                     CreateDepartmentResponse,
                                     DeleteDepartmentRequest,
                                     DeleteDepartmentResponse,
                                     DepartmentDetailRequest,
                                     DepartmentDetailResponse, DepartmentItem,
                                     DepartmentsFilters,
                                     DepartmentsListResponse,
                                     DuplicateDepartmentRequest,
                                     DuplicateDepartmentResponse,
                                     UpdateDepartmentRequest,
                                     UpdateDepartmentResponse)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class DepartmentService:
    """Service for department operations."""

    def __init__(self) -> None:
        """Initialize service with query builders."""
        self.queries = DepartmentQueries()

    async def get_departments_list(
        self, filters: DepartmentsFilters, session: AsyncSession
    ) -> DepartmentsListResponse:
        """
        Get list of departments with computed fields.

        Args:
            filters: Department filters
            session: Database session

        Returns:
            DepartmentsListResponse
        """
        query, params = self.queries.get_departments_list(
            filters.departmentIds, filters.profileId
        )

        result = await session.execute(text(query), params)
        rows = result.fetchall()

        departments: List[DepartmentItem] = []
        for row in rows:
            departments.append(
                DepartmentItem(
                    department_id=row.department_id,
                    title=row.title,
                    description=row.description,
                    active=row.active,
                    updated_at=row.updated_at.isoformat(),
                    total_price_spent=float(row.total_price_spent),
                    staff_count=int(row.staff_count),
                    can_edit=row.can_edit,
                    can_delete=row.can_delete,
                )
            )

        return DepartmentsListResponse(departments=departments)

    async def get_department_detail(
        self, request: DepartmentDetailRequest, session: AsyncSession
    ) -> DepartmentDetailResponse:
        """
        Get department detail with agent role assignments.

        Args:
            request: Detail request
            session: Database session

        Returns:
            DepartmentDetailResponse
        """
        # Get basic department info
        query, params = self.queries.get_department_basic(request.departmentId)
        result = await session.execute(text(query), params)
        dept_row = result.fetchone()

        if not dept_row:
            raise ValueError(f"Department {request.departmentId} not found")

        # Get agent role assignments (8 roles)
        query, params = self.queries.get_department_agent_roles(request.departmentId)
        result = await session.execute(text(query), params)
        agent_rows = result.fetchall()

        # Build agent_roles object
        agent_roles_dict: Dict[str, str] = {
            "title": "",
            "scenario": "",
            "classify": "",
            "assistant": "",
            "grade": "",
            "input_guardrail": "",
            "output_guardrail": "",
            "hint": "",
        }

        for row in agent_rows:
            agent_roles_dict[row.role] = row.agent_id

        # Get valid agents for selection
        query, params = self.queries.get_valid_agents()
        result = await session.execute(text(query), params)
        agent_rows = result.fetchall()

        valid_agent_ids: List[str] = []
        agent_mapping: Dict[str, str] = {}

        for row in agent_rows:
            valid_agent_ids.append(row.agent_id)
            agent_mapping[row.agent_id] = row.name

        return DepartmentDetailResponse(
            title=dept_row.title,
            description=dept_row.description,
            active=dept_row.active,
            agent_roles=AgentRoles(**agent_roles_dict),
            valid_agent_ids=valid_agent_ids,
            agent_mapping=agent_mapping,
        )

    async def get_department_detail_default(
        self, profile_id: str, session: AsyncSession
    ) -> DepartmentDetailResponse:
        """
        Get default department detail for a profile.

        Args:
            profile_id: Profile ID
            session: Database session

        Returns:
            DepartmentDetailResponse
        """
        # Get first department for profile
        query, params = self.queries.get_first_department_for_profile(profile_id)
        result = await session.execute(text(query), params)
        dept_row = result.fetchone()

        if not dept_row:
            raise ValueError(f"No departments found for profile {profile_id}")

        # Use detail endpoint with found department_id
        detail_request = DepartmentDetailRequest(
            departmentId=dept_row.department_id, profileId=profile_id
        )
        return await self.get_department_detail(detail_request, session)

    async def create_department(
        self, request: CreateDepartmentRequest, session: AsyncSession
    ) -> CreateDepartmentResponse:
        """
        Create a new department with agent role assignments.

        Args:
            request: Create request
            session: Database session

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

        # Create department
        query, params = self.queries.create_department(
            request.title, request.description, request.active
        )
        result = await session.execute(text(query), params)
        dept_row = result.fetchone()

        if not dept_row:
            raise ValueError("Failed to create department")

        department_id = dept_row.department_id

        # Create all 8 agent role assignments
        for role in required_roles:
            agent_id = agent_roles_dict[role]
            query, params = self.queries.create_department_agent(
                department_id, role, agent_id
            )
            await session.execute(text(query), params)

        await session.commit()

        return CreateDepartmentResponse(
            success=True,
            departmentId=department_id,
            message="Department created successfully",
        )

    async def update_department(
        self, request: UpdateDepartmentRequest, session: AsyncSession
    ) -> UpdateDepartmentResponse:
        """
        Update a department with agent role assignments.

        Args:
            request: Update request
            session: Database session

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

        # Update department
        query, params = self.queries.update_department(
            request.departmentId, request.title, request.description, request.active
        )
        await session.execute(text(query), params)

        # Delete old agent role assignments
        query, params = self.queries.delete_department_agents(request.departmentId)
        await session.execute(text(query), params)

        # Create new agent role assignments (upsert pattern)
        for role in required_roles:
            agent_id = agent_roles_dict[role]
            query, params = self.queries.create_department_agent(
                request.departmentId, role, agent_id
            )
            await session.execute(text(query), params)

        await session.commit()

        return UpdateDepartmentResponse(
            success=True, message="Department updated successfully"
        )

    async def duplicate_department(
        self, request: DuplicateDepartmentRequest, session: AsyncSession
    ) -> DuplicateDepartmentResponse:
        """
        Duplicate a department with all agent role assignments.

        Args:
            request: Duplicate request
            session: Database session

        Returns:
            DuplicateDepartmentResponse
        """
        # Get original department title
        query, params = self.queries.get_department_basic(request.departmentId)
        result = await session.execute(text(query), params)
        dept_row = result.fetchone()

        if not dept_row:
            raise ValueError(f"Department {request.departmentId} not found")

        new_title = f"{dept_row.title} Copy"

        # Duplicate department
        query, params = self.queries.duplicate_department(
            request.departmentId, new_title
        )
        result = await session.execute(text(query), params)
        new_dept_row = result.fetchone()

        if not new_dept_row:
            raise ValueError("Failed to duplicate department")

        new_department_id = new_dept_row.department_id

        # Duplicate agent role assignments
        query, params = self.queries.duplicate_department_agents(
            request.departmentId, new_department_id
        )
        await session.execute(text(query), params)

        await session.commit()

        return DuplicateDepartmentResponse(
            success=True,
            departmentId=new_department_id,
            message="Department duplicated successfully",
        )

    async def delete_department(
        self, request: DeleteDepartmentRequest, session: AsyncSession
    ) -> DeleteDepartmentResponse:
        """
        Delete a department (with usage check).

        Args:
            request: Delete request
            session: Database session

        Returns:
            DeleteDepartmentResponse
        """
        # Check if department is in use
        query, params = self.queries.check_department_usage(request.departmentId)
        result = await session.execute(text(query), params)
        usage_row = result.fetchone()

        if not usage_row:
            raise ValueError(f"Department {request.departmentId} not found")

        total_usage = (
            usage_row.profile_count
            + usage_row.simulation_count
            + usage_row.scenario_count
            + usage_row.persona_count
            + usage_row.document_count
            + usage_row.cohort_count
        )

        if total_usage > 0:
            raise ValueError(
                f"Cannot delete department: in use by {total_usage} entities"
            )

        # Delete department (cascade deletes department_agents)
        query, params = self.queries.delete_department(request.departmentId)
        await session.execute(text(query), params)

        await session.commit()

        return DeleteDepartmentResponse(
            success=True, message="Department deleted successfully"
        )


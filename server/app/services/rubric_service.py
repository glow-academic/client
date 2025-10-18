"""Rubric service layer - business logic for rubric operations with hierarchical structure."""

from typing import Any, Dict, List

import asyncpg  # type: ignore
from app.cache import keys
from app.db import transaction
from app.extensions import get_query_client
from app.queries.rubric_queries import RubricQueries
from app.schemas.base import DepartmentMappingItem
from app.schemas.rubrics import (CreateRubricRequest, CreateRubricResponse,
                                 DeleteRubricRequest, DeleteRubricResponse,
                                 DuplicateRubricRequest,
                                 DuplicateRubricResponse,
                                 RubricDetailDefaultRequest,
                                 RubricDetailRequest, RubricDetailResponse,
                                 RubricItem, RubricsFilters,
                                 RubricsListResponse, StandardGroupDetail,
                                 StandardGroupMappingDetail,
                                 StandardGroupMappingItem, StandardMappingItem,
                                 UpdateRubricRequest, UpdateRubricResponse)


class RubricService:
    """Service layer for rubric operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        self.conn = conn
        self.queries = RubricQueries()

    async def get_rubrics_list(self, filters: RubricsFilters) -> RubricsListResponse:
        """Get rubrics list with hierarchical structure and permissions."""
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            return await self._fetch_rubrics_list(filters)
        
        key = keys.rubric_list(filters)
        
        async def fetcher() -> RubricsListResponse:
            return await self._fetch_rubrics_list(filters)
        
        result: RubricsListResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def _fetch_rubrics_list(self, filters: RubricsFilters) -> RubricsListResponse:
        """Internal method to fetch rubrics list from database."""
        # Get rubrics
        query, params = self.queries.list_rubrics(
            filters.departmentIds, filters.profileId
        )
        rubrics_result = await self.conn.fetch(query, *params)

        rubrics = []
        rubric_ids = []

        for row in rubrics_result:
            rubrics.append(
                RubricItem(
                    rubric_id=str(row['rubric_id']),
                    name=row['name'],
                    description=row['description'],
                    points=row['points'],
                    passPoints=row['passpoints'],
                    can_edit=row['can_edit'],
                    can_delete=row['can_delete'],
                    can_duplicate=row['can_duplicate'],
                    standard_groups={},  # Will be populated below
                )
            )
            rubric_ids.append(str(row['rubric_id']))

        # Get all standard groups for these rubrics
        standard_groups_mapping = {}
        group_ids = []

        if rubric_ids:
            query, params = self.queries.get_standard_groups_for_rubrics(rubric_ids)
            groups_result = await self.conn.fetch(query, *params)

            for group in groups_result:
                group_id = str(group['id'])
                rubric_id = str(group['rubric_id'])
                group_ids.append(group_id)

                standard_groups_mapping[group_id] = StandardGroupMappingItem(
                    name=group['name'],
                    description=group['description'] or '',
                    points=group['points'],
                    passPoints=group['passpoints']
                )

                # Find the rubric and add group_id
                for rubric in rubrics:
                    if rubric.rubric_id == rubric_id:
                        if rubric_id not in rubric.standard_groups:
                            rubric.standard_groups[group_id] = []

        # Get all standards for these groups
        standards_mapping = {}

        if group_ids:
            query, params = self.queries.get_standards_for_groups(group_ids)
            standards_result = await self.conn.fetch(query, *params)

            for standard in standards_result:
                standard_id = str(standard['id'])
                group_id = str(standard['standard_group_id'])

                standards_mapping[standard_id] = StandardMappingItem(
                    name=standard['name'],
                    description=standard['description'] or '',
                    points=standard['points']
                )

                # Add standard_id to the appropriate group in the appropriate rubric
                for rubric in rubrics:
                    if group_id in rubric.standard_groups:
                        rubric.standard_groups[group_id].append(standard_id)

        return RubricsListResponse(
            rubrics=rubrics,
            standard_groups_mapping=standard_groups_mapping,
            standards_mapping=standards_mapping,
        )

    async def get_rubric_detail(
        self, request: RubricDetailRequest
    ) -> RubricDetailResponse:
        """Get detailed rubric information with hierarchical structure."""
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            return await self._fetch_rubric_detail(request)
        
        key = keys.rubric_by_id(request.rubricId, request.profileId)
        
        async def fetcher() -> RubricDetailResponse:
            return await self._fetch_rubric_detail(request)
        
        result: RubricDetailResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def _fetch_rubric_detail(
        self, request: RubricDetailRequest
    ) -> RubricDetailResponse:
        """Internal method to fetch rubric detail from database."""
        # Get rubric basic info
        query, params = self.queries.get_rubric_by_id(request.rubricId)
        rubric = await self.conn.fetchrow(query, *params)

        if not rubric:
            raise ValueError(f"Rubric not found: {request.rubricId}")

        # Get user's accessible department IDs and role
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        dept_result = await self.conn.fetch(query, *params)
        valid_department_ids = [str(row['id']) for row in dept_result]

        # Get user role for permission checks
        query, params = self.queries.get_profile_role(request.profileId)
        user_result = await self.conn.fetchrow(query, *params)
        user_role = user_result['role'] if user_result else "student"

        # Compute can_edit permission
        # Default rubrics can only be edited by superadmin
        is_admin = user_role in ("admin", "superadmin")
        can_edit = is_admin and (
            not rubric['default_rubric'] or user_role == "superadmin"
        )

        # Get standard groups for this rubric
        query, params = self.queries.get_standard_groups_for_rubric(request.rubricId)
        groups_result = await self.conn.fetch(query, *params)

        standard_group_ids = []
        standard_groups_detail = {}
        standard_groups_mapping = {}

        for group in groups_result:
            group_id = str(group['id'])
            standard_group_ids.append(group_id)

            # Get standards for this group
            query, params = self.queries.get_standards_for_group(group_id)
            standards_result = await self.conn.fetch(query, *params)
            standard_ids = [str(s['id']) for s in standards_result]

            standard_groups_detail[group_id] = StandardGroupDetail(
                points=group['points'],
                passPoints=group['passpoints'],
                standard_ids=standard_ids,
            )

            standard_groups_mapping[group_id] = StandardGroupMappingDetail(
                name=group['name'], description=group['description']
            )

        # Build standards mapping
        standards_mapping = {}
        for group in groups_result:
            group_id = str(group['id'])
            query, params = self.queries.get_standards_for_group(group_id)
            standards_result = await self.conn.fetch(query, *params)

            for standard in standards_result:
                standards_mapping[str(standard['id'])] = StandardMappingItem(
                    name=standard['name'],
                    description=standard['description'] or '',
                    points=standard['points']
                )

        # Get department mapping
        department_mapping = {
            str(row['id']): DepartmentMappingItem(
                name=row['name'], description=row['description'] or ''
            )
            for row in dept_result
        }

        return RubricDetailResponse(
            name=rubric['name'],
            description=rubric['description'],
            department_id=str(rubric['department_id']),
            valid_department_ids=valid_department_ids,
            points=rubric['points'],
            passPoints=rubric['passpoints'],
            active=rubric['active'],
            default_rubric=rubric['default_rubric'],
            can_edit=can_edit,
            standard_group_ids=standard_group_ids,
            standard_groups_detail=standard_groups_detail,
            standard_groups_mapping=standard_groups_mapping,
            standards_mapping=standards_mapping,
            department_mapping=department_mapping,
        )

    async def get_rubric_detail_default(
        self, request: RubricDetailDefaultRequest
    ) -> RubricDetailResponse:
        """Get default rubric details based on profile."""
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            return await self._fetch_rubric_detail_default(request)
        
        key = keys.rubric_detail_default(request.profileId)
        
        async def fetcher() -> RubricDetailResponse:
            return await self._fetch_rubric_detail_default(request)
        
        result: RubricDetailResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def _fetch_rubric_detail_default(
        self, request: RubricDetailDefaultRequest
    ) -> RubricDetailResponse:
        """Internal method to fetch default rubric detail from database."""
        # Get default rubric for profile
        query, params = self.queries.get_default_rubric(request.profileId)
        rubric = await self.conn.fetchrow(query, *params)

        if not rubric:
            raise ValueError("No rubrics found for user's departments")

        # Reuse the detail logic with the found rubric_id
        detail_request = RubricDetailRequest(
            rubricId=str(rubric['id']), profileId=request.profileId
        )

        return await self.get_rubric_detail(detail_request)

    async def create_rubric(self, request: CreateRubricRequest) -> CreateRubricResponse:
        """Create a new rubric with nested standard groups and standards."""

        async with transaction(self.conn):
            # Create rubric
            query, _ = self.queries.create_rubric()
            rubric_result = await self.conn.fetchrow(
                query,
                request.name,
                request.description,
                request.department_id,
                request.active,
                request.default_rubric,
                request.points,
                request.passPoints,
            )

            if not rubric_result:
                raise ValueError("Failed to create rubric")

            rubric_id = str(rubric_result['id'])

            # Create standard groups and their standards
            for group in request.standard_groups:
                # Create standard group
                query, _ = self.queries.create_standard_group()
                group_result = await self.conn.fetchrow(
                    query,
                    rubric_id,
                    group.name,
                    group.short_name,
                    group.description,
                    group.points,
                    group.passPoints,
                )

                if not group_result:
                    raise ValueError("Failed to create standard group")

                group_id = str(group_result['id'])

                # Create standards for this group
                query, _ = self.queries.create_standard()
                for standard in group.standards:
                    await self.conn.execute(
                        query,
                        group_id,
                        standard.name,
                        standard.description,
                    standard.points,
                )

        # Invalidate caches
        await self._invalidate_cache([
                keys.tag_rubric_all(),      # Coarse-grained
                keys.tag_analytics_all(),   # Related caches
            ])

        return CreateRubricResponse(
            success=True,
            rubricId=rubric_id,
            message=f"Rubric '{request.name}' created successfully",
        )

    async def update_rubric(self, request: UpdateRubricRequest) -> UpdateRubricResponse:
        """Update an existing rubric with incremental updates to standard groups and standards."""

        # Check if rubric exists
        query, params = self.queries.get_rubric_name(request.rubricId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Rubric not found: {request.rubricId}")

        async with transaction(self.conn):
            # Process standard groups incrementally
            for group in request.standard_groups:
                if group.deleted and group.id:
                    # Delete marked standard group (cascade deletes standards)
                    query, params = self.queries.delete_standard_group_by_id(group.id)
                    await self.conn.execute(query, *params)
                elif group.id:
                    # Update existing standard group
                    query, _ = self.queries.update_standard_group()
                    await self.conn.execute(
                        query,
                        group.id,
                        group.name,
                        group.short_name,
                        group.description,
                        group.points,
                        group.passPoints,
                    )

                    # Process standards for this group
                    await self._process_standards(group.id, group.standards)
                else:
                    # Create new standard group
                    query, _ = self.queries.create_standard_group()
                    group_result = await self.conn.fetchrow(
                        query,
                        request.rubricId,
                        group.name,
                        group.short_name,
                        group.description,
                        group.points,
                        group.passPoints,
                    )

                    if not group_result:
                        raise ValueError("Failed to create standard group")

                    group_id = str(group_result['id'])

                    # Create standards for new group
                    query, _ = self.queries.create_standard()
                    for standard in group.standards:
                        if not standard.deleted:
                            await self.conn.execute(
                                query,
                                group_id,
                                standard.name,
                                standard.description,
                                standard.points,
                            )

            # Calculate and update rubric points from standard groups
            calculated_points = await self._calculate_rubric_points(request.rubricId)

            # Update rubric with basic info and calculated points
            query, _ = self.queries.update_rubric()
            await self.conn.execute(
                query,
                request.rubricId,
                request.name,
                request.description,
                request.department_id,
                request.active,
                request.default_rubric,
                calculated_points["points"],
                calculated_points["passPoints"],
            )

        # Invalidate caches
        await self._invalidate_cache([
                keys.tag_rubric_by_id(request.rubricId),  # Fine-grained
                keys.tag_rubric_all(),                     # Coarse-grained
                keys.tag_analytics_all(),                  # Related caches
            ])

        return UpdateRubricResponse(
            success=True,
            message=f"Rubric '{request.name}' updated successfully",
            points=calculated_points["points"],
            passPoints=calculated_points["passPoints"],
        )

    async def _process_standards(
        self,
        group_id: str,
        standards: List[Any],
    ) -> None:
        """Process standards for a standard group (create, update, or delete)."""
        for standard in standards:
            if standard.deleted and standard.id:
                # Delete marked standard
                query, params = self.queries.delete_standard_by_id(standard.id)
                await self.conn.execute(query, *params)
            elif standard.id:
                # Update existing standard
                query, _ = self.queries.update_standard()
                await self.conn.execute(
                    query,
                    standard.id,
                    standard.name,
                    standard.description,
                    standard.points,
                )
            else:
                # Create new standard
                query, _ = self.queries.create_standard()
                await self.conn.execute(
                    query,
                    group_id,
                    standard.name,
                    standard.description,
                    standard.points,
                )

    async def _calculate_rubric_points(self, rubric_id: str) -> Dict[str, int]:
        """Calculate rubric points from all standard groups."""
        query, params = self.queries.calculate_rubric_points(rubric_id)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            return {"points": 0, "passPoints": 0}

        return {
            "points": int(result['total_points']),
            "passPoints": int(result['total_pass_points']),
        }

    async def duplicate_rubric(
        self, request: DuplicateRubricRequest
    ) -> DuplicateRubricResponse:
        """Duplicate a rubric with entire hierarchy."""

        # Get original rubric data
        query, params = self.queries.get_rubric_for_duplicate(request.rubricId)
        rubric = await self.conn.fetchrow(query, *params)

        if not rubric:
            raise ValueError(f"Rubric not found: {request.rubricId}")

        async with transaction(self.conn):
            # Create duplicate rubric
            query, _ = self.queries.insert_duplicate_rubric()
            new_rubric = await self.conn.fetchrow(
                query,
                rubric['name'],
                rubric['description'],
                rubric['department_id'],
                rubric['points'],
                rubric['pass_points'],
            )

            if not new_rubric:
                raise ValueError("Failed to create duplicate rubric")

            new_rubric_id = str(new_rubric['id'])

            # Get original standard groups
            query, params = self.queries.get_groups_for_duplicate(request.rubricId)
            groups = await self.conn.fetch(query, *params)

            # Duplicate groups and standards
            for group in groups:
                # Create new group
                query, _ = self.queries.create_standard_group()
                new_group = await self.conn.fetchrow(
                    query,
                    new_rubric_id,
                    group['name'],
                    group['short_name'],
                    group['description'],
                    group['points'],
                    group['pass_points'],
                )

                if not new_group:
                    raise ValueError("Failed to duplicate standard group")

                new_group_id = str(new_group['id'])

                # Get and duplicate standards for this group
                query, params = self.queries.get_standards_for_duplicate(str(group['id']))
                standards = await self.conn.fetch(query, *params)

                query, _ = self.queries.create_standard()
                for standard in standards:
                    await self.conn.execute(
                        query,
                        new_group_id,
                        standard['name'],
                        standard['description'],
                        standard['points'],
                    )

        # Invalidate caches
        await self._invalidate_cache([
                keys.tag_rubric_all(),      # Coarse-grained
                keys.tag_analytics_all(),   # Related caches
            ])

        return DuplicateRubricResponse(
            success=True,
            rubricId=new_rubric_id,
            message=f"Rubric '{rubric['name']}' duplicated successfully",
        )

    async def delete_rubric(self, request: DeleteRubricRequest) -> DeleteRubricResponse:
        """Delete a rubric if not in use."""

        # Check if rubric is in use
        query, params = self.queries.check_rubric_usage(request.rubricId)
        usage = await self.conn.fetchrow(query, *params)

        if not usage:
            raise ValueError("Failed to check rubric usage")

        if usage['usage_count'] > 0:
            raise ValueError("Cannot delete rubric that is in use by simulations")

        # Get rubric name
        query, params = self.queries.get_rubric_name(request.rubricId)
        rubric = await self.conn.fetchrow(query, *params)

        if not rubric:
            raise ValueError(f"Rubric not found: {request.rubricId}")

        # Delete rubric (cascade deletes groups and standards)
        query, params = self.queries.delete_rubric(request.rubricId)
        await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache([
                keys.tag_rubric_by_id(request.rubricId),  # Fine-grained
                keys.tag_rubric_all(),                     # Coarse-grained
                keys.tag_analytics_all(),                  # Related caches
            ])

        return DeleteRubricResponse(
            success=True, message=f"Rubric '{rubric['name']}' deleted successfully"
        )


def get_rubric_service(conn: asyncpg.Connection) -> RubricService:
    """Get rubric service instance."""
    return RubricService(conn)

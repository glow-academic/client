"""Rubric service layer - business logic for rubric operations with hierarchical structure."""

from typing import Any, Dict, List

from app.queries.rubric_queries import RubricQueries
from app.schemas.base import (DepartmentMappingItem, StandardGroupMappingItem,
                              StandardMappingItem)
from app.schemas.rubrics import (CreateRubricRequest, CreateRubricResponse,
                                 DeleteRubricRequest, DeleteRubricResponse,
                                 DuplicateRubricRequest,
                                 DuplicateRubricResponse,
                                 RubricDetailDefaultRequest,
                                 RubricDetailRequest, RubricDetailResponse,
                                 RubricItem, RubricsFilters,
                                 RubricsListResponse, StandardGroupDetail,
                                 StandardGroupMappingDetail,
                                 UpdateRubricRequest, UpdateRubricResponse)
from sqlalchemy import text
from sqlalchemy.orm import Session


class RubricService:
    """Service layer for rubric operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = RubricQueries()

    def get_rubrics_list(self, filters: RubricsFilters) -> RubricsListResponse:
        """Get rubrics list with hierarchical structure and permissions."""

        # Get rubrics
        query, params = self.queries.list_rubrics(
            filters.departmentIds, filters.profileId
        )
        rubrics_result = self.db.execute(text(query), params).fetchall()

        rubrics = []
        rubric_ids = []

        for row in rubrics_result:
            rubrics.append(
                RubricItem(
                    rubric_id=str(row.rubric_id),
                    name=row.name,
                    description=row.description,
                    points=row.points,
                    passPoints=row.passPoints,
                    can_edit=row.can_edit,
                    can_delete=row.can_delete,
                    can_duplicate=row.can_duplicate,
                    standard_groups={},  # Will be populated below
                )
            )
            rubric_ids.append(str(row.rubric_id))

        # Get all standard groups for these rubrics
        standard_groups_mapping = {}
        group_ids = []

        if rubric_ids:
            query, params = self.queries.get_standard_groups_for_rubrics(rubric_ids)
            groups_result = self.db.execute(text(query), params).fetchall()

            for group in groups_result:
                group_id = str(group.id)
                rubric_id = str(group.rubric_id)
                group_ids.append(group_id)

                standard_groups_mapping[group_id] = StandardGroupMappingItem(
                    name=group.name,
                    description=group.description or ''
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
            standards_result = self.db.execute(text(query), params).fetchall()

            for standard in standards_result:
                standard_id = str(standard.id)
                group_id = str(standard.standard_group_id)

                standards_mapping[standard_id] = StandardMappingItem(
                    name=standard.name,
                    description=standard.description or ''
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

    def get_rubric_detail(
        self, request: RubricDetailRequest
    ) -> RubricDetailResponse:
        """Get detailed rubric information with hierarchical structure."""

        # Get rubric basic info
        query, params = self.queries.get_rubric_by_id(request.rubricId)
        rubric = self.db.execute(text(query), params).fetchone()

        if not rubric:
            raise ValueError(f"Rubric not found: {request.rubricId}")

        # Get user's accessible department IDs
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        dept_result = self.db.execute(text(query), params).fetchall()
        valid_department_ids = [str(row.id) for row in dept_result]

        # Get standard groups for this rubric
        query, params = self.queries.get_standard_groups_for_rubric(request.rubricId)
        groups_result = self.db.execute(text(query), params).fetchall()

        standard_group_ids = []
        standard_groups_detail = {}
        standard_groups_mapping = {}

        for group in groups_result:
            group_id = str(group.id)
            standard_group_ids.append(group_id)

            # Get standards for this group
            query, params = self.queries.get_standards_for_group(group_id)
            standards_result = self.db.execute(text(query), params).fetchall()
            standard_ids = [str(s.id) for s in standards_result]

            standard_groups_detail[group_id] = StandardGroupDetail(
                points=group.points,
                passPoints=group.passPoints,
                standard_ids=standard_ids,
            )

            standard_groups_mapping[group_id] = StandardGroupMappingItem(
                name=group.name, description=group.description
            )

        # Build standards mapping
        standards_mapping = {}
        for group in groups_result:
            group_id = str(group.id)
            query, params = self.queries.get_standards_for_group(group_id)
            standards_result = self.db.execute(text(query), params).fetchall()

            for standard in standards_result:
                standards_mapping[str(standard.id)] = StandardMappingItem(
                    name=standard.name,
                    description=standard.description or ''
                )

        # Get department mapping
        department_mapping = {
            str(row.id): DepartmentMappingItem(
                name=row.name, description=row.description or ''
            )
            for row in dept_result
        }

        return RubricDetailResponse(
            name=rubric.name,
            description=rubric.description,
            department_id=str(rubric.department_id),
            valid_department_ids=valid_department_ids,
            points=rubric.points,
            passPoints=rubric.passPoints,
            active=rubric.active,
            default_rubric=rubric.default_rubric,
            standard_group_ids=standard_group_ids,
            standard_groups_detail=standard_groups_detail,
            standard_groups_mapping=standard_groups_mapping,
            standards_mapping=standards_mapping,
            department_mapping=department_mapping,
        )

    def get_rubric_detail_default(
        self, request: RubricDetailDefaultRequest
    ) -> RubricDetailResponse:
        """Get default rubric details based on profile."""

        # Get default rubric for profile
        query, params = self.queries.get_default_rubric(request.profileId)
        rubric = self.db.execute(text(query), params).fetchone()

        if not rubric:
            raise ValueError("No rubrics found for user's departments")

        # Reuse the detail logic with the found rubric_id
        detail_request = RubricDetailRequest(
            rubricId=str(rubric.id), profileId=request.profileId
        )

        return self.get_rubric_detail(detail_request)

    def create_rubric(self, request: CreateRubricRequest) -> CreateRubricResponse:
        """Create a new rubric with nested standard groups and standards."""

        # Create rubric
        query, _ = self.queries.create_rubric()
        rubric_result = self.db.execute(
            text(query),
            {
                "name": request.name,
                "description": request.description,
                "department_id": request.department_id,
                "active": request.active,
                "default_rubric": request.default_rubric,
                "points": request.points,
                "pass_points": request.passPoints,
            },
        ).fetchone()

        if not rubric_result:
            raise ValueError("Failed to create rubric")

        rubric_id = str(rubric_result.id)

        # Create standard groups and their standards
        group_query, _ = self.queries.create_standard_group()
        standard_query, _ = self.queries.create_standard()

        for group in request.standard_groups:
            # Create standard group
            group_result = self.db.execute(
                text(group_query),
                {
                    "rubric_id": rubric_id,
                    "name": group.name,
                    "short_name": group.short_name,
                    "description": group.description,
                    "points": group.points,
                    "pass_points": group.passPoints,
                },
            ).fetchone()

            if not group_result:
                raise ValueError("Failed to create standard group")

            group_id = str(group_result.id)

            # Create standards for this group
            for standard in group.standards:
                self.db.execute(
                    text(standard_query),
                    {
                        "standard_group_id": group_id,
                        "name": standard.name,
                        "description": standard.description,
                        "points": standard.points,
                    },
                )

        self.db.commit()

        return CreateRubricResponse(
            success=True,
            rubricId=rubric_id,
            message=f"Rubric '{request.name}' created successfully",
        )

    def update_rubric(self, request: UpdateRubricRequest) -> UpdateRubricResponse:
        """Update an existing rubric (replace entire hierarchy)."""

        # Check if rubric exists
        query, params = self.queries.get_rubric_name(request.rubricId)
        existing = self.db.execute(text(query), params).fetchone()

        if not existing:
            raise ValueError(f"Rubric not found: {request.rubricId}")

        # Update rubric
        query, _ = self.queries.update_rubric()
        self.db.execute(
            text(query),
            {
                "rubric_id": request.rubricId,
                "name": request.name,
                "description": request.description,
                "department_id": request.department_id,
                "active": request.active,
                "default_rubric": request.default_rubric,
                "points": request.points,
                "pass_points": request.passPoints,
            },
        )

        # Delete existing standard groups (cascade deletes standards)
        query, params = self.queries.delete_standard_groups(request.rubricId)
        self.db.execute(text(query), params)

        # Recreate standard groups and standards
        group_query, _ = self.queries.create_standard_group()
        standard_query, _ = self.queries.create_standard()

        for group in request.standard_groups:
            group_result = self.db.execute(
                text(group_query),
                {
                    "rubric_id": request.rubricId,
                    "name": group.name,
                    "short_name": group.short_name,
                    "description": group.description,
                    "points": group.points,
                    "pass_points": group.passPoints,
                },
            ).fetchone()

            if not group_result:
                raise ValueError("Failed to create standard group")

            group_id = str(group_result.id)

            for standard in group.standards:
                self.db.execute(
                    text(standard_query),
                    {
                        "standard_group_id": group_id,
                        "name": standard.name,
                        "description": standard.description,
                        "points": standard.points,
                    },
                )

        self.db.commit()

        return UpdateRubricResponse(
            success=True, message=f"Rubric '{request.name}' updated successfully"
        )

    def duplicate_rubric(
        self, request: DuplicateRubricRequest
    ) -> DuplicateRubricResponse:
        """Duplicate a rubric with entire hierarchy."""

        # Get original rubric data
        query, params = self.queries.get_rubric_for_duplicate(request.rubricId)
        rubric = self.db.execute(text(query), params).fetchone()

        if not rubric:
            raise ValueError(f"Rubric not found: {request.rubricId}")

        # Create duplicate rubric
        query, _ = self.queries.insert_duplicate_rubric()
        new_rubric = self.db.execute(
            text(query),
            {
                "name": rubric.name,
                "description": rubric.description,
                "department_id": rubric.department_id,
                "points": rubric.points,
                "pass_points": rubric.pass_points,
            },
        ).fetchone()

        if not new_rubric:
            raise ValueError("Failed to create duplicate rubric")

        new_rubric_id = str(new_rubric.id)

        # Get original standard groups
        query, params = self.queries.get_groups_for_duplicate(request.rubricId)
        groups = self.db.execute(text(query), params).fetchall()

        # Duplicate groups and standards
        group_query, _ = self.queries.create_standard_group()
        standard_query, _ = self.queries.create_standard()

        for group in groups:
            # Create new group
            new_group = self.db.execute(
                text(group_query),
                {
                    "rubric_id": new_rubric_id,
                    "name": group.name,
                    "short_name": group.short_name,
                    "description": group.description,
                    "points": group.points,
                    "pass_points": group.pass_points,
                },
            ).fetchone()

            if not new_group:
                raise ValueError("Failed to duplicate standard group")

            new_group_id = str(new_group.id)

            # Get and duplicate standards for this group
            query, params = self.queries.get_standards_for_duplicate(str(group.id))
            standards = self.db.execute(text(query), params).fetchall()

            for standard in standards:
                self.db.execute(
                    text(standard_query),
                    {
                        "standard_group_id": new_group_id,
                        "name": standard.name,
                        "description": standard.description,
                        "points": standard.points,
                    },
                )

        self.db.commit()

        return DuplicateRubricResponse(
            success=True,
            rubricId=new_rubric_id,
            message=f"Rubric '{rubric.name}' duplicated successfully",
        )

    def delete_rubric(self, request: DeleteRubricRequest) -> DeleteRubricResponse:
        """Delete a rubric if not in use."""

        # Check if rubric is in use
        query, params = self.queries.check_rubric_usage(request.rubricId)
        usage = self.db.execute(text(query), params).fetchone()

        if not usage:
            raise ValueError("Failed to check rubric usage")

        if usage.usage_count > 0:
            raise ValueError("Cannot delete rubric that is in use by simulations")

        # Get rubric name
        query, params = self.queries.get_rubric_name(request.rubricId)
        rubric = self.db.execute(text(query), params).fetchone()

        if not rubric:
            raise ValueError(f"Rubric not found: {request.rubricId}")

        # Delete rubric (cascade deletes groups and standards)
        query, params = self.queries.delete_rubric(request.rubricId)
        self.db.execute(text(query), params)
        self.db.commit()

        return DeleteRubricResponse(
            success=True, message=f"Rubric '{rubric.name}' deleted successfully"
        )


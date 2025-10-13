"""Parameter service layer - business logic for parameter operations with nested items."""

from typing import Any, Dict, List

from app.queries.parameter_queries import ParameterQueries
from app.schemas.parameters import (CreateParameterRequest,
                                    CreateParameterResponse,
                                    DeleteParameterRequest,
                                    DeleteParameterResponse,
                                    DuplicateParameterRequest,
                                    DuplicateParameterResponse,
                                    ParameterDetailDefaultRequest,
                                    ParameterDetailRequest,
                                    ParameterDetailResponse, ParameterItem,
                                    ParameterItemDetail, ParametersFilters,
                                    ParametersListResponse,
                                    UpdateParameterRequest,
                                    UpdateParameterResponse)
from app.schemas.personas import DepartmentMappingItem
from sqlalchemy import text
from sqlalchemy.orm import Session


class ParameterService:
    """Service layer for parameter operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = ParameterQueries()

    def get_parameters_list(
        self, filters: ParametersFilters
    ) -> ParametersListResponse:
        """Get parameters list with item counts and permissions."""

        # Get query from query builder
        query, params = self.queries.list_parameters(
            filters.departmentIds, filters.profileId
        )

        result = self.db.execute(text(query), params).fetchall()

        # Build response
        parameters = []

        for row in result:
            parameters.append(
                ParameterItem(
                    parameter_id=str(row.parameter_id),
                    name=row.name,
                    description=row.description,
                    numerical=row.numerical,
                    active=row.active,
                    default_parameter=row.default_parameter,
                    num_items=row.num_items,
                    can_edit=row.can_edit,
                    can_delete=row.can_delete,
                    can_duplicate=row.can_duplicate,
                )
            )

        return ParametersListResponse(parameters=parameters)

    def get_parameter_detail(
        self, request: ParameterDetailRequest
    ) -> ParameterDetailResponse:
        """Get detailed parameter information with nested items."""

        # Get parameter basic info
        query, params = self.queries.get_parameter_by_id(request.parameterId)
        parameter = self.db.execute(text(query), params).fetchone()

        if not parameter:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        # Get parameter items
        query, params = self.queries.get_parameter_items(request.parameterId)
        items_result = self.db.execute(text(query), params).fetchall()

        # Check usage for each item
        item_ids = [str(item.id) for item in items_result]
        item_usage: Dict[str, int] = {}

        if item_ids:
            query, params = self.queries.check_parameter_item_usage(item_ids)
            usage_result = self.db.execute(text(query), params).fetchall()

            for row in usage_result:
                item_usage[str(row.parameter_item_id)] = row.usage_count

        # Build parameter items list
        parameter_items = []
        for item in items_result:
            item_id = str(item.id)
            parameter_items.append(
                ParameterItemDetail(
                    parameter_item_id=item_id,
                    name=item.name,
                    description=item.description,
                    value=item.value,
                    default_item=item.default_item,
                    can_delete=item_usage.get(item_id, 0) == 0,
                )
            )

        # Get user's accessible department IDs
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        dept_result = self.db.execute(text(query), params).fetchall()
        valid_department_ids = [str(row.id) for row in dept_result]

        # Get department mapping
        department_mapping = {
            str(row.id): DepartmentMappingItem(
                name=row.name, description=row.description
            )
            for row in dept_result
        }

        return ParameterDetailResponse(
            name=parameter.name,
            description=parameter.description,
            numerical=parameter.numerical,
            active=parameter.active,
            default_parameter=parameter.default_parameter,
            department_id=str(parameter.department_id),
            valid_department_ids=valid_department_ids,
            parameter_items=parameter_items,
            department_mapping=department_mapping,
        )

    def get_parameter_detail_default(
        self, request: ParameterDetailDefaultRequest
    ) -> ParameterDetailResponse:
        """Get default parameter details based on profile."""

        # Get default parameter for profile
        query, params = self.queries.get_default_parameter(request.profileId)
        parameter = self.db.execute(text(query), params).fetchone()

        if not parameter:
            raise ValueError("No parameters found for user's departments")

        # Reuse the detail logic with the found parameter_id
        detail_request = ParameterDetailRequest(
            parameterId=str(parameter.id), profileId=request.profileId
        )

        return self.get_parameter_detail(detail_request)

    def create_parameter(
        self, request: CreateParameterRequest
    ) -> CreateParameterResponse:
        """Create a new parameter with nested items."""

        # Create parameter
        query, _ = self.queries.create_parameter()
        parameter_result = self.db.execute(
            text(query),
            {
                "name": request.name,
                "description": request.description,
                "numerical": request.numerical,
                "active": request.active,
                "default_parameter": request.default_parameter,
                "department_id": request.department_id,
            },
        ).fetchone()

        if not parameter_result:
            raise ValueError("Failed to create parameter")

        parameter_id = str(parameter_result.id)

        # Create parameter items
        item_query, _ = self.queries.create_parameter_item()

        for item in request.parameter_items:
            self.db.execute(
                text(item_query),
                {
                    "parameter_id": parameter_id,
                    "name": item.name,
                    "description": item.description,
                    "value": item.value,
                    "default_item": item.default_item,
                },
            )

        self.db.commit()

        return CreateParameterResponse(
            success=True,
            parameterId=parameter_id,
            message=f"Parameter '{request.name}' created successfully",
        )

    def update_parameter(
        self, request: UpdateParameterRequest
    ) -> UpdateParameterResponse:
        """Update an existing parameter (replace all items)."""

        # Check if parameter exists
        query, params = self.queries.get_parameter_name(request.parameterId)
        existing = self.db.execute(text(query), params).fetchone()

        if not existing:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        # Update parameter
        query, _ = self.queries.update_parameter()
        self.db.execute(
            text(query),
            {
                "parameter_id": request.parameterId,
                "name": request.name,
                "description": request.description,
                "numerical": request.numerical,
                "active": request.active,
                "default_parameter": request.default_parameter,
                "department_id": request.department_id,
            },
        )

        # Delete existing parameter items
        query, params = self.queries.delete_parameter_items(request.parameterId)
        self.db.execute(text(query), params)

        # Recreate parameter items
        item_query, _ = self.queries.create_parameter_item()
        for item in request.parameter_items:
            self.db.execute(
                text(item_query),
                {
                    "parameter_id": request.parameterId,
                    "name": item.name,
                    "description": item.description,
                    "value": item.value,
                    "default_item": item.default_item,
                },
            )

        self.db.commit()

        return UpdateParameterResponse(
            success=True, message=f"Parameter '{request.name}' updated successfully"
        )

    def duplicate_parameter(
        self, request: DuplicateParameterRequest
    ) -> DuplicateParameterResponse:
        """Duplicate a parameter with all items."""

        # Get original parameter data
        query, params = self.queries.get_parameter_for_duplicate(
            request.parameterId
        )
        parameter = self.db.execute(text(query), params).fetchone()

        if not parameter:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        # Create duplicate parameter
        query, _ = self.queries.insert_duplicate_parameter()
        new_parameter = self.db.execute(
            text(query),
            {
                "name": parameter.name,
                "description": parameter.description,
                "numerical": parameter.numerical,
                "department_id": parameter.department_id,
            },
        ).fetchone()

        if not new_parameter:
            raise ValueError("Failed to create duplicate parameter")

        new_parameter_id = str(new_parameter.id)

        # Get original items
        query, params = self.queries.get_items_for_duplicate(request.parameterId)
        items = self.db.execute(text(query), params).fetchall()

        # Duplicate items
        item_query, _ = self.queries.create_parameter_item()
        for item in items:
            self.db.execute(
                text(item_query),
                {
                    "parameter_id": new_parameter_id,
                    "name": item.name,
                    "description": item.description,
                    "value": item.value,
                    "default_item": item.default_item,
                },
            )

        self.db.commit()

        return DuplicateParameterResponse(
            success=True,
            parameterId=new_parameter_id,
            message=f"Parameter '{parameter.name}' duplicated successfully",
        )

    def delete_parameter(
        self, request: DeleteParameterRequest
    ) -> DeleteParameterResponse:
        """Delete a parameter if items not in use."""

        # Check if any parameter items are in use
        query, params = self.queries.check_parameter_usage(request.parameterId)
        usage = self.db.execute(text(query), params).fetchone()

        if not usage:
            raise ValueError("Failed to check parameter usage")

        if usage.usage_count > 0:
            raise ValueError(
                "Cannot delete parameter: Some items are in use by scenarios"
            )

        # Get parameter name
        query, params = self.queries.get_parameter_name(request.parameterId)
        parameter = self.db.execute(text(query), params).fetchone()

        if not parameter:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        # Delete parameter (cascade deletes items)
        query, params = self.queries.delete_parameter(request.parameterId)
        self.db.execute(text(query), params)
        self.db.commit()

        return DeleteParameterResponse(
            success=True, message=f"Parameter '{parameter.name}' deleted successfully"
        )


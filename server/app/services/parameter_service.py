"""Parameter service layer - business logic for parameter operations with nested items."""

import json

import asyncpg  # type: ignore

from app.cache import keys
from app.db import transaction
from app.queries.parameter_queries import ParameterQueries
from app.schemas.base import DepartmentMappingItem
from app.schemas.parameters import (
    CreateParameterItemRequest,
    CreateParameterItemResponse,
    CreateParameterRequest,
    CreateParameterResponse,
    DeleteParameterRequest,
    DeleteParameterResponse,
    DuplicateParameterRequest,
    DuplicateParameterResponse,
    ParameterDetailDefaultRequest,
    ParameterDetailRequest,
    ParameterDetailResponse,
    ParameterItem,
    ParameterItemDetail,
    ParameterSampleItem,
    ParametersFilters,
    ParametersListResponse,
    UpdateParameterRequest,
    UpdateParameterResponse,
)
from app.services.base_service import BaseService, with_cache


class ParameterService(BaseService):
    """Service layer for parameter operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = ParameterQueries()

    @with_cache(lambda self, filters: keys.parameter_list(filters))
    async def get_parameters_list(
        self, filters: ParametersFilters
    ) -> ParametersListResponse:
        """Get parameters list with item counts and permissions."""
        # Get query from query builder
        query, params = self.queries.list_parameters(
            filters.departmentIds, filters.profileId
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        parameters = []

        for row in result:
            # Parse sample items from JSONB
            sample_items = []
            if row.get("sample_items_json"):
                items_data = row["sample_items_json"]
                if isinstance(items_data, str):
                    items_data = json.loads(items_data)
                if isinstance(items_data, list):
                    for item_data in items_data:
                        if isinstance(item_data, dict):
                            sample_items.append(
                                ParameterSampleItem(
                                    parameter_item_id=item_data.get(
                                        "parameter_item_id", ""
                                    ),
                                    name=item_data.get("name", ""),
                                    description=item_data.get("description", ""),
                                    value=item_data.get("value", ""),
                                )
                            )

            parameters.append(
                ParameterItem(
                    parameter_id=str(row["parameter_id"]),
                    name=row["name"],
                    description=row["description"],
                    numerical=row["numerical"],
                    active=row["active"],
                    default_parameter=row["default_parameter"],
                    num_items=row["num_items"],
                    sample_items=sample_items,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

        return ParametersListResponse(parameters=parameters)

    @with_cache(
        lambda self, request: keys.parameter_by_id(
            request.parameterId, request.profileId
        )
    )
    async def get_parameter_detail(
        self, request: ParameterDetailRequest
    ) -> ParameterDetailResponse:
        """Get detailed parameter information with nested items."""
        # Get all parameter data with items and mappings in a single query
        query, params = self.queries.get_parameter_detail_complete(
            request.parameterId, request.profileId
        )
        parameter = await self.conn.fetchrow(query, *params)

        if not parameter:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        # Parse valid_department_ids from array
        valid_department_ids = parameter["valid_department_ids"] or []

        # Parse department_mapping from JSONB with type safety (may be string or dict)
        department_mapping = {}
        dept_mapping_data = parameter.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for dept_id, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse parameter items from JSONB with type safety
        parameter_items = []
        if parameter.get("parameter_items_json") and isinstance(
            parameter["parameter_items_json"], list
        ):
            for item_data in parameter["parameter_items_json"]:
                if isinstance(item_data, dict):
                    usage_count = item_data.get("usage_count", 0)
                    parameter_items.append(
                        ParameterItemDetail(
                            parameter_item_id=item_data.get("parameter_item_id", ""),
                            name=item_data.get("name", ""),
                            description=item_data.get("description", ""),
                            value=item_data.get("value", ""),
                            default_item=item_data.get("default_item", False),
                            can_delete=usage_count == 0,
                        )
                    )

        return ParameterDetailResponse(
            name=parameter["name"],
            description=parameter["description"],
            numerical=parameter["numerical"],
            active=parameter["active"],
            default_parameter=parameter["default_parameter"],
            department_id=str(parameter["department_id"]),
            valid_department_ids=valid_department_ids,
            parameter_items=parameter_items,
            department_mapping=department_mapping,
        )

    @with_cache(lambda self, request: keys.parameter_detail_default(request.profileId))
    async def get_parameter_detail_default(
        self, request: ParameterDetailDefaultRequest
    ) -> ParameterDetailResponse:
        """Get default parameter details based on profile."""
        # Use consolidated query that finds default and fetches detail in one go
        query, params = self.queries.get_parameter_detail_default_complete(
            request.profileId
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError("No parameters found for user's departments")

        # Parse the consolidated result
        parameter_items_json = json.loads(result["parameter_items_json"])
        department_mapping_json = json.loads(result["department_mapping"])
        valid_department_ids = result["valid_department_ids"]

        # Transform department mapping
        department_mapping: dict[str, DepartmentMappingItem] = {}
        for dept_id, ddata in department_mapping_json.items():
            department_mapping[dept_id] = DepartmentMappingItem(
                name=ddata.get("name", ""),
                description=ddata.get("description", ""),
            )

        # Transform parameter items and compute can_delete
        parameter_items = []
        for item_data in parameter_items_json:
            usage_count = item_data.get("usage_count", 0)
            parameter_items.append(
                ParameterItemDetail(
                    parameter_item_id=item_data.get("parameter_item_id", ""),
                    name=item_data.get("name", ""),
                    description=item_data.get("description", ""),
                    value=item_data.get("value", ""),
                    default_item=item_data.get("default_item", False),
                    can_delete=usage_count == 0,
                )
            )

        return ParameterDetailResponse(
            name=result["name"],
            description=result["description"],
            numerical=result["numerical"],
            active=result["active"],
            default_parameter=result["default_parameter"],
            department_id=str(result["department_id"]),
            parameter_items=parameter_items,
            department_mapping=department_mapping,
            valid_department_ids=valid_department_ids,
        )

    async def create_parameter(
        self, request: CreateParameterRequest
    ) -> CreateParameterResponse:
        """Create a new parameter with nested items."""

        async with transaction(self.conn):
            # Create parameter
            query, _ = self.queries.create_parameter()
            parameter_result = await self.conn.fetchrow(
                query,
                request.name,
                request.description,
                request.numerical,
                request.active,
                request.default_parameter,
                request.department_id,
            )

            if not parameter_result:
                raise ValueError("Failed to create parameter")

            parameter_id = str(parameter_result["id"])

            # Create parameter items
            item_query, _ = self.queries.create_parameter_item()
            for item in request.parameter_items:
                await self.conn.execute(
                    item_query,
                    parameter_id,
                    item.name,
                    item.description,
                    item.value,
                    item.default_item,
                )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_parameter_all(),
                keys.tag_agent_all(),  # Parameters used in scenario generation
            ]
        )

        return CreateParameterResponse(
            success=True,
            parameterId=parameter_id,
            message=f"Parameter '{request.name}' created successfully",
        )

    async def update_parameter(
        self, request: UpdateParameterRequest
    ) -> UpdateParameterResponse:
        """Update an existing parameter (replace all items)."""

        # Check if parameter exists
        query, params = self.queries.get_parameter_name(request.parameterId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        async with transaction(self.conn):
            # Update parameter
            update_query, _ = self.queries.update_parameter()
            await self.conn.execute(
                update_query,
                request.parameterId,
                request.name,
                request.description,
                request.numerical,
                request.active,
                request.default_parameter,
                request.department_id,
            )

            # Delete existing parameter items
            query, params = self.queries.delete_parameter_items(request.parameterId)
            await self.conn.execute(query, *params)

            # Recreate parameter items
            item_query, _ = self.queries.create_parameter_item()
            for item in request.parameter_items:
                await self.conn.execute(
                    item_query,
                    request.parameterId,
                    item.name,
                    item.description,
                    item.value,
                    item.default_item,
                )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_parameter_by_id(request.parameterId),
                keys.tag_parameter_all(),
                keys.tag_agent_all(),  # Parameters used in scenario context
            ]
        )

        return UpdateParameterResponse(
            success=True, message=f"Parameter '{request.name}' updated successfully"
        )

    async def duplicate_parameter(
        self, request: DuplicateParameterRequest
    ) -> DuplicateParameterResponse:
        """Duplicate a parameter with all items."""

        # Get original parameter data
        query, params = self.queries.get_parameter_for_duplicate(request.parameterId)
        parameter = await self.conn.fetchrow(query, *params)

        if not parameter:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        async with transaction(self.conn):
            # Create duplicate parameter
            dup_query, _ = self.queries.insert_duplicate_parameter()
            new_parameter = await self.conn.fetchrow(
                dup_query,
                parameter["name"],
                parameter["description"],
                parameter["numerical"],
                parameter["department_id"],
            )

            if not new_parameter:
                raise ValueError("Failed to create duplicate parameter")

            new_parameter_id = str(new_parameter["id"])

            # Get original items
            query, params = self.queries.get_items_for_duplicate(request.parameterId)
            items = await self.conn.fetch(query, *params)

            # Duplicate items
            item_query, _ = self.queries.create_parameter_item()
            for item in items:
                await self.conn.execute(
                    item_query,
                    new_parameter_id,
                    item["name"],
                    item["description"],
                    item["value"],
                    item["default_item"],
                )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_parameter_all(),
            ]
        )

        return DuplicateParameterResponse(
            success=True,
            parameterId=new_parameter_id,
            message=f"Parameter '{parameter['name']}' duplicated successfully",
        )

    async def delete_parameter(
        self, request: DeleteParameterRequest
    ) -> DeleteParameterResponse:
        """Delete a parameter if items not in use."""

        # Check if any parameter items are in use
        query, params = self.queries.check_parameter_usage(request.parameterId)
        usage = await self.conn.fetchrow(query, *params)

        if not usage:
            raise ValueError("Failed to check parameter usage")

        if usage["usage_count"] > 0:
            raise ValueError(
                "Cannot delete parameter: Some items are in use by scenarios"
            )

        # Get parameter name
        query, params = self.queries.get_parameter_name(request.parameterId)
        parameter = await self.conn.fetchrow(query, *params)

        if not parameter:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        # Delete parameter (cascade deletes items)
        query, params = self.queries.delete_parameter(request.parameterId)
        await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_parameter_by_id(request.parameterId),
                keys.tag_parameter_all(),
            ]
        )

        return DeleteParameterResponse(
            success=True,
            message=f"Parameter '{parameter['name']}' deleted successfully",
        )

    async def create_parameter_item(
        self, request: CreateParameterItemRequest
    ) -> CreateParameterItemResponse:
        """Create a single parameter item (for inline creation from pickers)."""

        # Verify parameter exists
        query, params = self.queries.get_parameter_by_id(request.parameterId)
        parameter = await self.conn.fetchrow(query, *params)

        if not parameter:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        # Create parameter item
        query, _ = self.queries.create_parameter_item()
        result = await self.conn.fetchrow(
            query,
            request.parameterId,
            request.name,
            request.description,
            request.value,
            request.default_item,
        )

        if not result:
            raise ValueError("Failed to create parameter item")

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_parameter_by_id(request.parameterId),
                keys.tag_parameter_all(),
                keys.tag_agent_all(),  # Parameter items used in scenario context
            ]
        )

        return CreateParameterItemResponse(
            success=True,
            parameterItemId=str(result["id"]),
            message=f"Parameter item '{request.name}' created successfully",
        )


def get_parameter_service(conn: asyncpg.Connection) -> ParameterService:
    """Get parameter service instance."""
    return ParameterService(conn)

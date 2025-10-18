"""Parameter service layer - business logic for parameter operations with nested items."""


import asyncpg  # type: ignore
from app.cache import keys
from app.db import transaction
from app.queries.parameter_queries import ParameterQueries
from app.schemas.base import DepartmentMappingItem
from app.schemas.parameters import (CreateParameterItemRequest,
                                    CreateParameterItemResponse,
                                    CreateParameterRequest,
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
from app.services.base import BaseService, with_cache


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
            parameters.append(
                ParameterItem(
                    parameter_id=str(row['parameter_id']),
                    name=row['name'],
                    description=row['description'],
                    numerical=row['numerical'],
                    active=row['active'],
                    default_parameter=row['default_parameter'],
                    num_items=row['num_items'],
                    can_edit=row['can_edit'],
                    can_delete=row['can_delete'],
                    can_duplicate=row['can_duplicate'],
                )
            )

        return ParametersListResponse(parameters=parameters)

    @with_cache(lambda self, request: keys.parameter_by_id(request.parameterId, request.profileId))
    async def get_parameter_detail(
        self, request: ParameterDetailRequest
    ) -> ParameterDetailResponse:
        """Get detailed parameter information with nested items."""
        # Get parameter basic info
        query, params = self.queries.get_parameter_by_id(request.parameterId)
        parameter = await self.conn.fetchrow(query, *params)

        if not parameter:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        # Get parameter items
        query, params = self.queries.get_parameter_items(request.parameterId)
        items_result = await self.conn.fetch(query, *params)

        # Check usage for each item
        item_ids = [str(item['id']) for item in items_result]
        item_usage: dict[str, int] = {}

        if item_ids:
            query, params = self.queries.check_parameter_item_usage(item_ids)
            usage_result = await self.conn.fetch(query, *params)

            for row in usage_result:
                item_usage[str(row['parameter_item_id'])] = row['usage_count']

        # Build parameter items list
        parameter_items = []
        for item in items_result:
            item_id = str(item['id'])
            parameter_items.append(
                ParameterItemDetail(
                    parameter_item_id=item_id,
                    name=item['name'],
                    description=item['description'],
                    value=item['value'],
                    default_item=item['default_item'],
                    can_delete=item_usage.get(item_id, 0) == 0,
                )
            )

        # Get user's accessible department IDs
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        dept_result = await self.conn.fetch(query, *params)
        valid_department_ids = [str(row['id']) for row in dept_result]

        # Get department mapping
        department_mapping = {
            str(row['id']): DepartmentMappingItem(
                name=row['name'], description=row['description'] or ''
            )
            for row in dept_result
        }

        return ParameterDetailResponse(
            name=parameter['name'],
            description=parameter['description'],
            numerical=parameter['numerical'],
            active=parameter['active'],
            default_parameter=parameter['default_parameter'],
            department_id=str(parameter['department_id']),
            valid_department_ids=valid_department_ids,
            parameter_items=parameter_items,
            department_mapping=department_mapping,
        )

    @with_cache(lambda self, request: keys.parameter_detail_default(request.profileId))
    async def get_parameter_detail_default(
        self, request: ParameterDetailDefaultRequest
    ) -> ParameterDetailResponse:
        """Get default parameter details based on profile."""
        # Get default parameter for profile
        query, params = self.queries.get_default_parameter(request.profileId)
        parameter = await self.conn.fetchrow(query, *params)

        if not parameter:
            raise ValueError("No parameters found for user's departments")

        # Reuse the detail logic with the found parameter_id
        detail_request = ParameterDetailRequest(
            parameterId=str(parameter['id']), profileId=request.profileId
        )

        return await self.get_parameter_detail(detail_request)

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

            parameter_id = str(parameter_result['id'])

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
        await self._invalidate_cache([
            keys.tag_parameter_all(),
            keys.tag_agent_all(),  # Parameters used in scenario generation
        ])

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
        await self._invalidate_cache([
            keys.tag_parameter_by_id(request.parameterId),
            keys.tag_parameter_all(),
            keys.tag_agent_all(),  # Parameters used in scenario context
        ])

        return UpdateParameterResponse(
            success=True, message=f"Parameter '{request.name}' updated successfully"
        )

    async def duplicate_parameter(
        self, request: DuplicateParameterRequest
    ) -> DuplicateParameterResponse:
        """Duplicate a parameter with all items."""

        # Get original parameter data
        query, params = self.queries.get_parameter_for_duplicate(
            request.parameterId
        )
        parameter = await self.conn.fetchrow(query, *params)

        if not parameter:
            raise ValueError(f"Parameter not found: {request.parameterId}")

        async with transaction(self.conn):
            # Create duplicate parameter
            dup_query, _ = self.queries.insert_duplicate_parameter()
            new_parameter = await self.conn.fetchrow(
                dup_query,
                parameter['name'],
                parameter['description'],
                parameter['numerical'],
                parameter['department_id'],
            )

            if not new_parameter:
                raise ValueError("Failed to create duplicate parameter")

            new_parameter_id = str(new_parameter['id'])

            # Get original items
            query, params = self.queries.get_items_for_duplicate(request.parameterId)
            items = await self.conn.fetch(query, *params)

            # Duplicate items
            item_query, _ = self.queries.create_parameter_item()
            for item in items:
                await self.conn.execute(
                    item_query,
                    new_parameter_id,
                    item['name'],
                    item['description'],
                    item['value'],
                    item['default_item'],
                )

        # Invalidate caches
        await self._invalidate_cache([
            keys.tag_parameter_all(),
        ])

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

        if usage['usage_count'] > 0:
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
        await self._invalidate_cache([
                keys.tag_parameter_by_id(request.parameterId),
                keys.tag_parameter_all(),
            ])

        return DeleteParameterResponse(
            success=True, message=f"Parameter '{parameter['name']}' deleted successfully"
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
        await self._invalidate_cache([
            keys.tag_parameter_by_id(request.parameterId),
            keys.tag_parameter_all(),
            keys.tag_agent_all(),  # Parameter items used in scenario context
        ])

        return CreateParameterItemResponse(
            success=True,
            parameterItemId=str(result['id']),
            message=f"Parameter item '{request.name}' created successfully",
        )


def get_parameter_service(conn: asyncpg.Connection) -> ParameterService:
    """Get parameter service instance."""
    return ParameterService(conn)

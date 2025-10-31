"""Parameter service layer - business logic for parameter operations with nested items."""

import json

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
                                    ParameterItemDetail, ParameterSampleItem,
                                    ParametersFilters, ParametersListResponse,
                                    UpdateParameterRequest,
                                    UpdateParameterResponse)
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
            filters.profileId
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        parameters = []
        department_mapping: dict[str, DepartmentMappingItem] = {}

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

            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            parameters.append(
                ParameterItem(
                    parameter_id=str(row["parameter_id"]),
                    name=row["name"],
                    description=row["description"],
                    numerical=row["numerical"],
                    active=row["active"],
                    department_ids=dept_ids,
                    num_items=row["num_items"],
                    sample_items=sample_items,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

            # Parse department_mapping from first row (same for all parameters)
            if not department_mapping and row.get("department_mapping"):
                dm = row["department_mapping"]
                if isinstance(dm, str):
                    dm = json.loads(dm)
                if isinstance(dm, dict):
                    for did, ddata in dm.items():
                        if isinstance(ddata, dict):
                            department_mapping[did] = DepartmentMappingItem(
                                name=ddata["name"], description=ddata["description"]
                            )

        return ParametersListResponse(
            parameters=parameters,
            department_mapping=department_mapping,
        )

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
        parameter_items_data = parameter.get("parameter_items_json")
        if isinstance(parameter_items_data, str):
            parameter_items_data = json.loads(parameter_items_data)
        
        if parameter_items_data and isinstance(parameter_items_data, list):
            for item_data in parameter_items_data:
                if isinstance(item_data, dict):
                    usage_count = item_data.get("usage_count", 0)
                    dept_ids = item_data.get("department_ids")
                    if dept_ids and isinstance(dept_ids, list):
                        dept_ids = [str(d) for d in dept_ids if d]
                    elif dept_ids is None:
                        dept_ids = None
                    else:
                        dept_ids = None
                    parameter_items.append(
                        ParameterItemDetail(
                            parameter_item_id=item_data.get("parameter_item_id", ""),
                            name=item_data.get("name", ""),
                            description=item_data.get("description", ""),
                            value=item_data.get("value", ""),
                            default_item=item_data.get("default_item", False),
                            department_ids=dept_ids,
                            can_delete=usage_count == 0,
                        )
                    )

        # Parse department_ids from query (None = cross-department)
        department_ids = parameter.get("department_ids")
        if department_ids:
            department_ids = [str(d) for d in department_ids]

        return ParameterDetailResponse(
            name=parameter["name"],
            description=parameter["description"],
            numerical=parameter["numerical"],
            active=parameter["active"],
            department_ids=department_ids,  # None or list of department IDs
            valid_department_ids=valid_department_ids,
            parameter_items=parameter_items,
            department_mapping=department_mapping,
        )

    @with_cache(lambda self, request: keys.parameter_detail_default(request.profileId))
    async def get_parameter_detail_default(
        self, request: ParameterDetailDefaultRequest
    ) -> ParameterDetailResponse:
        """Get default parameter structure for creation mode (empty with valid departments)."""
        # Get user's departments for validation
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        ),
        department_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.title,
                        'description', COALESCE(d.description, '')
                    )
                ),
                '{}'::jsonb
            ) as mapping
            FROM departments d
            WHERE d.id IN (SELECT department_id FROM user_departments)
        )
        SELECT 
            COALESCE(
                (SELECT array_agg(department_id::text ORDER BY department_id) FROM user_departments),
                ARRAY[]::text[]
            ) as department_ids,
            (SELECT mapping FROM department_mapping_data) as department_mapping
        """
        result = await self.conn.fetchrow(query, request.profileId)

        if not result:
            raise ValueError("Failed to fetch user departments")

        dept_ids = result["department_ids"] or []
        
        if not dept_ids:
            raise ValueError("No accessible departments found for user")

        # Default department (first accessible)
        default_dept_id = dept_ids[0]

        # Parse department mapping
        department_mapping_data = result.get("department_mapping")
        if isinstance(department_mapping_data, str):
            department_mapping_data = json.loads(department_mapping_data)
        
        department_mapping: dict[str, DepartmentMappingItem] = {}
        if isinstance(department_mapping_data, dict):
            for dept_id, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Return empty parameter with all valid options for creation
        # Default to first department or None (cross-department if superadmin)
        default_department_ids = [default_dept_id] if default_dept_id else None

        return ParameterDetailResponse(
            name="",
            description="",
            numerical=False,
            active=True,
            department_ids=default_department_ids,
            parameter_items=[],  # Empty - user will define items
            department_mapping=department_mapping,
            valid_department_ids=dept_ids,
        )

    async def create_parameter(
        self, request: CreateParameterRequest
    ) -> CreateParameterResponse:
        """Create a new parameter with nested items."""

        async with transaction(self.conn):
            # Create parameter
            # Note: create_parameter() query doesn't accept department_ids - handled separately
            query, _ = self.queries.create_parameter()
            parameter_result = await self.conn.fetchrow(
                query,
                request.name,
                request.description,
                request.numerical,
                request.active,
            )

            if not parameter_result:
                raise ValueError("Failed to create parameter")

            parameter_id = str(parameter_result["id"])

            # Create parameter items first
            item_query, _ = self.queries.create_parameter_item()
            item_ids = []
            for item in request.parameter_items:
                item_result = await self.conn.fetchrow(
                    item_query,
                    parameter_id,
                    item.name,
                    item.description,
                    item.value,
                    item.default_item,
                )
                if item_result:
                    item_id = str(item_result["id"])
                    item_ids.append(item_id)

                    # Link department_ids to this parameter item if provided
                    # Use per-item department_ids if available, otherwise fall back to parameter-level
                    dept_ids = item.department_ids if hasattr(item, 'department_ids') and item.department_ids is not None else (request.department_ids if request.department_ids else None)
                    if dept_ids:
                        insert_dept_query, insert_dept_params = (
                            self.queries.create_parameter_item_departments(
                                item_id, dept_ids
                            )
                        )
                        await self.conn.execute(insert_dept_query, *insert_dept_params)

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
            # Update parameter basic fields
            update_query, _ = self.queries.update_parameter()
            await self.conn.execute(
                update_query,
                request.parameterId,
                request.name,
                request.description,
                request.numerical,
                request.active,
            )

            # Delete existing parameter items (this will cascade delete parameter_item_departments)
            query, params = self.queries.delete_parameter_items(request.parameterId)
            await self.conn.execute(query, *params)

            # Recreate parameter items
            item_query, _ = self.queries.create_parameter_item()
            item_ids = []
            for item in request.parameter_items:
                item_result = await self.conn.fetchrow(
                    item_query,
                    request.parameterId,
                    item.name,
                    item.description,
                    item.value,
                    item.default_item,
                )
                if item_result:
                    item_id = str(item_result["id"])
                    item_ids.append(item_id)

                    # Link department_ids to this parameter item if provided
                    # Use per-item department_ids if available, otherwise fall back to parameter-level
                    dept_ids = item.department_ids if hasattr(item, 'department_ids') and item.department_ids is not None else (request.department_ids if request.department_ids else None)
                    if dept_ids:
                        insert_dept_query, insert_dept_params = (
                            self.queries.create_parameter_item_departments(
                                item_id, dept_ids
                            )
                        )
                        await self.conn.execute(insert_dept_query, *insert_dept_params)

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
            )

            if not new_parameter:
                raise ValueError("Failed to create duplicate parameter")

            new_parameter_id = str(new_parameter["id"])

            # Get original items with their department associations
            query, params = self.queries.get_items_for_duplicate(request.parameterId)
            items = await self.conn.fetch(query, *params)

            # Get department_ids for each item
            item_dept_query = """
            SELECT pid.department_id::text
            FROM parameter_item_departments pid
            WHERE pid.parameter_item_id = $1::uuid AND pid.active = true
            """

            # Duplicate items with their department associations
            item_query, _ = self.queries.create_parameter_item()
            for item in items:
                item_result = await self.conn.fetchrow(
                    item_query,
                    new_parameter_id,
                    item["name"],
                    item["description"],
                    item["value"],
                    item["default_item"],
                )
                if item_result:
                    new_item_id = str(item_result["id"])
                    # Get original item's department_ids
                    original_item_id = str(item["id"])
                    dept_results = await self.conn.fetch(item_dept_query, original_item_id)
                    if dept_results:
                        dept_ids = [str(d["department_id"]) for d in dept_results]
                        if dept_ids:
                            insert_dept_query, insert_dept_params = (
                                self.queries.create_parameter_item_departments(
                                    new_item_id, dept_ids
                                )
                            )
                            await self.conn.execute(insert_dept_query, *insert_dept_params)

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

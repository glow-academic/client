"""Unified endpoints for artifacts and resources."""

import importlib
import inspect
from pathlib import Path
from typing import Any, cast

from fastapi import Request, Response
from mcp.server.fastmcp import FastMCP

# ============================================================================
# Dynamic Discovery Functions
# ============================================================================

def discover_artifacts() -> list[str]:
    """Discover all artifacts by scanning artifacts directory.
    
    Returns:
        List of artifact names (singular, alphabetical).
    """
    artifacts_dir = Path(__file__).parent.parent / "api" / "v4" / "artifacts"
    artifacts = []
    
    if artifacts_dir.exists():
        for item in sorted(artifacts_dir.iterdir()):
            if item.is_dir() and not item.name.startswith("_"):
                # Check if it has handlers (has get.py or save.py)
                if (item / "get.py").exists() or (item / "save.py").exists():
                    artifacts.append(item.name)
    
    return artifacts


def discover_resources() -> list[str]:
    """Discover all resources by scanning resources directory.
    
    Returns:
        List of resource names (plural, alphabetical).
    """
    resources_dir = Path(__file__).parent.parent / "api" / "v4" / "resources"
    resources = []
    
    if resources_dir.exists():
        for item in sorted(resources_dir.iterdir()):
            if item.is_dir() and not item.name.startswith("_"):
                # Check if it has create.py
                if (item / "create.py").exists():
                    resources.append(item.name)
    
    return resources


def pluralize_artifact(artifact_name: str) -> str:
    """Pluralize artifact name for docs operations.
    
    Args:
        artifact_name: Singular artifact name (e.g., "agent", "persona")
    
    Returns:
        Pluralized artifact name (e.g., "agents", "personas")
    """
    # Simple rule: add 's' to end (handles most cases)
    # Special cases: y → ies, s/x/z → add 'es', etc.
    if artifact_name.endswith('y'):
        return artifact_name[:-1] + 'ies'
    elif artifact_name.endswith(('s', 'x', 'z', 'ch', 'sh')):
        return artifact_name + 'es'
    else:
        return artifact_name + 's'


def _get_artifact_handler_name(artifact_name: str, operation: str) -> str | None:
    """Get the handler function name for an artifact operation.
    
    Derives function names directly from API path structure.
    Artifacts use singular names matching directory names.
    
    Args:
        artifact_name: Singular artifact name (e.g., "agent", "persona")
        operation: Operation name (e.g., "get", "save", "list")
    
    Returns:
        Function name or None if operation not applicable.
    """
    if operation == "get":
        return f"get_{artifact_name}"
    elif operation == "save":
        return f"save_{artifact_name}"
    elif operation == "list":
        # Singular: get_{artifact}_list (matches directory name)
        return f"get_{artifact_name}_list"
    elif operation == "duplicate":
        return f"duplicate_{artifact_name}"
    elif operation == "delete":
        return f"delete_{artifact_name}"
    elif operation == "draft":
        return f"patch_{artifact_name}_draft"
    elif operation == "docs":
        # Pluralize only for docs: get_{artifact}s_docs
        plural_name = pluralize_artifact(artifact_name)
        return f"get_{plural_name}_docs"
    
    return None


def discover_artifact_handlers(artifact_name: str) -> dict[str, Any]:
    """Discover handlers for an artifact dynamically.
    
    Args:
        artifact_name: Singular artifact name (e.g., "agent", "persona")
    
    Returns:
        Dictionary mapping operation names to handler functions.
    """
    handlers: dict[str, Any] = {}
    operations = ["get", "save", "list", "duplicate", "delete", "draft", "docs"]
    
    for op in operations:
        func_name = _get_artifact_handler_name(artifact_name, op)
        if func_name is None:
            continue
        
        try:
            module_path = f"app.api.v4.artifacts.{artifact_name}.{op}"
            module = importlib.import_module(module_path)
            
            if hasattr(module, func_name):
                handlers[op] = getattr(module, func_name)
        except (ImportError, AttributeError):
            pass  # Operation not available for this artifact
    
    return handlers


def _get_resource_create_handler_name(resource_name: str) -> str | None:
    """Get the create handler function name for a resource.
    
    Derives function names directly from API path structure.
    Resources use plural names matching directory names.
    
    Args:
        resource_name: Plural resource name (e.g., "agents", "args")
    
    Returns:
        Function name: create_{resource_name} (plural, matches directory)
    """
    # Direct derivation: create_{resource_name} - matches directory name exactly
    return f"create_{resource_name}"


def discover_resource_handlers(resource_name: str) -> dict[str, Any]:
    """Discover handlers for a resource dynamically.
    
    Args:
        resource_name: Plural resource name (e.g., "agents", "args")
    
    Returns:
        Dictionary with "create" and optionally "docs" handlers.
    """
    handlers: dict[str, Any] = {}
    
    # Create handler
    try:
        module = importlib.import_module(f"app.api.v4.resources.{resource_name}.create")
        func_name = _get_resource_create_handler_name(resource_name)
        
        if func_name and hasattr(module, func_name):
            handlers["create"] = getattr(module, func_name)
        else:
            # Fallback: find any function starting with "create_"
            for attr_name in dir(module):
                if attr_name.startswith("create_") and callable(getattr(module, attr_name)):
                    handlers["create"] = getattr(module, attr_name)
                    break
    except ImportError:
        pass
    
    # Docs handler
    try:
        module = importlib.import_module(f"app.api.v4.resources.{resource_name}.docs")
        func_name = f"get_{resource_name}_docs"
        if hasattr(module, func_name):
            handlers["docs"] = getattr(module, func_name)
    except ImportError:
        pass
    
    return handlers

# ============================================================================
# Discovered Data Structures
# ============================================================================

# Discover artifacts and resources dynamically
ARTIFACTS = discover_artifacts()
RESOURCES = discover_resources()

# ============================================================================
# Legacy Description Dictionaries (DEPRECATED - use get_artifact_description/get_resource_description instead)
# ============================================================================

# These dictionaries have been removed. Descriptions are now derived dynamically
# from docs.py files or handler docstrings via get_artifact_description() and get_resource_description().

# Combined list
ALL_ITEMS = ARTIFACTS + RESOURCES

# Helper function to route save operations to create or update based on ID presence
# Only used for scenarios and profile which don't have unified save.py yet
def create_save_handler(create_func: Any, update_func: Any, id_field_name: str) -> Any:
    """Create a unified save handler that routes to create or update based on ID.
    
    Args:
        create_func: Function to call for create operations
        update_func: Function to call for update operations
        id_field_name: Name of the ID field to check (e.g., "scenario_id", "profile_id")
    """
    async def save_handler(request: Any, http_request: Any, response: Any, conn: Any) -> Any:
        # Check if ID field exists and is not None
        request_dict = request.model_dump() if hasattr(request, "model_dump") else dict(request)
        has_id = request_dict.get(id_field_name) is not None
        
        if has_id:
            return await update_func(request, http_request, response, conn)
        else:
            return await create_func(request, http_request, response, conn)
    
    return save_handler


# ============================================================================
# Discover Artifact Handlers Dynamically
# ============================================================================

# Discover handlers for all artifacts
HANDLERS: dict[str, dict[str, Any]] = {}
for artifact in ARTIFACTS:
    HANDLERS[artifact] = discover_artifact_handlers(artifact)



# Analytics handlers
try:
    from app.api.v4.analytics.activity.get import \
        get_activity_bundle  # type: ignore[attr-defined]
    from app.api.v4.analytics.activity.list import \
        get_activity_list  # type: ignore[attr-defined]
    from app.api.v4.analytics.benchmark.get import \
        get_benchmark_overview  # type: ignore[attr-defined]
    from app.api.v4.analytics.dashboard.get import \
        get_dashboard  # type: ignore[attr-defined]
    from app.api.v4.analytics.health.get import \
        get_health  # type: ignore[attr-defined]
    from app.api.v4.analytics.home.get import \
        get_home_overview  # type: ignore[attr-defined]
    from app.api.v4.analytics.leaderboard.get import \
        get_leaderboard  # type: ignore[attr-defined]
    from app.api.v4.analytics.practice.get import \
        get_practice_overview  # type: ignore[attr-defined]
    from app.api.v4.analytics.pricing.get import \
        get_pricing  # type: ignore[attr-defined]
    from app.api.v4.analytics.reports.get import \
        get_reports  # type: ignore[attr-defined] # Single profile report (merged overview + history)
    from app.api.v4.analytics.reports.list import \
        get_reports as \
        get_reports_list  # type: ignore[attr-defined] # List for multiple profiles

    ANALYTICS_HANDLERS = {
        "home": get_home_overview,
        "dashboard": get_dashboard,
        "practice": get_practice_overview,
        "leaderboard": get_leaderboard,
        "reports": get_reports_list,  # List for multiple profiles
        "report": get_reports,  # Single profile report (merged overview + history)
        "activity": get_activity_bundle,
        "pricing": get_pricing,
        "health": get_health,
        "benchmark": get_benchmark_overview,
    }
except ImportError:
    ANALYTICS_HANDLERS = {}

# Groups handlers
try:
    from app.api.v4.analytics.pricing.list import \
        get_pricing_list  # type: ignore[attr-defined]
    from app.api.v4.artifacts.group import \
        get_group  # type: ignore[attr-defined]

    GROUPS_HANDLERS = {
        "list": get_pricing_list,
        "get": get_group,
    }
except ImportError:
    GROUPS_HANDLERS = {}

# Attempts handlers
try:
    from app.api.v4.analytics.benchmark.list import \
        get_benchmark_history  # type: ignore[attr-defined]
    from app.api.v4.analytics.dashboard.list import \
        get_dashboard_history  # type: ignore[attr-defined]
    from app.api.v4.analytics.home.list import \
        get_home_history  # type: ignore[attr-defined]
    from app.api.v4.analytics.practice.list import \
        get_practice_history  # type: ignore[attr-defined]
    from app.api.v4.attempts.benchmark.archive import \
        bulk_archive_attempts as \
        bulk_archive_benchmark_attempts  # type: ignore[attr-defined]
    from app.api.v4.attempts.benchmark.get import \
        get_eval_attempt_full  # type: ignore[attr-defined]
    from app.api.v4.attempts.simulation.archive import \
        bulk_archive_attempts as \
        bulk_archive_simulation_attempts  # type: ignore[attr-defined]
    from app.api.v4.attempts.simulation.get import \
        get_attempt_full  # type: ignore[attr-defined]

    ATTEMPTS_HANDLERS = {
        "list_home": get_home_history,
        "list_dashboard": get_dashboard_history,
        "list_practice": get_practice_history,
        "list_benchmark": get_benchmark_history,
        "get_simulation": get_attempt_full,
        "get_eval": get_eval_attempt_full,
        "archive_simulation": bulk_archive_simulation_attempts,
        "archive_benchmark": bulk_archive_benchmark_attempts,
    }
except ImportError:
    ATTEMPTS_HANDLERS = {}



# ============================================================================
# Discover Resource Handlers Dynamically
# ============================================================================

# Discover handlers for all resources
RESOURCE_HANDLERS: dict[str, Any] = {}
RESOURCE_DOCS_HANDLERS: dict[str, Any] = {}

for resource in RESOURCES:
    resource_handlers = discover_resource_handlers(resource)
    if "create" in resource_handlers:
        RESOURCE_HANDLERS[resource] = resource_handlers["create"]
    if "docs" in resource_handlers:
        RESOURCE_DOCS_HANDLERS[resource] = resource_handlers["docs"]


# ============================================================================
# Discover Artifact Docs (for backward compatibility)
# ============================================================================

# Extract docs handlers from HANDLERS dictionary
ARTIFACT_DOCS: dict[str, Any] = {}
for artifact in ARTIFACTS:
    if "docs" in HANDLERS[artifact]:
        ARTIFACT_DOCS[artifact] = HANDLERS[artifact]["docs"]

# ============================================================================
# Description Derivation Functions
# ============================================================================

def get_artifact_description(artifact_name: str) -> str:
    """Get artifact description from handler docstring.
    
    This is used for the artifacts() list endpoint which shows short descriptions.
    For comprehensive documentation, use docs_artifact() which uses docs.py files.
    
    Args:
        artifact_name: Singular artifact name (e.g., "agent", "persona")
    
    Returns:
        Description string, or fallback if not available.
    """
    # Use handler docstring (get handler)
    if artifact_name in HANDLERS and "get" in HANDLERS[artifact_name]:
        handler = HANDLERS[artifact_name]["get"]
        if handler and handler.__doc__:
            # Extract first sentence
            first_sentence = handler.__doc__.split('.')[0].strip()
            return first_sentence
    
    # Generic fallback
    return f"{artifact_name.title()} artifact"


def get_resource_description(resource_name: str) -> str:
    """Get resource description from handler docstring.
    
    This is used for the resources() list endpoint which shows short descriptions.
    For comprehensive documentation, use docs_resource() which uses docs.py files.
    
    Args:
        resource_name: Plural resource name (e.g., "agents", "args")
    
    Returns:
        Description string, or fallback if not available.
    """
    # Use handler docstring (create handler)
    if resource_name in RESOURCE_HANDLERS:
        handler = RESOURCE_HANDLERS[resource_name]
        if handler and handler.__doc__:
            first_sentence = handler.__doc__.split('.')[0].strip()
            return first_sentence
    
    # Generic fallback
    return f"{resource_name.title()} resource"


# Import root GLOW documentation
try:
    from app.api.v4.docs import get_glow_docs as _get_glow_docs

    def get_glow_docs() -> dict[str, Any]:
        """Wrapper for root GLOW docs."""
        return _get_glow_docs()
except ImportError:

    def get_glow_docs() -> dict[str, Any]:
        """Fallback when root docs not available."""
        return {"error": "Root GLOW documentation not available."}


# Mapping from singular artifact names (MCP/database) to plural API endpoint names
# This allows MCP to use singular names matching the database while API uses plural
ARTIFACT_TO_API_NAME: dict[str, str] = {
    "persona": "personas",
    "scenario": "scenarios",
    "simulation": "simulations",
    "document": "documents",
    "department": "departments",
    "cohort": "cohorts",
    "eval": "evals",
    "rubric": "rubrics",
    "setting": "settings",
    "agent": "agents",
    "model": "models",
    "provider": "providers",
    "parameter": "parameters",
    "field": "fields",
    "profile": "profile",  # Already singular in API
    "auth": "auth",  # Already singular in API
    "tool": "tools",
}

# HANDLERS is already populated by dynamic discovery above
# No need for manual mapping - it's already done in the discovery loop


def is_artifact(name: str) -> bool:
    """Check if name is an artifact."""
    return name in ARTIFACTS


def is_resource(name: str) -> bool:
    """Check if name is a resource."""
    return name in RESOURCES


def get_available_operations(name: str) -> list[str]:
    """Get list of available operations for an item."""
    if name not in HANDLERS:
        return []
    return list(HANDLERS[name].keys())


def get_payload_schema(name: str) -> dict[str, Any]:
    """Get payload schema for artifact/resource operations."""
    if name not in ALL_ITEMS:
        return {"error": f"'{name}' is not a valid artifact or resource."}

    # Try to get schema from handler if available
    if name in HANDLERS and "get" in HANDLERS[name]:
        try:
            handler = HANDLERS[name]["get"]
            # Try to get request model from handler
            if hasattr(handler, "__annotations__"):
                annotations = handler.__annotations__
                if "request" in annotations:
                    request_type = annotations["request"]
                    if hasattr(request_type, "model_json_schema"):
                        schema: dict[str, Any] = request_type.model_json_schema()  # type: ignore[assignment]
                        return schema
        except Exception:
            pass

    # Return generic schema
    return {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": f"The {name} identifier"},
            "payload": {
                "type": "object",
                "description": f"Payload for {name} operation",
            },
        },
        "required": ["name"],
    }


async def call_handler(
    name: str, operation: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Call a handler function with the given payload.
    
    profile_id is automatically extracted from MCP request context.
    """
    from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

    # Extract profile_id from MCP context
    profile_id = get_mcp_profile_id()
    
    if name not in HANDLERS:
        available_artifacts = list(HANDLERS.keys())
        return {
            "error": f"'{name}' does not have handlers implemented yet.",
            "status": "not_implemented",
            "available_artifacts": available_artifacts,
            "note": f"Available artifacts: {', '.join(available_artifacts)}",
        }

    if operation not in HANDLERS[name]:
        available_operations = list(HANDLERS[name].keys())
        return {
            "error": f"Operation '{operation}' not available for '{name}'.",
            "status": "not_implemented",
            "available_operations": available_operations,
            "note": f"Available operations for '{name}': {', '.join(available_operations)}",
        }

    handler = HANDLERS[name][operation]
    if handler is None:
        return {
            "error": f"Handler for {name}.{operation} is not implemented yet.",
            "status": "not_implemented",
        }

    # Call the handler using call_endpoint_handler which properly sets up Request/Response/DB context
    return await call_endpoint_handler(handler, payload, profile_id)


def get_request_model_from_handler(handler: Any) -> Any | None:
    """Extract request model from handler function annotations.
    
    Args:
        handler: The handler function
        
    Returns:
        Request model class or None if not found
    """
    try:
        sig = inspect.signature(handler)
        params = list(sig.parameters.values())
        if params and len(params) > 0:
            # First parameter is usually the request model
            first_param = params[0]
            if first_param.annotation != inspect.Parameter.empty:
                return first_param.annotation
    except Exception:
        pass
    
    return None


async def call_endpoint_handler(
    handler: Any,
    payload: dict[str, Any],
    profile_id: str,
) -> dict[str, Any]:
    """Call an endpoint handler with proper Request/Response/DB context.
    
    Args:
        handler: The handler function to call
        payload: The payload dictionary (will be passed as request body)
        profile_id: The profile ID to use
        
    Returns:
        Dictionary with response data or error information
    """
    from app.main import get_db
    from starlette.requests import Request as StarletteRequest
    
    try:
        # Get request model from handler
        request_model = get_request_model_from_handler(handler)
        if not request_model:
            return {
                "error": "Could not determine request model from handler",
                "status": "error",
            }
        
        # Create Request object with proper scope
        scope = {
            "type": "http",
            "method": "POST",
            "path": "/api/v4/mcp",
            "headers": [],
            "query_string": b"",
            "server": ("localhost", 8000),
        }
        http_request = StarletteRequest(scope)
        
        # Set profile_id in request state
        http_request.state.profile_id = profile_id
        http_request.state.mcp = True
        
        # Create Response object
        http_response = Response()
        
        # Get database connection (get_db is an async generator)
        async for conn in get_db():
            # Parse payload into request model
            api_request = request_model(**payload)
            
            # Call handler
            result = await handler(
                request=api_request,
                http_request=http_request,
                response=http_response,
                conn=conn,
            )
            
            # Convert result to dict
            if hasattr(result, "model_dump"):
                result_dict = result.model_dump(mode="json")
                return cast(dict[str, Any], result_dict)
            elif hasattr(result, "dict"):
                result_dict = result.dict()
                return cast(dict[str, Any], result_dict)
            else:
                return cast(dict[str, Any], {"data": result})
        
        # This should never happen (get_db always yields), but satisfy type checker
        return {
            "error": "Database connection not available",
            "status": "error",
        }
                
    except Exception as e:
        return {
            "error": str(e),
            "status": "error",
            "type": type(e).__name__,
        }


def register_endpoints(server: FastMCP) -> None:
    """Register all MCP endpoints."""

    @server.tool()
    def artifacts() -> list[dict[str, str]]:
        """List all available artifacts with descriptions.

        Returns:
            List of dictionaries with 'name' and 'description' keys.
        """
        return [
            {
                "name": artifact,
                "description": get_artifact_description(artifact),
            }
            for artifact in ARTIFACTS
        ]

    @server.tool()
    def resources() -> list[dict[str, str]]:
        """List all available resources with descriptions.

        Returns:
            List of dictionaries with 'name' and 'description' keys.
        """
        return [
            {
                "name": resource,
                "description": get_resource_description(resource),
            }
            for resource in RESOURCES
        ]

    @server.tool()
    def docs_artifact(name: str) -> dict[str, Any]:
        """Get comprehensive documentation for an artifact.

        Args:
            name: The name of the artifact to get documentation for.

        Returns:
            Dictionary containing database schema, relationships, API routing,
            resources, frontend information, and GLOW context.
        """
        if name not in ARTIFACTS:
            return {"error": f"'{name}' is not a valid artifact."}

        # Use docs handler from HANDLERS if available
        if name in HANDLERS and "docs" in HANDLERS[name] and HANDLERS[name]["docs"]:
            docs_handler = HANDLERS[name]["docs"]
            result = docs_handler()
            return cast(dict[str, Any], result)

        return {
            "error": f"Documentation not available for '{name}'",
            "note": "Documentation may not be implemented yet. Check if docs.py exists for this artifact.",
        }

    @server.tool()
    def docs_resource(name: str) -> dict[str, Any]:
        """Get comprehensive documentation for a resource.

        Args:
            name: The name of the resource to get documentation for.

        Returns:
            Dictionary containing database schema, relationships, API routing,
            and GLOW context.
        """
        if name not in RESOURCES:
            return {"error": f"'{name}' is not a valid resource."}

        if name not in RESOURCE_DOCS_HANDLERS:
            return {
                "error": f"Documentation not available for '{name}'",
                "note": "Documentation may not be implemented yet. Check if docs.py exists for this resource.",
            }

        docs_handler = RESOURCE_DOCS_HANDLERS[name]
        result = docs_handler()
        return cast(dict[str, Any], result)

    @server.tool()
    def docs() -> dict[str, Any]:
        """Get general GLOW documentation.

        Returns:
            Dictionary containing general information about GLOW, its architecture,
            concepts, and patterns.
        """
        if get_glow_docs is None:
            return {"error": "Root GLOW documentation not available."}
        return get_glow_docs()

    @server.tool()
    def payload_artifact(name: str) -> dict[str, Any]:  # type: ignore[return]
        """Get payload schema for an artifact.

        Args:
            name: The name of the artifact.

        Returns:
            JSON schema for the payload.
        """
        return get_payload_schema(name)

    @server.tool()
    def payload_resource(name: str) -> dict[str, Any]:  # type: ignore[return]
        """Get payload schema for a resource.

        Args:
            name: The name of the resource.

        Returns:
            JSON schema for the payload.
        """
        return get_payload_schema(name)

    @server.tool()
    async def get_artifact(
        name: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Get an artifact or resource by name.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing parameters for the get operation.

        Returns:
            The artifact/resource data or error message.
        """
        return await call_handler(name, "get", payload)

    @server.tool()
    async def save_artifact(
        name: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Save (create or update) an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing data to save.

        Returns:
            Success response or error message.
        """
        return await call_handler(name, "save", payload)

    @server.tool()
    async def list_artifact(
        name: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """List items for an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing filter parameters.

        Returns:
            List of items or error message.
        """
        return await call_handler(name, "list", payload)

    @server.tool()
    async def duplicate_artifact(
        name: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Duplicate an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing the item to duplicate.

        Returns:
            Duplicated item data or error message.
        """
        return await call_handler(name, "duplicate", payload)

    @server.tool()
    async def delete_artifact(
        name: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Delete an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing the item to delete.

        Returns:
            Success response or error message.
        """
        return await call_handler(name, "delete", payload)

    @server.tool()
    async def draft_artifact(
        name: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Create or patch a draft artifact (autosave).

        Args:
            name: The name of the artifact.
            payload: The payload containing draft data.

        Returns:
            Draft data or error message.
        """
        return await call_handler(name, "draft", payload)

    # Resource-specific endpoints (create only)
    @server.tool()
    async def create_resource(
        name: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Create a resource.

        Args:
            name: The name of the resource.
            payload: The payload containing data to create the resource.

        Returns:
            Success response or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        # Resources are create-only, not full CRUD
        if name not in RESOURCES:
            return {
                "error": f"'{name}' is not a valid resource.",
                "status": "invalid_resource",
            }

        if name not in RESOURCE_HANDLERS:
            return {
                "error": f"Resource '{name}' handler not implemented.",
                "status": "not_implemented",
            }

        handler = RESOURCE_HANDLERS[name]
        return await call_endpoint_handler(handler, payload, profile_id)

    # Analytics endpoints
    @server.tool()
    async def analytics(
        type: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Call analytics endpoint by type.

        Args:
            type: Analytics type (home, dashboard, practice, leaderboard, reports, report, activity, pricing, health, benchmark)
            payload: Request payload

        Returns:
            Analytics data or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        if type not in ANALYTICS_HANDLERS:
            return {
                "error": f"'{type}' is not a valid analytics type.",
                "status": "invalid_type",
                "valid_types": list(ANALYTICS_HANDLERS.keys()),
            }

        handler = ANALYTICS_HANDLERS[type]
        if handler is None:
            return {
                "error": f"Analytics type '{type}' is not implemented yet.",
                "status": "not_implemented",
            }

        return await call_endpoint_handler(handler, payload, profile_id)  # type: ignore[arg-type]

    @server.tool()
    def analytics_payload(type: str) -> dict[str, Any]:
        """Get payload schema for analytics endpoint type.

        Args:
            type: Analytics type (home, dashboard, practice, leaderboard, reports, report, activity, pricing, health, benchmark)

        Returns:
            JSON schema for the payload.
        """
        if type not in ANALYTICS_HANDLERS:
            return {
                "error": f"'{type}' is not a valid analytics type.",
                "status": "invalid_type",
                "valid_types": list(ANALYTICS_HANDLERS.keys()),
            }

        handler = ANALYTICS_HANDLERS[type]
        if handler is None:
            return {
                "error": f"Analytics type '{type}' is not implemented yet.",
                "status": "not_implemented",
            }

        request_model = get_request_model_from_handler(handler)  # type: ignore[arg-type]
        if request_model and hasattr(request_model, "model_json_schema"):
            schema = request_model.model_json_schema()
            return cast(dict[str, Any], schema)

        return {
            "type": "object",
            "properties": {
                "payload": {
                    "type": "object",
                    "description": f"Payload for {type} analytics endpoint",
                }
            },
        }

    # Groups endpoints (pricing)
    @server.tool()
    async def list_groups(
        payload: dict[str, Any]
    ) -> dict[str, Any]:
        """List pricing groups/runs.

        Args:
            payload: Request payload

        Returns:
            List of pricing groups/runs or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        if "list" not in GROUPS_HANDLERS:
            return {
                "error": "list_groups handler not available.",
                "status": "not_implemented",
            }

        handler = GROUPS_HANDLERS["list"]
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def get_group(
        payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Get pricing group detail.

        Args:
            payload: Request payload (must include group_id)

        Returns:
            Pricing group detail or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        if "get" not in GROUPS_HANDLERS:
            return {
                "error": "get_group handler not available.",
                "status": "not_implemented",
            }

        handler = GROUPS_HANDLERS["get"]
        return await call_endpoint_handler(handler, payload, profile_id)

    # Attempts endpoints
    @server.tool()
    async def list_attempts(
        type: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """List attempts by type.

        Args:
            type: Attempt type (home, dashboard, practice, benchmark)
            payload: Request payload

        Returns:
            List of attempts or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        type_map = {
            "home": "list_home",
            "dashboard": "list_dashboard",
            "practice": "list_practice",
            "benchmark": "list_benchmark",
        }

        operation = type_map.get(type)
        if not operation:
            return {
                "error": f"'{type}' is not a valid attempt type.",
                "status": "invalid_type",
                "valid_types": list(type_map.keys()),
            }

        if operation not in ATTEMPTS_HANDLERS:
            return {
                "error": f"list_attempts for type '{type}' is not available.",
                "status": "not_implemented",
            }

        handler = ATTEMPTS_HANDLERS[operation]
        if handler is None:
            return {
                "error": f"list_attempts for type '{type}' is not implemented yet.",
                "status": "not_implemented",
            }

        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def get_attempt(
        type: str, attempt_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Get attempt by type and ID.

        Args:
            type: Attempt type (simulation, eval)
            attempt_id: Attempt ID
            payload: Request payload (will include attempt_id)

        Returns:
            Attempt data or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        type_map = {
            "simulation": "get_simulation",
            "eval": "get_eval",
        }

        operation = type_map.get(type)
        if not operation:
            return {
                "error": f"'{type}' is not a valid attempt type.",
                "status": "invalid_type",
                "valid_types": list(type_map.keys()),
            }

        if operation not in ATTEMPTS_HANDLERS:
            return {
                "error": f"get_attempt for type '{type}' is not available.",
                "status": "not_implemented",
            }

        handler = ATTEMPTS_HANDLERS[operation]

        # Add attempt_id to payload
        payload_with_id = {**payload, "attempt_id": attempt_id}
        return await call_endpoint_handler(handler, payload_with_id, profile_id)

    @server.tool()
    async def archive_attempts(
        type: str,
        archive: bool,
        ids: list[str],
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Archive or unarchive attempts.

        Args:
            type: Attempt type (simulation, benchmark, eval)
            archive: True to archive, False to unarchive
            ids: List of attempt IDs
            payload: Additional request payload

        Returns:
            Archive result or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        # Map attempt type to handler operation
        operation = f"archive_{type}"
        if operation not in ATTEMPTS_HANDLERS:
            available_types = [
                t.replace("archive_", "")
                for t in ATTEMPTS_HANDLERS.keys()
                if t.startswith("archive_")
            ]
            return {
                "error": f"archive_attempts for type '{type}' is not implemented yet.",
                "status": "not_implemented",
                "available_types": available_types,
                "note": f"Available types: {', '.join(available_types)}",
            }

        handler = ATTEMPTS_HANDLERS[operation]

        # Add archive parameters to payload
        payload_with_params = {
            **payload,
            "attempt_ids": ids,
            "archived": archive,
        }
        return await call_endpoint_handler(handler, payload_with_params, profile_id)


    # Debug/Report Problem endpoint
    @server.tool()
    async def debug(
        type: str, message: str
    ) -> dict[str, Any]:
        """Report a problem or provide feedback (debug tool).

        Args:
            type: Problem type (feature, bug, question, other)
            message: Problem description or feedback message (max 1000 characters)

        Returns:
            Feedback creation result or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        # Import debug handler directly
        from app.api.v4.debug import \
            create_feedback  # type: ignore[import-untyped]

        # Validate type
        valid_types = ["feature", "bug", "question", "other"]
        if type not in valid_types:
            return {
                "error": f"Invalid feedback type: '{type}'",
                "status": "invalid_type",
                "valid_types": valid_types,
            }

        # Validate message
        if not message or not message.strip():
            return {
                "error": "Message is required",
                "status": "validation_error",
            }

        if len(message) > 1000:
            return {
                "error": "Message must be less than 1000 characters",
                "status": "validation_error",
            }

        # Create payload for debug endpoint
        payload = {
            "type": type,
            "message": message.strip(),
        }

        return await call_endpoint_handler(create_feedback, payload, profile_id)

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


def _get_analytics_handler_name(analytics_type: str, operation: str) -> str | None:
    """Get the handler function name for an analytics operation.
    
    Args:
        analytics_type: Analytics type (e.g., "home", "dashboard")
        operation: Operation name (e.g., "get", "list")
    
    Returns:
        Function name or None if operation not applicable.
    """
    if operation == "get":
        # Pattern: get_{type}_overview, get_{type}, get_{type}_bundle, etc.
        # Try common patterns
        patterns = [
            f"get_{analytics_type}_overview",
            f"get_{analytics_type}",
            f"get_{analytics_type}_bundle",
        ]
        return patterns[0]  # Return first pattern, will try to import
    elif operation == "list":
        # Pattern: get_{type}_history, get_{type}_list, etc.
        patterns = [
            f"get_{analytics_type}_history",
            f"get_{analytics_type}_list",
        ]
        return patterns[0]
    elif operation == "refresh" and analytics_type == "refresh":
        return "refresh_analytics"
    
    return None


def discover_analytics_handlers() -> dict[tuple[str, str], Any]:
    """Discover all analytics handlers by scanning analytics directory.
    
    Returns:
        Dictionary mapping (type, operation) tuples to handler functions.
    """
    analytics_dir = Path(__file__).parent.parent / "api" / "v4" / "analytics"
    handlers: dict[tuple[str, str], Any] = {}
    
    if not analytics_dir.exists():
        return handlers
    
    # Handle refresh.py separately (it's at the root level)
    refresh_path = analytics_dir / "refresh.py"
    if refresh_path.exists():
        try:
            module = importlib.import_module("app.api.v4.analytics.refresh")
            func_name = _get_analytics_handler_name("refresh", "refresh")
            if func_name and hasattr(module, func_name):
                handlers[("refresh", "refresh")] = getattr(module, func_name)
        except (ImportError, AttributeError):
            pass
    
    # Scan subdirectories for type/operation pairs
    for item in sorted(analytics_dir.iterdir()):
        if item.is_dir() and not item.name.startswith("_"):
            analytics_type = item.name
            
            # Check for get.py
            get_path = item / "get.py"
            if get_path.exists():
                try:
                    module = importlib.import_module(f"app.api.v4.analytics.{analytics_type}.get")
                    func_name = _get_analytics_handler_name(analytics_type, "get")
                    if func_name:
                        # Try the primary pattern first
                        if hasattr(module, func_name):
                            handlers[(analytics_type, "get")] = getattr(module, func_name)
                        else:
                            # Fallback: find any function starting with "get_"
                            for attr_name in dir(module):
                                if attr_name.startswith("get_") and callable(getattr(module, attr_name)):
                                    handlers[(analytics_type, "get")] = getattr(module, attr_name)
                                    break
                except (ImportError, AttributeError):
                    pass
            
            # Check for list.py
            list_path = item / "list.py"
            if list_path.exists():
                try:
                    module = importlib.import_module(f"app.api.v4.analytics.{analytics_type}.list")
                    func_name = _get_analytics_handler_name(analytics_type, "list")
                    if func_name:
                        # Try the primary pattern first
                        if hasattr(module, func_name):
                            handlers[(analytics_type, "list")] = getattr(module, func_name)
                        else:
                            # Fallback: find any function starting with "get_" (list endpoints also use get_ prefix)
                            for attr_name in dir(module):
                                if attr_name.startswith("get_") and callable(getattr(module, attr_name)):
                                    handlers[(analytics_type, "list")] = getattr(module, attr_name)
                                    break
                except (ImportError, AttributeError):
                    pass
    
    return handlers


def _get_attempts_handler_name(attempt_type: str, operation: str) -> str | None:
    """Get the handler function name for an attempts operation.
    
    Args:
        attempt_type: Attempt type (e.g., "simulation", "benchmark")
        operation: Operation name (e.g., "get", "archive")
    
    Returns:
        Function name or None if operation not applicable.
    """
    if operation == "get":
        return f"get_{attempt_type}_attempt"
    elif operation == "archive":
        return f"archive_{attempt_type}_attempts"
    
    return None


def discover_attempts_handlers() -> dict[tuple[str, str], Any]:
    """Discover all attempts handlers by scanning attempts directory.
    
    Returns:
        Dictionary mapping (type, operation) tuples to handler functions.
    """
    attempts_dir = Path(__file__).parent.parent / "api" / "v4" / "attempts"
    handlers: dict[tuple[str, str], Any] = {}
    
    if not attempts_dir.exists():
        return handlers
    
    # Scan subdirectories for type/operation pairs
    for item in sorted(attempts_dir.iterdir()):
        if item.is_dir() and not item.name.startswith("_"):
            attempt_type = item.name
            
            # Check for get.py
            get_path = item / "get.py"
            if get_path.exists():
                try:
                    module = importlib.import_module(f"app.api.v4.attempts.{attempt_type}.get")
                    func_name = _get_attempts_handler_name(attempt_type, "get")
                    if func_name and hasattr(module, func_name):
                        handlers[(attempt_type, "get")] = getattr(module, func_name)
                except (ImportError, AttributeError):
                    pass
            
            # Check for archive.py
            archive_path = item / "archive.py"
            if archive_path.exists():
                try:
                    module = importlib.import_module(f"app.api.v4.attempts.{attempt_type}.archive")
                    func_name = _get_attempts_handler_name(attempt_type, "archive")
                    if func_name and hasattr(module, func_name):
                        handlers[(attempt_type, "archive")] = getattr(module, func_name)
                except (ImportError, AttributeError):
                    pass
    
    return handlers


def _get_bulk_handler_name(bulk_type: str, operation: str) -> str | None:
    """Get the handler function name for a bulk operation.
    
    Args:
        bulk_type: Bulk type (e.g., "document", "staff")
        operation: Operation name (e.g., "process", "search", "save", "delete")
    
    Returns:
        Function name: {operation}_{type}
    """
    return f"{operation}_{bulk_type}"


def discover_bulk_handlers() -> dict[tuple[str, str], Any]:
    """Discover all bulk handlers by scanning bulk directory.
    
    Returns:
        Dictionary mapping (type, operation) tuples to handler functions.
    """
    bulk_dir = Path(__file__).parent.parent / "api" / "v4" / "bulk"
    handlers: dict[tuple[str, str], Any] = {}
    
    if not bulk_dir.exists():
        return handlers
    
    # Scan subdirectories for type/operation pairs
    for item in sorted(bulk_dir.iterdir()):
        if item.is_dir() and not item.name.startswith("_"):
            bulk_type = item.name
            
            # Check for operation files
            for op_file in sorted(item.iterdir()):
                if op_file.is_file() and op_file.suffix == ".py" and not op_file.name.startswith("_"):
                    operation = op_file.stem
                    if operation == "__init__":
                        continue
                    
                    try:
                        module = importlib.import_module(f"app.api.v4.bulk.{bulk_type}.{operation}")
                        func_name = _get_bulk_handler_name(bulk_type, operation)
                        if func_name and hasattr(module, func_name):
                            handlers[(bulk_type, operation)] = getattr(module, func_name)
                    except (ImportError, AttributeError):
                        pass
    
    return handlers


def _get_export_handler_name(export_type: str) -> str | None:
    """Get the handler function name for an export operation.
    
    Args:
        export_type: Export type (e.g., "certificate", "report")
    
    Returns:
        Function name: export_{type}
    """
    return f"export_{export_type}"


def discover_export_handlers() -> dict[str, Any]:
    """Discover all export handlers by scanning export directory.
    
    Returns:
        Dictionary mapping type to handler functions.
    """
    export_dir = Path(__file__).parent.parent / "api" / "v4" / "export"
    handlers: dict[str, Any] = {}
    
    if not export_dir.exists():
        return handlers
    
    # Scan for type files
    for item in sorted(export_dir.iterdir()):
        if item.is_file() and item.suffix == ".py" and not item.name.startswith("_"):
            export_type = item.stem
            if export_type == "__init__":
                continue
            
            try:
                module = importlib.import_module(f"app.api.v4.export.{export_type}")
                func_name = _get_export_handler_name(export_type)
                if func_name and hasattr(module, func_name):
                    handlers[export_type] = getattr(module, func_name)
            except (ImportError, AttributeError):
                pass
    
    return handlers


def discover_decrypt_handlers() -> dict[str, Any]:
    """Discover decrypt handler.
    
    Returns:
        Dictionary with "decrypt" key mapping to handler function.
    """
    handlers: dict[str, Any] = {}
    
    try:
        module = importlib.import_module("app.api.v4.decrypt.key")
        if hasattr(module, "decrypt_key"):
            handlers["decrypt"] = getattr(module, "decrypt_key")
    except (ImportError, AttributeError):
        pass
    
    return handlers


def _get_uploads_handler_name(operation: str) -> str | None:
    """Get the handler function name for an uploads operation.
    
    Args:
        operation: Operation name (e.g., "get", "save")
    
    Returns:
        Function name: {operation}_upload
    """
    return f"{operation}_upload"


def discover_uploads_handlers() -> dict[str, Any]:
    """Discover all uploads handlers by scanning uploads directory.
    
    Returns:
        Dictionary mapping operation to handler functions.
    """
    uploads_dir = Path(__file__).parent.parent / "api" / "v4" / "uploads"
    handlers: dict[str, Any] = {}
    
    if not uploads_dir.exists():
        return handlers
    
    # Scan for operation files
    for item in sorted(uploads_dir.iterdir()):
        if item.is_file() and item.suffix == ".py" and not item.name.startswith("_"):
            operation = item.stem
            if operation == "__init__":
                continue
            
            try:
                module = importlib.import_module(f"app.api.v4.uploads.{operation}")
                func_name = _get_uploads_handler_name(operation)
                if func_name and hasattr(module, func_name):
                    handlers[operation] = getattr(module, func_name)
            except (ImportError, AttributeError):
                pass
    
    return handlers


def discover_debug_handlers() -> dict[str, Any]:
    """Discover debug handler.
    
    Returns:
        Dictionary with "debug" key mapping to handler function.
    """
    handlers: dict[str, Any] = {}
    
    try:
        module = importlib.import_module("app.api.v4.debug")
        # Try create_feedback first (current name), fallback to debug
        if hasattr(module, "create_feedback"):
            handlers["debug"] = getattr(module, "create_feedback")
        elif hasattr(module, "debug"):
            handlers["debug"] = getattr(module, "debug")
    except (ImportError, AttributeError):
        pass
    
    return handlers


def discover_groups_handlers() -> dict[str, Any]:
    """Discover groups handler from artifacts/group.py.
    
    Returns:
        Dictionary with "get" key mapping to handler function.
    """
    handlers: dict[str, Any] = {}
    
    try:
        module = importlib.import_module("app.api.v4.artifacts.group")
        if hasattr(module, "get_group"):
            handlers["get"] = getattr(module, "get_group")
    except (ImportError, AttributeError):
        pass
    
    return handlers


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



# Analytics handlers - dynamically discovered
ANALYTICS_HANDLERS: dict[tuple[str, str], Any] = discover_analytics_handlers()

# Groups handlers - dynamically discovered
GROUPS_HANDLERS: dict[str, Any] = discover_groups_handlers()

# Attempts handlers - dynamically discovered
ATTEMPTS_HANDLERS: dict[tuple[str, str], Any] = discover_attempts_handlers()

# Bulk handlers - dynamically discovered
BULK_HANDLERS: dict[tuple[str, str], Any] = discover_bulk_handlers()

# Export handlers - dynamically discovered
EXPORT_HANDLERS: dict[str, Any] = discover_export_handlers()

# Decrypt handlers - dynamically discovered
DECRYPT_HANDLERS: dict[str, Any] = discover_decrypt_handlers()

# Uploads handlers - dynamically discovered
UPLOADS_HANDLERS: dict[str, Any] = discover_uploads_handlers()

# Debug handlers - dynamically discovered
DEBUG_HANDLERS: dict[str, Any] = discover_debug_handlers()



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
        type: str, operation: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Call analytics endpoint by type and operation.

        Args:
            type: Analytics type (home, dashboard, practice, leaderboard, reports, activity, pricing, health, benchmark, refresh)
            operation: Operation (get, list, refresh)
            payload: Request payload

        Returns:
            Analytics data or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        key = (type, operation)
        if key not in ANALYTICS_HANDLERS:
            valid_keys = list(ANALYTICS_HANDLERS.keys())
            return {
                "error": f"'{type}' with operation '{operation}' is not a valid analytics endpoint.",
                "status": "invalid_type_operation",
                "valid_combinations": [f"{t}/{op}" for t, op in valid_keys],
            }

        handler = ANALYTICS_HANDLERS[key]
        if handler is None:
            return {
                "error": f"Analytics endpoint '{type}/{operation}' is not implemented yet.",
                "status": "not_implemented",
            }

        return await call_endpoint_handler(handler, payload, profile_id)  # type: ignore[arg-type]

    @server.tool()
    def analytics_payload(type: str, operation: str) -> dict[str, Any]:
        """Get payload schema for analytics endpoint type and operation.

        Args:
            type: Analytics type (home, dashboard, practice, leaderboard, reports, activity, pricing, health, benchmark, refresh)
            operation: Operation (get, list, refresh)

        Returns:
            JSON schema for the payload.
        """
        key = (type, operation)
        if key not in ANALYTICS_HANDLERS:
            valid_keys = list(ANALYTICS_HANDLERS.keys())
            return {
                "error": f"'{type}' with operation '{operation}' is not a valid analytics endpoint.",
                "status": "invalid_type_operation",
                "valid_combinations": [f"{t}/{op}" for t, op in valid_keys],
            }

        handler = ANALYTICS_HANDLERS[key]
        if handler is None:
            return {
                "error": f"Analytics endpoint '{type}/{operation}' is not implemented yet.",
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
                    "description": f"Payload for {type}/{operation} analytics endpoint",
                }
            },
        }

    # Groups endpoints
    @server.tool()
    async def get_group(
        group_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Get pricing group detail.

        Args:
            group_id: The group ID
            payload: Request payload

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

        # Add group_id to payload
        payload_with_id = {**payload, "group_id": group_id}
        return await call_endpoint_handler(GROUPS_HANDLERS["get"], payload_with_id, profile_id)

    # Attempts endpoints
    @server.tool()
    async def get_attempt(
        type: str, attempt_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Get attempt by type and ID.

        Args:
            type: Attempt type (simulation, benchmark)
            attempt_id: Attempt ID
            payload: Request payload

        Returns:
            Attempt data or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        key = (type, "get")
        if key not in ATTEMPTS_HANDLERS:
            valid_keys = list(ATTEMPTS_HANDLERS.keys())
            return {
                "error": f"'{type}' is not a valid attempt type for get.",
                "status": "invalid_type",
                "valid_types": [t for t, op in valid_keys if op == "get"],
            }

        handler = ATTEMPTS_HANDLERS[key]
        if handler is None:
            return {
                "error": f"get_attempt for type '{type}' is not implemented yet.",
                "status": "not_implemented",
            }

        # Add attempt_id to payload
        payload_with_id = {**payload, "attempt_id": attempt_id}
        return await call_endpoint_handler(handler, payload_with_id, profile_id)

    @server.tool()
    async def archive_attempt(
        type: str, attempt_ids: list[str], payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Archive or unarchive attempts.

        Args:
            type: Attempt type (simulation, benchmark)
            attempt_ids: List of attempt IDs
            payload: Request payload (must include archived: bool)

        Returns:
            Archive result or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        key = (type, "archive")
        if key not in ATTEMPTS_HANDLERS:
            valid_keys = list(ATTEMPTS_HANDLERS.keys())
            return {
                "error": f"'{type}' is not a valid attempt type for archive.",
                "status": "invalid_type",
                "valid_types": [t for t, op in valid_keys if op == "archive"],
            }

        handler = ATTEMPTS_HANDLERS[key]
        if handler is None:
            return {
                "error": f"archive_attempt for type '{type}' is not implemented yet.",
                "status": "not_implemented",
            }

        # Add attempt_ids to payload
        payload_with_ids = {**payload, "attempt_ids": attempt_ids}
        return await call_endpoint_handler(handler, payload_with_ids, profile_id)


    # Decrypt endpoint
    @server.tool()
    async def decrypt(
        key_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Decrypt encrypted key value.

        Args:
            key_id: The key ID to decrypt
            payload: Request payload

        Returns:
            Decrypted key value or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        if "decrypt" not in DECRYPT_HANDLERS:
            return {
                "error": "decrypt handler not available.",
                "status": "not_implemented",
            }

        # Add key_id to payload
        payload_with_id = {**payload, "key_id": key_id}
        return await call_endpoint_handler(DECRYPT_HANDLERS["decrypt"], payload_with_id, profile_id)

    # Export endpoints
    @server.tool()
    async def export_certificate(
        payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Export certificate.

        Args:
            payload: Request payload

        Returns:
            Certificate content (PDF/text) or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        if "certificate" not in EXPORT_HANDLERS:
            return {
                "error": "export_certificate handler not available.",
                "status": "not_implemented",
            }

        return await call_endpoint_handler(EXPORT_HANDLERS["certificate"], payload, profile_id)

    @server.tool()
    async def export_report(
        payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Export report.

        Args:
            payload: Request payload

        Returns:
            Report content (CSV/ZIP) or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        if "report" not in EXPORT_HANDLERS:
            return {
                "error": "export_report handler not available.",
                "status": "not_implemented",
            }

        return await call_endpoint_handler(EXPORT_HANDLERS["report"], payload, profile_id)

    # Bulk endpoints
    @server.tool()
    async def bulk(
        type: str, operation: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Call bulk operation endpoint by type and operation.

        Args:
            type: Bulk type (document, staff)
            operation: Operation (process, search, save, delete)
            payload: Request payload

        Returns:
            Bulk operation result or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        key = (type, operation)
        if key not in BULK_HANDLERS:
            valid_keys = list(BULK_HANDLERS.keys())
            valid_types = list(set(t for t, op in valid_keys))
            valid_operations = list(set(op for t, op in valid_keys if t == type))
            
            if type not in valid_types:
                return {
                    "error": f"'{type}' is not a valid bulk type.",
                    "status": "invalid_type",
                    "valid_types": valid_types,
                }
            else:
                return {
                    "error": f"'{operation}' is not a valid operation for {type} bulk operations.",
                    "status": "invalid_operation",
                    "valid_operations": valid_operations,
                }
        
        handler = BULK_HANDLERS[key]
        if handler is None:
            return {
                "error": f"bulk handler for type '{type}' operation '{operation}' is not implemented yet.",
                "status": "not_implemented",
            }

        return await call_endpoint_handler(handler, payload, profile_id)

    # Upload endpoints
    @server.tool()
    async def upload(
        payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Upload a file (base64 content).

        Args:
            payload: Request payload containing:
                - content: base64 string (required)
                - filename: string (required)
                - content_type: string (optional)
                - subfolder: "audio" | "video" | None (optional)

        Returns:
            Upload result with upload_id or error message.
        """
        import base64
        import json
        import os
        import shutil
        import uuid
        from pathlib import Path

        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        # Validate payload
        if "content" not in payload or "filename" not in payload:
            return {
                "error": "Payload must include 'content' (base64) and 'filename'",
                "status": "validation_error",
            }

        try:
            # Decode base64 content
            content_bytes = base64.b64decode(payload["content"])
            filename = payload["filename"]
            content_type = payload.get("content_type")
            subfolder = payload.get("subfolder")

            # Create upload_id
            upload_id = str(uuid.uuid4())

            # Get upload directories
            from app.main import (AUDIO_FOLDER, TUS_UPLOADS_DIR, UPLOAD_FOLDER,
                                  VIDEO_FOLDER)

            # Create TUS upload directory
            upload_dir = TUS_UPLOADS_DIR / upload_id
            upload_dir.mkdir(parents=True, exist_ok=True)

            # Save metadata
            metadata = {
                "filename": filename,
                "filetype": content_type,
                "subfolder": subfolder,
            }
            with open(upload_dir / "metadata.json", "w") as f:
                json.dump(metadata, f)

            # Save file content
            with open(upload_dir / "file", "wb") as f:
                f.write(content_bytes)

            # Save info
            with open(upload_dir / "info", "w") as f:
                f.write(f"length:{len(content_bytes)}\noffset:{len(content_bytes)}")

            # Finalize upload (move to final location and create DB record)
            if "save" not in UPLOADS_HANDLERS:
                return {
                    "error": "save_upload handler not available.",
                    "status": "not_implemented",
                }
            
            from app.main import get_db
            from starlette.requests import Request as StarletteRequest

            # Create request/response objects for finalize
            scope = {
                "type": "http",
                "method": "POST",
                "path": f"/api/v4/uploads/save/{upload_id}",
                "headers": [],
                "query_string": b"",
                "server": ("localhost", 8000),
            }
            http_request = StarletteRequest(scope)
            http_request.state.profile_id = profile_id
            http_request.state.mcp = True
            http_response = Response()

            # Call finalize
            async for conn in get_db():
                result = await UPLOADS_HANDLERS["save"](upload_id, http_request, http_response, conn)
                if hasattr(result, "model_dump"):
                    result_dict = result.model_dump(mode="json")
                    return cast(dict[str, Any], result_dict)
                return cast(dict[str, Any], {"data": result})

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

    @server.tool()
    async def download(
        upload_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Download an upload file.

        Args:
            upload_id: The upload ID
            payload: Request payload (may include preview: bool for PDF previews)

        Returns:
            File content (base64 encoded for binary files) or error message.
        """
        import base64

        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
        if "get" not in UPLOADS_HANDLERS:
            return {
                "error": "get_upload handler not available.",
                "status": "not_implemented",
            }
        
        try:
            from app.main import get_db
            from starlette.requests import Request as StarletteRequest

            # Create request object
            scope = {
                "type": "http",
                "method": "GET",
                "path": f"/api/v4/uploads/get/{upload_id}",
                "headers": [],
                "query_string": b"",
                "server": ("localhost", 8000),
            }
            http_request = StarletteRequest(scope)
            http_request.state.profile_id = profile_id
            http_request.state.mcp = True

            # Get preview parameter
            preview = payload.get("preview", False)

            # Call download handler
            async for conn in get_db():
                result = await UPLOADS_HANDLERS["get"](upload_id, http_request, conn, preview=preview)
                
                # Handle FileResponse or Response
                if hasattr(result, "body"):
                    # Response object
                    content = result.body
                    if isinstance(content, bytes):
                        # Binary content - encode as base64
                        return {
                            "content": base64.b64encode(content).decode("utf-8"),
                            "content_type": result.headers.get("content-type", "application/octet-stream"),
                            "encoding": "base64",
                        }
                    else:
                        return {
                            "content": content.decode("utf-8") if isinstance(content, bytes) else str(content),
                            "content_type": result.headers.get("content-type", "text/plain"),
                        }
                else:
                    return {
                        "error": "Unexpected response type from download handler",
                        "status": "error",
                    }

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

    # Debug/Report Problem endpoint
    @server.tool()
    async def debug(
        message: str
    ) -> dict[str, Any]:
        """Report a problem or provide feedback (debug tool).

        Args:
            message: Problem description or feedback message (max 1000 characters)

        Returns:
            Feedback creation result or error message.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()
        
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

        if "debug" not in DEBUG_HANDLERS:
            return {
                "error": "debug handler not available.",
                "status": "not_implemented",
            }

        # Create payload for debug endpoint - always use type="bug"
        payload = {
            "type": "bug",
            "message": message.strip(),
        }

        return await call_endpoint_handler(DEBUG_HANDLERS["debug"], payload, profile_id)

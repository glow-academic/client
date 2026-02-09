"""Unified endpoints for artifacts and resources."""

import importlib
import inspect
from pathlib import Path
from typing import Any, cast

from fastapi import Response
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
                    module = importlib.import_module(
                        f"app.api.v4.analytics.{analytics_type}.get"
                    )
                    func_name = _get_analytics_handler_name(analytics_type, "get")
                    if func_name:
                        # Try the primary pattern first
                        if hasattr(module, func_name):
                            handlers[(analytics_type, "get")] = getattr(
                                module, func_name
                            )
                        else:
                            # Fallback: find any function starting with "get_"
                            for attr_name in dir(module):
                                if attr_name.startswith("get_") and callable(
                                    getattr(module, attr_name)
                                ):
                                    handlers[(analytics_type, "get")] = getattr(
                                        module, attr_name
                                    )
                                    break
                except (ImportError, AttributeError):
                    pass

            # Check for list.py
            list_path = item / "list.py"
            if list_path.exists():
                try:
                    module = importlib.import_module(
                        f"app.api.v4.analytics.{analytics_type}.list"
                    )
                    func_name = _get_analytics_handler_name(analytics_type, "list")
                    if func_name:
                        # Try the primary pattern first
                        if hasattr(module, func_name):
                            handlers[(analytics_type, "list")] = getattr(
                                module, func_name
                            )
                        else:
                            # Fallback: find any function starting with "get_" (list endpoints also use get_ prefix)
                            for attr_name in dir(module):
                                if attr_name.startswith("get_") and callable(
                                    getattr(module, attr_name)
                                ):
                                    handlers[(analytics_type, "list")] = getattr(
                                        module, attr_name
                                    )
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
                    module = importlib.import_module(
                        f"app.api.v4.attempts.{attempt_type}.get"
                    )
                    func_name = _get_attempts_handler_name(attempt_type, "get")
                    if func_name and hasattr(module, func_name):
                        handlers[(attempt_type, "get")] = getattr(module, func_name)
                except (ImportError, AttributeError):
                    pass

            # Check for archive.py
            archive_path = item / "archive.py"
            if archive_path.exists():
                try:
                    module = importlib.import_module(
                        f"app.api.v4.attempts.{attempt_type}.archive"
                    )
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
    """Discover all bulk handlers by scanning artifact bulk directories.

    Returns:
        Dictionary mapping (type, operation) tuples to handler functions.
    """
    handlers: dict[tuple[str, str], Any] = {}

    # Map bulk types to their new artifact locations
    bulk_locations = {
        "document": "app.api.v4.artifacts.document.bulk",
        "staff": "app.api.v4.artifacts.profile.bulk",
    }

    for bulk_type, module_base in bulk_locations.items():
        for operation in ["process", "search", "save", "delete"]:
            try:
                module = importlib.import_module(f"{module_base}.{operation}")
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
    """Discover export handlers from their new locations.

    Returns:
        Dictionary mapping type to handler functions.
    """
    handlers: dict[str, Any] = {}

    # Report export is now in artifacts/reports/export.py
    try:
        module = importlib.import_module("app.api.v4.artifacts.reports.export")
        if hasattr(module, "export_report"):
            handlers["report"] = module.export_report
    except (ImportError, AttributeError):
        pass

    # Certificate export is in artifacts/attempt/certifficate.py
    try:
        module = importlib.import_module("app.api.v4.artifacts.attempt.certifficate")
        if hasattr(module, "export_certificate"):
            handlers["certificate"] = module.export_certificate
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
        module = importlib.import_module("app.api.v4.resources.keys.decrypt")
        if hasattr(module, "decrypt_key"):
            handlers["decrypt"] = module.decrypt_key
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
    """Discover uploads handlers from their new locations.

    Returns:
        Dictionary mapping operation to handler functions.
    """
    handlers: dict[str, Any] = {}

    # Download (was get) - now in resources/uploads/download.py
    try:
        module = importlib.import_module("app.api.v4.resources.uploads.download")
        if hasattr(module, "get_upload"):
            handlers["get"] = module.get_upload
    except (ImportError, AttributeError):
        pass

    # Upload/finalize (was save) - now in resources/uploads/upload.py
    try:
        module = importlib.import_module("app.api.v4.resources.uploads.upload")
        if hasattr(module, "save_upload"):
            handlers["save"] = module.save_upload
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
        module = importlib.import_module("app.api.v4.artifacts.activity.problem")
        if hasattr(module, "create_problem"):
            handlers["debug"] = module.create_problem
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
            handlers["get"] = module.get_group
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
    if artifact_name.endswith("y"):
        return artifact_name[:-1] + "ies"
    elif artifact_name.endswith(("s", "x", "z", "ch", "sh")):
        return artifact_name + "es"
    else:
        return artifact_name + "s"


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
                if attr_name.startswith("create_") and callable(
                    getattr(module, attr_name)
                ):
                    handlers["create"] = getattr(module, attr_name)
                    break
    except (ImportError, KeyError):
        # KeyError can occur if parent package not in sys.modules yet
        pass

    # Docs handler
    try:
        module = importlib.import_module(f"app.api.v4.resources.{resource_name}.docs")
        func_name = f"get_{resource_name}_docs"
        if hasattr(module, func_name):
            handlers["docs"] = getattr(module, func_name)
    except (ImportError, KeyError):
        # KeyError can occur if parent package not in sys.modules yet
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

    async def save_handler(
        request: Any, http_request: Any, response: Any, conn: Any
    ) -> Any:
        # Check if ID field exists and is not None
        request_dict = (
            request.model_dump() if hasattr(request, "model_dump") else dict(request)
        )
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
        if handler:
            doc = getattr(handler, "__doc__", None)
            if doc and isinstance(doc, str):
                # Extract first sentence
                parts = doc.split(".")
                if parts:
                    first_sentence = parts[0].strip()
                    return str(first_sentence)

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
        if handler:
            doc = getattr(handler, "__doc__", None)
            if doc and isinstance(doc, str):
                # Extract first sentence
                parts = doc.split(".")
                if parts:
                    first_sentence = parts[0].strip()
                    return str(first_sentence)

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


# ============================================================================
# Documentation Helper Functions
# ============================================================================


def get_artifact_operation_description(operation: str) -> str:
    """Generate enhanced description for artifact operations.

    Args:
        operation: Operation name (get, save, list, duplicate, delete, draft)

    Returns:
        Enhanced description string with examples and workflow guidance.
    """
    descriptions = {
        "get": """Get an artifact or resource by name.

Args:
    name: Artifact name (e.g., "agent", "persona", "cohort", "document", "scenario").
          Use singular form: "scenario" not "scenarios".
    payload: Request payload. IMPORTANT: Call payload_artifact(name="{name}", operation="get") first to get exact schema.

Payload Structure:
    Common fields for "get" operations:
    - {artifact}_id: UUID | null (optional, null for new item)
    - draft_id: UUID | null (optional, for draft items)

Example:
    name: "agent"
    payload: {{"agent_id": "123e4567-e89b-12d3-a456-426614174000"}}
    or
    payload: {{"agent_id": null}}  # for new item
    
    name: "scenario"  # singular, not "scenarios"
    payload: {{"scenario_id": "123e4567-e89b-12d3-a456-426614174000"}}

Returns:
    Object containing:
    - id: UUID
    - name: string
    - created_at: timestamp
    - updated_at: timestamp
    - ... artifact-specific fields and related resources

Workflow:
    1. Call payload_artifact(name="agent", operation="get") to get exact payload schema
    2. Construct payload with required fields
    3. Call get_artifact with name and payload""",
        "save": """Save (create or update) an artifact or resource.

Args:
    name: Artifact name (e.g., "agent", "persona", "cohort").
    payload: Request payload. IMPORTANT: Call payload_artifact(name="{name}") first to get exact schema.

Payload Structure:
    Use payload_artifact(name="{name}") to get the exact schema.
    
    For create: omit {artifact}_id or set to null
    For update: include {artifact}_id with UUID

Example:
    name: "agent"
    payload: {{"name": "My Agent", "description": "Agent description", ...}}

Returns:
    Object with saved artifact data including id, timestamps, and all fields.

Workflow:
    1. Call payload_artifact(name="agent") to get exact payload schema
    2. Construct payload with artifact data
    3. Call save_artifact with name and payload""",
        "list": """List items for an artifact or resource.

Args:
    name: Artifact name (e.g., "agent", "persona", "cohort", "scenario"). Use singular form.
    payload: Request payload with filter parameters. Call payload_artifact(name="{name}", operation="list") first to get exact schema.

Payload Structure:
    Common fields for "list" operations:
    - Filters may include department_ids, cohort_ids, search terms, etc.
    - Use payload_artifact(name="{name}", operation="list") to see available filters

Example:
    name: "agent"
    payload: {{}}  # empty for all items
    or
    payload: {{"department_ids": ["123e4567-..."]}}  # filtered

Returns:
    List of artifact objects, each containing id, name, timestamps, and related data.

Workflow:
    1. Call payload_artifact(name="agent", operation="list") to get exact payload schema
    2. Construct payload with filter parameters (or empty for all)
    3. Call list_artifact with name and payload""",
        "duplicate": """Duplicate an artifact or resource.

Args:
    name: Artifact name (e.g., "agent", "persona", "scenario"). Use singular form.
    payload: Request payload. IMPORTANT: Call payload_artifact(name="{name}", operation="duplicate") first to get exact schema.

Payload Structure:
    Typically includes:
    - {artifact}_id: UUID (required, ID of item to duplicate)
    - name: string (optional, new name for duplicated item)

Example:
    name: "agent"
    payload: {{"agent_id": "123e4567-e89b-12d3-a456-426614174000", "name": "Copy of Agent"}}

Returns:
    Object with duplicated artifact data including new id.

Workflow:
    1. Call payload_artifact(name="agent", operation="duplicate") to get exact payload schema
    2. Construct payload with source artifact_id
    3. Call duplicate_artifact with name and payload""",
        "delete": """Delete an artifact or resource.

Args:
    name: Artifact name (e.g., "agent", "persona", "scenario"). Use singular form.
    payload: Request payload. IMPORTANT: Call payload_artifact(name="{name}", operation="delete") first to get exact schema.

Payload Structure:
    Typically includes:
    - {artifact}_id: UUID (required, ID of item to delete)

Example:
    name: "agent"
    payload: {{"agent_id": "123e4567-e89b-12d3-a456-426614174000"}}

Returns:
    Success response or error message.

Workflow:
    1. Call payload_artifact(name="agent", operation="delete") to get exact payload schema
    2. Construct payload with artifact_id to delete
    3. Call delete_artifact with name and payload""",
        "draft": """Create or patch a draft artifact (autosave).

Args:
    name: Artifact name (e.g., "agent", "persona", "scenario"). Use singular form.
    payload: Request payload with draft data. Call payload_artifact(name="{name}", operation="draft") first to get exact schema.

Payload Structure:
    Use payload_artifact(name="{name}", operation="draft") to get the exact schema.
    Draft payloads typically include partial artifact data for autosave.

Example:
    name: "agent"
    payload: {{"name": "Draft Agent", "description": "..."}}

Returns:
    Draft data including draft_id and version information.

Workflow:
    1. Call payload_artifact(name="agent", operation="draft") to get exact payload schema
    2. Construct payload with draft data
    3. Call draft_artifact with name and payload""",
    }

    return descriptions.get(operation, "Standard artifact operation")


def format_example_payload(artifact_name: str, operation: str) -> str:
    """Format example payload for documentation.

    Args:
        artifact_name: Name of the artifact (e.g., "agent", "persona")
        operation: Operation name (get, save, list, etc.)

    Returns:
        Formatted example payload string.
    """
    artifact_id_field = f"{artifact_name}_id"

    examples = {
        "get": f'{{"{artifact_id_field}": "123e4567-e89b-12d3-a456-426614174000"}}',
        "save": f'{{"name": "My {artifact_name.title()}", "description": "...", ...}}',
        "list": "{}",  # empty for all
        "duplicate": f'{{"{artifact_id_field}": "123e4567-e89b-12d3-a456-426614174000", "name": "Copy"}}',
        "delete": f'{{"{artifact_id_field}": "123e4567-e89b-12d3-a456-426614174000"}}',
        "draft": f'{{"name": "Draft {artifact_name.title()}", ...}}',
    }

    return examples.get(operation, "{}")


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


def _suggest_item_name(name: str) -> str | None:
    """Suggest the correct artifact/resource name based on common pluralization mistakes."""
    if name in ALL_ITEMS:
        return None

    plural_to_singular = {pluralize_artifact(a): a for a in ARTIFACTS}
    if name in plural_to_singular:
        return plural_to_singular[name]

    if name.endswith("s") and name[:-1] in ARTIFACTS:
        return name[:-1]

    if f"{name}s" in RESOURCES:
        return f"{name}s"

    return None


def get_payload_schema(name: str, operation: str = "get") -> dict[str, Any]:
    """Get payload schema for artifact/resource operations.

    Args:
        name: Artifact or resource name (e.g., "agent", "scenario", "names")
        operation: Operation name (e.g., "get", "save", "list", "create"). Defaults to "get".

    Note: The 'mcp' field is automatically filtered out as it's auto-injected.
    """
    if name not in ALL_ITEMS:
        suggestion = _suggest_item_name(name)
        response: dict[str, Any] = {
            "error": f"'{name}' is not a valid artifact or resource."
        }
        if suggestion:
            response["suggestion"] = suggestion
        return response

    # Try to get schema from handler if available
    handler: Any | None = None
    if name in RESOURCES and operation == "create":
        handler = RESOURCE_HANDLERS.get(name)
    elif name in HANDLERS and operation in HANDLERS[name]:
        handler = HANDLERS[name][operation]

    if handler:
        try:
            request_type = get_request_model_from_handler(handler)
            if request_type and hasattr(request_type, "model_json_schema"):
                schema: dict[str, Any] = request_type.model_json_schema()  # type: ignore[assignment]
                # Filter out 'mcp' field from schema so agents don't see it
                if "properties" in schema and "mcp" in schema["properties"]:
                    schema = schema.copy()
                    schema["properties"] = schema["properties"].copy()
                    del schema["properties"]["mcp"]
                    # Remove from required list if present
                    if "required" in schema and "mcp" in schema["required"]:
                        schema["required"] = [
                            r for r in schema["required"] if r != "mcp"
                        ]
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
        suggestion = _suggest_item_name(name)
        return {
            "error": f"'{name}' does not have handlers implemented yet.",
            "status": "not_implemented",
            "available_artifacts": available_artifacts,
            "note": f"Available artifacts: {', '.join(available_artifacts)}",
            **({"suggestion": suggestion} if suggestion else {}),
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
    if not handler:
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
    from starlette.requests import Request as StarletteRequest

    from app.main import get_db

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

        # Auto-inject mcp: true if request model has mcp field
        # This ensures agents never need to pass mcp parameter
        if (
            hasattr(request_model, "model_fields")
            and "mcp" in request_model.model_fields
        ):
            payload = {**payload, "mcp": True}

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

        Use this tool to understand the complete structure, relationships, and usage patterns
        for an artifact before working with it.

        Args:
            name: Artifact name (e.g., "agent", "persona", "cohort", "document").

        Returns:
            Dictionary containing:
            - database: Table schema, columns, indexes, foreign keys
            - relationships: Resources, junction tables, related artifacts
            - api_routing: All endpoints (get, save, list, duplicate, delete, draft)
            - resources: Available resource types and their endpoints
            - frontend: Components and pages that use this artifact
            - glow_context: Description, use cases, related concepts

        Example:
            name: "agent"
            Returns comprehensive documentation about agents including database structure,
            API endpoints, available resources (names, descriptions, flags, etc.), and usage patterns.

        Workflow:
            1. Call docs_artifact(name="agent") to understand the artifact structure
            2. Use payload_artifact(name="agent") to get exact payload schemas
            3. Use artifact operations (get_artifact, save_artifact, etc.) to work with data
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

        Use this tool to understand the structure and usage patterns for a resource
        before creating it.

        Args:
            name: Resource name (e.g., "names", "descriptions", "flags", "departments").

        Returns:
            Dictionary containing:
            - database: Table schema, columns, indexes, foreign keys
            - relationships: How resources connect to artifacts
            - api_routing: Create endpoint details
            - glow_context: Description, use cases, related concepts

        Example:
            name: "names"
            Returns documentation about name resources including database structure,
            how they connect to artifacts, and usage patterns.

        Workflow:
            1. Call docs_resource(name="names") to understand the resource structure
            2. Use payload_resource(name="names") to get exact payload schema
            3. Use create_resource(name="names", payload=...) to create resources
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

        Use this tool to understand GLOW's overall architecture, concepts, and patterns.
        This is helpful when starting to work with GLOW or understanding high-level concepts.

        Returns:
            Dictionary containing general information about:
            - GLOW architecture and design principles
            - Core concepts (artifacts, resources, relationships)
            - Common patterns and workflows
            - Best practices

        Example:
            Returns overview of GLOW including:
            - Artifact vs resource distinction
            - Database design principles (BCNF, no nulls)
            - API routing patterns
            - Frontend architecture

        Workflow:
            1. Call docs() for high-level understanding
            2. Call docs_artifact(name="...") for specific artifact details
            3. Use payload_artifact/payload_resource for exact schemas
            4. Use artifact/resource operations to work with data
        """
        if get_glow_docs is None:
            return {"error": "Root GLOW documentation not available."}
        return get_glow_docs()

    @server.tool()
    def payload_artifact(name: str, operation: str = "get") -> dict[str, Any]:  # type: ignore[return]
        """Get payload schema for an artifact.

        IMPORTANT: Call this tool FIRST before using artifact operations (get_artifact, save_artifact, etc.)
        to understand the exact payload structure required.

        Args:
            name: Artifact name (e.g., "agent", "persona", "cohort", "document", "scenario").
            operation: Operation name (e.g., "get", "save", "list", "duplicate", "delete", "draft").
                      Defaults to "get". Use "save" to get schema for save operations.

        Returns:
            JSON schema for the payload showing:
            - Required and optional fields
            - Field types (UUID, string, boolean, etc.)
            - Field descriptions
            - Default values

            Note: The 'mcp' field is automatically filtered out as it's auto-injected.

        Example:
            name: "agent", operation: "get"
            Returns schema with fields like agent_id, draft_id, etc.

            name: "scenario", operation: "save"
            Returns SaveScenarioApiRequest schema with all required fields for saving.

        Workflow:
            1. Call payload_artifact(name="agent", operation="get") to get read schema
            2. Call payload_artifact(name="agent", operation="save") to get save schema
            3. Use the schema to construct payload for get_artifact, save_artifact, etc.
        """
        return get_payload_schema(name, operation)

    @server.tool()
    def payload_resource(name: str, operation: str = "create") -> dict[str, Any]:  # type: ignore[return]
        """Get payload schema for a resource.

        IMPORTANT: Call this tool FIRST before using create_resource to understand
        the exact payload structure required.

        Args:
            name: Resource name (e.g., "names", "descriptions", "flags", "departments").
            operation: Operation name. Defaults to "create" for resources.
                      Most resources only support "create", but some may have other operations.

        Returns:
            JSON schema for the payload showing:
            - Required and optional fields
            - Field types (UUID, string, boolean, etc.)
            - Field descriptions
            - Default values

            Note: The 'mcp' field is automatically filtered out as it's auto-injected.

        Example:
            name: "names", operation: "create"
            Returns schema with fields like agent_id, name, etc.

        Workflow:
            1. Call payload_resource(name="names", operation="create") to get schema
            2. Use the schema to construct payload for create_resource
        """
        return get_payload_schema(name, operation)

    @server.tool()
    async def get_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Get an artifact or resource by name.

        Args:
            name: Artifact name (e.g., "agent", "persona", "cohort", "document").
            payload: Request payload. IMPORTANT: Call payload_artifact(name="{name}") first to get exact schema.

        Payload Structure:
            Common fields for "get" operations:
            - {artifact}_id: UUID | null (optional, null for new item)
            - draft_id: UUID | null (optional, for draft items)

        Example:
            name: "agent"
            payload: {{"agent_id": "123e4567-e89b-12d3-a456-426614174000"}}
            or
            payload: {{"agent_id": null}}  # for new item

        Returns:
            Object containing:
            - id: UUID
            - name: string
            - created_at: timestamp
            - updated_at: timestamp
            - ... artifact-specific fields and related resources

        Workflow:
            1. Call payload_artifact(name="agent") to get exact payload schema
            2. Construct payload with required fields
            3. Call get_artifact with name and payload
        """
        return await call_handler(name, "get", payload)

    @server.tool()
    async def save_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Save (create or update) an artifact or resource.

        Args:
            name: Artifact name (e.g., "agent", "persona", "cohort").
            payload: Request payload. IMPORTANT: Call payload_artifact(name="{name}") first to get exact schema.

        Payload Structure:
            Use payload_artifact(name="{name}") to get the exact schema.

            For create: omit {artifact}_id or set to null
            For update: include {artifact}_id with UUID

        Example:
            name: "agent"
            payload: {{"name": "My Agent", "description": "Agent description", ...}}

        Returns:
            Object with saved artifact data including id, timestamps, and all fields.

        Workflow:
            1. Call payload_artifact(name="agent") to get exact payload schema
            2. Construct payload with artifact data
            3. Call save_artifact with name and payload
        """
        return await call_handler(name, "save", payload)

    @server.tool()
    async def list_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """List items for an artifact or resource.

        Args:
            name: Artifact name (e.g., "agent", "persona", "cohort").
            payload: Request payload with filter parameters. Call payload_artifact(name="{name}") first to get exact schema.

        Payload Structure:
            Common fields for "list" operations:
            - Filters may include department_ids, cohort_ids, search terms, etc.
            - Use payload_artifact(name="{name}") to see available filters

        Example:
            name: "agent"
            payload: {{}}  # empty for all items
            or
            payload: {{"department_ids": ["123e4567-..."]}}  # filtered

        Returns:
            List of artifact objects, each containing id, name, timestamps, and related data.

        Workflow:
            1. Call payload_artifact(name="agent") to get exact payload schema
            2. Construct payload with filter parameters (or empty for all)
            3. Call list_artifact with name and payload
        """
        return await call_handler(name, "list", payload)

    @server.tool()
    async def duplicate_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Duplicate an artifact or resource.

        Args:
            name: Artifact name (e.g., "agent", "persona").
            payload: Request payload. IMPORTANT: Call payload_artifact(name="{name}") first to get exact schema.

        Payload Structure:
            Typically includes:
            - {artifact}_id: UUID (required, ID of item to duplicate)
            - name: string (optional, new name for duplicated item)

        Example:
            name: "agent"
            payload: {{"agent_id": "123e4567-e89b-12d3-a456-426614174000", "name": "Copy of Agent"}}

        Returns:
            Object with duplicated artifact data including new id.

        Workflow:
            1. Call payload_artifact(name="agent") to get exact payload schema
            2. Construct payload with source artifact_id
            3. Call duplicate_artifact with name and payload
        """
        return await call_handler(name, "duplicate", payload)

    @server.tool()
    async def delete_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Delete an artifact or resource.

        Args:
            name: Artifact name (e.g., "agent", "persona").
            payload: Request payload. IMPORTANT: Call payload_artifact(name="{name}") first to get exact schema.

        Payload Structure:
            Typically includes:
            - {artifact}_id: UUID (required, ID of item to delete)

        Example:
            name: "agent"
            payload: {{"agent_id": "123e4567-e89b-12d3-a456-426614174000"}}

        Returns:
            Success response or error message.

        Workflow:
            1. Call payload_artifact(name="agent") to get exact payload schema
            2. Construct payload with artifact_id to delete
            3. Call delete_artifact with name and payload
        """
        return await call_handler(name, "delete", payload)

    @server.tool()
    async def draft_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Create or patch a draft artifact (autosave).

        Args:
            name: Artifact name (e.g., "agent", "persona").
            payload: Request payload with draft data. Call payload_artifact(name="{name}") first to get exact schema.

        Payload Structure:
            Use payload_artifact(name="{name}") to get the exact schema.
            Draft payloads typically include partial artifact data for autosave.

        Example:
            name: "agent"
            payload: {{"name": "Draft Agent", "description": "..."}}

        Returns:
            Draft data including draft_id and version information.

        Workflow:
            1. Call payload_artifact(name="agent") to get exact payload schema
            2. Construct payload with draft data
            3. Call draft_artifact with name and payload
        """
        return await call_handler(name, "draft", payload)

    # Resource-specific endpoints (create only)
    @server.tool()
    async def create_resource(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a resource.

        Args:
            name: Resource name (e.g., "names", "descriptions", "flags").
            payload: Request payload. IMPORTANT: Call payload_resource(name="{name}") first to get exact schema.

        Payload Structure:
            Use payload_resource(name="{name}") to get the exact schema.
            Resources are create-only and typically include:
            - {artifact}_id: UUID (required, ID of parent artifact)
            - Resource-specific fields (name, description, value, etc.)

        Example:
            name: "names"
            payload: {{"agent_id": "123e4567-...", "name": "My Agent Name"}}

        Returns:
            Success response with created resource data including id.

        Workflow:
            1. Call payload_resource(name="names") to get exact payload schema
            2. Construct payload with resource data
            3. Call create_resource with name and payload
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

        IMPORTANT: Call analytics_payload(type="{type}", operation="{operation}") first
        to get the exact payload schema required.

        Args:
            type: Analytics type:
                - "home": Home dashboard analytics
                - "dashboard": Main dashboard analytics
                - "practice": Practice session analytics
                - "leaderboard": Leaderboard data
                - "reports": Report analytics
                - "activity": Activity analytics
                - "pricing": Pricing analytics
                - "health": Health metrics
                - "benchmark": Benchmark analytics
                - "refresh": Refresh analytics cache
            operation: Operation type:
                - "get": Get analytics data
                - "list": List analytics history
                - "refresh": Refresh analytics (only for type="refresh")
            payload: Request payload. Call analytics_payload first to get exact schema.

        Payload Structure:
            Common fields may include:
            - start_date: ISO timestamp (optional)
            - end_date: ISO timestamp (optional)
            - cohort_ids: array of UUIDs (optional)
            - department_ids: array of UUIDs (optional)
            - Use analytics_payload to see exact schema

        Example:
            type: "dashboard"
            operation: "get"
            payload: {{"start_date": "2025-01-01T00:00:00Z", "end_date": "2025-01-31T23:59:59Z"}}

        Returns:
            Analytics data object with metrics, charts, and aggregated data.

        Workflow:
            1. Call analytics_payload(type="dashboard", operation="get") to get schema
            2. Construct payload with filter parameters
            3. Call analytics with type, operation, and payload
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

        IMPORTANT: Call this tool FIRST before using analytics to understand
        the exact payload structure required.

        Args:
            type: Analytics type (home, dashboard, practice, leaderboard, reports, activity, pricing, health, benchmark, refresh).
            operation: Operation (get, list, refresh).

        Returns:
            JSON schema for the payload showing:
            - Required and optional fields
            - Field types and formats
            - Field descriptions
            - Default values

            Note: The 'mcp' field is automatically filtered out as it's auto-injected.

        Example:
            type: "dashboard"
            operation: "get"
            Returns schema with fields like start_date, end_date, cohort_ids, etc.

        Workflow:
            1. Call analytics_payload(type="dashboard", operation="get") to get schema
            2. Use the schema to construct payload for analytics call
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
            # Filter out 'mcp' field from schema so agents don't see it
            if (
                isinstance(schema, dict)
                and "properties" in schema
                and "mcp" in schema["properties"]
            ):
                schema = schema.copy()
                schema["properties"] = schema["properties"].copy()
                del schema["properties"]["mcp"]
                # Remove from required list if present
                if "required" in schema and "mcp" in schema["required"]:
                    schema["required"] = [r for r in schema["required"] if r != "mcp"]
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
    async def get_group(group_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Get pricing group detail.

        Args:
            group_id: UUID string of the pricing group.
            payload: Request payload (typically empty or minimal).

        Example:
            group_id: "123e4567-e89b-12d3-a456-426614174000"
            payload: {{}}

        Returns:
            Object containing pricing group details including:
            - id: UUID
            - name: string
            - pricing information
            - associated data
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
        return await call_endpoint_handler(
            GROUPS_HANDLERS["get"], payload_with_id, profile_id
        )

    # Attempts endpoints
    @server.tool()
    async def get_attempt(
        type: str, attempt_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Get attempt by type and ID.

        Args:
            type: Attempt type:
                - "simulation": Simulation attempt
                - "benchmark": Benchmark attempt
            attempt_id: UUID string of the attempt.
            payload: Request payload (typically empty or minimal).

        Example:
            type: "simulation"
            attempt_id: "123e4567-e89b-12d3-a456-426614174000"
            payload: {{}}

        Returns:
            Object containing attempt data including:
            - id: UUID
            - type: string
            - status: string
            - scores and metrics
            - timestamps
            - related data
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
            type: Attempt type:
                - "simulation": Simulation attempts
                - "benchmark": Benchmark attempts
            attempt_ids: List of UUID strings for attempts to archive/unarchive.
            payload: Request payload must include:
                - archived: boolean (true to archive, false to unarchive)

        Example:
            type: "simulation"
            attempt_ids: ["123e4567-...", "234e5678-..."]
            payload: {{"archived": true}}

        Returns:
            Archive result with success status and affected attempt IDs.

        Workflow:
            1. Get attempt IDs using list_artifact or other methods
            2. Construct payload with archived boolean
            3. Call archive_attempt with type, attempt_ids, and payload
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
    async def decrypt(key_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Decrypt encrypted key value.

        Args:
            key_id: UUID string of the encrypted key to decrypt.
            payload: Request payload (typically empty or minimal).

        Example:
            key_id: "123e4567-e89b-12d3-a456-426614174000"
            payload: {{}}

        Returns:
            Object containing:
            - decrypted_value: string (the decrypted key value)
            - key_id: UUID
            - metadata about the key

        Note: This tool requires appropriate permissions to decrypt keys.
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
        return await call_endpoint_handler(
            DECRYPT_HANDLERS["decrypt"], payload_with_id, profile_id
        )

    # Export endpoints
    @server.tool()
    async def export_certificate(payload: dict[str, Any]) -> dict[str, Any]:
        """Export certificate.

        Args:
            payload: Request payload typically including:
                - certificate_id or similar identifier
                - format preferences (optional)

        Example:
            payload: {{"certificate_id": "123e4567-e89b-12d3-a456-426614174000"}}

        Returns:
            Certificate content:
            - For PDF: base64-encoded PDF content
            - For text: plain text certificate content
            - Includes content_type and encoding information
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()

        if "certificate" not in EXPORT_HANDLERS:
            return {
                "error": "export_certificate handler not available.",
                "status": "not_implemented",
            }

        return await call_endpoint_handler(
            EXPORT_HANDLERS["certificate"], payload, profile_id
        )

    @server.tool()
    async def export_report(payload: dict[str, Any]) -> dict[str, Any]:
        """Export report.

        Args:
            payload: Request payload typically including:
                - report_id or report parameters
                - format: "csv" or "zip" (optional)
                - date ranges, filters, etc.

        Example:
            payload: {{
                "report_id": "123e4567-e89b-12d3-a456-426614174000",
                "format": "csv"
            }}

        Returns:
            Report content:
            - For CSV: CSV file content (base64-encoded or text)
            - For ZIP: ZIP archive content (base64-encoded)
            - Includes content_type and encoding information
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        # Extract profile_id from MCP context
        profile_id = get_mcp_profile_id()

        if "report" not in EXPORT_HANDLERS:
            return {
                "error": "export_report handler not available.",
                "status": "not_implemented",
            }

        return await call_endpoint_handler(
            EXPORT_HANDLERS["report"], payload, profile_id
        )

    # Bulk endpoints
    @server.tool()
    async def bulk(
        type: str, operation: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Call bulk operation endpoint by type and operation.

        Args:
            type: Bulk type:
                - "document": Document bulk operations
                - "staff": Staff bulk operations
            operation: Operation type:
                - "process": Process bulk items
                - "search": Search bulk items
                - "save": Save bulk items
                - "delete": Delete bulk items
            payload: Request payload with operation-specific data.

        Payload Structure:
            Varies by type and operation:
            - For "process": May include file data, processing options
            - For "search": Search criteria and filters
            - For "save": Array of items to save
            - For "delete": Array of IDs to delete

        Example:
            type: "document"
            operation: "process"
            payload: {{"file_data": "...", "options": {{...}}}}

        Returns:
            Bulk operation result with:
            - success: boolean
            - processed_count: number
            - errors: array (if any)
            - results: array of processed items
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
    async def upload(payload: dict[str, Any]) -> dict[str, Any]:
        """Upload a file (base64 content).

        Args:
            payload: Request payload containing:
                - content: base64-encoded string (required) - the file content encoded in base64
                - filename: string (required) - the original filename
                - content_type: string (optional) - MIME type (e.g., "image/png", "application/pdf")
                - subfolder: "audio" | "video" | None (optional) - subfolder for organization

        Example:
            payload: {{
                "content": "iVBORw0KGgoAAAANSUhEUgAA...",  # base64-encoded file
                "filename": "document.pdf",
                "content_type": "application/pdf"
            }}

        Returns:
            Object containing:
            - upload_id: UUID string (use this for download or other operations)
            - filename: string
            - status: string

        Workflow:
            1. Encode file content as base64
            2. Construct payload with content, filename, and optional metadata
            3. Call upload with payload
            4. Use returned upload_id for subsequent operations (download, etc.)
        """
        import base64
        import json
        import uuid

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
            from app.main import (
                TUS_UPLOADS_DIR,
            )

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

            from starlette.requests import Request as StarletteRequest

            from app.main import get_db

            # Create request/response objects for finalize
            scope = {
                "type": "http",
                "method": "POST",
                "path": f"/api/v4/resources/uploads/upload/{upload_id}/finalize",
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
                result = await UPLOADS_HANDLERS["save"](
                    upload_id, http_request, http_response, conn
                )
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
    async def download(upload_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Download an upload file.

        Args:
            upload_id: UUID string of the upload (obtained from upload tool).
            payload: Request payload (optional):
                - preview: boolean (optional, default false) - if true, returns PDF preview for PDF files

        Example:
            upload_id: "123e4567-e89b-12d3-a456-426614174000"
            payload: {{}}  # download full file
            or
            payload: {{"preview": true}}  # get PDF preview

        Returns:
            Object containing:
            - content: string (base64-encoded for binary files, plain text for text files)
            - content_type: string (MIME type)
            - encoding: "base64" (for binary files) or omitted (for text files)

        Workflow:
            1. Get upload_id from upload tool or other source
            2. Call download with upload_id and optional preview flag
            3. Decode base64 content if encoding is "base64"
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
            from starlette.requests import Request as StarletteRequest

            from app.main import get_db

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
                result = await UPLOADS_HANDLERS["get"](
                    upload_id, http_request, conn, preview=preview
                )

                # Handle FileResponse or Response
                if hasattr(result, "body"):
                    # Response object
                    content = result.body
                    if isinstance(content, bytes):
                        # Binary content - encode as base64
                        return {
                            "content": base64.b64encode(content).decode("utf-8"),
                            "content_type": result.headers.get(
                                "content-type", "application/octet-stream"
                            ),
                            "encoding": "base64",
                        }
                    else:
                        return {
                            "content": content.decode("utf-8")
                            if isinstance(content, bytes)
                            else str(content),
                            "content_type": result.headers.get(
                                "content-type", "text/plain"
                            ),
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
    async def debug(message: str) -> dict[str, Any]:
        """Report a problem or provide feedback (debug tool).

        Use this tool to report bugs, provide feedback, or ask questions about the system.
        All feedback is logged and reviewed.

        Args:
            message: Problem description or feedback message (max 1000 characters).
                Include:
                - What you were trying to do
                - What happened (or what you expected)
                - Any error messages
                - Steps to reproduce (if applicable)

        Example:
            message: "When calling get_artifact with agent_id=null, I expected to get a new agent template but got an error instead."

        Returns:
            Object containing:
            - success: boolean
            - feedback_id: UUID (if created)
            - message: confirmation message

        Note: This tool automatically sets type="bug" - use it for reporting issues or providing feedback.
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

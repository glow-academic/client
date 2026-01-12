"""Unified endpoints for artifacts and resources."""

import inspect
from typing import Any, cast

from fastapi import Request, Response
from mcp.server.fastmcp import FastMCP

# Static enumeration of artifacts and resources with descriptions
ARTIFACTS = [
    "personas",
    "scenarios",
    "simulations",
    "documents",
    "departments",
    "cohorts",
    "evals",
    "rubrics",
    "settings",
    "agents",
    "keys",
    "models",
    "providers",
    "parameters",
    "fields",
    "profile",
    "auth",
]

RESOURCES = [
    "names",
    "colors",
    "flags",
    "descriptions",
    "examples",
    "icons",
    "points",
    "thresholds",
    "content",
    "html",
    "hints",
    "images",
    "videos",
    "objectives",
    "options",
    "problem_statements",
    "prompts",
    "questions",
    "responses",
    "analyses",
    "instructions",
    "improvements",
    "strengths",
    "feedbacks",
    "conversations",
    "debug_info",
    "schemas",
    "schema_fields",
    "schema_field_items",
    "templates",
    "template_array_items",
    "template_values",
    "standard_groups",
    "times",
]

# Artifact descriptions (one-sentence)
ARTIFACT_DESCRIPTIONS: dict[str, str] = {
    "personas": "AI characters used in scenarios to represent different roles or perspectives",
    "scenarios": "Practice scenarios that students interact with for learning",
    "simulations": "Interactive simulation sessions for practice and assessment",
    "documents": "Document resources used in scenarios and learning materials",
    "departments": "Organizational departments for grouping users and resources",
    "cohorts": "Student cohorts for organizing groups of learners",
    "evals": "Evaluation configurations for assessing student performance",
    "rubrics": "Grading rubrics for structured assessment criteria",
    "settings": "System settings for configuration and preferences",
    "agents": "AI agents that perform various tasks and operations",
    "keys": "API keys for external service authentication",
    "models": "AI models used for generation and inference",
    "providers": "AI providers that supply models and services",
    "parameters": "Configuration parameters for customizing behavior",
    "fields": "Custom fields for extending artifact schemas",
    "profile": "User profiles containing account and preference information",
    "auth": "Authentication configurations for user access control",
}

# Resource descriptions (one-sentence)
RESOURCE_DESCRIPTIONS: dict[str, str] = {
    "names": "Name resources for various artifacts",
    "colors": "Color resources for UI elements and visual representation",
    "flags": "Boolean flag resources for enabling/disabling features",
    "descriptions": "Description resources providing detailed information",
    "examples": "Example resources demonstrating usage patterns",
    "icons": "Icon resources for UI visual representation",
    "points": "Point resources for scoring and evaluation",
    "thresholds": "Threshold resources for defining limits and boundaries",
    "content": "Content resources containing text or media",
    "html": "HTML content resources for rich text formatting",
    "hints": "Hint resources providing guidance and tips",
    "images": "Image resources for visual content",
    "videos": "Video resources for multimedia content",
    "objectives": "Objective resources defining learning goals",
    "options": "Option resources for choices and selections",
    "problem_statements": "Problem statement resources describing challenges",
    "prompts": "Prompt resources for AI generation inputs",
    "questions": "Question resources for assessments and quizzes",
    "responses": "Response resources for answers and feedback",
    "analyses": "Analysis resources containing evaluation results",
    "instructions": "Instruction resources providing guidance and directions",
    "improvements": "Improvement resources suggesting enhancements",
    "strengths": "Strength resources highlighting positive aspects",
    "feedbacks": "Feedback resources containing evaluation comments",
    "conversations": "Conversation resources for dialogue content",
    "debug_info": "Debug info resources containing diagnostic information",
    "schemas": "Schema resources defining data structures",
    "schema_fields": "Schema field resources for structured data",
    "schema_field_items": "Schema field item resources for nested structures",
    "templates": "Template resources for reusable content patterns",
    "template_array_items": "Template array item resources for list structures",
    "template_values": "Template value resources for variable substitution",
    "standard_groups": "Standard group resources for organizing criteria",
    "times": "Time resources for duration and scheduling",
}

# Combined list
ALL_ITEMS = ARTIFACTS + RESOURCES

# Static imports for persona handlers (only fully implemented artifact)
try:
    from app.api.v4.personas.delete import delete_persona
    from app.api.v4.personas.duplicate import duplicate_persona
    from app.api.v4.personas.get import get_persona
    from app.api.v4.personas.list import get_personas_list
    from app.api.v4.personas.save import save_persona

    PERSONAS_HANDLERS = {
        "get": get_persona,
        "save": save_persona,
        "list": get_personas_list,
        "duplicate": duplicate_persona,
        "delete": delete_persona,
    }
except ImportError:
    PERSONAS_HANDLERS = {}

# Analytics handlers
try:
    from app.api.v4.activity.list import get_activity_list
    from app.api.v4.benchmark.bundle import get_benchmark_bundle
    from app.api.v4.dashboard.bundle import get_dashboard
    from app.api.v4.health.bundle import get_health_bundle
    from app.api.v4.home.overview import get_home_overview
    from app.api.v4.leaderboard.bundle import get_leaderboard
    from app.api.v4.practice.overview import get_practice_overview
    from app.api.v4.pricing.analytics import get_pricing
    from app.api.v4.reports.bundle import \
        get_reports  # Bundle for multiple profiles
    from app.api.v4.reports.overview import \
        get_reports_overview  # Single profile report

    ANALYTICS_HANDLERS = {
        "home": get_home_overview,
        "dashboard": get_dashboard,
        "practice": get_practice_overview,
        "leaderboard": get_leaderboard,
        "reports": get_reports,  # Bundle for multiple profiles
        "report": get_reports_overview,  # Single profile report
        "activity": get_activity_list,
        "pricing": get_pricing,
        "health": get_health_bundle,
        "benchmark": get_benchmark_bundle,
    }
except ImportError:
    ANALYTICS_HANDLERS = {}

# Groups handlers (pricing)
try:
    from app.api.v4.pricing.detail import get_pricing_run_detail
    from app.api.v4.pricing.runs import get_pricing_runs

    GROUPS_HANDLERS = {
        "list": get_pricing_runs,
        "get": get_pricing_run_detail,
    }
except ImportError:
    GROUPS_HANDLERS = {}

# Attempts handlers
try:
    from app.api.v4.attempts.archive import bulk_archive_attempts
    from app.api.v4.attempts.eval import get_eval_attempt_full
    from app.api.v4.attempts.simulation import get_attempt_full
    from app.api.v4.dashboard.history import get_dashboard_history
    from app.api.v4.home.history import get_home_history
    from app.api.v4.practice.history import get_practice_history

    ATTEMPTS_HANDLERS = {
        "list_home": get_home_history,
        "list_dashboard": get_dashboard_history,
        "list_practice": get_practice_history,
        "list_benchmark": None,  # TODO: Will be implemented when benchmark/history endpoint is created
        "get_simulation": get_attempt_full,
        "get_eval": get_eval_attempt_full,
        "archive": bulk_archive_attempts,  # Currently supports simulation only, will support benchmark/eval later
    }
except ImportError:
    ATTEMPTS_HANDLERS = {}

# Settings handlers
try:
    from app.api.v4.settings.list import list_settings
    from app.api.v4.settings.update import update_settings

    SETTINGS_HANDLERS = {
        "get": list_settings,
        "save": update_settings,
    }
except ImportError:
    SETTINGS_HANDLERS = {}

# Feedback handlers (for debug/report problem)
try:
    from app.api.v4.feedback.create import create_feedback

    FEEDBACK_HANDLER: Any = create_feedback
except ImportError:
    FEEDBACK_HANDLER: Any = None

# Import artifact documentation functions
ARTIFACT_DOCS: dict[str, Any] = {}
try:
    from app.api.v4.personas.docs import get_personas_docs

    ARTIFACT_DOCS["personas"] = get_personas_docs
except ImportError:
    pass

# Import root GLOW documentation
try:
    from app.mcp.docs import get_glow_docs as _get_glow_docs

    def get_glow_docs() -> dict[str, Any]:
        """Wrapper for root GLOW docs."""
        return _get_glow_docs()
except ImportError:

    def get_glow_docs() -> dict[str, Any]:
        """Fallback when root docs not available."""
        return {"error": "Root GLOW documentation not available."}


# Handler mapping - maps item name to available operations
HANDLERS: dict[str, dict[str, Any]] = {
    "personas": PERSONAS_HANDLERS,
    # TODO: Add other artifacts as they get implemented
    # "scenarios": {...},
    # Resources will be added similarly when implemented
}


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
    """Call a handler function with the given payload."""
    if name not in HANDLERS:
        return {
            "error": f"TODO: '{name}' does not have handlers implemented yet.",
            "status": "not_implemented",
        }

    if operation not in HANDLERS[name]:
        return {
            "error": f"TODO: Operation '{operation}' not available for '{name}'.",
            "status": "not_implemented",
        }

    handler = HANDLERS[name][operation]

    # TODO: Properly implement handler calling
    # Handlers expect FastAPI Request/Response objects and database connection
    # This requires creating proper mock objects or refactoring handlers
    # For now, return a message indicating the handler exists but needs implementation
    return {
        "message": f"Handler for {name}.{operation} exists but direct calling needs implementation.",
        "status": "handler_exists",
        "note": "Handlers require FastAPI Request/Response objects and database connection. Consider calling via HTTP or refactoring handlers.",
    }


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
                "description": ARTIFACT_DESCRIPTIONS.get(
                    artifact, "No description available"
                ),
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
                "description": RESOURCE_DESCRIPTIONS.get(
                    resource, "No description available"
                ),
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

        if name not in ARTIFACT_DOCS:
            return {
                "error": f"Documentation not available for '{name}'",
                "note": "Documentation may not be implemented yet. Check if docs.py exists for this artifact.",
            }

        result = ARTIFACT_DOCS[name]()
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
    async def get_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Get an artifact or resource by name.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing parameters for the get operation.

        Returns:
            The artifact/resource data or error message.
        """
        return await call_handler(name, "get", payload)

    @server.tool()
    async def save_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Save (create or update) an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing data to save.

        Returns:
            Success response or error message.
        """
        return await call_handler(name, "save", payload)

    @server.tool()
    async def list_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """List items for an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing filter parameters.

        Returns:
            List of items or error message.
        """
        return await call_handler(name, "list", payload)

    @server.tool()
    async def duplicate_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Duplicate an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing the item to duplicate.

        Returns:
            Duplicated item data or error message.
        """
        return await call_handler(name, "duplicate", payload)

    @server.tool()
    async def delete_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Delete an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing the item to delete.

        Returns:
            Success response or error message.
        """
        return await call_handler(name, "delete", payload)

    # Resource-specific endpoints (create only)
    @server.tool()
    async def create_resource(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a resource.

        Args:
            name: The name of the resource.
            payload: The payload containing data to create the resource.

        Returns:
            Success response or error message.
        """
        # Resources are create-only, not full CRUD
        # TODO: Implement actual resource creation handler
        if name not in RESOURCES:
            return {
                "error": f"'{name}' is not a valid resource.",
                "status": "invalid_resource",
            }

        return {
            "message": f"Resource creation for '{name}' needs implementation.",
            "status": "not_implemented",
            "note": "Resources are create-only. Use POST /api/v4/resources/{name} endpoint.",
        }

    # Analytics endpoints
    @server.tool()
    async def analytics(
        type: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Call analytics endpoint by type.

        Args:
            type: Analytics type (home, dashboard, practice, leaderboard, reports, report, activity, pricing, health, benchmark)
            payload: Request payload
            profile_id: Profile ID for authentication

        Returns:
            Analytics data or error message.
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

        return await call_endpoint_handler(handler, payload, profile_id)

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

        request_model = get_request_model_from_handler(handler)
        if request_model and hasattr(request_model, "model_json_schema"):
            return request_model.model_json_schema()

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
        payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """List pricing groups/runs.

        Args:
            payload: Request payload
            profile_id: Profile ID for authentication

        Returns:
            List of pricing groups/runs or error message.
        """
        if "list" not in GROUPS_HANDLERS:
            return {
                "error": "list_groups handler not available.",
                "status": "not_implemented",
            }

        handler = GROUPS_HANDLERS["list"]
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def get_group(
        payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Get pricing group detail.

        Args:
            payload: Request payload (must include group_id)
            profile_id: Profile ID for authentication

        Returns:
            Pricing group detail or error message.
        """
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
        type: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """List attempts by type.

        Args:
            type: Attempt type (home, dashboard, practice, benchmark)
            payload: Request payload
            profile_id: Profile ID for authentication

        Returns:
            List of attempts or error message.
        """
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
                "note": "Benchmark history endpoint will be created in the future.",
            }

        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def get_attempt(
        type: str, attempt_id: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Get attempt by type and ID.

        Args:
            type: Attempt type (simulation, eval)
            attempt_id: Attempt ID
            payload: Request payload (will include attempt_id)
            profile_id: Profile ID for authentication

        Returns:
            Attempt data or error message.
        """
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
        profile_id: str,
    ) -> dict[str, Any]:
        """Archive or unarchive attempts.

        Args:
            type: Attempt type (simulation, benchmark, eval)
            archive: True to archive, False to unarchive
            ids: List of attempt IDs
            payload: Additional request payload
            profile_id: Profile ID for authentication

        Returns:
            Archive result or error message.
        """
        # Currently only simulation is supported
        if type != "simulation":
            return {
                "error": f"archive_attempts for type '{type}' is not implemented yet.",
                "status": "not_implemented",
                "note": "Will support benchmark and eval types in the future.",
            }

        if "archive" not in ATTEMPTS_HANDLERS:
            return {
                "error": "archive_attempts handler not available.",
                "status": "not_implemented",
            }

        handler = ATTEMPTS_HANDLERS["archive"]

        # Add archive parameters to payload
        payload_with_params = {
            **payload,
            "attempt_ids": ids,
            "archived": archive,
        }
        return await call_endpoint_handler(handler, payload_with_params, profile_id)

    # Settings endpoints
    @server.tool()
    async def get_settings(
        payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Get settings list or detail.

        Args:
            payload: Request payload
            profile_id: Profile ID for authentication

        Returns:
            Settings data or error message.
        """
        if "get" not in SETTINGS_HANDLERS:
            return {
                "error": "get_settings handler not available.",
                "status": "not_implemented",
            }

        handler = SETTINGS_HANDLERS["get"]
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def save_settings(
        payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Save (update) settings.

        Args:
            payload: Request payload with settings data
            profile_id: Profile ID for authentication

        Returns:
            Updated settings or error message.
        """
        if "save" not in SETTINGS_HANDLERS:
            return {
                "error": "save_settings handler not available.",
                "status": "not_implemented",
            }

        handler = SETTINGS_HANDLERS["save"]
        return await call_endpoint_handler(handler, payload, profile_id)

    # Debug/Report Problem endpoint
    @server.tool()
    async def debug(
        type: str, message: str, profile_id: str
    ) -> dict[str, Any]:
        """Report a problem or provide feedback (debug tool).

        Args:
            type: Problem type (feature, bug, question, other)
            message: Problem description or feedback message (max 1000 characters)
            profile_id: Profile ID for authentication

        Returns:
            Feedback creation result or error message.
        """
        if FEEDBACK_HANDLER is None:
            return {
                "error": "debug/report problem handler not available.",
                "status": "not_implemented",
            }

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

        # Create payload for feedback endpoint
        payload = {
            "type": type,
            "message": message.strip(),
        }

        return await call_endpoint_handler(FEEDBACK_HANDLER, payload, profile_id)

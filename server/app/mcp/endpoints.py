"""Unified endpoints for artifacts and resources."""

from typing import Any, cast

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


def register_endpoints(server: FastMCP) -> None:
    """Register all MCP endpoints."""

    @server.tool()
    def artifacts() -> list[dict[str, str]]:
        """List all available artifacts with descriptions.
        
        Returns:
            List of dictionaries with 'name' and 'description' keys.
        """
        return [
            {"name": artifact, "description": ARTIFACT_DESCRIPTIONS.get(artifact, "No description available")}
            for artifact in ARTIFACTS
        ]

    @server.tool()
    def resources() -> list[dict[str, str]]:
        """List all available resources with descriptions.
        
        Returns:
            List of dictionaries with 'name' and 'description' keys.
        """
        return [
            {"name": resource, "description": RESOURCE_DESCRIPTIONS.get(resource, "No description available")}
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
                "note": "Documentation may not be implemented yet. Check if docs.py exists for this artifact."
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
                "status": "invalid_resource"
            }
        
        return {
            "message": f"Resource creation for '{name}' needs implementation.",
            "status": "not_implemented",
            "note": "Resources are create-only. Use POST /api/v4/resources/{name} endpoint."
        }

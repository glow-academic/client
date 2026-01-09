"""Personas artifact documentation."""

from typing import Any


def get_personas_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the personas artifact.
    
    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "personas",
        "type": "artifact",
        "database": {
            "table": "personas",
            "primary_key": "id",
            "columns": [
                {
                    "name": "id",
                    "type": "uuid",
                    "nullable": False,
                    "default": "uuidv7()",
                    "description": "Primary key, UUID v7"
                },
                {
                    "name": "created_at",
                    "type": "timestamptz",
                    "nullable": False,
                    "default": "now()",
                    "description": "Creation timestamp"
                },
                {
                    "name": "updated_at",
                    "type": "timestamptz",
                    "nullable": False,
                    "default": "now()",
                    "description": "Last update timestamp"
                },
                {
                    "name": "active",
                    "type": "boolean",
                    "nullable": False,
                    "default": "true",
                    "description": "Whether the persona is active"
                },
                {
                    "name": "generated",
                    "type": "boolean",
                    "nullable": False,
                    "default": "false",
                    "description": "Whether the persona was AI-generated"
                },
                {
                    "name": "call_id",
                    "type": "uuid",
                    "nullable": True,
                    "description": "Reference to the generation call if AI-generated"
                }
            ],
            "indexes": [
                {
                    "name": "personas_pkey",
                    "type": "PRIMARY KEY",
                    "columns": ["id"]
                }
            ],
            "foreign_keys": []
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "colors",
                "icons",
                "instructions",
                "flags",
                "examples",
                "fields",
                "departments"
            ],
            "junction_tables": [
                "persona_names",
                "persona_descriptions",
                "persona_colors",
                "persona_icons",
                "persona_instructions",
                "persona_flags",
                "persona_examples",
                "persona_fields",
                "persona_departments",
                "scenario_personas",
                "parameter_personas",
                "message_personas",
                "run_personas",
                "draft_personas"
            ],
            "related_artifacts": [
                {
                    "artifact": "scenarios",
                    "junction_table": "scenario_personas",
                    "description": "Personas can be assigned to scenarios"
                },
                {
                    "artifact": "parameters",
                    "junction_table": "parameter_personas",
                    "description": "Personas can be linked to parameters"
                },
                {
                    "artifact": "messages",
                    "junction_table": "message_personas",
                    "description": "Messages can be associated with personas"
                },
                {
                    "artifact": "runs",
                    "junction_table": "run_personas",
                    "description": "Model runs can reference personas"
                },
                {
                    "artifact": "drafts",
                    "junction_table": "draft_personas",
                    "description": "Draft personas for autosave"
                }
            ]
        },
        "api_routing": {
            "base_path": "/api/v4/personas",
            "endpoints": {
                "get": {
                    "path": "/get",
                    "method": "POST",
                    "description": "Get a single persona by ID",
                    "request_model": "GetPersonaApiRequest",
                    "response_model": "GetPersonaApiResponse"
                },
                "save": {
                    "path": "/save",
                    "method": "POST",
                    "description": "Create or update a persona",
                    "request_model": "SavePersonaApiRequest",
                    "response_model": "SavePersonaApiResponse"
                },
                "list": {
                    "path": "/list",
                    "method": "POST",
                    "description": "List personas with optional filters",
                    "request_model": "GetPersonasListApiRequest",
                    "response_model": "GetPersonasListApiResponse"
                },
                "duplicate": {
                    "path": "/duplicate",
                    "method": "POST",
                    "description": "Duplicate an existing persona",
                    "request_model": "DuplicatePersonaApiRequest",
                    "response_model": "DuplicatePersonaApiResponse"
                },
                "delete": {
                    "path": "/delete",
                    "method": "POST",
                    "description": "Delete a persona",
                    "request_model": "DeletePersonaApiRequest",
                    "response_model": "DeletePersonaApiResponse"
                },
                "draft": {
                    "path": "/draft",
                    "method": "PATCH",
                    "description": "Create or patch a persona draft (autosave)",
                    "request_model": "PatchPersonaDraftApiRequest",
                    "response_model": "PatchPersonaDraftApiResponse"
                }
            }
        },
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for personas - multiple names can be assigned",
                    "junction_table": "persona_names"
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for personas - multiple descriptions can be assigned",
                    "junction_table": "persona_descriptions"
                },
                {
                    "name": "colors",
                    "endpoint": "/api/v4/resources/colors",
                    "create_only": True,
                    "description": "Color resources for personas - UI color representation",
                    "junction_table": "persona_colors"
                },
                {
                    "name": "icons",
                    "endpoint": "/api/v4/resources/icons",
                    "create_only": True,
                    "description": "Icon resources for personas - UI icon representation",
                    "junction_table": "persona_icons"
                },
                {
                    "name": "instructions",
                    "endpoint": "/api/v4/resources/instructions",
                    "create_only": True,
                    "description": "Instruction resources for personas - behavior instructions",
                    "junction_table": "persona_instructions"
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for personas - boolean flags with types",
                    "junction_table": "persona_flags",
                    "note": "Uses type_persona_flags enum for flag types"
                },
                {
                    "name": "examples",
                    "endpoint": "/api/v4/resources/examples",
                    "create_only": True,
                    "description": "Example resources for personas - example interactions",
                    "junction_table": "persona_examples",
                    "note": "Includes idx for ordering"
                },
                {
                    "name": "fields",
                    "endpoint": "/api/v4/resources/fields",
                    "create_only": True,
                    "description": "Field resources for personas - custom field associations",
                    "junction_table": "persona_fields"
                },
                {
                    "name": "departments",
                    "endpoint": "/api/v4/resources/departments",
                    "create_only": True,
                    "description": "Department resources for personas - department associations",
                    "junction_table": "persona_departments"
                }
            ]
        },
        "frontend": {
            "components": [
                "client/components/personas/Persona.tsx",
                "client/components/personas/PersonaNew.tsx",
                "client/components/personas/Personas.tsx"
            ],
            "pages": [
                "client/app/(main)/create/personas/page.tsx",
                "client/app/(main)/create/personas/new/page.tsx",
                "client/app/(main)/create/personas/p/[personaId]/page.tsx",
                "client/app/(main)/create/personas/p/page.tsx"
            ],
            "usage_patterns": "Personas are created and edited through the create/personas pages. Users can assign multiple resources (names, descriptions, colors, icons, etc.) to personas. Personas are then used in scenarios to represent different AI characters or roles."
        },
        "glow_context": {
            "description": "Personas represent AI characters used in scenarios to provide different perspectives, roles, or personalities. They are central to GLOW's simulation and practice features, allowing students to interact with various AI characters in realistic scenarios.",
            "use_cases": [
                "Creating AI characters for scenario-based learning",
                "Defining different roles in simulations (e.g., patient, doctor, administrator)",
                "Customizing AI behavior through instructions and examples",
                "Organizing personas by department or field",
                "Using personas in messages and model runs for consistent character representation"
            ],
            "related_concepts": [
                "Scenarios - Personas are assigned to scenarios to define available characters",
                "Messages - Messages can be associated with personas to indicate which character is speaking",
                "Runs - Model runs reference personas to track which character generated responses",
                "Parameters - Personas can be linked to parameters for configuration",
                "Resources - Personas use multiple resource types (names, descriptions, colors, icons, etc.) for rich representation"
            ],
            "generation": {
                "available": True,
                "endpoint": "/socket/v4/personas/generate",
                "resource_types": [
                    "names",
                    "descriptions",
                    "colors",
                    "icons",
                    "instructions",
                    "flags",
                    "examples",
                    "fields",
                    "departments"
                ],
                "description": "Personas support AI generation for all resource types via WebSocket"
            }
        }
    }

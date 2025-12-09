"""Handler for generate_scenario WebSocket event."""

import json
import uuid
from typing import Any, Type

from agents import (FunctionToolResult, RunContextWrapper, Runner, Tool,
                    ToolsToFinalOutputResult, function_tool, gen_trace_id,
                    trace)
from agents.items import TResponseInputItem
from app.main import (get_dynamic_document_storage,
                      get_image_generation_storage, get_pool,
                      get_scenario_storage, sio)
from app.utils.agents.generic_agent import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.document.format_document_info import format_document_info
from app.utils.documents.create_dynamic_document import create_dynamic_document
from app.utils.logging.db_logger import get_logger
from app.utils.messages.log_run_messages import log_run_messages
from app.utils.personas import format_persona_info
from app.utils.scenario import format_parameter_item_info
from app.utils.scenario.format_document_template_info import \
    format_document_template_info
from app.utils.scenario.image_generation import (get_image_generation_results,
                                                 set_image_generation_context)
from app.utils.sql_helper import load_sql
from app.utils.storage.request_storage import build_storage_key
from pydantic import (BaseModel, ConfigDict, Field, ValidationError,
                      create_model)

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class ScenarioGenerationProgressPayload(BaseModel):
    type: str  # "start", "tool_call", "complete"
    message: str | None = None
    tool_name: str | None = None
    trace_id: str | None = None


class ScenarioGenerationCompletePayload(BaseModel):
    success: bool
    message: str
    title: str
    description: str
    objectives: list[str]
    dynamic_document_mapping: dict[str, str] | None = None
    generated_image_ids: list[str] | None = None
    trace_id: str | None = None


class ScenarioGenerationErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str | None = None


class ScenarioImageGenerationProgressPayload(BaseModel):
    type: str  # "start", "generating", "completed"
    message: str | None = None
    image_id: str | None = None
    trace_id: str | None = None


class ScenarioImageGenerationCompletePayload(BaseModel):
    success: bool
    image_id: str
    upload_id: str
    name: str
    trace_id: str | None = None


class ScenarioImageGenerationErrorPayload(BaseModel):
    success: bool
    image_id: str
    message: str
    trace_id: str | None = None


# Pydantic model for client-to-server event
class GenerateScenarioAIPayload(BaseModel):
    departmentId: str
    agentId: str  # Required: UI filters and selects appropriate agent based on flags
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    fieldIds: list[str] | None = None
    profileId: str | None = None


# Emit helper functions
async def scenario_generation_progress(
    payload: ScenarioGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "scenario_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def scenario_generation_complete(
    payload: ScenarioGenerationCompletePayload, room: str
) -> None:
    await sio.emit("scenario_generation_complete", payload.model_dump(), room=room)


async def scenario_generation_error(
    payload: ScenarioGenerationErrorPayload, room: str
) -> None:
    await sio.emit("scenario_generation_error", payload.model_dump(), room=room)


async def scenario_image_generation_progress(
    payload: ScenarioImageGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "scenario_image_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def scenario_image_generation_complete(
    payload: ScenarioImageGenerationCompletePayload, room: str
) -> None:
    await sio.emit(
        "scenario_image_generation_complete", payload.model_dump(), room=room
    )


async def scenario_image_generation_error(
    payload: ScenarioImageGenerationErrorPayload, room: str
) -> None:
    await sio.emit("scenario_image_generation_error", payload.model_dump(), room=room)


# Helper function to build Pydantic models dynamically from template schemas
def _build_template_model(schema: dict[str, Any]) -> Type[BaseModel]:
    """Build a Pydantic model from a template schema.

    Args:
        schema: Template schema dict with 'name' and 'fields' keys

    Returns:
        A dynamically created Pydantic model class with strict schema (no additionalProperties)
    """
    fields_data = schema.get("fields", [])
    if not fields_data:
        # If no fields, return a simple model with no fields and strict config
        model = create_model(
            "TemplateArgs",
            __base__=BaseModel,
            __config__=ConfigDict(extra="forbid"),  # Disallow extra fields
        )
        return model  # type: ignore[return-value]

    # Build field definitions for the model
    field_definitions: dict[str, Any] = {}

    for field in fields_data:
        field_name = field.get("name")
        if not field_name:
            continue

        field_type = field.get("type", "string")
        required = field.get("required", False)
        description = field.get("description", "")
        placeholder = field.get("placeholder", "")

        # Build description with placeholder if available
        field_description = description
        if placeholder:
            field_description = (
                f"{description} (Example: {placeholder})"
                if description
                else f"Example: {placeholder}"
            )

        # Map field types to Python types
        python_type: Any
        if field_type == "string":
            python_type = str
        elif field_type == "array":
            # Arrays always have an 'item' definition in the schema
            item_def = field.get("item", {})
            if not item_def:
                # Fallback: if no item definition, use list[str] (shouldn't happen in practice)
                logger.warning(
                    f"Array field '{field_name}' has no item definition, defaulting to list[str]"
                )
                python_type = list[str]
            elif item_def.get("type") == "object":
                # Array of objects - always build a proper Pydantic model
                item_fields = item_def.get("fields", [])
                if item_fields:
                    # Build nested model for array items
                    item_schema = {
                        "name": f"{field_name}_item",
                        "fields": item_fields,
                    }
                    item_model = _build_template_model(item_schema)
                    # Runtime-created models can't be statically typed, but will generate strict schemas
                    # Use Any to avoid type checker issues with dynamic types
                    python_type = list[item_model]  # type: ignore
                else:
                    # Empty object - create empty model (shouldn't happen in practice)
                    empty_item_model = create_model(
                        f"{field_name}_item",
                        __base__=BaseModel,
                        __config__=ConfigDict(extra="forbid"),
                    )
                    # Runtime-created models can't be statically typed, but will generate strict schemas
                    # Use Any to avoid type checker issues with dynamic types
                    python_type = list[empty_item_model]  # type: ignore
            else:
                # Array of primitives - item.type should be "string", "number", etc.
                item_type = item_def.get("type", "string")
                if item_type == "string":
                    python_type = list[str]
                elif item_type == "number":
                    python_type = list[float]
                elif item_type == "boolean":
                    python_type = list[bool]
                else:
                    # Default to string for unknown primitive types
                    python_type = list[str]
        elif field_type == "object":
            # Objects always have a 'fields' array in the schema
            nested_fields = field.get("fields", [])
            if nested_fields:
                # Recursively build nested model
                nested_schema = {"name": f"{field_name}_nested", "fields": nested_fields}
                nested_model = _build_template_model(nested_schema)
                # Store as Any to avoid type checker issues, but it's actually Type[BaseModel]
                python_type = nested_model  # type: ignore[assignment, misc]
            else:
                # Empty object - create empty model (shouldn't happen in practice)
                logger.warning(
                    f"Object field '{field_name}' has no fields definition, creating empty model"
                )
                empty_model = create_model(
                    f"{field_name}_empty",
                    __base__=BaseModel,
                    __config__=ConfigDict(extra="forbid"),
                )
                python_type = empty_model  # type: ignore[assignment, misc]
        else:
            # Default to str for unknown types (safer than Any)
            python_type = str

        # Create Field with description and required flag
        if required:
            field_definitions[field_name] = (
                python_type,
                Field(..., description=field_description),
            )
        else:
            field_definitions[field_name] = (
                python_type | None,
                Field(default=None, description=field_description),
            )

    # Create the model dynamically with strict config to prevent additionalProperties
    model_name = schema.get("name", "TemplateArgs").replace(" ", "").replace(":", "")
    model = create_model(
        f"{model_name}Args",
        __base__=BaseModel,
        __config__=ConfigDict(extra="forbid"),  # Disallow extra fields - critical for strict schemas
        **field_definitions,
    )

    return model  # type: ignore[return-value]


async def _generate_scenario_impl(sid: str, data: GenerateScenarioAIPayload) -> None:
    """Handle scenario generation requests via WebSocket."""
    trace_id = gen_trace_id()

    try:
        logger.info(
            f"Received generate_scenario request from {sid} with data: {data}"
        )

        # Convert string IDs to UUIDs
        department_id = uuid.UUID(data.departmentId)
        persona_ids = (
            [uuid.UUID(p) for p in data.personaIds] if data.personaIds else None
        )
        persona_id = persona_ids[0] if persona_ids and len(persona_ids) > 0 else None
        document_ids = (
            [uuid.UUID(d) for d in data.documentIds] if data.documentIds else None
        )
        field_ids = (
            [uuid.UUID(f) for f in data.fieldIds]
            if data.fieldIds
            else None
        )
        profile_id = uuid.UUID(data.profileId) if data.profileId else None

        # Filter out empty lists
        if document_ids and len(document_ids) == 0:
            document_ids = None

        # Get connection pool
        pool = get_pool()
        if not pool:
            await scenario_generation_error(
                ScenarioGenerationErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                    trace_id=trace_id,
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Clear previous results (now handled by storage with keys)

            # Emit start event
            await scenario_generation_progress(
                ScenarioGenerationProgressPayload(
                    type="start",
                    message="Starting scenario generation",
                    trace_id=trace_id,
                ),
                room=sid,
            )

            # Get all context data in a single optimized query using SQL file
            doc_ids_str = [str(d) for d in document_ids] if document_ids else []
            field_ids_str = (
                [str(f) for f in field_ids] if field_ids else []
            )

            sql = load_sql("sql/v3/agents/get_scenario_run_context.sql")
            # Agent ID should be provided in payload (UI filters and selects appropriate agent)
            # For backward compatibility, if not provided, we'll need to find a default agent
            # But ideally the UI should always provide agent_id
            agent_id = uuid.UUID(data.agentId) if hasattr(data, 'agentId') and data.agentId else None
            
            if not agent_id:
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False,
                        message="Agent ID is required for scenario generation",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return
            
            context_row = await conn.fetchrow(
                sql,
                str(department_id),
                str(persona_id) if persona_id else None,
                doc_ids_str,
                field_ids_str,
                str(agent_id),  # agent_id (required)
            )

            if not context_row:
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False,
                        message=f"No scenario agent configured for department {data.departmentId}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Parse JSON arrays
            documents = (
                json.loads(context_row["documents"])
                if isinstance(context_row["documents"], str)
                else context_row["documents"]
            )
            parameter_items = (
                json.loads(context_row["parameter_items"])
                if isinstance(context_row["parameter_items"], str)
                else context_row["parameter_items"]
            )
            document_templates = (
                json.loads(context_row["document_templates"])
                if isinstance(context_row["document_templates"], str)
                else context_row["document_templates"]
            )

            agent_role = context_row.get("agent_role", "scenario")
            
            context = {
                "agent_id": context_row["agent_id"],
                "agent_name": context_row["agent_name"],
                "agent_role": agent_role,
                "system_prompt": context_row["system_prompt"],
                "temperature": float(context_row["temperature"])
                if context_row["temperature"] is not None
                else 0.0,
                "reasoning": context_row["reasoning"],
                "model_id": context_row["model_id"],
                "model_name": context_row["model_name"],
                "custom_model": context_row["custom_model"],
                "provider_id": context_row["provider_id"],
                "provider_name": context_row["provider_name"],
                "base_url": context_row["base_url"],
                "api_key": context_row["api_key"],
                "persona": {
                    "id": context_row["persona_id"],
                    "name": context_row["persona_name"],
                    "description": context_row["persona_description"],
                }
                if context_row["persona_id"]
                else None,
                "documents": documents,
                "parameter_items": parameter_items,
                "document_templates": document_templates,
                "default_guest_profile_id": context_row["guest_profile_id"],
                "req_per_day": context_row["req_per_day"],
                "runs_today_count": context_row["runs_today_count"],
                "earliest_run_created_at": context_row["earliest_run_created_at"],
            }

            # Format persona info if persona was provided
            if persona_id is None or context["persona"] is None:
                persona_info = None
                show_images = False
            else:
                persona_info = format_persona_info(context["persona"])
                show_images = False

            # Format document info if documents were provided
            if not document_ids or len(document_ids) == 0:
                document_info = None
            else:
                document_info = format_document_info(context["documents"], show_images)

            # Format parameter item info if parameter items were provided
            if not field_ids or len(field_ids) == 0:
                field_info = None
            else:
                field_info = format_parameter_item_info(context["parameter_items"])

            # Determine which tools to enable based on agent role
            group_id = None
            
            # Determine tool availability based on agent role
            # Base 'scenario' role supports all tools (backward compatibility)
            # Fine-grained roles indicate specific capabilities
            agent_role_str = str(agent_role).lower()
            objectives_enabled = (
                agent_role_str == "scenario"  # Base role supports all
                or "objectives" in agent_role_str
            )
            images_enabled = (
                agent_role_str == "scenario"  # Base role supports all
                or "image" in agent_role_str
            )
            # Documents enabled if agent supports templates AND template documents exist
            has_template_documents = bool(
                context["document_templates"]
                and len(context["document_templates"]) > 0
            )
            documents_enabled = (
                has_template_documents
                and (
                    agent_role_str == "scenario"  # Base role supports all
                    or "templates" in agent_role_str
                )
            )
            
            logger.info(
                f"Agent role: {agent_role}, objectives_enabled: {objectives_enabled}, "
                f"images_enabled: {images_enabled}, documents_enabled: {documents_enabled}"
            )

            # Use default guest profile from context if no profile_id provided
            final_profile_id = (
                profile_id if profile_id else context["default_guest_profile_id"]
            )

            # Format document template info if templates are available
            document_template_info = await format_document_template_info(
                context["document_templates"],
                profile_id=str(final_profile_id) if final_profile_id else None,
                primary_id=trace_id,
            )

            # Set image generation context before creating tools (async)
            if images_enabled and final_profile_id:
                await set_image_generation_context(
                    agent_id=context["agent_id"],
                    profile_id=str(final_profile_id),
                    primary_id=trace_id,
                    department_id=str(department_id) if department_id else None,
                )

            # Create scenario generation tools inline
            scenario_tools: list[Tool] = []
            primary_id = trace_id or (str(group_id) if group_id else None)

            # 1. Title and Description Tool (always included)
            async def set_title_and_description(
                title: str = Field(
                    description="Short, descriptive title for the scenario (5-10 words)"
                ),
                scenario: str = Field(
                    description="Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it"
                ),
            ) -> str:
                """Set the title and description for the scenario.

                The title should be concise and descriptive (5-10 words).
                The scenario description must be exactly 1-2 sentences and should:
                - Subtly show the student's persona without stating it directly
                - Incorporate environmental parameters (crowdedness, intensity, time, deadline, location)
                - Focus on the course topic from the documents
                - Build a scene that shows, not tells

                Args:
                    title: Short descriptive title
                    scenario: 1-2 sentence scenario description

                Returns:
                    Confirmation message
                """
                if not final_profile_id or not primary_id:
                    logger.error("profile_id and primary_id required for storage")
                    return "Error: Storage configuration missing"

                storage = get_scenario_storage()
                storage_key = build_storage_key(
                    operation_type="scenario_generation",
                    profile_id=str(final_profile_id),
                    primary_id=primary_id,
                )

                await storage.set(storage_key, "title", title)
                await storage.set(storage_key, "description", scenario)
                await storage.set(storage_key, "title_description_progress", True)

                logger.info(f"✓ Set title: {title}")
                logger.info(f"✓ Set description: {scenario[:100]}...")
                return "Set title and description successfully"

            scenario_tools.append(function_tool(set_title_and_description))
            logger.info("Created title and description tool")

            # 2. Objectives Tool (if enabled)
            if objectives_enabled:
                async def set_objectives(
                    objectives: list[str] = Field(
                        description="List of 1-3 specific learning objectives that GTAs should achieve in this scenario"
                    ),
                ) -> str:
                    """Set the learning objectives for this scenario.

                    Objectives should:
                    - Be specific and measurable
                    - Relate to the skills needed to handle this particular scenario
                    - Focus on pedagogical skills, communication, or subject matter knowledge
                    - Be achievable within a single chat interaction

                    Examples:
                    - "Demonstrate active listening by paraphrasing the student's concerns"
                    - "Break down complex concepts into understandable chunks"
                    - "Manage time effectively while addressing the student's emotional state"

                    Args:
                        objectives: List of 1-3 learning objectives (maximum 3)

                    Returns:
                        Confirmation message
                    """
                    if not final_profile_id or not primary_id:
                        logger.error("profile_id and primary_id required for storage")
                        return "Error: Storage configuration missing"

                    # Limit to maximum 3 objectives
                    objectives = objectives[:3]

                    if len(objectives) < 1 or len(objectives) > 3:
                        logger.warning(
                            f"Objectives count ({len(objectives)}) outside recommended range of 1-3"
                        )

                    storage = get_scenario_storage()
                    storage_key = build_storage_key(
                        operation_type="scenario_generation",
                        profile_id=str(final_profile_id),
                        primary_id=primary_id,
                    )

                    await storage.set(storage_key, "objectives", objectives)
                    await storage.set(storage_key, "objectives_progress", True)

                    logger.info(f"✓ Set {len(objectives)} objectives: {objectives}")
                    return f"Set {len(objectives)} learning objectives successfully"

                scenario_tools.append(function_tool(set_objectives))
                logger.info("Created objectives tool")
            else:
                logger.info("Objectives tool skipped (objectives_enabled=False)")

            # 3. Dynamic Document Tool (if enabled)
            if documents_enabled:
                if not final_profile_id:
                    logger.warning(
                        "profile_id required for dynamic document storage, skipping tool"
                    )
                else:
                    # Extract template schema from document_templates if available
                    template_schema: dict[str, Any] | None = None
                    if document_templates and len(document_templates) > 0:
                        # Use the first template's schema (typically there's only one)
                        first_template = document_templates[0]
                        template_args_raw = first_template.get("template_args")
                        if template_args_raw:
                            # Parse if it's a string, otherwise use as-is
                            if isinstance(template_args_raw, str):
                                try:
                                    template_schema = json.loads(template_args_raw)
                                except json.JSONDecodeError:
                                    logger.warning(
                                        "Failed to parse template_args JSON, falling back to untyped function"
                                    )
                            elif isinstance(template_args_raw, dict):
                                template_schema = template_args_raw
                            else:
                                logger.warning(
                                    f"Unexpected template_args type: {type(template_args_raw)}, falling back to untyped function"
                                )

                    # Core implementation function that processes template args
                    async def _create_document_impl(template_args_dict: dict[str, Any]) -> str:
                        """Internal implementation that processes template args dict."""
                        if not final_profile_id or not primary_id:
                            return "Error: Storage configuration missing"

                        storage = get_dynamic_document_storage()
                        storage_key = build_storage_key(
                            operation_type="dynamic_document",
                            profile_id=str(final_profile_id),
                            primary_id=primary_id,
                        )

                        # Get available templates from storage
                        templates = await storage.get(storage_key, "templates")
                        if not templates:
                            return "Error: No template documents are available for dynamic creation."

                        # Use the first available template (typically there will be only one)
                        parent_template = templates[0]
                        parent_document_id = parent_template.get("document_id", "")

                        if not parent_document_id:
                            return "Error: Could not determine parent template document ID."

                        # Get existing dynamic documents list or create new one
                        dynamic_documents = await storage.get(storage_key, "dynamic_documents")
                        if not dynamic_documents:
                            dynamic_documents = []

                        # Append new document request
                        dynamic_documents.append(
                            {
                                "parent_document_id": parent_document_id,
                                "template_args": template_args_dict,
                            }
                        )

                        # Store updated list
                        await storage.set(storage_key, "dynamic_documents", dynamic_documents)

                        logger.info(
                            f"✓ Queued dynamic document creation: parent={parent_document_id}, "
                            f"args={list(template_args_dict.keys())}"
                        )
                        return "Queued dynamic document creation. Child document will be created after scenario generation with provided template values."

                    # If we have a template schema, create a function with individual parameters
                    if template_schema:
                        TemplateArgsModel: Type[BaseModel] | None = None
                        try:
                            TemplateArgsModel = _build_template_model(template_schema)
                            logger.info(
                                f"Built strongly typed template model: {TemplateArgsModel.__name__}"
                            )
                        except Exception as e:
                            logger.warning(
                                f"Failed to build template model, falling back to dict: {e}",
                                exc_info=True,
                            )
                            TemplateArgsModel = None

                        if template_schema and TemplateArgsModel:
                            fields_data = template_schema.get("fields", [])
                            if fields_data:
                                # Build function signature with individual parameters
                                # We'll use exec to create a function with dynamic signature
                                param_definitions = []
                                param_names = []
                                
                                for field in fields_data:
                                    field_name = field.get("name")
                                    if not field_name:
                                        continue
                                        
                                    field_type = field.get("type", "string")
                                    required = field.get("required", False)
                                    description = field.get("description", "")
                                    placeholder = field.get("placeholder", "")
                                    
                                    # Build description with placeholder if available
                                    field_description = description
                                    if placeholder:
                                        field_description = f"{description} (Example: {placeholder})" if description else f"Example: {placeholder}"
                                    
                                    # Map field types to Python types for type hints
                                    python_type_str = "str"
                                    if field_type == "number":
                                        python_type_str = "float"
                                    elif field_type == "boolean":
                                        python_type_str = "bool"
                                    elif field_type == "array":
                                        python_type_str = "list[str]"  # Default to list[str] for arrays
                                    
                                    param_names.append(field_name)
                                    
                                    # Create Field annotation
                                    if required:
                                        param_def = f"{field_name}: {python_type_str} = Field(..., description={repr(field_description)})"
                                    else:
                                        param_def = f"{field_name}: {python_type_str} | None = Field(default=None, description={repr(field_description)})"
                                    
                                    param_definitions.append(param_def)
                                
                                # Build function code
                                params_str = ", ".join(param_definitions)
                                
                                # Create function body that collects parameters into dict
                                # Indent with 4 spaces to match function body indentation
                                collect_dict_code = "    template_args_dict = {\n"
                                for field_name in param_names:
                                    collect_dict_code += f"        {repr(field_name)}: {field_name},\n"
                                collect_dict_code += "    }\n"
                                
                                # Remove None values for optional fields
                                collect_dict_code += "    # Remove None values for optional fields\n"
                                collect_dict_code += "    template_args_dict = {k: v for k, v in template_args_dict.items() if v is not None}\n"
                                
                                func_code = f"""async def create_document({params_str}) -> str:
    \"\"\"Create a dynamic child document from the available template document.

    This tool renders the available template document with provided template argument values
    and creates a new child document (not a template) that replaces the parent in the scenario.

    You do not need to specify the parent document ID - it will be automatically inferred.
    Provide the template argument values as specified by the template schema.

    Args:
        {chr(10).join(f'        {name}: Template argument value' for name in param_names)}

    Returns:
        Confirmation message
    \"\"\"
{collect_dict_code}
    return await _create_document_impl(template_args_dict)
"""
                                
                                # Execute in local namespace with access to required imports
                                local_namespace = {
                                    "Field": Field,
                                    "_create_document_impl": _create_document_impl,
                                    "str": str,
                                    "float": float,
                                    "bool": bool,
                                    "list": list,
                                }
                                
                                exec(func_code, globals(), local_namespace)
                                create_document_func = local_namespace["create_document"]
                                
                                logger.info(
                                    f"Created dynamic document function with {len(param_names)} individual parameters"
                                )
                                scenario_tools.append(function_tool(create_document_func))  # type: ignore
                            else:
                                # Fallback: create function with dict parameter
                                async def create_document_fallback(template_args: dict[str, Any]) -> str:
                                    """Create a dynamic child document from the available template document.

                                    This tool renders the available template document with provided template argument values
                                    and creates a new child document (not a template) that replaces the parent in the scenario.

                                    You do not need to specify the parent document ID - it will be automatically inferred.
                                    Provide the template argument values as a dictionary matching the template schema.

                                    Args:
                                        template_args: Dictionary of template argument values

                                    Returns:
                                        Confirmation message
                                    """
                                    return await _create_document_impl(template_args)
                                
                                scenario_tools.append(function_tool(create_document_fallback))  # type: ignore[arg-type]
                        else:
                            # Fallback: create function with dict parameter
                            async def create_document_fallback(template_args: dict[str, Any]) -> str:
                                """Create a dynamic child document from the available template document.

                                This tool renders the available template document with provided template argument values
                                and creates a new child document (not a template) that replaces the parent in the scenario.

                                You do not need to specify the parent document ID - it will be automatically inferred.
                                Provide the template argument values as a dictionary matching the template schema.

                                Args:
                                    template_args: Dictionary of template argument values

                                Returns:
                                    Confirmation message
                                """
                                return await _create_document_impl(template_args)
                            
                            scenario_tools.append(function_tool(create_document_fallback))  # type: ignore[arg-type]
                    else:
                        # Fallback: create function with dict parameter (for backward compatibility)
                        async def create_document_fallback(template_args: dict[str, Any]) -> str:
                            """Create a dynamic child document from the available template document.

                            This tool renders the available template document with provided template argument values
                            and creates a new child document (not a template) that replaces the parent in the scenario.

                            You do not need to specify the parent document ID - it will be automatically inferred.
                            Provide the template argument values as a dictionary matching the template schema.

                            Args:
                                template_args: Dictionary of template argument values

                            Returns:
                                Confirmation message
                            """
                            return await _create_document_impl(template_args)
                        
                        scenario_tools.append(function_tool(create_document_fallback))  # type: ignore[arg-type]
            else:
                logger.info("Dynamic document tool skipped (documents_enabled=False)")

            # 4. Image Generation Tool (if enabled)
            if images_enabled:
                if not final_profile_id:
                    logger.warning("profile_id required for image generation, skipping tool")
                else:
                    async def generate_image(
                        name: str = Field(description="Descriptive name for the generated image"),
                        prompt: str = Field(
                            description="Detailed, descriptive prompt for image generation"
                        ),
                    ) -> str:
                        """Generate an image from a detailed prompt.

                        This tool creates an image using AI image generation based on your detailed prompt.
                        The image will be saved and linked to the scenario after generation completes.

                        Args:
                            name: Descriptive name for the image (required)
                            prompt: Detailed, descriptive prompt describing what the image should look like (required)

                        Returns:
                            Confirmation message
                        """
                        # Get storage instance
                        storage = get_image_generation_storage()

                        # Build storage key
                        storage_key = build_storage_key(
                            operation_type="image_generation",
                            profile_id=str(final_profile_id),
                            primary_id=trace_id,
                        )

                        # Get context from storage
                        agent_id = await storage.get(storage_key, "agent_id")
                        department_id_stored = await storage.get(storage_key, "department_id")
                        context_profile_id = await storage.get(storage_key, "profile_id")
                        room = await storage.get(storage_key, "room")

                        if not agent_id:
                            return "Error: Image generation context not set. Cannot generate image."

                        # Create image record immediately with completed=false
                        pool = get_pool()
                        if not pool:
                            return "Error: Database pool not available. Cannot create image record."

                        try:
                            async with pool.acquire() as conn:
                                # Create image record
                                sql_insert_image = load_sql("sql/v3/images/insert_image_complete.sql")
                                image_row = await conn.fetchrow(sql_insert_image, name)

                                if not image_row:
                                    return "Error: Failed to create image record."

                                image_id = image_row["id"]

                                # Store image generation context for background task
                                image_context_key = f"{storage_key}:image:{image_id}"
                                await storage.set(image_context_key, "image_id", image_id)
                                await storage.set(image_context_key, "name", name)
                                await storage.set(image_context_key, "prompt", prompt)
                                await storage.set(image_context_key, "agent_id", agent_id)
                                await storage.set(image_context_key, "department_id", department_id_stored)
                                await storage.set(image_context_key, "profile_id", context_profile_id)
                                if room:
                                    await storage.set(image_context_key, "room", room)

                                # Emit WebSocket event for background image generation
                                await sio.emit(
                                    "generate_image",
                                    {
                                        "image_id": image_id,
                                        "storage_key": image_context_key,
                                    },
                                )

                                # Track image_id in images list
                                images = await storage.get(storage_key, "images")
                                if not images:
                                    images = []
                                images.append(image_id)
                                await storage.set(storage_key, "images", images)

                                logger.info(
                                    f"✓ Started image generation: name={name}, image_id={image_id}, "
                                    f"prompt_length={len(prompt)}"
                                )
                                return f"Image generation started for '{name}'. Image ID: {image_id}"
                        except Exception as e:
                            logger.error(f"Error creating image record: {e}", exc_info=True)
                            return f"Error: Failed to start image generation: {str(e)}"

                    scenario_tools.append(function_tool(generate_image))
                    logger.info("Created image generation tool")
            else:
                logger.info("Image generation tool skipped (images_enabled=False)")

            # Add debug info tool
            scenario_tools.append(debug_info_tool)

            logger.info(f"Total scenario tools created: {len(scenario_tools)}")

            # Create tool use behavior to check when all required tools are called
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                """Check if all required tools have been called.

                Required tools:
                - title_description (always required)
                - objectives (if objectives_enabled)
                - create_document (if has_template_documents)
                """
                required_tools = ["title_description"]
                if objectives_enabled:
                    required_tools.append("objectives")
                if has_template_documents:
                    required_tools.append("create_document")

                # Check which tools have been called
                completed_tools = []
                logger.info(f"tool_use_behavior called with {len(tool_results)} tool results")
                
                for idx, result in enumerate(tool_results):
                    logger.info(f"Tool result {idx}: type={type(result)}")
                    logger.info(f"Tool result {idx} dir: {[x for x in dir(result) if not x.startswith('_')]}")
                    
                    # Try multiple ways to get tool name (FunctionToolResult structure may vary)
                    tool_name = None
                    
                    # Try direct attribute access (like hint agent)
                    if hasattr(result, "tool_name"):
                        tool_name = result.tool_name  # type: ignore[attr-defined]
                        logger.info(f"Tool result {idx}: Found tool_name via hasattr: {tool_name}")
                    # Try getattr as fallback
                    else:
                        tool_name = getattr(result, "tool_name", None)  # type: ignore[misc]
                        if tool_name:
                            logger.info(f"Tool result {idx}: Found tool_name via getattr: {tool_name}")
                        else:
                            tool_name = getattr(result, "name", None)  # type: ignore[misc]
                            if tool_name:
                                logger.info(f"Tool result {idx}: Found name via getattr: {tool_name}")
                    
                    # Try to get tool name from tool object if result has one
                    if not tool_name:
                        tool_obj = getattr(result, "tool", None)  # type: ignore[misc]
                        if tool_obj:
                            tool_name = getattr(tool_obj, "name", None)  # type: ignore[misc]
                            if tool_name:
                                logger.info(f"Tool result {idx}: Found tool.name: {tool_name}")
                    
                    if tool_name and isinstance(tool_name, str):
                        logger.info(f"Tool result {idx}: Processing tool_name={tool_name}")
                        # Normalize tool names (handle variations like set_title_and_description -> title_description)
                        normalized_name = tool_name
                        if "title" in tool_name.lower() and "description" in tool_name.lower():
                            normalized_name = "title_description"
                        elif "objective" in tool_name.lower():
                            normalized_name = "objectives"
                        elif "create_document" in tool_name.lower() or ("create" in tool_name.lower() and "document" in tool_name.lower()):
                            normalized_name = "create_document"
                        completed_tools.append(normalized_name)
                        logger.info(f"Tool result {idx}: Normalized to {normalized_name}")
                    else:
                        logger.warning(f"Tool result {idx}: Could not extract tool name. tool_name={tool_name}, type={type(tool_name)}")
                        # Log the actual result object for debugging
                        logger.info(f"Tool result {idx} repr: {repr(result)}")

                # Check if all required tools have been completed
                all_completed = all(tool in completed_tools for tool in required_tools)

                logger.info(
                    f"Tool use behavior check: required={required_tools}, "
                    f"completed={completed_tools}, all_completed={all_completed}, "
                    f"tool_results_count={len(tool_results)}"
                )
                
                # If no tools detected but we have results, log what we got
                if len(tool_results) > 0 and len(completed_tools) == 0:
                    logger.warning(
                        f"Tool results present ({len(tool_results)}) but no tool names extracted. "
                        f"First result type: {type(tool_results[0])}, "
                        f"First result dir: {[x for x in dir(tool_results[0]) if not x.startswith('_')][:10]}"
                    )

                return ToolsToFinalOutputResult(is_final_output=all_completed)

            scenario_agent_generic = GenericAgent(
                agent_name=context["agent_name"],
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                provider=context["provider_name"],
                base_url=context["base_url"],
                api_key=context["api_key"],
                reasoning=context["reasoning"],
                tools=scenario_tools,
                parallel_tool_calls=False,
                tool_use_behavior=tool_use_behavior,
            )

            agent_instance = scenario_agent_generic.agent()

            input_items: list[TResponseInputItem | None] = [
                persona_info,
                document_info,
                field_info,
                document_template_info,
            ]

            clean_input_items = [item for item in input_items if item is not None]

            # Check rate limit
            profile_id_uuid = final_profile_id if final_profile_id else None
            if not profile_id_uuid:
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False,
                        message="Profile not found. Please contact support.",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            req_per_day = context["req_per_day"]
            runs_today_count = context["runs_today_count"]

            if req_per_day is not None and runs_today_count >= req_per_day:
                from datetime import timedelta
                from zoneinfo import ZoneInfo

                earliest_run_created_at = context["earliest_run_created_at"]
                if earliest_run_created_at:
                    next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                    eastern_tz = ZoneInfo("America/New_York")
                    next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                    error_message = (
                        f"Daily request limit of {req_per_day} reached. "
                        f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                        f"{next_allowed_et.strftime('%B %d, %Y')}."
                    )
                else:
                    error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False, message=error_message, trace_id=trace_id
                    ),
                    room=sid,
                )
                return

            # Create model run with all junction records using SQL file
            sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
            model_run_row = await conn.fetchrow(
                sql_create_run,
                str(department_id),
                context["model_id"],
                context["agent_id"],
                "agent",
                final_profile_id,
                None,  # key_id
                str(context["agent_id"]),  # agent_id
            )
            model_run_id = uuid.UUID(model_run_row["run_id"])

            # Log system and developer messages for this run
            await log_run_messages(
                conn=conn,
                run_id=model_run_id,
                system_prompt=context["system_prompt"],
                input_items=clean_input_items,
                department_id=department_id,
            )

            with trace(
                "Scenario Agent",
                group_id=str(group_id) if group_id else None,
                trace_id=trace_id,
            ):
                result = await Runner.run(
                    agent_instance,
                    input=clean_input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Log assistant message (model output)
            assistant_output = getattr(result, "final_output", None) or ""
            if assistant_output:
                await log_run_messages(
                    conn=conn,
                    run_id=model_run_id,
                    system_prompt=None,  # Already logged
                    assistant_output=assistant_output,
                    department_id=department_id,
                )

            # Extract results from request-scoped storage
            storage = get_scenario_storage()
            storage_key = build_storage_key(
                operation_type="scenario_generation",
                profile_id=str(final_profile_id),
                primary_id=trace_id,
            )
            scenario_result = await storage.get_all(storage_key)

            usage = result.context_wrapper.usage

            # Update model run with token usage using SQL file
            sql_update_tokens = load_sql(
                "sql/v3/model_runs/update_model_run_tokens.sql"
            )
            await conn.execute(
                sql_update_tokens,
                str(model_run_id),
                usage.input_tokens,
                usage.output_tokens,
            )

            # Get result values
            title = scenario_result.get("title", "")
            description = scenario_result.get("description", "")
            objectives = (
                scenario_result.get("objectives", []) if objectives_enabled else []
            )

            # Limit objectives to maximum 3
            limited_objectives = objectives[:3] if objectives else []

            # Process dynamic documents if any were created
            dynamic_document_mapping: dict[str, str] | None = None
            if final_profile_id:
                storage = get_dynamic_document_storage()
                storage_key = build_storage_key(
                    operation_type="dynamic_document",
                    profile_id=str(final_profile_id),
                    primary_id=trace_id,
                )
                dynamic_document_result = await storage.get_all(storage_key)
                dynamic_documents = dynamic_document_result.get("dynamic_documents")
                if dynamic_documents:
                    dynamic_document_mapping = {}
                    for doc_request in dynamic_documents:
                        try:
                            parent_id = uuid.UUID(doc_request["parent_document_id"])
                            template_args = doc_request["template_args"]

                            # Create child document
                            # http_request is optional and only used for theme settings
                            child_id = await create_dynamic_document(
                                conn=conn,
                                parent_document_id=parent_id,
                                template_args=template_args,
                                department_id=department_id,
                                profile_id=profile_id,
                                http_request=None,  # WebSocket doesn't have HTTP request
                            )

                            dynamic_document_mapping[str(parent_id)] = str(child_id)
                            logger.info(
                                f"Created dynamic child document {child_id} from parent {parent_id}"
                            )
                        except Exception as e:
                            logger.error(
                                f"Failed to create dynamic document from parent {doc_request.get('parent_document_id')}: {e}",
                                exc_info=True,
                            )
                            # Continue with other documents even if one fails

                    # Clear dynamic document results after processing
                    await storage.delete(storage_key, "dynamic_documents")

            # Retrieve image_ids from storage (images are generated in background)
            generated_image_ids: list[str] = []
            if final_profile_id:
                image_results = await get_image_generation_results(
                    profile_id=str(final_profile_id),
                    primary_id=trace_id,
                )
                # image_results["images"] contains list of image_ids (strings)
                image_ids = image_results.get("images", [])
                if image_ids:
                    generated_image_ids = image_ids
                    logger.info(
                        f"Retrieved {len(generated_image_ids)} image IDs from storage "
                        f"(generation in progress in background)"
                    )
                    # Don't clear storage - background tasks will clean up individual image contexts

            # Emit completion event
            await scenario_generation_complete(
                ScenarioGenerationCompletePayload(
                    success=True,
                    message="Scenario generated successfully",
                    title=title,
                    description=description,
                    objectives=limited_objectives,
                    dynamic_document_mapping=dynamic_document_mapping,
                    generated_image_ids=generated_image_ids
                    if generated_image_ids
                    else None,
                    trace_id=trace_id,
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in generate_scenario for {sid}: {str(e)}", exc_info=True
        )
        await scenario_generation_error(
            ScenarioGenerationErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def generate_scenario(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateScenarioAIPayload(**data)
        await _generate_scenario_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in generate_scenario for {sid}: {e}")
        await scenario_generation_error(
            ScenarioGenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", trace_id=None
            ),
            room=sid,
        )


"""Per-resource-type column schemas.

Business columns only — excludes system columns (id, created_at, active, generated, mcp)
that are present on every resource table.

Type strings: text, int, float, numeric, bool, uuid, array, enum, timestamp
"""

RESOURCE_SCHEMAS: dict[str, dict[str, str]] = {
    "agents": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "temperature": "float",
        "reasoning": "text",
        "tool_ids": "array",
        "quality": "enum",
        "voice": "text",
        "model_id": "uuid",
        "prompt_id": "uuid",
        "instruction_ids": "array",
    },
    "arg_positions": {
        "args_id": "uuid",
        "value": "int",
    },
    "args_outputs": {
        "args_id": "uuid",
        "name": "text",
        "template": "text",
    },
    "args": {
        "name": "text",
        "description": "text",
        "field_type": "text",
        "required": "bool",
        "default_value": "text",
    },
    "auth_item_keys": {
        "auth_id": "uuid",
        "key_id": "uuid",
        "updated_at": "timestamp",
        "item_id": "uuid",
    },
    "auths": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "slug": "text",
        "protocol": "text",
    },
    "bindings": {
        "entry": "enum",
    },
    "cohorts": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "simulation_ids": "array",
    },
    "colors": {
        "name": "text",
        "description": "text",
        "hex_code": "text",
    },
    "conditional_parameters": {
        "parameter_id": "uuid",
        "updated_at": "timestamp",
    },
    "departments": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "setting_ids": "array",
    },
    "descriptions": {
        "description": "text",
    },
    "documents": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "upload_id": "uuid",
        "text_id": "uuid",
        "image_ids": "array",
        "template": "bool",
        "parameter_ids": "array",
        "parameter_field_ids": "array",
    },
    "domains": {
        "resource": "enum",
        "creatable": "bool",
    },
    "emails": {
        "email": "text",
    },
    "endpoints": {
        "base_url": "text",
    },
    "evals": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
    },
    "examples": {
        "example": "text",
    },
    "fields": {
        "name": "text",
        "description": "text",
        "value": "text",
        "department_ids": "array",
        "conditional_parameter_ids": "array",
    },
    "flags": {
        "name": "text",
        "description": "text",
        "type": "enum",
        "icon": "text",
    },
    "group_positions": {
        "groups_id": "uuid",
        "value": "int",
        "eval_id": "uuid",
    },
    "groups": {},
    "group_rubrics": {
        "groups_id": "uuid",
        "rubric_id": "uuid",
    },
    "icons": {
        "name": "text",
        "description": "text",
        "value": "text",
    },
    "images": {
        "name": "text",
        "description": "text",
    },
    "instructions": {
        "template": "text",
    },
    "items": {
        "name": "text",
        "description": "text",
        "encrypted": "bool",
        "position": "int",
    },
    "keys": {
        "key_id": "uuid",
        "key": "text",
        "name": "text",
        "description": "text",
    },
    "modalities": {
        "modality": "enum",
        "is_input": "bool",
    },
    "models": {
        "value": "text",
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "provider_id": "uuid",
        "temperature_level_ids": "array",
        "reasoning_level_ids": "array",
        "quality_ids": "array",
        "voice_ids": "array",
        "modality_ids": "array",
    },
    "names": {
        "name": "text",
    },
    "objectives": {
        "objective": "text",
    },
    "options": {
        "option_text": "text",
        "is_correct": "bool",
        "question_id": "uuid",
    },
    "parameter_fields": {
        "field_id": "uuid",
        "updated_at": "timestamp",
        "parameter_id": "uuid",
        "conditional_parameter_id": "uuid",
        "conditional_parameter_ids": "array",
    },
    "parameters": {
        "name": "text",
        "description": "text",
        "value": "text",
        "department_ids": "array",
        "persona_parameter": "bool",
        "document_parameter": "bool",
        "scenario_parameter": "bool",
        "video_parameter": "bool",
        "field_ids": "array",
    },
    "personas": {
        "name": "text",
        "description": "text",
        "icon": "text",
        "color": "text",
        "department_ids": "array",
        "instructions": "text",
        "examples": "array",
        "parameter_ids": "array",
        "parameter_field_ids": "array",
    },
    "points": {
        "value": "int",
    },
    "pricing": {
        "pricing_type": "enum",
        "price": "float",
        "unit_id": "uuid",
    },
    "problem_statements": {
        "name": "text",
        "problem_statement": "text",
    },
    "profiles": {
        "last_login": "timestamp",
        "role": "enum",
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "cohort_ids": "array",
        "role_id": "uuid",
        "emails": "array",
        "primary_email": "text",
        "requests_per_day": "int",
    },
    "prompts": {
        "system_prompt": "text",
        "name": "text",
        "description": "text",
    },
    "protocols": {
        "value": "text",
    },
    "provider_keys": {
        "provider_id": "uuid",
        "key_id": "uuid",
        "key": "text",
        "name": "text",
        "description": "text",
    },
    "providers": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "value": "text",
        "endpoint": "text",
        "key": "text",
    },
    "qualities": {
        "quality": "enum",
    },
    "questions": {
        "question_text": "text",
        "allow_multiple": "bool",
        "time": "int",
    },
    "reasoning_levels": {
        "reasoning_level_id": "uuid",
        "reasoning_level": "text",
    },
    "request_limits": {
        "requests_per_day": "int",
    },
    "roles": {
        "role": "enum",
        "name": "text",
        "description": "text",
        "icon_id": "uuid",
        "color_id": "uuid",
        "artifacts": "array",
    },
    "rubrics": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "total_points": "int",
        "pass_points": "int",
        "simulation_rubric": "bool",
        "video_rubric": "bool",
        "standard_group_ids": "array",
    },
    "run_positions": {
        "runs_id": "uuid",
        "value": "int",
        "eval_id": "uuid",
    },
    "run_rubrics": {
        "runs_id": "uuid",
        "rubric_id": "uuid",
    },
    "runs": {},
    "scenario_flags": {
        "flag_id": "uuid",
        "scenario_id": "uuid",
    },
    "scenario_personas": {
        "scenario_id": "uuid",
        "persona_id": "uuid",
    },
    "scenario_positions": {
        "value": "int",
        "scenario_id": "uuid",
    },
    "scenario_rubrics": {
        "rubric_id": "uuid",
        "scenario_id": "uuid",
    },
    "scenario_time_limits": {
        "time_limit_seconds": "int",
        "scenario_id": "uuid",
        "negative": "bool",
    },
    "scenarios": {
        "name": "text",
        "description": "text",
        "problem_statement_enabled": "bool",
        "objectives_enabled": "bool",
        "video_enabled": "bool",
        "images_enabled": "bool",
        "questions_enabled": "bool",
        "department_ids": "array",
        "persona_ids": "array",
        "parameter_ids": "array",
        "parameter_field_ids": "array",
    },
    "settings": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "agent_ids": "array",
        "provider_key_ids": "array",
        "auth_ids": "array",
    },
    "simulation_availability": {
        "simulation_id": "uuid",
        "time": "timestamp",
        "type": "enum",
        "updated_at": "timestamp",
    },
    "simulation_positions": {
        "value": "int",
        "simulation_id": "uuid",
    },
    "simulations": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "scenario_ids": "array",
    },
    "slugs": {
        "value": "text",
    },
    "standard_groups": {
        "name": "text",
        "short_name": "text",
        "description": "text",
        "points": "int",
        "pass_points": "int",
    },
    "standards": {
        "name": "text",
        "description": "text",
        "points": "int",
        "standard_group_id": "uuid",
    },
    "temperature_levels": {
        "temperature": "float",
    },
    "texts": {
        "text_id": "uuid",
    },
    "thresholds": {
        "value": "int",
    },
    "tools": {
        "name": "text",
        "description": "text",
        "department_ids": "array",
        "createable": "bool",
        "args_ids": "array",
        "args_output_ids": "array",
    },
    "uploads": {
        "upload_id": "uuid",
    },
    "values": {
        "value": "text",
    },
    "videos": {
        "name": "text",
        "description": "text",
    },
    "voices": {
        "voice": "text",
    },
}

# resource_outputs_relation (resource_type → output schema fields)
# Simplified types (string/number/boolean) for the tool-facing output contract.
RESOURCE_OUTPUT_SCHEMAS: dict[str, list[dict[str, str]]] = {
    "agents": [{"field_type": "string", "name": "id"}],
    "arg_positions": [{"field_type": "string", "name": "id"}],
    "args": [{"field_type": "string", "name": "id"}],
    "args_outputs": [{"field_type": "string", "name": "id"}],
    "auth_item_keys": [{"field_type": "string", "name": "id"}],
    "cohorts": [{"field_type": "string", "name": "id"}],
    "colors": [
        {"field_type": "string", "name": "description"},
        {"field_type": "string", "name": "hex_code"},
        {"field_type": "string", "name": "id"},
        {"field_type": "string", "name": "name"},
    ],
    "departments": [{"field_type": "string", "name": "id"}],
    "descriptions": [
        {"field_type": "string", "name": "description"},
        {"field_type": "string", "name": "id"},
    ],
    "documents": [{"field_type": "string", "name": "id"}],
    "emails": [{"field_type": "string", "name": "email"}],
    "endpoints": [{"field_type": "string", "name": "base_url"}],
    "evals": [{"field_type": "string", "name": "id"}],
    "examples": [
        {"field_type": "string", "name": "example"},
        {"field_type": "string", "name": "id"},
    ],
    "fields": [{"field_type": "string", "name": "id"}],
    "flags": [{"field_type": "string", "name": "id"}],
    "group_positions": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "string", "name": "eval_id"},
        {"field_type": "string", "name": "group_id"},
        {"field_type": "string", "name": "value"},
    ],
    "group_rubrics": [{"field_type": "string", "name": "id"}],
    "groups": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "string", "name": "group_id"},
    ],
    "icons": [{"field_type": "string", "name": "id"}],
    "images": [
        {"field_type": "string", "name": "description"},
        {"field_type": "string", "name": "name"},
    ],
    "instructions": [
        {"field_type": "string", "name": "id"},
        {"field_type": "string", "name": "template"},
    ],
    "items": [
        {"field_type": "string", "name": "description"},
        {"field_type": "boolean", "name": "encrypted"},
        {"field_type": "string", "name": "name"},
        {"field_type": "number", "name": "position"},
    ],
    "keys": [
        {"field_type": "string", "name": "id"},
        {"field_type": "string", "name": "key_id"},
    ],
    "modalities": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "string", "name": "modality"},
    ],
    "models": [
        {"field_type": "string", "name": "id"},
        {"field_type": "string", "name": "value"},
    ],
    "names": [
        {"field_type": "string", "name": "id"},
        {"field_type": "string", "name": "name"},
    ],
    "objectives": [{"field_type": "string", "name": "objective"}],
    "options": [
        {"field_type": "boolean", "name": "is_correct"},
        {"field_type": "string", "name": "option_text"},
    ],
    "parameter_fields": [
        {"field_type": "string", "name": "field_id"},
        {"field_type": "string", "name": "id"},
        {"field_type": "string", "name": "parameter_id"},
    ],
    "parameters": [{"field_type": "string", "name": "id"}],
    "personas": [{"field_type": "string", "name": "id"}],
    "points": [{"field_type": "string", "name": "value"}],
    "pricing": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "number", "name": "price"},
        {"field_type": "string", "name": "pricing_type"},
        {"field_type": "string", "name": "unit_id"},
    ],
    "problem_statements": [
        {"field_type": "string", "name": "name"},
        {"field_type": "string", "name": "problem_statement"},
    ],
    "profiles": [{"field_type": "string", "name": "id"}],
    "prompts": [
        {"field_type": "string", "name": "description"},
        {"field_type": "string", "name": "name"},
        {"field_type": "string", "name": "system_prompt"},
    ],
    "protocols": [{"field_type": "string", "name": "value"}],
    "provider_keys": [{"field_type": "string", "name": "id"}],
    "providers": [{"field_type": "string", "name": "provider_id"}],
    "qualities": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "string", "name": "quality"},
    ],
    "questions": [
        {"field_type": "boolean", "name": "allow_multiple"},
        {"field_type": "string", "name": "question_text"},
        {"field_type": "number", "name": "time"},
    ],
    "reasoning_levels": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "string", "name": "reasoning_level"},
        {"field_type": "string", "name": "reasoning_level_id"},
    ],
    "request_limits": [{"field_type": "number", "name": "requests_per_day"}],
    "rubrics": [{"field_type": "string", "name": "id"}],
    "run_positions": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "string", "name": "eval_id"},
        {"field_type": "string", "name": "run_id"},
        {"field_type": "string", "name": "value"},
    ],
    "run_rubrics": [{"field_type": "string", "name": "id"}],
    "runs": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "string", "name": "run_id"},
    ],
    "scenario_flags": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "string", "name": "description"},
        {"field_type": "string", "name": "icon_id"},
        {"field_type": "string", "name": "id"},
        {"field_type": "string", "name": "name"},
    ],
    "scenario_personas": [{"field_type": "string", "name": "id"}],
    "scenario_positions": [
        {"field_type": "string", "name": "id"},
        {"field_type": "string", "name": "scenario_id"},
        {"field_type": "string", "name": "simulation_id"},
        {"field_type": "string", "name": "value"},
    ],
    "scenario_rubrics": [{"field_type": "string", "name": "id"}],
    "scenario_time_limits": [{"field_type": "string", "name": "id"}],
    "scenarios": [{"field_type": "string", "name": "id"}],
    "settings": [{"field_type": "string", "name": "id"}],
    "simulation_availability": [
        {"field_type": "string", "name": "simulation_id"},
        {"field_type": "number", "name": "time"},
        {"field_type": "string", "name": "type"},
    ],
    "simulation_positions": [
        {"field_type": "string", "name": "simulation_id"},
        {"field_type": "string", "name": "value"},
    ],
    "simulations": [{"field_type": "string", "name": "id"}],
    "slugs": [{"field_type": "string", "name": "value"}],
    "standard_groups": [
        {"field_type": "string", "name": "description"},
        {"field_type": "string", "name": "name"},
        {"field_type": "number", "name": "pass_points"},
        {"field_type": "number", "name": "points"},
        {"field_type": "string", "name": "short_name"},
    ],
    "temperature_levels": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "boolean", "name": "is_upper"},
        {"field_type": "number", "name": "temperature"},
        {"field_type": "string", "name": "temperature_level_id"},
    ],
    "texts": [{"field_type": "string", "name": "id"}],
    "thresholds": [{"field_type": "string", "name": "value"}],
    "uploads": [{"field_type": "string", "name": "id"}],
    "values": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "string", "name": "value"},
    ],
    "videos": [
        {"field_type": "string", "name": "description"},
        {"field_type": "number", "name": "length_seconds"},
        {"field_type": "string", "name": "name"},
    ],
    "voices": [
        {"field_type": "boolean", "name": "active"},
        {"field_type": "string", "name": "voice"},
        {"field_type": "string", "name": "voice_id"},
    ],
}

# artifact_units_relation (unit_id → unit_name)
UNIT_NAMES: dict[str, str] = {
    "019b3be4-3ced-7b19-a313-ffdaa73b65fe": "200k",
    "019b3be4-3ced-7b2b-8fd2-54556abd3391": "image",
    "019b3be4-3ced-7b0d-b978-c5a8f6729c49": "million_audio",
    "019b3be4-3ced-7b1c-84f7-4e13f220fdb4": "million_image",
    "019b3be4-3ced-7acb-afab-19ceef6b410b": "million_text",
    "019b3be4-3ced-7b23-a804-0ab3f0dff208": "second",
}

# artifact_units_relation (unit_id → unit_value divisor)
UNIT_VALUES: dict[str, int] = {
    "019b3be4-3ced-7b19-a313-ffdaa73b65fe": 200000,
    "019b3be4-3ced-7b2b-8fd2-54556abd3391": 1,
    "019b3be4-3ced-7b0d-b978-c5a8f6729c49": 1000000,
    "019b3be4-3ced-7b1c-84f7-4e13f220fdb4": 1000000,
    "019b3be4-3ced-7acb-afab-19ceef6b410b": 1000000,
    "019b3be4-3ced-7b23-a804-0ab3f0dff208": 1,
}

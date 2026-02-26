-- Module: Chat
-- Category: agent
-- Description: Chat system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are a chat generation agent responsible for creating and managing training chat sessions with persona-driven scenario conversations.

## Your Role

Generate or update only the requested resource_types for a chat artifact:
names, descriptions, flags, departments, personas, documents, scenarios, parameter_fields, parameters, fields, questions, options, videos, images, objectives, problem_statements.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_personas**: Create a new persona binding (persona_id)
- **create_documents**: Create a new reference document (document_id)
- **create_scenarios**: Create a new scenario binding (scenario_id)
- **create_parameter_fields**: Create a new parameter field link (field_id, parameter_id)
- **create_parameters**: Create a new parameter binding (parameter_id)
- **create_fields**: Create a new field value (field_id)
- **create_questions**: Create a new scenario question (question text)
- **create_options**: Create a new response option (option text)
- **create_videos**: Create a new video reference (video_id)
- **create_images**: Create a new image reference (image_id)
- **create_objectives**: Create a new learning objective (objective text)
- **create_problem_statements**: Create a new problem statement (statement text)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_personas**: Use an existing persona by its ID
- **use_documents**: Use an existing document by its ID
- **use_scenarios**: Use an existing scenario by its ID
- **use_parameter_fields**: Use an existing parameter_field by its ID
- **use_parameters**: Use an existing parameter by its ID
- **use_fields**: Use an existing field by its ID
- **use_questions**: Use an existing question by its ID
- **use_options**: Use an existing option by its ID
- **use_videos**: Use an existing video by its ID
- **use_images**: Use an existing image by its ID
- **use_objectives**: Use an existing objective by its ID
- **use_problem_statements**: Use an existing problem_statement by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the chat
- Provide detailed descriptions explaining the chat''s role and characteristics
- Ensure consistency across all chat elements
- Review available resources in the context FIRST before creating new ones
- Use existing resources when suitable ones are already available (avoids duplicates)
- Create new resources only when nothing suitable exists

### Best Practices
- Operate only on requested resource_types
- Prefer using existing suitable resources before creating new ones
- Do not invent IDs — use IDs provided in context
- Keep outputs deterministic, concise, and production-safe
- Return only valid tool calls and arguments
- Do not output narrative text
', 'Chat Prompt', 'AI agent for creating and managing training chat sessions with persona-driven scenario conversations', true, '019c82b8-5daa-7b10-802c-6334ed655fe4', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-11T20:37:27.875564+00:00', true, false, false, 'bb000003-0000-0000-0000-000000000003', 'Chat', 'AI agent for creating and managing training chat sessions with persona-driven scenario conversations', '{}', NULL, NULL, '{019bebc4-d436-7c01-b86b-9483883762a6,019c0a2d-fc36-7e78-9083-05afa0c8e4d8,019c0a2d-fc36-7d3c-ac2c-a2108a6c55de,019c0a2d-fc36-7ace-adde-c1e47bc14a89,019c0a2d-fc36-7c0c-80c1-098a75897197,019c0a2d-fc36-756e-b50e-a5987eb4f0d5,019c06a8-2af6-7439-b8fb-2a083dd49848,019c0a2d-fc36-7997-bdca-92935994cb93,019c0a2d-fc36-785a-9b6d-02eca12bb6e6,019c06a8-2af6-727b-b94a-71bddc4d76de,019c0a2d-fc36-770a-b18d-af61cdf0f908,019c06a8-2af5-766c-9713-315ab9567235,019c0a2d-fc35-7eb7-8bc4-4a4d9578918d,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019bebc4-d436-7b96-b622-c512f3a418da,019bebc4-d436-78e3-ae05-f12509f43557,019bebc4-d436-7b81-9555-1d88249b6d78,019bebc4-d436-7b9b-b92c-009fbdb67144,019bf207-ca52-70cc-ae3c-a5ca44d6d5e9,019bebc4-d436-7bd2-b670-e4c1b24b1a9c,019bebc4-d436-7b8b-8443-f82efdfd5790,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7b8d-adb8-3b17bafdda99,52bd3f2d-8a5f-4a90-940a-a334975adc2a,019c4f27-1778-7a54-b3bb-1574ff2c0357,019c0cd8-ad73-72dd-8a41-ea5b247384db,019c06a8-2af6-7609-9bc5-2782eb639be2,98194c0a-97af-4bf8-8c30-12a87bfbacb2,b4e15440-86af-48e3-b18f-e8d11e55302b,ac2d7f98-3e27-4c0e-87b8-c283a3305062,753f699e-f1dc-4fd9-8701-a69f26d0c110,a51d1d18-44d9-4fd3-a7d3-3db17b652d02}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5daa-7b10-802c-6334ed655fe4', '{019c82b8-5dab-7448-9750-1cf0a3cf6412}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('bb000002-0000-0000-0000-000000000002', 'AI agent for creating and managing training chat sessions with persona-driven scenario conversations', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5dab-7448-9750-1cf0a3cf6412', '## Current State
{% set draft = entries.draft_chat if entries and entries.draft_chat else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.persona_ids and draft.persona_ids|length > 0 %}{% set selected = [] %}{% for item in resources.personas if item.id|string in draft.persona_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Personas: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Personas: ({{ draft.persona_ids|length }} selected by ID){% endif %}{% else %}Personas: (not set){% endif %}
{% if draft and draft.document_ids and draft.document_ids|length > 0 %}{% set selected = [] %}{% for item in resources.documents if item.id|string in draft.document_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Documents: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Documents: ({{ draft.document_ids|length }} selected by ID){% endif %}{% else %}Documents: (not set){% endif %}
{% if draft and draft.scenario_ids and draft.scenario_ids|length > 0 %}{% set selected = [] %}{% for item in resources.scenarios if item.id|string in draft.scenario_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Scenarios: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Scenarios: ({{ draft.scenario_ids|length }} selected by ID){% endif %}{% else %}Scenarios: (not set){% endif %}
{% if draft and draft.parameter_field_ids and draft.parameter_field_ids|length > 0 %}{% set selected = [] %}{% for item in resources.parameter_fields if item.id|string in draft.parameter_field_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Parameter Fields: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Parameter Fields: ({{ draft.parameter_field_ids|length }} selected by ID){% endif %}{% else %}Parameter Fields: (not set){% endif %}
{% if draft and draft.parameter_ids and draft.parameter_ids|length > 0 %}{% set selected = [] %}{% for item in resources.parameters if item.parameter_id|string in draft.parameter_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Parameters: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Parameters: ({{ draft.parameter_ids|length }} selected by ID){% endif %}{% else %}Parameters: (not set){% endif %}
{% if draft and draft.field_ids and draft.field_ids|length > 0 %}{% set selected = [] %}{% for item in resources.fields if item.field_id|string in draft.field_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Fields: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Fields: ({{ draft.field_ids|length }} selected by ID){% endif %}{% else %}Fields: (not set){% endif %}
{% if draft and draft.question_ids and draft.question_ids|length > 0 %}{% set selected = [] %}{% for item in resources.questions if item.id|string in draft.question_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Questions: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Questions: ({{ draft.question_ids|length }} selected by ID){% endif %}{% else %}Questions: (not set){% endif %}
{% if draft and draft.option_ids and draft.option_ids|length > 0 %}{% set selected = [] %}{% for item in resources.options if item.id|string in draft.option_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Options: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Options: ({{ draft.option_ids|length }} selected by ID){% endif %}{% else %}Options: (not set){% endif %}
{% if draft and draft.video_ids and draft.video_ids|length > 0 %}{% set selected = [] %}{% for item in resources.videos if item.id|string in draft.video_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Videos: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Videos: ({{ draft.video_ids|length }} selected by ID){% endif %}{% else %}Videos: (not set){% endif %}
{% if draft and draft.image_ids and draft.image_ids|length > 0 %}{% set selected = [] %}{% for item in resources.images if item.id|string in draft.image_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Images: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Images: ({{ draft.image_ids|length }} selected by ID){% endif %}{% else %}Images: (not set){% endif %}
{% if draft and draft.objective_ids and draft.objective_ids|length > 0 %}{% set selected = [] %}{% for item in resources.objectives if item.id|string in draft.objective_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Objectives: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Objectives: ({{ draft.objective_ids|length }} selected by ID){% endif %}{% else %}Objectives: (not set){% endif %}
{% if draft and draft.problem_statement_ids and draft.problem_statement_ids|length > 0 %}{% set selected = [] %}{% for item in resources.problem_statements if item.id|string in draft.problem_statement_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Problem Statements: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Problem Statements: ({{ draft.problem_statement_ids|length }} selected by ID){% endif %}{% else %}Problem Statements: (not set){% endif %}

---

{% set all_gen_types = (resources.types or []) + (entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and resources.names and resources.names|length > 0 %}
Names:
{% for item in resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and resources.descriptions and resources.descriptions|length > 0 %}
Descriptions:
{% for item in resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and resources.flags and resources.flags|length > 0 %}
Flags:
{% for item in resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and resources.departments and resources.departments|length > 0 %}
Departments:
{% for item in resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "personas" in all_gen_types and resources.personas and resources.personas|length > 0 %}
Personas:
{% for item in resources.personas %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "documents" in all_gen_types and resources.documents and resources.documents|length > 0 %}
Documents:
{% for item in resources.documents %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "scenarios" in all_gen_types and resources.scenarios and resources.scenarios|length > 0 %}
Scenarios:
{% for item in resources.scenarios %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "parameter_fields" in all_gen_types and resources.parameter_fields and resources.parameter_fields|length > 0 %}
Parameter Fields:
{% for item in resources.parameter_fields %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "parameters" in all_gen_types and resources.parameters and resources.parameters|length > 0 %}
Parameters:
{% for item in resources.parameters %}
- id: {{ item.parameter_id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "fields" in all_gen_types and resources.fields and resources.fields|length > 0 %}
Fields:
{% for item in resources.fields %}
- id: {{ item.field_id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "questions" in all_gen_types and resources.questions and resources.questions|length > 0 %}
Questions:
{% for item in resources.questions %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "options" in all_gen_types and resources.options and resources.options|length > 0 %}
Options:
{% for item in resources.options %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "videos" in all_gen_types and resources.videos and resources.videos|length > 0 %}
Videos:
{% for item in resources.videos %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "images" in all_gen_types and resources.images and resources.images|length > 0 %}
Images:
{% for item in resources.images %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "objectives" in all_gen_types and resources.objectives and resources.objectives|length > 0 %}
Objectives:
{% for item in resources.objectives %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "problem_statements" in all_gen_types and resources.problem_statements and resources.problem_statements|length > 0 %}
Problem Statements:
{% for item in resources.problem_statements %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}

---

## Generating For
{% if resources.types and resources.types|length > 0 %}
Resource types (create or use): {{ resources.types|join(", ") }}
{% endif %}
{% if entries.types and entries.types|length > 0 %}
Entry types (use only): {{ entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('bb000001-0000-0000-0000-000000000001', 'Chat', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:37:27.875564+00:00', '2026-02-11T20:37:27.875564+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bb000003-0000-0000-0000-000000000003', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bb000002-0000-0000-0000-000000000002', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c82b8-5dab-7448-9750-1cf0a3cf6412', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bb000001-0000-0000-0000-000000000001', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c82b8-5daa-7b10-802c-6334ed655fe4', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bebc4-d436-7b8d-adb8-3b17bafdda99', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bebc4-d436-7b8b-8443-f82efdfd5790', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bebc4-d436-7bd2-b670-e4c1b24b1a9c', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bebc4-d436-7b9b-b92c-009fbdb67144', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bebc4-d436-7b81-9555-1d88249b6d78', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bebc4-d436-78e3-ae05-f12509f43557', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019bebc4-d436-7b96-b622-c512f3a418da', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c0a2d-fc35-7eb7-8bc4-4a4d9578918d', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c0a2d-fc36-770a-b18d-af61cdf0f908', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c0a2d-fc36-785a-9b6d-02eca12bb6e6', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c0a2d-fc36-7997-bdca-92935994cb93', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c06a8-2af6-7439-b8fb-2a083dd49848', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c0a2d-fc36-756e-b50e-a5987eb4f0d5', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c0a2d-fc36-7c0c-80c1-098a75897197', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c0a2d-fc36-7ace-adde-c1e47bc14a89', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c0a2d-fc36-7d3c-ac2c-a2108a6c55de', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c0a2d-fc36-7e78-9083-05afa0c8e4d8', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '98194c0a-97af-4bf8-8c30-12a87bfbacb2', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b4e15440-86af-48e3-b18f-e8d11e55302b', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ac2d7f98-3e27-4c0e-87b8-c283a3305062', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '753f699e-f1dc-4fd9-8701-a69f26d0c110', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a51d1d18-44d9-4fd3-a7d3-3db17b652d02', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '52bd3f2d-8a5f-4a90-940a-a334975adc2a', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c4f27-1778-7a54-b3bb-1574ff2c0357', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c06a8-2af6-7609-9bc5-2782eb639be2', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '019c0cd8-ad73-72dd-8a41-ea5b247384db', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;

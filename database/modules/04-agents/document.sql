-- Module: Document
-- Category: agent
-- Description: Document system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2025-12-02T13:15:00.683340+00:00', 'You are a document generation agent responsible for creating and managing documents with uploads, images, text content, and parameter fields.

## Your Role

Generate or update only the requested resource_types for a document artifact:
names, descriptions, flags, departments, images, parameter_fields, parameters, texts, uploads.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_images**: Create a new image (image reference)
- **create_parameter_fields**: Create a new parameter field link (field_id, parameter_id)
- **create_parameters**: Create a new parameter binding (parameter_id)
- **create_texts**: Create a new text content (text body)
- **create_uploads**: Create a new file upload (upload reference)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_images**: Use an existing image by its ID
- **use_parameter_fields**: Use an existing parameter_field by its ID
- **use_parameters**: Use an existing parameter by its ID
- **use_texts**: Use an existing text by its ID
- **use_uploads**: Use an existing upload by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the document
- Provide detailed descriptions explaining the document''s role and characteristics
- Ensure consistency across all document elements
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
', 'Document Agent System Prompt', 'System prompt for document generation agents', true, '019b3be4-36fe-7be0-9e4c-1981f6603d55', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea1-7cc3-af43-22701005aebd', 'Agent for generating and working with documents, templates, and structured content', '2025-12-02T13:15:00.683340+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019b8c1f-2a67-7352-9eb5-3bfe0b853b10', '## Current State
{% set draft = artifacts.document.get.entries.draft_document if artifacts.document.get.entries and artifacts.document.get.entries.draft_document else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.document.get.resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.document.get.resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.document.get.resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.document.get.resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.image_ids and draft.image_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.document.get.resources.images if item.id|string in draft.image_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Images: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Images: ({{ draft.image_ids|length }} selected by ID){% endif %}{% else %}Images: (not set){% endif %}
{% if draft and draft.parameter_field_ids and draft.parameter_field_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.document.get.resources.parameter_fields if item.id|string in draft.parameter_field_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Parameter Fields: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Parameter Fields: ({{ draft.parameter_field_ids|length }} selected by ID){% endif %}{% else %}Parameter Fields: (not set){% endif %}
{% if draft and draft.parameter_ids and draft.parameter_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.document.get.resources.parameters if item.parameter_id|string in draft.parameter_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Parameters: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Parameters: ({{ draft.parameter_ids|length }} selected by ID){% endif %}{% else %}Parameters: (not set){% endif %}
{% if draft and draft.text_ids and draft.text_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.document.get.resources.texts if item.id|string in draft.text_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Texts: {% for item in selected %}{{ item.text[:80] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Texts: ({{ draft.text_ids|length }} selected by ID){% endif %}{% else %}Texts: (not set){% endif %}
{% if draft and draft.upload_ids and draft.upload_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.document.get.resources.uploads if item.id|string in draft.upload_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Uploads: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Uploads: ({{ draft.upload_ids|length }} selected by ID){% endif %}{% else %}Uploads: (not set){% endif %}

---

{% set all_gen_types = (artifacts.document.get.resources.types or []) + (artifacts.document.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.document.get.resources.names and artifacts.document.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.document.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and artifacts.document.get.resources.descriptions and artifacts.document.get.resources.descriptions|length > 0 %}
Descriptions:
{% for item in artifacts.document.get.resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.document.get.resources.flags and artifacts.document.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.document.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and artifacts.document.get.resources.departments and artifacts.document.get.resources.departments|length > 0 %}
Departments:
{% for item in artifacts.document.get.resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "images" in all_gen_types and artifacts.document.get.resources.images and artifacts.document.get.resources.images|length > 0 %}
Images:
{% for item in artifacts.document.get.resources.images %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "parameter_fields" in all_gen_types and artifacts.document.get.resources.parameter_fields and artifacts.document.get.resources.parameter_fields|length > 0 %}
Parameter Fields:
{% for item in artifacts.document.get.resources.parameter_fields %}
- id: {{ item.id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "parameters" in all_gen_types and artifacts.document.get.resources.parameters and artifacts.document.get.resources.parameters|length > 0 %}
Parameters:
{% for item in artifacts.document.get.resources.parameters %}
- id: {{ item.parameter_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "texts" in all_gen_types and artifacts.document.get.resources.texts and artifacts.document.get.resources.texts|length > 0 %}
Texts:
{% for item in artifacts.document.get.resources.texts %}
- id: {{ item.id }} | {{ item.text[:80] }}{% if item.text|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "uploads" in all_gen_types and artifacts.document.get.resources.uploads and artifacts.document.get.resources.uploads|length > 0 %}
Uploads:
{% for item in artifacts.document.get.resources.uploads %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.document.get.resources.types and artifacts.document.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.document.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.document.get.entries.types and artifacts.document.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.document.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-01-05T03:06:51.366493+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea0-7d03-a4e4-614e3dca72a2', 'Document', '2025-12-02T13:15:00.683340+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T13:15:00.683340+00:00', '2025-12-02T13:15:00.683340+00:00', '019b3be4-3112-774d-82b2-c4c3ed98238e', false, false) ON CONFLICT (id) DO NOTHING;

-- Tools (tools_resource for create_html)
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('2026-01-13T23:48:20.098044+00:00', true, false, false, '019bebc4-d436-7bcc-b38a-2799877eb259', 'create_html', 'Generate the Jinja template HTML for the document.', '{}', 'create', '{}', '{}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019b995c-8ea1-7cc3-af43-22701005aebd', '2025-12-02T13:15:00.683340+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2025-12-02T13:15:00.683340+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- config_resource (from agent_models_junction)
INSERT INTO public.config_resource (id, model_id, prompt_id, instruction_ids, created_at, generated, mcp, active) VALUES ('d3387474-56d5-51da-aa2a-665f92fec605', '019bb25e-e5ff-7793-a3bb-74e2548d9062', '019b3be4-36fe-7be0-9e4c-1981f6603d55', ARRAY['019b8c1f-2a67-7352-9eb5-3bfe0b853b10'::uuid], '2026-01-23T16:46:46.036849+00:00', false, false, true) ON CONFLICT (id) DO NOTHING;
-- agent_configs_junction
INSERT INTO public.agent_configs_junction (agent_id, config_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', 'd3387474-56d5-51da-aa2a-665f92fec605', '2026-01-23T16:46:46.036849+00:00', false, false, true) ON CONFLICT (agent_id, config_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019b995c-8ea0-7d03-a4e4-614e3dca72a2', '2025-12-02T13:15:00.683340+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7b73-a506-0b196bce4ada', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7d16-8107-8dc0086e3182', true, '2026-01-15T02:40:56.685940+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7d1d-9e14-3299c8677730', true, '2026-01-15T02:40:56.692128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-78e3-ae05-f12509f43557', true, '2026-01-17T17:57:40.542460+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7d20-945d-557447e427bd', true, '2026-01-17T17:57:40.542460+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', 'b4e15440-86af-48e3-b18f-e8d11e55302b', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', 'aa93008d-9bcd-4594-a41c-9f003f6f1b33', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019c0a2d-fc36-770a-b18d-af61cdf0f908', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019c06a8-2af6-7609-9bc5-2782eb639be2', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019c06a8-2af6-7439-b8fb-2a083dd49848', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '1b746440-0408-4df2-8130-87eacd6b05af', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', 'a9275dc8-75e1-42c9-8fd7-ab5bdee1189b', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7bcc-b38a-2799877eb259', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- agents_resource (denormalized row for generation pipeline)
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2025-12-02T13:15:00.683340+00:00', true, false, false, '019bb25e-e5f2-7f7a-ba83-2e756143cec4', 'Document', 'Agent for generating and working with documents, templates, and structured content', '{}', NULL, NULL, '{019bebc4-d436-7bcc-b38a-2799877eb259,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7b73-a506-0b196bce4ada,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7d16-8107-8dc0086e3182,019bebc4-d436-7d1d-9e14-3299c8677730,019bebc4-d436-78e3-ae05-f12509f43557,019bebc4-d436-7d20-945d-557447e427bd,aa93008d-9bcd-4594-a41c-9f003f6f1b33,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af6-727b-b94a-71bddc4d76de,1b746440-0408-4df2-8130-87eacd6b05af,a9275dc8-75e1-42c9-8fd7-ab5bdee1189b,019c0a2d-fc36-770a-b18d-af61cdf0f908,019c06a8-2af6-7609-9bc5-2782eb639be2,019c06a8-2af6-7439-b8fb-2a083dd49848,b4e15440-86af-48e3-b18f-e8d11e55302b,019bf207-ca52-70cc-ae3c-a5ca44d6d5e9}', NULL, NULL, '019bb25e-e5ff-7793-a3bb-74e2548d9062', '019b3be4-36fe-7be0-9e4c-1981f6603d55', '{019b8c1f-2a67-7352-9eb5-3bfe0b853b10}') ON CONFLICT (id) DO NOTHING;
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bb25e-e5f2-7f7a-ba83-2e756143cec4', true, '2025-12-02T13:15:00.683340+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;

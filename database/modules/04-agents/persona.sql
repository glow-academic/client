-- Module: Persona
-- Category: agent
-- Description: Persona system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-28T22:10:10.283595+00:00', 'You are a persona generation agent responsible for creating and managing personas for AI-powered simulations and interactions.

Your Role: Generate or update only the requested resource types for a persona artifact.

Resource Guidance:
- names, descriptions, instructions, examples: Strongly prefer creating new — these are typically unique to each persona, but reuse if it genuinely fits
- colors, voices: Prefer using existing options when a suitable match exists, but create if nothing fits
- icons, departments, flags, parameters, parameter_fields: Use existing from available context

Rules:
- For use-only resources: always use use_* tools with IDs from context
- Operate only on the resource/entry types specified in the developer instructions
- Do not invent IDs — use IDs from context
- Return only valid tool calls, no narrative text', 'Persona Agent System Prompt', 'System prompt for persona generation agents that create and manage persona resources', true, '019c06a8-2b01-788b-b8c0-4d92f79fed2f', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-01-10T22:20:49.676121+00:00', true, false, false, '019bb25e-e5f2-7f9e-8027-3334ababb644', 'Persona', 'AI agent for generating and managing persona resources including names, descriptions, colors, icons, instructions, examples, flags, departments, and fields using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c20-b35a-73c9819b708a,019bebc4-d436-7c0f-9471-cfe52d274678,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7bee-9d95-c252a477881d,019c06a8-2af6-7439-b8fb-2a083dd49848,019bf207-ca52-70cc-ae3c-a5ca44d6d5e9,019c06a8-2af4-765d-abe4-dc47e392ad30,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-747f-a440-a2a60dd205e1,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af5-7b5d-9491-b53823a821c7,019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af6-7609-9bc5-2782eb639be2,209cfad1-69b5-40be-a980-406888376306,019bebc4-d436-7ccc-9e9c-6f4b2a633f9d}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c06a8-2b01-788b-b8c0-4d92f79fed2f', '{019c06a8-2b02-7b38-821e-2baeba1039b1}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019ba9ff-7490-7ce9-bc43-10787c7e3eb8', 'AI agent for generating and managing persona resources including names, descriptions, colors, icons, instructions, examples, flags, departments, and fields using GPT-5.1', '2026-01-10T22:20:49.676121+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c06a8-2b02-7b38-821e-2baeba1039b1', '## Current State
{% set draft = entries.draft_persona if entries and entries.draft_persona else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected_names = [] %}{% for n in resources.names if n.id|string in draft.name_ids|map("string")|list %}{% if selected_names.append(n) %}{% endif %}{% endfor %}{% if selected_names|length > 0 %}Names: {% for n in selected_names %}{{ n.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected_descs = [] %}{% for d in resources.descriptions if d.id|string in draft.description_ids|map("string")|list %}{% if selected_descs.append(d) %}{% endif %}{% endfor %}{% if selected_descs|length > 0 %}Descriptions: {% for d in selected_descs %}{{ d.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.color_ids and draft.color_ids|length > 0 %}{% set selected_colors = [] %}{% for c in resources.colors if c.id|string in draft.color_ids|map("string")|list %}{% if selected_colors.append(c) %}{% endif %}{% endfor %}{% if selected_colors|length > 0 %}Colors: {% for c in selected_colors %}{{ c.name }} ({{ c.hex_code }}){% if not loop.last %}, {% endif %}{% endfor %}{% else %}Colors: ({{ draft.color_ids|length }} selected by ID){% endif %}{% else %}Colors: (not set){% endif %}
{% if draft and draft.icon_ids and draft.icon_ids|length > 0 %}{% set selected_icons = [] %}{% for i in resources.icons if i.id|string in draft.icon_ids|map("string")|list %}{% if selected_icons.append(i) %}{% endif %}{% endfor %}{% if selected_icons|length > 0 %}Icons: {% for i in selected_icons %}{{ i.name }} ({{ i.value }}){% if not loop.last %}, {% endif %}{% endfor %}{% else %}Icons: ({{ draft.icon_ids|length }} selected by ID){% endif %}{% else %}Icons: (not set){% endif %}
{% if draft and draft.instruction_ids and draft.instruction_ids|length > 0 %}{% set selected_insts = [] %}{% for i in resources.instructions if i.id|string in draft.instruction_ids|map("string")|list %}{% if selected_insts.append(i) %}{% endif %}{% endfor %}{% if selected_insts|length > 0 %}Instructions: {% for i in selected_insts %}{{ i.template[:80] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Instructions: ({{ draft.instruction_ids|length }} selected by ID){% endif %}{% else %}Instructions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected_flags = [] %}{% for f in resources.flags if f.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected_flags.append(f) %}{% endif %}{% endfor %}{% if selected_flags|length > 0 %}Flags: {% for f in selected_flags %}{{ f.label or f.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected_depts = [] %}{% for d in resources.departments if d.department_id|string in draft.department_ids|map("string")|list %}{% if selected_depts.append(d) %}{% endif %}{% endfor %}{% if selected_depts|length > 0 %}Departments: {% for d in selected_depts %}{{ d.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.example_ids and draft.example_ids|length > 0 %}{% set selected_examples = [] %}{% for e in resources.examples if e.id|string in draft.example_ids|map("string")|list %}{% if selected_examples.append(e) %}{% endif %}{% endfor %}{% if selected_examples|length > 0 %}Examples: {% for e in selected_examples %}{{ e.example[:50] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Examples: ({{ draft.example_ids|length }} selected by ID){% endif %}{% else %}Examples: (not set){% endif %}
{% if draft and draft.parameter_field_ids and draft.parameter_field_ids|length > 0 %}{% set selected_pfs = [] %}{% for pf in resources.parameter_fields if pf.id|string in draft.parameter_field_ids|map("string")|list %}{% if selected_pfs.append(pf) %}{% endif %}{% endfor %}{% if selected_pfs|length > 0 %}Parameter Fields: {% for pf in selected_pfs %}{{ pf.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Parameter Fields: ({{ draft.parameter_field_ids|length }} selected by ID){% endif %}{% else %}Parameter Fields: (not set){% endif %}
{% if draft and draft.parameter_ids and draft.parameter_ids|length > 0 %}{% set selected_params = [] %}{% for p in resources.parameters if p.parameter_id|string in draft.parameter_ids|map("string")|list %}{% if selected_params.append(p) %}{% endif %}{% endfor %}{% if selected_params|length > 0 %}Parameters: {% for p in selected_params %}{{ p.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Parameters: ({{ draft.parameter_ids|length }} selected by ID){% endif %}{% else %}Parameters: (not set){% endif %}
{% if draft and draft.voice_ids is defined and draft.voice_ids and draft.voice_ids|length > 0 %}{% set selected_voices = [] %}{% for v in resources.voices if v.id|string in draft.voice_ids|map("string")|list %}{% if selected_voices.append(v) %}{% endif %}{% endfor %}{% if selected_voices|length > 0 %}Voices: {% for v in selected_voices %}{{ v.voice }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Voices: ({{ draft.voice_ids|length }} selected by ID){% endif %}{% else %}Voices: (not set){% endif %}

---

{% set all_gen_types = (config.resource_types or []) + (config.entry_types or []) %}
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
{% if "colors" in all_gen_types and resources.colors and resources.colors|length > 0 %}
Colors:
{% for item in resources.colors %}
- id: {{ item.id }} | {{ item.name }} | {{ item.hex_code }}
{% endfor %}
{% endif %}
{% if "icons" in all_gen_types and resources.icons and resources.icons|length > 0 %}
Icons:
{% for item in resources.icons %}
- id: {{ item.id }} | {{ item.name }} | {{ item.value }}
{% endfor %}
{% endif %}
{% if "instructions" in all_gen_types and resources.instructions and resources.instructions|length > 0 %}
Instructions:
{% for item in resources.instructions %}
- id: {{ item.id }} | {{ item.template[:80] }}{% if item.template|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and resources.departments and resources.departments|length > 0 %}
Departments:
{% for item in resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and resources.flags and resources.flags|length > 0 %}
Flags:
{% for item in resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "examples" in all_gen_types and resources.examples and resources.examples|length > 0 %}
Examples:
{% for item in resources.examples %}
- id: {{ item.id }} | {{ item.example[:80] }}{% if item.example|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "parameter_fields" in all_gen_types and resources.parameter_fields and resources.parameter_fields|length > 0 %}
Parameter Fields:
{% for item in resources.parameter_fields %}
- id: {{ item.id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "parameters" in all_gen_types and resources.parameters and resources.parameters|length > 0 %}
Parameters:
{% for item in resources.parameters %}
- id: {{ item.parameter_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "voices" in all_gen_types and resources.voices and resources.voices|length > 0 %}
Voices:
{% for item in resources.voices %}
- id: {{ item.id }} | {{ item.voice }}
{% endfor %}
{% endif %}

---

## Generating For
{% if config.resource_types and config.resource_types|length > 0 %}
Resource types (create or use): {{ config.resource_types|join(", ") }}
{% endif %}
{% if config.entry_types and config.entry_types|length > 0 %}
Entry types (use only): {{ config.entry_types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019ba9ff-7490-775f-a5e1-2148751ab900', 'Persona', '2026-01-10T22:20:49.676121+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-10T22:20:49.676121+00:00', '2026-01-10T22:20:49.676121+00:00', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bb25e-e5f2-7f9e-8027-3334ababb644', true, '2026-01-10T22:20:49.676121+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019ba9ff-7490-7ce9-bc43-10787c7e3eb8', '2026-01-10T22:20:49.676121+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-10T22:20:49.676121+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2b02-7b38-821e-2baeba1039b1', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-11T05:18:16.481334+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019ba9ff-7490-775f-a5e1-2148751ab900', '2026-01-10T22:20:49.676121+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-10T22:20:49.676121+00:00', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2b01-788b-b8c0-4d92f79fed2f', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7c0f-9471-cfe52d274678', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7c20-b35a-73c9819b708a', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7bee-9d95-c252a477881d', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af4-765d-abe4-dc47e392ad30', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af5-747f-a440-a2a60dd205e1', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af5-7b5d-9491-b53823a821c7', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af6-7439-b8fb-2a083dd49848', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af6-7609-9bc5-2782eb639be2', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-02-22T23:46:41.084407+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '209cfad1-69b5-40be-a980-406888376306', true, '2026-02-22T23:46:41.084407+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;

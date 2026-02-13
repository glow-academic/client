-- Module: Document
-- Category: agent
-- Description: Document system agent
-- ============================================================


-- Resource rows
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2025-12-02T13:15:00.683340+00:00', true, false, false, '019bb25e-e5f2-7f7a-ba83-2e756143cec4', 'Document', 'Agent for generating and working with documents, templates, and structured content', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c14-a42e-f45a12c4fdb0,019bebc4-d436-7b73-a506-0b196bce4ada,019bebc4-d436-7bcc-b38a-2799877eb259,019bebc4-d436-7bf6-af0e-91e685a8f15e,019bebc4-d436-7d16-8107-8dc0086e3182,019bebc4-d436-7d1d-9e14-3299c8677730,019bebc4-d436-78e3-ae05-f12509f43557,019bebc4-d436-7c3e-b71d-a48e787dafc1,019bebc4-d436-7d20-945d-557447e427bd}', NULL, NULL, '019bb25e-e5ff-7793-a3bb-74e2548d9062', '019b3be4-36fe-7be0-9e4c-1981f6603d55', '{019b8c1f-2a67-7352-9eb5-3bfe0b853b10}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea1-7cc3-af43-22701005aebd', 'Agent for generating and working with documents, templates, and structured content', '2025-12-02T13:15:00.683340+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019b8c1f-2a67-7352-9eb5-3bfe0b853b10', '## Current Form State

The user is currently editing a document with the following selections:

{% set draft = views.draft_document if views and views.draft_document else None %}

{% if names and names|length > 0 %}
**Current Name:** {% for name in names %}{{ name.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.name_ids and draft.name_ids|length > 0 %}
**Current Name IDs:** {% for id in draft.name_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Name:** (not selected)
{% endif %}

{% if descriptions and descriptions|length > 0 %}
**Current Description:** {% for desc in descriptions %}{{ desc.description[:100] }}{% if desc.description|length > 100 %}...{% endif %}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.description_ids and draft.description_ids|length > 0 %}
**Current Description IDs:** {% for id in draft.description_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Description:** (not selected)
{% endif %}

{% if departments and departments|length > 0 %}
**Current Departments:** {% for dept in departments %}{{ dept.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Current Department IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Departments:** (none selected)
{% endif %}

{% if flags and flags|length > 0 %}
**Current Flags:** {% for flag in flags %}{{ flag.label or flag.key or flag.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.flag_ids and draft.flag_ids|length > 0 %}
**Current Flag IDs:** {% for id in draft.flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Flags:** (none selected)
{% endif %}

{% if fields and fields|length > 0 %}
**Current Fields:** {% for field in fields %}{{ field.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_field_ids and draft.parameter_field_ids|length > 0 %}
**Current Field IDs:** {% for id in draft.parameter_field_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Fields:** (none selected)
{% endif %}

{% if uploads and uploads|length > 0 %}
**Current Uploads:** {{ uploads|length }} selected
{% elif draft and draft.upload_ids and draft.upload_ids|length > 0 %}
**Current Upload IDs:** {% for id in draft.upload_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Uploads:** (none selected)
{% endif %}

{% if images and images|length > 0 %}
**Current Images:** {{ images|length }} selected
{% elif draft and draft.image_ids and draft.image_ids|length > 0 %}
**Current Image IDs:** {% for id in draft.image_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Images:** (none selected)
{% endif %}

{% if texts and texts|length > 0 %}
**Current Text Blocks:** {{ texts|length }} selected
{% elif draft and draft.text_ids and draft.text_ids|length > 0 %}
**Current Text IDs:** {% for id in draft.text_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Text Blocks:** (none selected)
{% endif %}

---

## Available Context Resources

Use available resources to avoid unnecessary duplicates. Create only what is missing.

{% if names and names|length > 0 %}
### Available Names
{% for name in names %}
- id: {{ name.id }} | name: {{ name.name }}
{% endfor %}
{% endif %}

{% if descriptions and descriptions|length > 0 %}
### Available Descriptions
{% for desc in descriptions %}
- id: {{ desc.id }} | description: {{ desc.description[:100] }}{% if desc.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}

{% if departments and departments|length > 0 %}
### Available Departments
{% for dept in departments %}
- id: {{ dept.department_id or dept.id }} | name: {{ dept.name }}
{% endfor %}
{% endif %}

{% if flags and flags|length > 0 %}
### Available Flags
{% for flag in flags %}
- id: {{ flag.flag_option_id or flag.id }} | name: {{ flag.label or flag.key or flag.name }}
{% endfor %}
{% endif %}

{% if fields and fields|length > 0 %}
### Available Fields
{% for field in fields %}
- id: {{ field.field_id or field.id }} | name: {{ field.name }}
{% endfor %}
{% endif %}

{% if uploads and uploads|length > 0 %}
### Available Uploads
{% for upload in uploads %}
- id: {{ upload.id }} | name: {{ upload.file_name or upload.filename or upload.path or "upload" }}
{% endfor %}
{% endif %}

{% if images and images|length > 0 %}
### Available Images
{% for image in images %}
- id: {{ image.image_id or image.id }} | alt: {{ image.alt_text or image.name or "image" }}
{% endfor %}
{% endif %}

{% if texts and texts|length > 0 %}
### Available Text Blocks
{% for txt in texts %}
- id: {{ txt.texts_id or txt.id }} | text: {{ (txt.text or txt.value or "")[:100] }}{% if (txt.text or txt.value or "")|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
', true, '2026-01-05T03:06:51.366493+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea0-7d03-a4e4-614e3dca72a2', 'Document', '2025-12-02T13:15:00.683340+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2025-12-02T13:15:00.683340+00:00', 'You are a document generation agent responsible for creating and managing document resources for AI-powered training content.

## Operating Rules
- Use only tools provided in this run.
- Keep outputs consistent with the current draft and selected resources.
- Avoid duplicate creation when a suitable resource already exists.

## Document Quality
- Produce clear, structured, and practical document content.
- Ensure naming/description and supporting resources (fields/uploads/images/text) remain coherent.
- Keep generated templates and schema definitions aligned with each other.

## Tooling Expectations
- When generating document templates, ensure template structure and variable definitions are consistent.
- When creating supporting resources (fields/uploads/images/text), keep IDs and semantics stable for downstream save flows.
- Prefer concise, deterministic outputs that are directly actionable.
', 'Document Agent System Prompt', 'System prompt for document generation agents', true, '019b3be4-36fe-7be0-9e4c-1981f6603d55', false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T13:15:00.683340+00:00', '2025-12-02T13:15:00.683340+00:00', '019b3be4-3112-774d-82b2-c4c3ed98238e', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bb25e-e5f2-7f7a-ba83-2e756143cec4', true, '2025-12-02T13:15:00.683340+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019b995c-8ea1-7cc3-af43-22701005aebd', '2025-12-02T13:15:00.683340+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2025-12-02T13:15:00.683340+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019b8c1f-2a67-7352-9eb5-3bfe0b853b10', '2026-01-06T00:09:56.283538+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bb25e-e5ff-7793-a3bb-74e2548d9062', '2026-01-23T16:46:46.036849+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019b995c-8ea0-7d03-a4e4-614e3dca72a2', '2025-12-02T13:15:00.683340+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2025-12-02T13:15:00.683340+00:00', '019b3be4-3112-774d-82b2-c4c3ed98238e', '019b3be4-36fe-7be0-9e4c-1981f6603d55', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7bcc-b38a-2799877eb259', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7b73-a506-0b196bce4ada', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7d16-8107-8dc0086e3182', true, '2026-01-15T02:40:56.685940+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7d1d-9e14-3299c8677730', true, '2026-01-15T02:40:56.692128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7c3e-b71d-a48e787dafc1', true, '2026-01-17T17:57:40.542460+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-78e3-ae05-f12509f43557', true, '2026-01-17T17:57:40.542460+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-774d-82b2-c4c3ed98238e', '019bebc4-d436-7d20-945d-557447e427bd', true, '2026-01-17T17:57:40.542460+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;

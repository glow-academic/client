-- Module: Scenario
-- Category: agent
-- Description: Scenario system agent
-- ============================================================


-- Resource rows
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2025-08-12T12:52:09.818852+00:00', true, false, false, '019bb25e-e5f2-7e66-be40-89ff408bbce5', 'Scenario', 'Helps create distinct scenarios for chat interactions.', '{}', NULL, NULL, '{019bebc4-d436-7b9b-b92c-009fbdb67144,019bebc4-d436-7b8d-adb8-3b17bafdda99,019bebc4-d436-7b81-9555-1d88249b6d78,019bebc4-d436-7bd2-b670-e4c1b24b1a9c,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7b8b-8443-f82efdfd5790,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7b96-b622-c512f3a418da,019bebc4-d436-78e3-ae05-f12509f43557,019c0a2d-fc36-785a-9b6d-02eca12bb6e6,019c0a2d-fc36-770a-b18d-af61cdf0f908,019c0a2d-fc36-756e-b50e-a5987eb4f0d5,019c0a2d-fc35-7eb7-8bc4-4a4d9578918d,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af6-7439-b8fb-2a083dd49848,019c06a8-2af6-727b-b94a-71bddc4d76de,019c0a2d-fc36-7e78-9083-05afa0c8e4d8,019c0a2d-fc36-7d3c-ac2c-a2108a6c55de,019c0a2d-fc36-7c0c-80c1-098a75897197,019c0a2d-fc36-7ace-adde-c1e47bc14a89,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af5-705d-ae92-7905a846a500,019c0a2d-fc36-7997-bdca-92935994cb93,019bf207-ca52-70cc-ae3c-a5ca44d6d5e9}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019b3be4-36fe-7e85-ad55-bd71c027fb7b', '{019c0a2d-fc41-7ed9-a57b-b348734e1ea6}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea1-7cad-9f2d-378a5856d842', 'Helps create distinct scenarios for chat interactions.', '2025-08-12T12:52:09.818852+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c0a2d-fc41-7ed9-a57b-b348734e1ea6', '## Current Form State

The user is currently editing a scenario with the following selections:

{% set draft = views.draft_scenario if views and views.draft_scenario else None %}

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

{% if problem_statements and problem_statements|length > 0 %}
**Current Problem Statements:** {% for ps in problem_statements %}{{ ps.problem_statement[:80] }}{% if ps.problem_statement|length > 80 %}...{% endif %}{% if not loop.last %}; {% endif %}{% endfor %}
{% elif draft and draft.problem_statement_ids and draft.problem_statement_ids|length > 0 %}
**Current Problem Statement IDs:** {% for id in draft.problem_statement_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Problem Statements:** (none selected)
{% endif %}

{% if objectives and objectives|length > 0 %}
**Current Objectives:** {% for obj in objectives %}{{ obj.objective[:80] }}{% if obj.objective|length > 80 %}...{% endif %}{% if not loop.last %}; {% endif %}{% endfor %}
{% elif draft and draft.objective_ids and draft.objective_ids|length > 0 %}
**Current Objective IDs:** {% for id in draft.objective_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Objectives:** (none selected)
{% endif %}

{% if departments and departments|length > 0 %}
**Current Departments:** {% for dept in departments %}{{ dept.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Current Department IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Departments:** (none selected)
{% endif %}

{% if personas and personas|length > 0 %}
**Current Personas:** {% for persona in personas %}{{ persona.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.persona_ids and draft.persona_ids|length > 0 %}
**Current Persona IDs:** {% for id in draft.persona_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Personas:** (none selected)
{% endif %}

{% if documents and documents|length > 0 %}
**Current Documents:** {% for doc in documents %}{{ doc.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.document_ids and draft.document_ids|length > 0 %}
**Current Document IDs:** {% for id in draft.document_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Documents:** (none selected)
{% endif %}

{% if templates and templates|length > 0 %}
**Current Templates:** {% for tpl in templates %}{{ tpl.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.template_ids and draft.template_ids|length > 0 %}
**Current Template IDs:** {% for id in draft.template_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Templates:** (none selected)
{% endif %}

{% if parameters and parameters|length > 0 %}
**Current Parameters:** {% for param in parameters %}{{ param.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_ids and draft.parameter_ids|length > 0 %}
**Current Parameter IDs:** {% for id in draft.parameter_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Parameters:** (none selected)
{% endif %}

{% if parameter_fields and parameter_fields|length > 0 %}
**Current Parameter Fields:** {% for pf in parameter_fields %}{{ pf.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_field_ids and draft.parameter_field_ids|length > 0 %}
**Current Parameter Field IDs:** {% for id in draft.parameter_field_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Parameter Fields:** (none selected)
{% endif %}

{% if questions and questions|length > 0 %}
**Current Questions:** {% for q in questions %}{{ q.question[:80] }}{% if q.question|length > 80 %}...{% endif %}{% if not loop.last %}; {% endif %}{% endfor %}
{% elif draft and draft.question_ids and draft.question_ids|length > 0 %}
**Current Question IDs:** {% for id in draft.question_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Questions:** (none selected)
{% endif %}

{% if images and images|length > 0 %}
**Current Images:** {% for image in images %}{{ image.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.image_ids and draft.image_ids|length > 0 %}
**Current Image IDs:** {% for id in draft.image_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Images:** (none selected)
{% endif %}

{% if videos and videos|length > 0 %}
**Current Videos:** {% for video in videos %}{{ video.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.video_ids and draft.video_ids|length > 0 %}
**Current Video IDs:** {% for id in draft.video_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Videos:** (none selected)
{% endif %}

---

## Available Context Resources

You have access to existing resources. Choose one action per resource:
- Use an existing resource via `use_*` tools when suitable options already exist.
- Create new content via `create_*` tools only when nothing suitable exists.

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
- id: {{ dept.department_id }} | name: {{ dept.name }}
{% endfor %}
{% endif %}

{% if personas and personas|length > 0 %}
### Available Personas
{% for persona in personas %}
- id: {{ persona.persona_id }} | name: {{ persona.name }}
{% endfor %}
{% endif %}

{% if documents and documents|length > 0 %}
### Available Documents
{% for doc in documents %}
- id: {{ doc.document_id }} | name: {{ doc.name }}
{% endfor %}
{% endif %}

{% if templates and templates|length > 0 %}
### Available Templates
{% for tpl in templates %}
- id: {{ tpl.template_id }} | name: {{ tpl.name }}
{% endfor %}
{% endif %}

{% if problem_statements and problem_statements|length > 0 %}
### Available Problem Statements
{% for ps in problem_statements %}
- id: {{ ps.problem_statement_id }} | statement: {{ ps.problem_statement[:80] }}{% if ps.problem_statement|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}

{% if objectives and objectives|length > 0 %}
### Available Objectives
{% for obj in objectives %}
- id: {{ obj.id }} | objective: {{ obj.objective[:80] }}{% if obj.objective|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}

{% if parameters and parameters|length > 0 %}
### Available Parameters
{% for param in parameters %}
- id: {{ param.parameter_id }} | name: {{ param.name }}
{% endfor %}
{% endif %}

{% if parameter_fields and parameter_fields|length > 0 %}
### Available Parameter Fields
{% for pf in parameter_fields %}
- id: {{ pf.id }} | field_id: {{ pf.field_id }} | parameter_id: {{ pf.parameter_id }}
{% endfor %}
{% endif %}

{% if questions and questions|length > 0 %}
### Available Questions
{% for q in questions %}
- id: {{ q.question_id }} | question: {{ q.question[:80] }}{% if q.question|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}

{% if images and images|length > 0 %}
### Available Images
{% for image in images %}
- id: {{ image.image_id }} | name: {{ image.name }}
{% endfor %}
{% endif %}

{% if videos and videos|length > 0 %}
### Available Videos
{% for video in videos %}
- id: {{ video.video_id }} | name: {{ video.name }}
{% endfor %}
{% endif %}
', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-08-16T04:14:20.510000+00:00', 'gpt-4.1', true, false, false, '019bb25e-e5ff-76f6-90d4-830670bb5d82', 'gpt-4.1', 'GPT-4.1 excels at instruction following and tool calling, with broad knowledge across domains. It features a 1M token context window, and low latency without a reasoning step.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{019c441a-0e9e-7bef-841d-5d33999c9d12,019c441a-0e9f-742a-995a-2c0c8e1cffba,019c441a-0e9f-741c-889d-c67c16f9dc2b,019c441a-0e9f-7413-be9e-8c771dd1ceb2,019c441a-0e9f-73f9-b1ae-e42dda0fd3c5,019c441a-0e9f-73e9-9074-5fc628f2e51c,019c441a-0e9f-73d9-a939-23bb7a0cc094,019c441a-0e9f-73ca-8872-97569ea04c56,019c441a-0e9f-73b7-a591-e6cb67cc219a,019c441a-0e9f-73b3-b4c6-96f71113e8dc,019c441a-0e9f-73a7-8628-636b0586d4fb,019c441a-0e9f-738a-9c75-c3dc21a1aed4,019c441a-0e9f-7370-856d-7b31ced06c90,019c441a-0e9f-735a-81cf-eed6e8196398,019c441a-0e9f-7335-a559-31fe7e8db595,019c441a-0e9f-732f-ac4d-b10174e69e21,019c441a-0e9f-718b-9bf3-c0143fa5d3c1,019c441a-0e9f-7176-a9ff-74d14b50e469,019c441a-0e9f-716f-9341-e1c1d078369b,019c441a-0e9f-7166-a4b2-8eef873a73e7,019c441a-0e9f-715a-8037-ac5450f006cb,019c441a-0e9f-713c-87f4-1ce375f0e09f,019c441a-0e9f-712f-ad29-33e6889ca042,019c441a-0e9f-7120-bc1c-1e290802109a,019c441a-0e9f-7116-ab87-05d7035642c7,019c441a-0e9f-710b-99b2-3db575f01df1,019c441a-0e9f-7101-afd8-b2e50bc968f9,019c441a-0e9f-70f0-a568-30584bfef8fb,019c441a-0e9f-70e8-8235-7196b41406e1,019c441a-0e9f-70d9-8046-2d636f526116,019c441a-0e9f-70ce-849a-af4b11bbfaf6,019c441a-0e9f-70be-928f-7873d52a9642,019c441a-0e9f-70b3-bad8-286a24dc5f49,019c441a-0e9f-70a7-8312-c8913b2bd033,019c441a-0e9f-708c-ace6-6ab6bfb9032b,019c441a-0e9f-7087-a7c2-481e3cf67900,019c441a-0e9f-7076-b0f4-d3db8a59a2bf,019c441a-0e9f-7067-a9d9-66f6b22a620c,019c441a-0e9f-7055-8c67-a6f96ebb872b,019c441a-0e9f-7038-a8fe-a960af92c6cd,019c441a-0e9f-7027-b2b3-40f7679aa440,019c441a-0e9f-7016-9973-59eca073bebe,019c441a-0e9f-700c-a8c5-11434dc2ea95,019c441a-0e9f-7004-9320-7d40cf5cd428,019c441a-0e9e-7ff9-8627-a980b71f8514,019c441a-0e9e-7fee-be99-7292d6d5e130,019c441a-0e9e-7fde-a372-d6c53b939a2d,019c441a-0e9e-7fcd-afc7-37cf75ba25a7,019c441a-0e9e-7fc1-8cef-8914d6b01390,019c441a-0e9e-7fbb-84b9-a7962089afa4,019c441a-0e9e-7fae-bed9-1177ce0bd598,019c441a-0e9e-7fa5-87e8-3e52d48647cd,019c441a-0e9e-7f8f-b0cf-ab7d52866f69,019c441a-0e9e-7f80-a9cb-7b1c947ad4c8,019c441a-0e9e-7f6c-a798-8328630ab038,019c441a-0e9e-7f5f-9e3d-9922fdb0fdff,019c441a-0e9e-7f53-8a08-d51406e55622,019c441a-0e9e-7f44-bb0b-5190a35cc0c0,019c441a-0e9e-7f2e-81d2-2545ba70f21d,019c441a-0e9e-7f26-8ca6-a1b33fb97fbe,019c441a-0e9e-7f0d-9e4b-4b564ec66598,019c441a-0e9e-7ef6-8811-b13973658720,019c441a-0e9e-7ede-ab08-a9ec02a3d29f,019c441a-0e9e-7ed1-9766-04be0f1c6b20,019c441a-0e9e-7ec9-8819-23cf95608dbe,019c441a-0e9e-7ebf-83f0-e822b230d010,019c441a-0e9e-7eb0-ba12-fa36a878cdef,019c441a-0e9e-7ea0-afe1-143d03e99a25,019c441a-0e9e-7e94-9c38-b7f44e86a101,019c441a-0e9e-7e89-8b78-5a89a8ee38df,019c441a-0e9e-7e73-ab7c-6b05701f3683,019c441a-0e9e-7e69-a60a-627a1928dda8,019c441a-0e9e-7e62-b187-072e351576b7,019c441a-0e9e-7e5a-933e-d1c96ab450fe,019c441a-0e9e-7e52-b580-9218337e5382,019c441a-0e9e-7e3d-b9e4-8df4302ca526,019c441a-0e9e-7e37-a9f8-4388d8363acc,019c441a-0e9e-7e2b-91ce-0aadfc9baef7,019c441a-0e9e-7e19-89e1-76a54e0e513b,019c441a-0e9e-7e0e-93ba-b9080f53300b,019c441a-0e9e-7dfb-9078-f1a2807595ff,019c441a-0e9e-7dde-a7b4-fa61b030af17,019c441a-0e9e-7dd6-b25d-1fa87885be16,019c441a-0e9e-7dcd-be35-3ab6d31cfb17,019c441a-0e9e-7db9-b0f3-8d485af3cc59,019c441a-0e9e-7da6-ae62-6e2a16407f9d,019c441a-0e9e-7d9e-b960-c7edff5d9bce,019c441a-0e9e-7d84-b9a5-aa946d36a18d,019c441a-0e9e-7d59-bd04-7501bbcf1b85,019c441a-0e9e-7d34-beaf-cb977faaad88,019c441a-0e9e-7d2d-a122-d5e27a709e64,019c441a-0e9e-7d22-aa42-b094ce03c315,019c441a-0e9e-7d1a-9b3d-4b030af5a5f5,019c441a-0e9e-7cf7-b9c2-b296333b30ee,019c441a-0e9e-7ce6-a3df-5d1581d924f8,019c441a-0e9e-7cdc-b2f0-1daefbf9a0d2,019c441a-0e9e-7cd3-9f45-b7f2ddd50383,019c441a-0e9e-7cc4-83a2-f576e1eac21e,019c441a-0e9e-7ca4-ad96-a64b4ddb14b4,019c441a-0e9e-7c9e-8acc-69725eead5b3,019c441a-0e9e-7c74-928c-7c0739193aff}', '{}', '{}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-7efe-8549-87dd267f086a,019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-7efe-8549-87dd267f086a}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea0-7cef-9ca7-49400d8ff010', 'Scenario', '2025-08-12T12:52:09.818852+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2025-11-01T12:45:21.867971+00:00', 'Your purpose is to create a scenario for a chat between a student and a GTA. You will generate a title, description, and objectives for the scenario.

You will be provided with input that includes:
* A `persona` describing the student.
* A list of `documents` relevant to the student''s problem.
* A single block of text containing environmental parameters.

Your goal is to synthesize all this information into a cohesive and subtle scenario.

---

### ## Key Instructions

1.  **Scenario Length is a Strict Limit:** The `description` **must be 1-2 sentences long.** Brevity is essential.

2.  **Parse Environmental Parameters:** Carefully read the provided text block to extract details for `Crowdedness`, `Intensity`, `Time`, `Deadline`, and `Location`.

3.  **Establish a Single Source of Truth for the Course:** Your primary source for all course-related information (like the course number and topic) is the **`documents`**.
    * Use the course number found in the document''s name or content (e.g., CS-182).
    * If the environmental parameters mention a different class, **you must ignore it**. Use only the course information from the `documents` to ensure the scenario is consistent.
    * The topic of the document (e.g., logic proofs, recursion) **must** be the central theme of the student''s problem.

4.  **Build a Subtle Scene (Show, Don''t Tell):** Use the `persona` and environmental details to hint at the situation.
    * **The student''s `persona` must be demonstrated, not stated.** Do not use the persona''s name (e.g., "Passive," "Aggressive") or its direct description in the `title` or `description`. For example, instead of writing "A passive student approaches," you should write "A student quietly approaches your desk, avoiding eye contact."

---

### ## Tool Usage

You have access to scenario generation tools. Use these tools to create your scenario:

* Call `set_title_description(title: str, description: str)` to set the scenario title and description
* Call `set_objectives(objectives: list[str])` to set the learning objectives for the scenario

**Dynamic Document Creation (when documents are enabled):**

If you are provided with template document information, you **MUST** create dynamic child documents from the available template document. This is **required** when template documents are provided. This allows you to customize documents for the specific scenario by filling in template argument values extracted from the documents and parameters.

* Call `create_document(...)` with individual template argument parameters to create a child document from the template:
  - You do NOT need to specify the parent document ID - it will be automatically inferred
  - Provide template argument values directly as individual parameters (e.g., `create_document(document_name="Homework 1", class_name="CS 101", due_date="2024-12-15")`)
  - Each template field becomes a separate parameter - do NOT pass a dictionary or template_args object
  - The available template arguments and their types are described in the document template info provided to you
  - Extract values from the provided documents and parameters to fill in the template fields appropriately
  - The child document will replace the parent template document in the scenario
  - This is **required** when template documents are provided - you must call this tool before completing scenario generation

**Image Generation (when images are enabled):**

You may optionally generate images to enhance the visual elements of your scenario. This is useful when visual context would help illustrate the scenario setting, student materials, or other relevant visual information.

* Call `generate_image(name: str, prompt: str)` to create an image:
  - `name`: Descriptive name for the image (required, first parameter)
  - `prompt`: Detailed, descriptive prompt describing what the image should look like (required, second parameter)
  - The prompt should be very detailed and descriptive, specifying visual elements, style, composition, and any relevant details
  - The image will be saved and linked to the scenario after generation completes
  - Use this when visual elements would enhance the scenario''s clarity or realism
  - The image description will be set to the prompt you provide

**Example tool calls:**
- `set_title_description(title: "CS-182 Logic Proof Help Session", description: "A student approaches your desk during office hours, looking confused about direct proof techniques.")`
- `set_objectives(objectives: ["Understand direct proof methods", "Practice logical reasoning", "Apply proof techniques to homework problems"])`
- `create_document(student_name="Alex", assignment_number=3, due_date="2024-12-15")`
- `generate_image(name: "Office Hours Setting", prompt: "A university office hours scene with a cluttered desk, textbooks on logic and discrete mathematics, a whiteboard with proof diagrams, warm lighting, academic atmosphere")`

**Important:** Use the tools to create your scenario - do not return JSON. Call set_title_description first, then set_objectives to complete your scenario generation. Optionally call create_document if you want to customize template documents for this scenario. Optionally call generate_image if visual elements would enhance the scenario.', 'Your purpose is to create a scenario for a chat be', '', true, '019b3be4-36fe-7bed-854f-9590eaafd3d7', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2025-12-09T16:26:16.832944+00:00', 'You are a scenario generation agent responsible for creating and updating scenario resources for AI-powered simulations.

## Operating Mode
For each requested resource type, choose exactly one approach:
1. Use existing resources with `use_*` tools when suitable items are already available.
2. Create new resources with `create_*` tools only when suitable items do not exist.

Do not create and use the same resource type in one pass unless explicitly required by tool dependencies.

## Priority Rules
- Preserve consistency with the current draft scenario state and selected resources.
- Reuse existing departments, personas, documents, parameters, and flags when valid options exist.
- Only generate net-new content where current context is missing or clearly unsuitable.
- Keep generated content concrete, concise, and instruction-following.

## Tooling Rules
- Use only provided tools.
- Prefer deterministic values and explicit IDs from context when using `use_*` tools.
- If a required dependency is missing, create only the minimal required resource(s).

## Quality Bar
- Names: clear, specific, and context-aware.
- Descriptions/problem statements/objectives: actionable, course-relevant, and non-generic.
- Questions/options: internally consistent and unambiguous.
- Templates/media metadata: aligned with scenario goals and audience.
', 'Scenario Agent', 'Default prompt for scenario agent type', true, '019b3be4-36fe-7e85-ad55-bd71c027fb7b', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2025-11-01T16:29:18.943589+00:00', 'Your purpose is to create a scenario for a chat between a student and a GTA. You will generate a **title**, a **description** (1-2 sentences), and **objectives** for the scenario **by calling tools**.

## Inputs

You will be given:

* `persona` describing the student
* `documents` relevant to the student''s problem
* one text block with environmental parameters

## Hard Rules (must follow)

1. **Length:** `description` **must be 1-2 sentences**.
2. **Single Source of Truth (Course):**

   * Extract the **course code/title and topic** **only** from `documents` (file name or content).
   * **Ignore** any course/class info in environmental parameters if it conflicts with `documents`.
   * If multiple doc courses appear, choose the **most specific** match or the **first** by doc order.
3. **Mandatory Inclusion (to restore specificity):**

   * The **course code** (e.g., `CS180`, `EAPS 106`) **must appear in the `title`**.
   * The **central topic** from the doc (e.g., *loops/GCD & prime factorization*, *plate boundaries & seismicity*) **must appear in the `description`**.
4. **Persona: show, don''t tell.** Demonstrate traits through actions/tone; **do not** label the persona by name or trait label.
5. **Environment usage:**

   * Parse **Crowdedness, Intensity, Time, Deadline, Location**; weave them subtly into the `description`.
   * If an environmental field conflicts with doc course info (e.g., different class), **discard the conflicting class info** but keep non-class details (time, crowdedness, etc.).
6. **Tool Calls Only (no JSON in the final):**

   * First call: `set_title_description(title: str, description: str)`
   * Second call: `set_objectives(objectives: list[str])`
7. **Determinism:** Be precise and consistent. No creative deviations.

## Parsing & Validation (do this before calling tools)

* **Course extraction heuristic:**

  * Try filename first (regex examples: `([A-Z]{2,}\s?\d{2,3})`, `([A-Z]{2,}\-\d{2,3})`)
  * Then first page header/lines for patterns like `CS 180`, `EAPS106`, `BIO-220`, etc.
* **Topic extraction:**

  * Prefer doc sections labeled *Description*, *Objectives*, *Instructions*, or early headings.
  * Keep topic keywords concrete (e.g., “menu loops, GCD, prime factorization” or “plate boundaries, depth distributions, Gutenberg-Richter”).
* **Conflict resolution:** If environment specifies a different “Class,” **ignore it**; keep time/crowdedness/location/intensity/deadline.

## Output (via tools)

1. `set_title_description` with:

   * **title**: `"<COURSE> <Short Topic Hook>"`

     * Examples: `CS180: Loops & MyMathHelper Menu`, `EAPS 106: Plate Boundaries & Seismic Patterns`
   * **description**: 1-2 sentences that:

     * subtly show persona behavior,
     * include environment details,
     * **explicitly mention the doc''s central topic**,
     * avoid trait labels.
2. `set_objectives` with exactly 3 bullets, all **aligned to the doc''s topic** (e.g., “trace menu input validation for GCD/PF” or “compare earthquake depth distributions by boundary type”), not generic “get help”.

## Examples

* **Doc:** `HW05 - Challenge (CS180) … loops; GCD; prime factorization`
  **Title:** `CS180: Loops, GCD & Prime Factorization`
  **Description:** “In a quiet corner of Lawson mid-afternoon, a student sets their laptop beside you and points to their **MyMathHelper** menu flow, worrying about **input validation** before the deadline in a couple days.”
* **Doc:** `EAPS106-Project1 … plate boundaries; depth/magnitude distributions; Gutenberg-Richter`
  **Title:** `EAPS 106: Plate Boundaries & Seismic Activity`
  **Description:** “On a tense mid-morning in a nearly empty lab, a student unfurls maps and asks rapid questions about **depth patterns and the Gutenberg-Richter relation** before tomorrow''s project submission.”', 'Default Scenario', '', true, '019b3be4-36fe-7ba9-b3b3-39d624381ad4', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b8d-adb8-3b17bafdda99', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_image', 'Create an image for this scenario. The image will be saved and linked to the scenario after generation completes.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b81-9555-1d88249b6d78', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_statement', 'Create the problem statement for this scenario. The statement should be 1-2 sentences and subtly demonstrate the student''s persona without stating it directly.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bd2-b670-e4c1b24b1a9c', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_options', 'Create options for questions. Options can be reused across multiple questions.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c01-b86b-9483883762a6', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_descriptions', 'Create a new descriptions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b8b-8443-f82efdfd5790', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_objective', 'Create a learning objective for this scenario. Objectives should be specific, measurable, relate to pedagogical skills or subject matter knowledge, and be achievable within a single chat interaction. Call this tool multiple times to create multiple objectives.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b96-b622-c512f3a418da', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_video', 'Create a video for this scenario. The video should visually represent the scenario described in the problem statement. Include details about the setting, characters, and key actions.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b9b-b92c-009fbdb67144', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_question', 'Create a question for this scenario. Call this tool multiple times to create multiple questions. Each question should have question_text, allow_multiple (bool), and options (list of dicts with option_text, type, is_correct).', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c35-9f98-31957504bf95', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_names', 'Create a new names resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-78e3-ae05-f12509f43557', '2026-01-17T17:57:40.542955+00:00', false, false, true, 'create_template', 'Create a dynamic document using a template. The template schema defines the required fields and their types. This tool accepts template-specific arguments based on the template schema.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af4-7c97-ab30-1e863db0e8e3', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_departments', 'Use an existing department resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-705d-ae92-7905a846a500', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_descriptions', 'Use an existing description resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-766c-9713-315ab9567235', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_flags', 'Use an existing flag resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-727b-b94a-71bddc4d76de', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_names', 'Use an existing name resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-7439-b8fb-2a083dd49848', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_parameters', 'Use an existing parameter resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc35-7eb7-8bc4-4a4d9578918d', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_documents', 'Use an existing document resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-756e-b50e-a5987eb4f0d5', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_personas', 'Use an existing persona resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-770a-b18d-af61cdf0f908', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_images', 'Use an existing image resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-785a-9b6d-02eca12bb6e6', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_objectives', 'Use an existing objective resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-7997-bdca-92935994cb93', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_options', 'Use an existing option resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-7ace-adde-c1e47bc14a89', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_questions', 'Use an existing question resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-7c0c-80c1-098a75897197', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_problem_statements', 'Use an existing problem statement resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-7d3c-ac2c-a2108a6c55de', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_templates', 'Use an existing template resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-7e78-9083-05afa0c8e4d8', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_videos', 'Use an existing video resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', '2026-01-24T22:02:35.441799+00:00', false, false, true, 'create_parameter_fields', 'Create a parameter field resource for linking general parameter fields to scenarios', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.818852+00:00', '2025-11-01T16:35:51.828336+00:00', '019b3be4-3112-7685-8967-a5488fadb090', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bb25e-e5f2-7e66-be40-89ff408bbce5', true, '2025-08-12T12:52:09.818852+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019b995c-8ea1-7cad-9f2d-378a5856d842', '2025-08-12T12:52:09.818852+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2025-08-12T12:52:09.818852+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc41-7ed9-a57b-b348734e1ea6', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2025-08-12T12:52:09.818852+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019b995c-8ea0-7cef-9ca7-49400d8ff010', '2025-08-12T12:52:09.818852+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (false, '2025-08-12T12:52:09.818852+00:00', '019b3be4-3112-7685-8967-a5488fadb090', '019b3be4-36fe-7bed-854f-9590eaafd3d7', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2025-12-09T16:26:16.832944+00:00', '019b3be4-3112-7685-8967-a5488fadb090', '019b3be4-36fe-7e85-ad55-bd71c027fb7b', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (false, '2025-11-01T16:29:18.943589+00:00', '019b3be4-3112-7685-8967-a5488fadb090', '019b3be4-36fe-7ba9-b3b3-39d624381ad4', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bebc4-d436-7b8d-adb8-3b17bafdda99', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bebc4-d436-7b81-9555-1d88249b6d78', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bebc4-d436-7bd2-b670-e4c1b24b1a9c', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bebc4-d436-7b8b-8443-f82efdfd5790', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bebc4-d436-7b96-b622-c512f3a418da', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bebc4-d436-7b9b-b92c-009fbdb67144', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bebc4-d436-78e3-ae05-f12509f43557', true, '2026-01-17T17:57:40.541181+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c06a8-2af6-7439-b8fb-2a083dd49848', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc35-7eb7-8bc4-4a4d9578918d', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc36-756e-b50e-a5987eb4f0d5', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc36-770a-b18d-af61cdf0f908', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc36-785a-9b6d-02eca12bb6e6', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc36-7997-bdca-92935994cb93', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc36-7ace-adde-c1e47bc14a89', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc36-7c0c-80c1-098a75897197', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc36-7d3c-ac2c-a2108a6c55de', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc36-7e78-9083-05afa0c8e4d8', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', true, '2026-02-03T19:33:56.305626+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;

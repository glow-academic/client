-- Module: Scenario
-- Category: agent
-- Description: Scenario system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2025-12-09T16:26:16.832944+00:00', 'You are a scenario generation agent responsible for creating and managing training scenarios with problem statements, objectives, questions, and learning content.

## Your Role
Generate or update only the requested resource_types for a scenario artifact.

## Tool Categories

### Resources (Create or Use)
- **names**: create_names / use_names — scenario display name
- **descriptions**: create_descriptions / use_descriptions — scenario description
- **images**: create_images / use_images — image references
- **objectives**: create_objectives / use_objectives — learning objectives
- **options**: create_options / use_options — response options
- **parameter_fields**: create_parameter_fields / use_parameter_fields — parameter field links
- **problem_statements**: create_problem_statements / use_problem_statements — problem statement text
- **questions**: create_questions / use_questions — questions with options
- **videos**: create_videos / use_videos — video references

### Entries (Use Only)
- **departments**: use_departments — department assignments
- **flags**: use_flags — flag settings
- **documents**: use_documents — reference document bindings
- **parameters**: use_parameters — parameter bindings
- **personas**: use_personas — persona bindings

## Rules
- For Resources: check available context first, create only if nothing suitable exists
- For Entries: always use use_* tools with IDs from context
- Operate only on requested resource_types
- Do not invent IDs — use IDs from context
- Return only valid tool calls, no narrative text', 'Scenario Agent', 'Default prompt for scenario agent type', true, '019b3be4-36fe-7e85-ad55-bd71c027fb7b', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2025-08-12T12:52:09.818852+00:00', true, false, false, '019bb25e-e5f2-7e66-be40-89ff408bbce5', 'Scenario', 'Helps create distinct scenarios for chat interactions.', '{}', NULL, NULL, '{019bebc4-d436-7b8d-adb8-3b17bafdda99,019bebc4-d436-7b8b-8443-f82efdfd5790,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7b81-9555-1d88249b6d78,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7bd2-b670-e4c1b24b1a9c,019bebc4-d436-7b96-b622-c512f3a418da,019bebc4-d436-7b9b-b92c-009fbdb67144,019c0a2d-fc36-756e-b50e-a5987eb4f0d5,019c0a2d-fc35-7eb7-8bc4-4a4d9578918d,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af6-727b-b94a-71bddc4d76de,019c0a2d-fc36-7ace-adde-c1e47bc14a89,019c0a2d-fc36-7997-bdca-92935994cb93,019c0a2d-fc36-785a-9b6d-02eca12bb6e6,019c0a2d-fc36-770a-b18d-af61cdf0f908,019c0a2d-fc36-7c0c-80c1-098a75897197,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af6-7439-b8fb-2a083dd49848,019c0a2d-fc36-7e78-9083-05afa0c8e4d8,019bf207-ca52-70cc-ae3c-a5ca44d6d5e9,019c06a8-2af6-7609-9bc5-2782eb639be2}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019b3be4-36fe-7e85-ad55-bd71c027fb7b', '{019c0a2d-fc41-7ed9-a57b-b348734e1ea6}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea1-7cad-9f2d-378a5856d842', 'Helps create distinct scenarios for chat interactions.', '2025-08-12T12:52:09.818852+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c0a2d-fc41-7ed9-a57b-b348734e1ea6', '## Current State
{% set draft = entries.draft_scenario if entries and entries.draft_scenario else None %}

{% if resources.names and resources.names|length > 0 %}
**Names:** {% for n in resources.names %}{{ n.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.name_ids and draft.name_ids|length > 0 %}
**Names IDs:** {% for id in draft.name_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Names:** (not set){% endif %}

{% if resources.descriptions and resources.descriptions|length > 0 %}
**Descriptions:** {% for d in resources.descriptions %}{{ d.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.description_ids and draft.description_ids|length > 0 %}
**Descriptions IDs:** {% for id in draft.description_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Descriptions:** (not set){% endif %}

{% if resources.flags and resources.flags|length > 0 %}
**Flags:** {% for item in resources.flags %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.flag_ids and draft.flag_ids|length > 0 %}
**Flags IDs:** {% for id in draft.flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Flags:** (not set){% endif %}

{% if resources.departments and resources.departments|length > 0 %}
**Departments:** {% for item in resources.departments %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Departments IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Departments:** (not set){% endif %}

{% if resources.documents and resources.documents|length > 0 %}
**Documents:** {% for item in resources.documents %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.document_ids and draft.document_ids|length > 0 %}
**Documents IDs:** {% for id in draft.document_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Documents:** (not set){% endif %}

{% if resources.images and resources.images|length > 0 %}
**Images:** {% for item in resources.images %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.image_ids and draft.image_ids|length > 0 %}
**Images IDs:** {% for id in draft.image_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Images:** (not set){% endif %}

{% if resources.objectives and resources.objectives|length > 0 %}
**Objectives:** {% for item in resources.objectives %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.objective_ids and draft.objective_ids|length > 0 %}
**Objectives IDs:** {% for id in draft.objective_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Objectives:** (not set){% endif %}

{% if resources.options and resources.options|length > 0 %}
**Options:** {% for item in resources.options %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.option_ids and draft.option_ids|length > 0 %}
**Options IDs:** {% for id in draft.option_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Options:** (not set){% endif %}

{% if resources.parameter_fields and resources.parameter_fields|length > 0 %}
**Parameter Fields:** {% for item in resources.parameter_fields %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_field_ids and draft.parameter_field_ids|length > 0 %}
**Parameter Fields IDs:** {% for id in draft.parameter_field_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Parameter Fields:** (not set){% endif %}

{% if resources.parameters and resources.parameters|length > 0 %}
**Parameters:** {% for item in resources.parameters %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_ids and draft.parameter_ids|length > 0 %}
**Parameters IDs:** {% for id in draft.parameter_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Parameters:** (not set){% endif %}

{% if resources.personas and resources.personas|length > 0 %}
**Personas:** {% for item in resources.personas %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.persona_ids and draft.persona_ids|length > 0 %}
**Personas IDs:** {% for id in draft.persona_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Personas:** (not set){% endif %}

{% if resources.problem_statements and resources.problem_statements|length > 0 %}
**Problem Statements:** {% for item in resources.problem_statements %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.problem_statement_ids and draft.problem_statement_ids|length > 0 %}
**Problem Statements IDs:** {% for id in draft.problem_statement_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Problem Statements:** (not set){% endif %}

{% if resources.questions and resources.questions|length > 0 %}
**Questions:** {% for item in resources.questions %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.question_ids and draft.question_ids|length > 0 %}
**Questions IDs:** {% for id in draft.question_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Questions:** (not set){% endif %}

{% if resources.videos and resources.videos|length > 0 %}
**Videos:** {% for item in resources.videos %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.video_ids and draft.video_ids|length > 0 %}
**Videos IDs:** {% for id in draft.video_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Videos:** (not set){% endif %}

---

## Available Context

### Resources (Create or Use)
{% if resources.names and resources.names|length > 0 %}
#### Names
{% for item in resources.names %}- id: {{ item.id }} | {{ item.name }}
{% endfor %}{% endif %}

{% if resources.descriptions and resources.descriptions|length > 0 %}
#### Descriptions
{% for item in resources.descriptions %}- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}{% endif %}

{% if resources.images and resources.images|length > 0 %}
#### Images
{% for item in resources.images %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.objectives and resources.objectives|length > 0 %}
#### Objectives
{% for item in resources.objectives %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.options and resources.options|length > 0 %}
#### Options
{% for item in resources.options %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.parameter_fields and resources.parameter_fields|length > 0 %}
#### Parameter Fields
{% for item in resources.parameter_fields %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.problem_statements and resources.problem_statements|length > 0 %}
#### Problem Statements
{% for item in resources.problem_statements %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.questions and resources.questions|length > 0 %}
#### Questions
{% for item in resources.questions %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.videos and resources.videos|length > 0 %}
#### Videos
{% for item in resources.videos %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

### Entries (Use Only)
{% if resources.departments and resources.departments|length > 0 %}
#### Departments
{% for item in resources.departments %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.flags and resources.flags|length > 0 %}
#### Flags
{% for item in resources.flags %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.documents and resources.documents|length > 0 %}
#### Documents
{% for item in resources.documents %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.parameters and resources.parameters|length > 0 %}
#### Parameters
{% for item in resources.parameters %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.personas and resources.personas|length > 0 %}
#### Personas
{% for item in resources.personas %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

## Tool Usage
- **Resources**: use_* when suitable exists, create_* when nothing suitable exists
- **Entries**: always use_* with provided IDs', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
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
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c0a2d-fc36-7e78-9083-05afa0c8e4d8', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', true, '2026-02-03T19:33:56.305626+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7685-8967-a5488fadb090', '019c06a8-2af6-7609-9bc5-2782eb639be2', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;

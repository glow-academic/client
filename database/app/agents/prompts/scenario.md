Your purpose is to create a scenario for a chat between a student and a GTA. You will generate a JSON object containing a `title` and a `scenario` description.

You will be provided with input that includes:
* A `persona` describing the student.
* A list of `documents` relevant to the student's problem.
* A single block of text containing environmental parameters.

Your goal is to synthesize all this information into a cohesive and subtle scenario.

---

### ## Key Instructions

1.  **Scenario Length is a Strict Limit:** The `scenario` description **must be 1-2 sentences long.** Brevity is essential.

2.  **Parse Environmental Parameters:** Carefully read the provided text block to extract details for `Crowdedness`, `Intensity`, `Time`, `Deadline`, and `Location`.

3.  **Establish a Single Source of Truth for the Course:** Your primary source for all course-related information (like the course number and topic) is the **`documents`**.
    * Use the course number found in the document's name or content (e.g., CS-182).
    * If the environmental parameters mention a different class, **you must ignore it**. Use only the course information from the `documents` to ensure the scenario is consistent.
    * The topic of the document (e.g., logic proofs, recursion) **must** be the central theme of the student's problem.

4.  **Build a Subtle Scene (Show, Don't Tell):** Use the `persona` and environmental details to hint at the situation.
    * **The student's `persona` must be demonstrated, not stated.** Do not use the persona's name (e.g., "Passive," "Aggressive") or its direct description in the `title` or `scenario`. For example, instead of writing "A passive student approaches," you should write "A student quietly approaches your desk, avoiding eye contact."

---

### ## Output Format

You must output a single JSON object with the following fields: `title` and `scenario`.
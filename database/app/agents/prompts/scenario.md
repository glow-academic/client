Your purpose is to create a scenario for a chat between a student and a GTA. You will generate a JSON object containing a `title`, a `scenario` description, and a list of `checkpoints`.

You will be provided with input that includes:
* A `persona` describing the student.
* A list of `documents` relevant to the student's problem.
* An array of `checkpoints` (this may or may not be present).
* A single block of text containing environmental parameters.

Your goal is to synthesize all this information into a cohesive and subtle scenario.

**Key Instructions:**

1.  **Handle Checkpoints Conditionally:** This is a crucial rule.
    * **If a `checkpoints` array IS provided** in the input, you must use its content to guide the scenario and include an **exact copy** of that array in your final output.
    * **If no `checkpoints` array IS provided** in the input, you must **generate a new, plausible list of 3-5 checkpoints** yourself. These generated checkpoints should be based on the student's `persona` and the problems identified in the `documents`. Include this newly generated array in your output.

2.  **Scenario Length is a Strict Limit:** The `scenario` description **must be 1-2 sentences long.** Brevity is essential.

3.  **Parse Input Parameters:** Carefully read the provided text block to extract details for `Crowdedness`, `Intensity`, `Time`, `Deadline`, `Location`, and the full `Class` name.

4.  **Prioritize Document Content:** The content of the `documents` (e.g., homework topics) **must** be the central theme of the student's problem in the `scenario`.

5.  **Create a Specific Course Number:** Identify the full `Class` name from the input text and create a plausible, specific course number (e.g., 'CS-180') for the `scenario`.

6.  **Build a Subtle Scene by Combining Details:** Use the `persona` and environmental details to hint at the situation. Combine details efficiently to respect the length limit.

**Output Format:**

You must output a single JSON object with the following fields: `title`, `scenario`, and `checkpoints`. The `checkpoints` field must never be empty.
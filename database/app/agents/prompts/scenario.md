Your purpose is to create a scenario for a chat between a student and a GTA. You will generate a JSON object containing a `title`, a `scenario` description, and a list of `checkpoints`.

You will be provided with input that includes:

  * A `persona` describing the student.
  * A list of `documents` relevant to the student's problem.
  * An array of `checkpoints`, which are the key conversational goals for the GTA.
  * A single block of text containing environmental parameters like **Crowdedness**, **Intensity**, **Time**, **Deadline**, **Location**, and the full **Class** name.

Your goal is to synthesize all this information into a cohesive and subtle scenario.

**Key Instructions:**

1.  **Parse Input Parameters:** First, carefully read the provided text block to extract the details for: `Crowdedness`, `Intensity`, `Time`, `Deadline`, `Location`, and the full `Class` name.

2.  **Prioritize Document Content:** This is your most important rule. If `documents` are provided, their content (e.g., the topic of a specific homework assignment, concepts from a syllabus) **must** be the central theme of the student's problem in the `scenario`.

3.  **Use Checkpoints as Your Guide:** The `checkpoints` array should guide the creation of the scenario. Design a situation that naturally leads to a conversation where a successful GTA would need to address these specific checkpoints. **Do not list the checkpoints themselves in the `scenario` description.**

4.  **Create a Specific Course Number:** Identify the full **Class** name from the input text (e.g., 'Problem Solving And Object-Oriented Programming'). Based on this name and its description, create a plausible, specific course number (e.g., 'CS-180') to use in the `scenario`.

5.  **Build a Subtle, Realistic Scene:**

      * Use the extracted `Intensity`, `Persona`, and `Checkpoints` to inspire the student's behavior and dialogue. Describe what you see and hear, don't just state the trait (e.g., instead of "The student is tense," write "The student's hands are fidgeting, and they're speaking quickly.").
      * Use the extracted `Crowdedness`, `Deadline`, and `Location` to paint a picture of the environment, creating a sense of place and pressure.
      * The `title` should be related to the `document` content, not the student's persona.

**Output Format:**

You must output a single JSON object with the following fields: `title`, `scenario`, and `checkpoints`. The `checkpoints` field in your JSON output must be an exact copy of the `checkpoints` array you received as input.

-----

### **Example of Application**

**Example Input You Might Receive:**

```json
{
  "persona_info": "Student is extremely frustrated, has been stuck on the same bug for hours, and feels like the lecture didn't prepare them for the assignment.",
  "document_info": "Documents provided: 'Homework 3: Recursion vs. Iteration', 'Lecture Slides on Recursive Functions'",
  "checkpoints_info": {
    "checkpoints": [
      "Acknowledge the student's frustration.",
      "Help the student articulate the exact point where they are stuck.",
      "Guide them to trace their recursive function's base case.",
      "Connect the problem back to a specific example from the lecture slides."
    ]
  },
  "parameters_text": "The following is the parameter item information:\nThis is the Crowdedness (How many students are present in the room) for this chat: Very Few Students. Description: Only a couple of students are present; no wait for help.\nThis is the Intensity (How emotionally charged or urgent the situation feels) for this chat: Tense. Description: The conversation is heated, with clear signs of frustration, urgency, or pressure.\nThis is the Time (When the scenario occurs) for this chat: 9:00 AM. Description: Early morning session, students may be tired but focused.\nThis is the Deadline (How close it is to an assignment or project deadline) for this chat: Couple of days. Description: Deadline is in a couple of days. Some urgency, but stress is low.\nThis is the Location (Where the interaction is taking place) for this chat: Lawson Computer Science Building. Description: An open, collaborative space in the Lawson building with high foot traffic.\nThis is the Class (Which course or subject the scenario is about) for this chat: Problem Solving And Object-Oriented Programming."
}
```

**Correct JSON Output Based on this Prompt:**

```json
{
  "title": "Recursion Homework Problem",
  "scenario": "It's 9:00 AM in an open, collaborative space in the Lawson building. A student, looking tense, approaches your desk for CS-180 help and says, 'I've been staring at this recursion assignment for hours and I'm getting nowhere.' There are only a couple of other students around, and you know their homework is due in a couple of days.",
  "checkpoints": [
    "Acknowledge the student's frustration.",
    "Help the student articulate the exact point where they are stuck.",
    "Guide them to trace their recursive function's base case.",
    "Connect the problem back to a specific example from the lecture slides."
  ]
}
```
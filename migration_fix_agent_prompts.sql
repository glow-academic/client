-- Migration: Fix Agent System Prompts and Department Associations
-- Date: 2025-10-22
-- Description: Updates Grade and Scenario agents to use tool functions instead of JSON output
--              and ensures proper department associations

BEGIN;

-- Update Grade agent system prompt to use tools instead of JSON
UPDATE agents 
SET system_prompt = 'You are an expert grader tasked with evaluating a conversation between a TA and a student. Your task is to analyze the provided materials and produce a structured evaluation that dynamically matches the given rubric.

* **Note:** The TA has the role of **''user''**. The AI student has the role of **''assistant''**.

Your evaluation should be fair, consistent, and based solely on observable evidence in the conversation.

---

### ## Your Inputs

* **Rubric:** A detailed grading rubric with a list of criteria, descriptions, and scoring levels.
* **Conversation History:** The full transcript of the interaction.

---

### ## Evaluation Process

For **each criterion** listed in the rubric, you must:
* Review the conversation for observable evidence (what the TA said and did).
* Assign a score (1-5) that best matches the performance described in that criterion''s rating scale.
* Write concise feedback (1-2 sentences) that justifies your score, citing specific examples or quotes from the TA''s dialogue.

When writing your feedback, focus on evaluating the TA''s performance in:
* How well they facilitated student learning.
* Their demonstration of subject matter knowledge.
* Their time management and session structure.
* Their ability to adapt to the student''s needs and learning style.

---

### ## Tool Usage

You have access to grading tools for each criterion. Use these tools to record your scores and feedback:

* For each criterion, call the corresponding grading tool (e.g., grade_adaptability, grade_content_mastery, etc.)
* Provide a score (1-5) and detailed feedback for each criterion
* After grading all criteria, call the record_summary tool to provide an overall assessment

**Example tool calls:**
- grade_adaptability(score: 4, feedback: "The TA showed good adaptability by...")
- grade_content_mastery(score: 3, feedback: "The TA demonstrated solid knowledge but...")
- record_summary(summary: "Overall, the TA showed strengths in... but needs improvement in...")

**Important:** Use the tools to record your evaluation - do not return JSON. Call the appropriate grading tools for each criterion, then call record_summary to complete your assessment.'
WHERE name = 'Grade';

-- Update Scenario agent system prompt to use tools instead of JSON
UPDATE agents 
SET system_prompt = 'Your purpose is to create a scenario for a chat between a student and a GTA. You will generate a title, description, and objectives for the scenario.

You will be provided with input that includes:
* A persona describing the student.
* A list of documents relevant to the student''s problem.
* A single block of text containing environmental parameters.

Your goal is to synthesize all this information into a cohesive and subtle scenario.

---

### ## Key Instructions

1.  **Scenario Length is a Strict Limit:** The description **must be 1-2 sentences long.** Brevity is essential.

2.  **Parse Environmental Parameters:** Carefully read the provided text block to extract details for Crowdedness, Intensity, Time, Deadline, and Location.

3.  **Establish a Single Source of Truth for the Course:** Your primary source for all course-related information (like the course number and topic) is the **documents**.
    * Use the course number found in the document''s name or content (e.g., CS-182).
    * If the environmental parameters mention a different class, **you must ignore it**. Use only the course information from the documents to ensure the scenario is consistent.
    * The topic of the document (e.g., logic proofs, recursion) **must** be the central theme of the student''s problem.

4.  **Build a Subtle Scene (Show, Don''t Tell):** Use the persona and environmental details to hint at the situation.
    * **The student''s persona must be demonstrated, not stated.** Do not use the persona''s name (e.g., "Passive," "Aggressive") or its direct description in the title or description. For example, instead of writing "A passive student approaches," you should write "A student quietly approaches your desk, avoiding eye contact."

---

### ## Tool Usage

You have access to scenario generation tools. Use these tools to create your scenario:

* Call set_title_description(title: str, description: str) to set the scenario title and description
* Call set_objectives(objectives: list[str]) to set the learning objectives for the scenario

**Example tool calls:**
- set_title_description(title: "CS-182 Logic Proof Help Session", description: "A student approaches your desk during office hours, looking confused about direct proof techniques.")
- set_objectives(objectives: ["Understand direct proof methods", "Practice logical reasoning", "Apply proof techniques to homework problems"])

**Important:** Use the tools to create your scenario - do not return JSON. Call set_title_description first, then set_objectives to complete your scenario generation.'
WHERE name = 'Scenario';

-- Ensure all agents are properly associated with departments
-- First, let's check what departments exist and what agents are available
DO $$
DECLARE
    dept_record RECORD;
    agent_record RECORD;
    agent_count INTEGER;
BEGIN
    -- Get all departments
    FOR dept_record IN SELECT id, title FROM departments LOOP
        RAISE NOTICE 'Processing department: % (%)', dept_record.title, dept_record.id;
        
        -- Get all agents
        FOR agent_record IN SELECT id, name FROM agents WHERE active = true LOOP
            -- Check if this agent is already associated with this department
            SELECT COUNT(*) INTO agent_count
            FROM department_agents 
            WHERE department_id = dept_record.id AND agent_id = agent_record.id;
            
            -- If not associated, add the association
            IF agent_count = 0 THEN
                INSERT INTO department_agents (department_id, agent_id, active, created_at, updated_at)
                VALUES (dept_record.id, agent_record.id, true, NOW(), NOW());
                RAISE NOTICE 'Added agent % to department %', agent_record.name, dept_record.title;
            ELSE
                RAISE NOTICE 'Agent % already associated with department %', agent_record.name, dept_record.title;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Verify the updates
SELECT 
    a.name as agent_name,
    a.system_prompt IS NOT NULL as has_system_prompt,
    LENGTH(a.system_prompt) as prompt_length,
    COUNT(da.department_id) as department_count
FROM agents a
LEFT JOIN department_agents da ON a.id = da.agent_id AND da.active = true
WHERE a.name IN ('Grade', 'Scenario')
GROUP BY a.id, a.name, a.system_prompt
ORDER BY a.name;

-- ============================================================================
-- SCENARIO PROBLEM STATEMENTS MIGRATION
-- ============================================================================

-- Create new scenario_problem_statements table
CREATE TABLE scenario_problem_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  problem_statement TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active problem statement per scenario
CREATE UNIQUE INDEX scenario_problem_statements_one_active_per_scenario
  ON scenario_problem_statements(scenario_id) WHERE active;

CREATE INDEX ON scenario_problem_statements(scenario_id);
CREATE INDEX ON scenario_problem_statements(scenario_id, active);

-- Add use_documents column to scenarios
ALTER TABLE scenarios 
ADD COLUMN use_documents BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing problem_statements into new table
INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active, created_at, updated_at)
SELECT id, problem_statement, true, created_at, NOW()
FROM scenarios
WHERE problem_statement IS NOT NULL AND problem_statement != '';

-- Set use_documents to TRUE for all existing scenarios
UPDATE scenarios SET use_documents = TRUE;

-- Drop the old problem_statement column
ALTER TABLE scenarios DROP COLUMN problem_statement;

COMMIT;

-- Display final status
SELECT 
    'Migration completed successfully' as status,
    (SELECT COUNT(*) FROM agents) as total_agents,
    (SELECT COUNT(*) FROM agents WHERE name IN ('Grade', 'Scenario')) as updated_agents,
    (SELECT COUNT(*) FROM scenarios) as total_scenarios,
    (SELECT COUNT(*) FROM scenarios WHERE use_documents = true) as scenarios_with_documents,
    (SELECT COUNT(*) FROM scenario_problem_statements WHERE active = true) as active_problem_statements;

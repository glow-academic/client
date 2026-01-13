# Tool Reorganization Analysis: Scenario & Simulation Tool Consolidation

**Date:** Generated from database analysis  
**Database:** mydb (PostgreSQL)

## Executive Summary

This analysis examines the proposal to reorganize tools by:
1. **Moving scenario conversation tools** → **Scenario artifact** (`create_hint`, `create_content`, `create_response`, `end_conversation`)
2. **Moving grade tools** → **Simulation artifact** (all grading tools)
3. **Removing run tools** (`create_models`, `create_personas`, `create_profiles`) - they don't make sense as tools
4. **Removing domain tables** - no longer needed after direct artifact linking
5. **Removing chat/grade/run from artifacts enum** - they become regular tables, not artifacts

**Recommendation:** ✅ **YES, proceed with reorganization** - simplifies architecture and aligns tools with their actual use cases.

---

## Current State Analysis

### 17 Core Artifacts (from Unified Sidebar/MCP)

These are the artifacts that appear in the unified sidebar and MCP endpoints:

1. **personas** - AI characters used in scenarios
2. **scenarios** - Practice scenarios for learning
3. **simulations** - Interactive simulation sessions
4. **documents** - Document resources
5. **departments** - Organizational departments
6. **cohorts** - Student cohorts
7. **evals** - Evaluation configurations
8. **rubrics** - Grading rubrics
9. **settings** - System settings
10. **agents** - AI agents
11. **keys** - API keys
12. **models** - AI models
13. **providers** - AI providers
14. **parameters** - Configuration parameters
15. **fields** - Custom fields
16. **profile** - User profiles
17. **auth** - Authentication configurations

**Note:** The database enum currently has 22 artifacts total, including `chat`, `grade`, `run`, `message`, `tool`, `provider` which should become regular tables, not artifacts.

---

## Current Tool Mappings

### Message Artifact (Currently)
**Resources:**
- `content` → **NO TOOL MAPPED** (but `create_content` tool exists!)
- `hints` → `create_hint` tool
- `texts` → `create_text` tool
- `audios` → `create_audio` tool
- `personas` → `create_personas` tool

**Issues:**
- ❌ `create_content` tool exists but is NOT mapped to `content` resource
- ❌ These tools are scattered across `message` artifact when they belong to `scenario`

### Chat Artifact (Currently)
**Resources:**
- `conversations` → `create_conversation` tool (description says "End the conversation" - **incorrectly named!**)
- `responses` → `create_response` tool (for answering questions)

**Issues:**
- ❌ `create_conversation` description says "End the conversation" - should be `end_conversation`
- ❌ Chat artifact should not exist - conversations belong to scenarios

### Run Artifact (Currently)
**Resources:**
- `models` → `create_models` tool
- `personas` → `create_personas` tool
- `profiles` → `create_profiles` tool

**Issues:**
- ❌ These are NOT tools - they're metadata tracking
- ❌ Run artifact should not exist - runs are implementation details

### Grade Artifact (Currently)
**Resources:**
- `analyses` → `create_analysis` tool
- `feedbacks` → `create_feedback` tool
- `improvements` → `create_improvement` tool
- `strengths` → `create_strength` tool
- `times` → `create_times` tool

**Issues:**
- ❌ Grade artifact should not exist - grades belong to simulations

### Scenario Artifact (Currently)
**Resources (14 tools total):**
- `departments` → `create_departments`
- `descriptions` → `create_descriptions`
- `documents` → `create_documents`
- `fields` → `create_field`
- `flags` → `create_flags`
- `images` → `create_image`
- `names` → `create_names`
- `objectives` → `create_objective`
- `options` → `create_options`
- `parameters` → `create_parameters`
- `personas` → `create_personas`
- `questions` → `create_question`
- `templates` → `create_template`
- `videos` → `create_video`

**Missing:**
- ❌ `problem_statements` resource exists but is NOT mapped to scenario artifact
- ❌ `hints` resource exists but is mapped to `message` artifact
- ❌ `content` resource exists but has no tool mapping (should map to `create_content`)
- ❌ `responses` resource exists but is mapped to `chat` artifact
- ❌ `conversations` resource exists but is mapped to `chat` artifact

### Simulation Artifact (Currently)
**Resources (8 tools total):**
- `departments` → `create_departments`
- `descriptions` → `create_descriptions`
- `flags` → `create_flags`
- `names` → `create_names`
- `scenarios` → `create_scenarios`
- `simulation_scenario_flags` → `create_simulation_scenario_flags`
- `scenario_rubric_grade_agents` → `create_scenario_rubric_grade_agents`
- `scenario_positions` → `create_scenario_positions`

**Missing:**
- ❌ No grading tools currently mapped to simulation!

### Rubric Artifact (Currently)
**Resources (5 tools total):**
- `departments` → `create_departments`
- `descriptions` → `create_descriptions`
- `flags` → `create_flags`
- `names` → `create_names`
- `points` → `create_points`

**Missing:**
- ❌ `standard_groups` resource exists and has `create_standard_group` tool, but is NOT mapped to rubric artifact!

---

## Proposed Reorganization

### Phase 1: Fix Scenario Artifact Tools ✅

**Scenario Artifact** should have these conversation/interaction tools:
- `hints` → `create_hint` (move from message artifact)
- `content` → `create_content` (currently unmapped - **BUG FIX**)
- `responses` → `create_response` (move from chat artifact - for answering questions)
- `conversations` → `end_conversation` (move from chat artifact, **RENAME** `create_conversation` → `end_conversation`)
- `problem_statements` → `create_statement` (currently unmapped)

**Rationale:**
- ✅ Hints are provided during scenario conversations
- ✅ Content (messages) are created during scenario conversations
- ✅ Responses are answers to scenario questions
- ✅ Ending conversations happens in scenario context
- ✅ Problem statements are part of scenario definition

**Result:** Scenario artifact would have **19 tools total** (currently 14):
- Existing scenario tools (14)
- Conversation tools: `create_hint`, `create_content`, `create_response`, `end_conversation` (4)
- Missing tool: `create_statement` for `problem_statements` (1)

### Phase 2: Move Grade Tools to Simulation ✅

**Simulation Artifact** should have all grading tools:
- `analyses` → `create_analysis` (move from grade artifact)
- `feedbacks` → `create_feedback` (move from grade artifact)
- `improvements` → `create_improvement` (move from grade artifact)
- `strengths` → `create_strength` (move from grade artifact)
- `times` → `create_times` (move from grade artifact)

**Rationale:**
- ✅ Grades are always linked to simulations (via groups)
- ✅ Grading happens during/after simulation sessions
- ✅ Simulation agents need grading tools to provide feedback
- ✅ Aligns with business logic: simulations → grades

**Result:** Simulation artifact would have **13 tools total** (currently 8):
- Existing simulation tools (8)
- Grade tools: `create_analysis`, `create_feedback`, `create_improvement`, `create_strength`, `create_times` (5)

### Phase 3: Remove Run Tools ✅

**Remove these tools from artifact mappings:**
- `create_models` - NOT a tool, just metadata tracking
- `create_personas` - Already on scenario artifact (keep there)
- `create_profiles` - NOT a tool, just metadata tracking

**Rationale:**
- ✅ Runs are implementation details, not user-facing artifacts
- ✅ These "tools" don't create user-facing resources
- ✅ They're metadata that gets populated automatically during runs
- ✅ Removing them simplifies the tool model

**Result:** 
- `run` artifact removed from `artifact_resources`
- `models` and `profiles` resources removed from run artifact mappings
- `personas` stays on scenario artifact (where it belongs)

### Phase 4: Fix Rubric Artifact ✅

**Rubric Artifact** should gain:
- `standard_groups` → `create_standard_group` (currently unmapped!)

**Rationale:**
- ✅ Standard groups are the core of rubrics
- ✅ Rubrics define standard groups for grading
- ✅ Currently missing this critical mapping!

**Result:** Rubric artifact would have **6 tools total** (currently 5)

---

## Domain Tables Removal

### Current Domain Infrastructure

**Domain Tables (8 total):**
- `domains` - Base domain table
- `domain_artifacts` - Links domains to artifacts (22 rows)
- `agent_domains` - Links agents to domains (20 rows)
- `scenario_agent_domains` - Scenario-specific agent domains
- `simulation_agent_domains` - Simulation-specific agent domains
- `document_agent_domains` - Document-specific agent domains
- `rubric_domains` - Rubric-specific domains
- `tool_domains` - Tool-specific domains

### Why Remove Domains?

**Current Flow:**
```
Agent → Domain → Artifact → Resource → Tool
```

**After Reorganization:**
```
Agent → Artifact → Resource → Tool
```

**Rationale:**
- ✅ After tool reorganization, agents link directly to artifacts
- ✅ No need for intermediate domain layer
- ✅ Simpler mental model: "This agent works with scenarios"
- ✅ Domains were used to group tools, but now tools are properly organized by artifact

**Migration:**
1. Agents currently linked via `agent_domains` → link directly to artifacts via `artifact_agents` (or similar)
2. Remove all domain-related tables
3. Update agent configuration to use direct artifact links

---

## Removing Chat/Grade/Run from Artifacts Enum

### Current State

**Artifacts Enum (22 total):**
- Core artifacts: `agent`, `scenario`, `simulation`, `document`, `cohort`, `persona`, `parameter`, `field`, `model`, `eval`, `department`, `auth`, `key`, `setting`, `profile`, `rubric`, `provider`, `tool`
- Implementation artifacts: `chat`, `grade`, `run`, `message`

### Proposed Change

**Artifacts Enum (18 total):**
- Core artifacts: `agent`, `scenario`, `simulation`, `document`, `cohort`, `persona`, `parameter`, `field`, `model`, `eval`, `department`, `auth`, `key`, `setting`, `profile`, `rubric`, `provider`, `tool`
- **Remove:** `chat`, `grade`, `run`, `message`

**Rationale:**
- ✅ `chat`, `grade`, `run`, `message` are implementation details, not user-facing artifacts
- ✅ They exist as tables (`chat_artifact`, `grade_artifact`, `run_artifact`, `message_artifact`) but don't need to be in the artifacts enum
- ✅ Tools are now organized by core artifacts (scenario, simulation, rubric)
- ✅ Cleaner separation: 17 core artifacts + `tool` artifact = 18 total

**Migration:**
1. Remove `chat`, `grade`, `run`, `message` from `artifacts` enum
2. Keep tables (`chat_artifact`, `grade_artifact`, `run_artifact`, `message_artifact`) - they still store data
3. Remove from `artifact_resources` mappings
4. Update all code references to use core artifacts instead

---

## Detailed Analysis

### Is This a Good Split?

**YES** - Here's why:

#### ✅ **Semantic Alignment**
- **Scenarios** = content creation + conversation → all scenario/conversation tools belong here
- **Simulations** = execution + assessment → all simulation/grading tools belong here
- **Rubrics** = assessment criteria → standard_group tools belong here

#### ✅ **Simplifies Agent Configuration**
Currently, agents need to be linked to multiple artifacts:
- Scenario agents need: `scenario` + `chat` + `message` + `run` artifacts
- Simulation agents need: `simulation` + `grade` artifacts

After reorganization:
- Scenario agents get everything from `scenario` artifact
- Simulation agents get everything from `simulation` artifact
- **No domain tables needed** - direct artifact linking

#### ✅ **Removes Unnecessary Abstraction**
- Domains were an intermediate layer that's no longer needed
- Direct artifact → resource → tool mapping is clearer
- Fewer tables to maintain and understand

#### ✅ **Database Relationships Support This**
- `chat_artifact.scenario_id` FK → chats belong to scenarios
- `grade_artifact` linked to simulations via groups
- `run_artifact` tracks executions but doesn't need tool exposure
- `message_artifact` is part of conversations (scenarios)

### Tool Naming Fixes

#### ❌ **Current:** `create_conversation`
**Description:** "End the conversation. This tool signals that the conversation should be terminated."

**✅ **Should be:** `end_conversation`
- Tool name matches its actual function
- Clearer intent: ending vs creating

#### ❌ **Current:** `create_content` exists but not mapped
**Description:** "Make a persona speak by calling this tool with the persona name and message."

**✅ **Should map to:** `content` resource on `scenario` artifact
- This is how personas create messages during conversations
- Belongs with scenario conversation tools

---

## Recommended Migration Plan

### Phase 1: Fix Scenario Artifact Tools
1. Map `problem_statements` resource to `scenario` artifact
2. Map `content` resource to `scenario` artifact (currently unmapped!)
3. Map `hints` resource to `scenario` artifact (move from `message` artifact)
4. Map `responses` resource to `scenario` artifact (move from `chat` artifact)
5. Map `conversations` resource to `scenario` artifact (move from `chat` artifact)
6. Rename `create_conversation` tool → `end_conversation`
7. Map `create_content` tool to `content` resource

### Phase 2: Move Grade Tools to Simulation
1. Map `analyses` resource to `simulation` artifact
2. Map `feedbacks` resource to `simulation` artifact
3. Map `improvements` resource to `simulation` artifact
4. Map `strengths` resource to `simulation` artifact
5. Map `times` resource to `simulation` artifact

### Phase 3: Remove Run Tools
1. Remove `models` resource from `run` artifact mappings
2. Remove `profiles` resource from `run` artifact mappings
3. Keep `personas` on `scenario` artifact (already there)
4. Remove `run` artifact from `artifact_resources` entirely

### Phase 4: Fix Rubric Artifact
1. Map `standard_groups` resource to `rubric` artifact

### Phase 5: Remove Domain Tables
1. Migrate agents from `agent_domains` → direct artifact links
2. Drop `agent_domains` table
3. Drop `domain_artifacts` table
4. Drop `scenario_agent_domains` table
5. Drop `simulation_agent_domains` table
6. Drop `document_agent_domains` table
7. Drop `rubric_domains` table
8. Drop `tool_domains` table
9. Drop `domains` table (if no other references)

### Phase 6: Remove Chat/Grade/Run/Message from Artifacts Enum
1. Remove `chat` from `artifacts` enum
2. Remove `grade` from `artifacts` enum
3. Remove `run` from `artifacts` enum
4. Remove `message` from `artifacts` enum
5. Keep tables (`chat_artifact`, `grade_artifact`, `run_artifact`, `message_artifact`) - they still store data
6. Remove from `artifact_resources` mappings
7. Update all code references

### Phase 7: Update Agent Configuration
1. Agents currently linked to `chat` artifact → link to `scenario` artifact
2. Agents currently linked to `message` artifact → link to `scenario` artifact
3. Agents currently linked to `run` artifact → remove (no tools needed)
4. Agents currently linked to `grade` artifact → link to `simulation` artifact
5. Verify `agent_tools` junction table repopulates correctly

---

## Final Recommendation

### ✅ **Proceed with Complete Reorganization**

**Benefits:**
1. **Cleaner mental model** - Tools grouped by user-facing artifacts (scenario, simulation, rubric)
2. **Simpler agent config** - One artifact per use case, no domains needed
3. **Better alignment** - Tools match business logic flow
4. **Fewer abstractions** - Remove domain layer, direct artifact linking
5. **Correct tool names** - `end_conversation` instead of `create_conversation`
6. **Fix bugs** - Map `create_content` tool to `content` resource

**Implementation:**
- Keep `chat_artifact`, `grade_artifact`, `run_artifact`, `message_artifact` tables (they store data)
- Remove them from `artifacts` enum (they're implementation details)
- Remove them from `artifact_resources` mappings (tools moved to core artifacts)
- Remove all domain tables (no longer needed)
- Update agent configurations to use core artifacts directly

**Result:**
- **18 artifacts** in enum (17 core + `tool`)
- **Scenario artifact:** 19 tools (content creation + conversation)
- **Simulation artifact:** 13 tools (simulation management + grading)
- **Rubric artifact:** 6 tools (rubric definition + standard groups)
- **No domain tables** - direct artifact → resource → tool mapping
- **Clean separation** between user-facing artifacts and implementation details

---

## Questions Answered

### Q: What tools belong with the scenario agent?
**A:** Scenario agent should have:
- `create_hint` - Create strategic hints during conversations
- `create_content` - Make personas speak (create messages)
- `create_response` - Answer questions (link questions to options)
- `end_conversation` - End the conversation (currently incorrectly named `create_conversation`)
- Plus all existing scenario generation tools (images, videos, questions, objectives, etc.)

### Q: What tools belong with the simulation agent?
**A:** Simulation agent should have:
- All existing simulation management tools (8)
- All grading tools: `create_analysis`, `create_feedback`, `create_improvement`, `create_strength`, `create_times` (5)
- Total: 13 tools

### Q: Should run tools be removed?
**A:** ✅ **YES** - `create_models`, `create_personas`, `create_profiles` are NOT tools. They're metadata that gets populated automatically during runs. Removing them simplifies the model.

### Q: Can we remove domain tables after this?
**A:** ✅ **YES** - After tools are properly organized by artifact, agents can link directly to artifacts. No need for intermediate domain layer.

### Q: Can we remove chat/grade/run from artifacts enum?
**A:** ✅ **YES** - They become regular tables (`chat_artifact`, `grade_artifact`, `run_artifact`) but don't need to be in the artifacts enum. Tools are now organized by core artifacts (scenario, simulation, rubric).

---

## Next Steps

1. **Review this analysis** with team
2. **Create migration script** following Phase 1-7 plan
3. **Test migration** on development database
4. **Update agent configurations** to use new artifact mappings
5. **Remove domain infrastructure** (tables, code references)
6. **Update artifacts enum** to remove chat/grade/run/message
7. **Update documentation** to reflect new tool organization

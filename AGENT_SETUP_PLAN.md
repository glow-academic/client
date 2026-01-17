# Agent Setup Plan: One Dedicated Agent Per Artifact

## Summary

**Goal**: Create exactly **17 dedicated agents** - one for each artifact. Each agent must have:
- ✅ System prompt
- ✅ Developer instructions  
- ✅ ALL tools for that artifact (and ONLY tools for that artifact)

**Current State**: Only some artifacts have dedicated agents. Many artifacts share agents or don't have dedicated agents at all.

## Audit Results: One Dedicated Agent Per Artifact

### Current Dedicated Agents (Agents Named After Artifacts)

| Artifact | Dedicated Agent Name | Agent ID | Tool Count | Agent Tools | Status |
|----------|---------------------|----------|------------|-------------|--------|
| persona | Persona Agent | `cccccccc-cccc-cccc-cccc-cccccccccccc` | 10 | 9 | ⚠️ Missing 1 tool |
| scenario | Scenario | `019b3be4-3112-7685-8967-a5488fadb090` | 20 | 17 | ⚠️ Missing 3 tools |
| simulation | Simulation Agent | `dddddddd-dddd-dddd-dddd-dddddddddddd` | 13 | 12 | ⚠️ Missing 1 tool |
| document | Document Agent | `019b3be4-3112-774d-82b2-c4c3ed98238e` | 10 | 7 | ⚠️ Missing 3 tools |
| rubric | Rubric | `019b3be4-3112-7786-ad7d-45ee39b86bc5` | 6 | 6 | ⚠️ Missing instructions |
| setting | Setting Agent | `77777777-7777-7777-7777-777777777777` | 8 | 8 | ✅ Complete |
| parameter | Parameter Agent | `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` | 5 | 5 | ⚠️ Shared UUID - needs separate agent |
| auth | Auth Agent | `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` | 6 | 6 | ⚠️ Shared UUID with Parameter - needs separate agent |
| profile | Profile Agent | `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` | 6 | 3 | ⚠️ Shared UUID - needs separate agent |
| tool | Tool Agent | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | 5 | 2 | ⚠️ Missing 3 tools |
| field | Field Agent | ❌ Not in database | 5 | 0 | ❌ **CREATE** (migration 241 created it but not in DB) |

### Missing Dedicated Agents (Need to Create)

| Artifact | Tool Count | Action |
|----------|------------|--------|
| department | 4 | **CREATE Department Agent** |
| cohort | 6 | **CREATE Cohort Agent** |
| eval | 14 | **CREATE Eval Agent** |
| agent | 10 | **CREATE Agent Agent** (meta-agent for managing agents) |
| model | 13 | **CREATE Model Agent** |
| provider | 4 | **CREATE Provider Agent** |
| field | 5 | **CREATE Field Agent** (migration 241 created it but not in DB) |

### Issues to Fix

1. **UUID Conflict**: Auth Agent, Parameter Agent, and Profile Agent all share UUID `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` - Need to create separate agents
2. **Field Agent**: Exists in migration 241 - Need to verify it's properly set up in database
3. **Missing Tools**: Most agents don't have all tools for their artifact
4. **Missing Instructions**: Rubric Agent missing developer instructions
5. **Tool Agent**: Exists but missing 3 tools

## Migration Strategy: One Agent Per Artifact

### Phase 1: Fix Existing Dedicated Agents
1. **Persona Agent** - Add 1 missing tool
2. **Scenario Agent** - Add 3 missing tools
3. **Simulation Agent** - Add 1 missing tool
4. **Document Agent** - Add 3 missing tools
5. **Rubric Agent** - Add developer instructions
6. **Setting Agent** - Verify complete (should be OK)
7. **Parameter Agent** - Fix UUID conflict (create new separate agent)
8. **Auth Agent** - Fix UUID conflict (create new separate agent)
9. **Profile Agent** - Fix UUID conflict (create new separate agent)
10. **Tool Agent** - Add 3 missing tools
11. **Field Agent** - Verify exists and is complete

### Phase 2: Create Missing Dedicated Agents
Create NEW dedicated agents for artifacts that don't have one:
1. **Department Agent** - 4 tools
2. **Cohort Agent** - 6 tools  
3. **Eval Agent** - 14 tools
4. **Agent Agent** (meta-agent for managing agents) - 10 tools
5. **Model Agent** - 13 tools
6. **Provider Agent** - 4 tools
7. **Field Agent** - 5 tools (migration 241 created it but not in DB)

### Phase 3: Ensure Each Agent Has All Required Components
For EACH of the 17 agents, verify:
- ✅ Agent exists and is dedicated to ONE artifact
- ✅ Agent has ALL tools for that artifact (query: `SELECT DISTINCT rt.tool_id FROM artifact_resources ar JOIN resource_tools rt ON rt.resource = ar.resource WHERE ar.artifact = '{artifact}'`)
- ✅ Agent has a system prompt
- ✅ Agent has developer instructions
- ✅ Agent has name, description, model, flags configured

### Final State: 17 Dedicated Agents

| # | Artifact | Agent Name | Status |
|---|----------|------------|--------|
| 1 | persona | Persona Agent | ✅ Exists | Add 1 missing tool |
| 2 | scenario | Scenario Agent | ✅ Exists | Add 3 missing tools |
| 3 | simulation | Simulation Agent | ✅ Exists | Add 1 missing tool |
| 4 | document | Document Agent | ✅ Exists | Add 3 missing tools |
| 5 | department | Department Agent | ❌ Missing | **CREATE** + all tools + prompt + instructions |
| 6 | cohort | Cohort Agent | ❌ Missing | **CREATE** + all tools + prompt + instructions |
| 7 | eval | Eval Agent | ❌ Missing | **CREATE** + all tools + prompt + instructions |
| 8 | rubric | Rubric Agent | ✅ Exists | Add developer instructions |
| 9 | setting | Setting Agent | ✅ Exists | ✅ Complete - verify only |
| 10 | agent | Agent Agent | ❌ Missing | **CREATE** + all tools + prompt + instructions |
| 11 | model | Model Agent | ❌ Missing | **CREATE** + all tools + prompt + instructions |
| 12 | provider | Provider Agent | ❌ Missing | **CREATE** + all tools + prompt + instructions |
| 13 | parameter | Parameter Agent | ⚠️ UUID conflict | Fix UUID + verify complete |
| 14 | field | Field Agent | ❌ Missing | **CREATE** + all tools + prompt + instructions |
| 15 | profile | Profile Agent | ⚠️ UUID conflict | Fix UUID + all tools + prompt + instructions |
| 16 | auth | Auth Agent | ⚠️ UUID conflict | Fix UUID + verify complete |
| 17 | tool | Tool Agent | ✅ Exists | Add 3 missing tools |

**Summary:**
- ✅ **9 agents exist** but need fixes (missing tools/instructions/UUID conflicts)
- ❌ **7 agents need to be created** (department, cohort, eval, agent, model, provider, field)
- ⚠️ **1 agent needs UUID fix** (parameter/auth/profile share UUID `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee`)

## Implementation Notes

### Agent Naming Convention
- Use format: `{Artifact} Agent` (e.g., "Persona Agent", "Cohort Agent")
- Exception: "Agent Agent" for the meta-agent (or "Agent Management Agent")

### Tool Assignment
- Each agent gets ALL tools for its artifact via `artifact_resources` → `resource_tools`
- Query: `SELECT DISTINCT rt.tool_id FROM artifact_resources ar JOIN resource_tools rt ON rt.resource = ar.resource WHERE ar.artifact = '{artifact_name}'`

### Prompt Template
Each agent needs a system prompt that:
- Describes the agent's role
- Lists all available tools
- Provides guidelines for tool usage
- Follows the pattern from existing migrations (e.g., Persona Agent in migration 229)

### Developer Instructions Template
Each agent needs developer instructions that:
- Provide specific guidance for agent behavior
- Reference the tools available
- Follow the pattern from existing migrations (e.g., Parameter Agent in migration 241)

## Next Steps

1. ✅ **Audit Complete** - This document summarizes findings
2. ⏳ **Create Migration** - Build migration SQL to create/fix all agents
3. ⏳ **Test Migration** - Verify on test database
4. ⏳ **Apply Migration** - Run on production

## References

- Migration 229: Persona Agent creation pattern
- Migration 241: Parameter/Field Agent creation pattern  
- Migration 256: Agent consolidation (but doesn't create one per artifact)

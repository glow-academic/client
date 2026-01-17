# Agent Audit Summary: One Agent Per Artifact

## Current State (Based on Database Query)

### Artifacts with Dedicated Agents (Primary Agent with Most Tools)
1. **Persona** - Agent: `cccccccc-cccc-cccc-cccc-cccccccccccc` - ⚠️ Missing 1 tool (9/10)
2. **Scenario** - Agent: `019b3be4-3112-7685-8967-a5488fadb090` - ⚠️ Missing 3 tools (17/20)
3. **Simulation** - Agent: `dddddddd-dddd-dddd-dddd-dddddddddddd` - ⚠️ Missing 1 tool (12/13)
4. **Document** - Agent: `019b3be4-3112-774d-82b2-c4c3ed98238e` - ⚠️ Missing 3 tools (7/10)
5. **Department** - Agent: `cccccccc-cccc-cccc-cccc-cccccccccccc` (Persona Agent) - ⚠️ Missing 1 tool (3/4)
6. **Cohort** - Agent: `019b3be4-3112-774d-82b2-c4c3ed98238e` (Document Agent) - ⚠️ Missing 2 tools (4/6)
7. **Eval** - Agent: `dddddddd-dddd-dddd-dddd-dddddddddddd` (Simulation Agent) - ⚠️ Missing 7 tools (7/14)
8. **Rubric** - Agent: `019b3be4-3112-7786-ad7d-45ee39b86bc5` - ✅ Complete (6/6)
9. **Setting** - Agent: `77777777-7777-7777-7777-777777777777` - ✅ Complete (8/8)
10. **Agent** - Agent: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` (Prompt Agent) - ⚠️ Missing 3 tools (7/10)
11. **Model** - Agent: `77777777-7777-7777-7777-777777777777` (Setting Agent) - ⚠️ Missing 8 tools (5/13)
12. **Provider** - Agent: `019b3be4-3112-7685-8967-a5488fadb090` (Scenario Agent) - ⚠️ Missing 1 tool (3/4)
13. **Parameter** - Agent: `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` - ✅ Complete (5/5)
14. **Field** - Agent: `019b3be4-3112-7685-8967-a5488fadb090` (Scenario Agent) - ✅ Complete (5/5)
15. **Profile** - Agent: `cccccccc-cccc-cccc-cccc-cccccccccccc` (Persona Agent) - ⚠️ Missing 3 tools (3/6)
16. **Auth** - Agent: `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` - ✅ Complete (6/6)
17. **Tool** - Agent: `019b3be4-3112-774d-82b2-c4c3ed98238e` (Document Agent) - ⚠️ Missing 1 tool (4/5)

### Issues Found
1. **Agents are shared across artifacts**: Many artifacts share the same agent (e.g., Persona Agent serves Persona, Department, Profile)
2. **Missing tools**: Most agents don't have all tools for their primary artifact
3. **No dedicated agents**: Some artifacts don't have a dedicated agent (they share with others)

### Issues Found
1. **Shared Agent IDs**: Auth Agent, Profile Agent, and Parameter Agent all share the same UUID (`eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee`) - This is a bug!
2. **Missing Instructions**: Rubric Agent has no developer instructions
3. **Incomplete Tools**: Many agents don't have all tools for their artifact
4. **No Dedicated Agents**: 6 artifacts don't have dedicated agents

## Target State

### One Agent Per Artifact (17 agents total)

Each agent must have:
1. ✅ **Prompt**: System prompt describing the agent's role and available tools
2. ✅ **Developer Instructions**: Template instructions for the agent
3. ✅ **All Tools**: All tools for that artifact (via `artifact_resources` → `resource_tools`)

### Artifacts and Their Tool Counts
- `persona`: 10 tools
- `scenario`: 20 tools
- `simulation`: 13 tools
- `document`: 10 tools
- `department`: 4 tools
- `cohort`: 6 tools
- `eval`: 14 tools
- `rubric`: 6 tools
- `setting`: 8 tools
- `agent`: 10 tools
- `model`: 13 tools
- `provider`: 4 tools
- `parameter`: 5 tools
- `field`: 5 tools
- `profile`: 6 tools
- `auth`: 6 tools
- `tool`: 5 tools

## Migration Plan

### Phase 1: Fix Existing Agents
1. Fix shared UUID issue (create separate agents for Auth, Profile, Parameter)
2. Add missing tools to existing agents
3. Add developer instructions to Rubric Agent

### Phase 2: Create Missing Agents
1. Create Cohort Agent
2. Create Eval Agent
3. Create Department Agent
4. Create Provider Agent
5. Create Model Agent
6. Create Agent Agent (meta-agent)

### Phase 3: Verify Completeness
1. Verify each artifact has exactly one dedicated agent
2. Verify each agent has all tools for its artifact
3. Verify each agent has a prompt
4. Verify each agent has developer instructions

## Notes

- **No `agent_artifacts` table**: Agents are linked to artifacts via their tools (`agent_tools` → `resource_tools` → `artifact_resources`)
- **Agent derivation**: An agent's artifact association is derived from its tools, not stored explicitly
- **One agent can serve multiple artifacts**: This is allowed, but for clean slate, we want one dedicated agent per artifact

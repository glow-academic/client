# Artifacts/Resources Analysis - Part 1: Current State

## Overview

Analysis of what it would take to make all 17 top-level graph components artifacts (with singular names), and all tables related to them resources.

## Current Artifacts Enum

The `artifacts` enum currently contains:
- `agent`
- `chat`
- `document`
- `grade`
- `message`
- `rubric`
- `run`
- `scenario`

**Total**: 8 artifacts

## Current Resources Enum

The `resources` enum currently contains:
- `analysis`
- `answer`
- `content`
- `conversation`
- `debug_info`
- `developer_instruction`
- `document`
- `feedback`
- `field`
- `fields`
- `hint`
- `html`
- `image`
- `improvement`
- `objective`
- `option`
- `parameters`
- `problem_statement`
- `prompt`
- `question`
- `response`
- `schema`
- `schema_field`
- `schema_field_item`
- `standard_group`
- `strength`
- `template`
- `template_array_item`
- `template_value`
- `times`
- `video`

**Total**: 31 resources

## Current Tables Using Artifacts/Resources

### Tables with `artifact` column:
- `domains` - Links artifacts to agents (artifact enum + agent_id)
- `rubrics` - Has artifact enum column

### Tables with `resource` column:
- `resource_schemas` - Links resources to schemas (resource enum + schema_id)
- `resource_tools` - Links resources to tools (resource enum + tool_id)

## Current Domains Table Structure

```sql
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    artifact artifacts NOT NULL,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(artifact, agent_id)
);
```

**Purpose**: Links artifacts to agents. Each domain represents an agent's capability in a specific artifact type.

## Current Resource Schemas Table Structure

```sql
CREATE TABLE resource_schemas (
    resource resources NOT NULL,
    schema_id UUID NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (resource, schema_id)
);
```

**Purpose**: Links resources to schemas. Defines which schemas can be used for which resources.

## Current Resource Tools Table Structure

```sql
CREATE TABLE resource_tools (
    resource resources NOT NULL,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (resource, tool_id)
);
```

**Purpose**: Links resources to tools. Defines which tools can operate on which resources.

## Current Pattern Summary

1. **Artifacts** = Top-level entities (scenario, document, message, etc.)
2. **Resources** = Sub-entities or attributes of artifacts (problem_statement, objective, content, etc.)
3. **Domains** = Links artifacts to agents (which agents can work with which artifacts)
4. **Resource Schemas** = Links resources to schemas (which schemas define which resources)
5. **Resource Tools** = Links resources to tools (which tools operate on which resources)

## Key Observations

1. **Artifacts are singular**: All artifact enum values are singular (scenario, document, persona, profile)
2. **Resources are plural**: Resources are the plural form of table names (personas, departments, emails, names)
3. **Junction table pattern**: Junction tables follow `{artifact}_{resource}` where artifact is singular and resource is plural (e.g., `scenario_personas`, `profile_departments`)
4. **Artifacts can be resources**: A table/entity can be both an artifact (top-level, singular name) AND a resource (when referenced by another artifact, plural name). For example:
   - `personas` table → artifact: `persona` (singular)
   - `personas` table → resource: `personas` (plural, when referenced by `scenario` artifact via `scenario_personas` junction table)
5. **Database table names**: Database table names are typically plural (e.g., `documents`, `fields`, `personas`), artifact enum values are singular (e.g., `document`, `field`, `persona`)
6. **Not all top-level objects are artifacts**: Only 8 artifacts exist, but we have 17 core graph components
7. **Resources map to artifact sub-entities**: Resources represent things that belong to artifacts (e.g., `personas` resource belongs to `scenario` artifact via `scenario_personas` junction table)


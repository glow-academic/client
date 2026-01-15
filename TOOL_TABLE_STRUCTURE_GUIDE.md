# Working Backwards: From Tool to Table Structure

## Concrete Example: `create_analysis` Tool

**Tool ID:** `019b6ba0-df03-7337-b323-09bd3a69abac`

---

## Step-by-Step: How to Trace Backwards

### 1. Start with the Tool

```sql
-- Find the tool
SELECT ta.id as tool_id, nr.name as tool_name
FROM tool_artifact ta
JOIN tool_names tn ON tn.tool_id = ta.id
JOIN names_resource nr ON nr.id = tn.name_id
WHERE nr.name = 'create_analysis' AND tn.active = true;
```

**Result:**
- `tool_id`: `019b6ba0-df03-7337-b323-09bd3a69abac`
- `tool_name`: `create_analysis`

**Table:** `tool_artifact` (the tool itself)

---

### 2. Find Input Arguments (What the tool expects)

```sql
-- Get input arguments via tool_args junction table
SELECT 
    ar.id as args_id,
    ar.name,
    ar.description,
    ar.field_type,
    ar.required,
    ar.default_value,
    ar.position
FROM tool_args tar
JOIN args_resource ar ON ar.id = tar.args_id
WHERE tar.tool_id = '019b6ba0-df03-7337-b323-09bd3a69abac'
  AND ar.active = true
ORDER BY ar.position;
```

**Result for `create_analysis`:**
- `args_id`: `019bbf87-091e-768f-9c96-37941363873a`
- `name`: `content`
- `field_type`: `string`
- `required`: `true`

**Tables:**
- `tool_args` (junction: tool → args_resource)
- `args_resource` (defines input argument structure)

**Relationship:**
```
tool_artifact (id)
  ↓ (via tool_args.tool_id)
tool_args (tool_id, args_id)
  ↓ (via tool_args.args_id)
args_resource (id, name, field_type, required, default_value, ...)
```

---

### 3. Find Output Templates (How the tool transforms outputs)

```sql
-- Get output templates via tool_args_outputs junction table
SELECT 
    aor.id as args_outputs_id,
    aor.name,
    aor.template,
    aor.args_id as linked_args_id  -- Links back to args_resource
FROM tool_args_outputs tao
JOIN args_outputs_resource aor ON aor.id = tao.args_outputs_id
WHERE tao.tool_id = '019b6ba0-df03-7337-b323-09bd3a69abac'
  AND aor.active = true;
```

**Result for `create_analysis`:**
- `args_outputs_id`: `019bbf87-0966-7327-b2a1-f5fbde584a12`
- `name`: `content`
- `template`: `{{ info }}`
- `linked_args_id`: `019bbf87-091e-768f-9c96-37941363873a` (references the input arg!)

**Tables:**
- `tool_args_outputs` (junction: tool → args_outputs_resource)
- `args_outputs_resource` (defines output template structure)

**Relationship:**
```
tool_artifact (id)
  ↓ (via tool_args_outputs.tool_id)
tool_args_outputs (tool_id, args_outputs_id)
  ↓ (via tool_args_outputs.args_outputs_id)
args_outputs_resource (id, name, template, args_id)
  ↓ (via args_outputs_resource.args_id)
args_resource (id)  -- Links back to input argument!
```

**Key Insight:** `args_outputs_resource.args_id` links back to `args_resource`, creating a connection between input and output!

---

### 4. Find Actual Input Values (When tool was called)

```sql
-- Get actual input values from calls
SELECT 
    av.id,
    av.call_id,
    av.args_id,
    ar.name as arg_name,
    av.string_value,
    av.number_value,
    av.boolean_value
FROM args_values av
JOIN args_resource ar ON ar.id = av.args_id
JOIN calls c ON c.id = av.call_id
WHERE c.tool_id = '019b6ba0-df03-7337-b323-09bd3a69abac'
ORDER BY c.created_at DESC
LIMIT 10;
```

**Tables:**
- `calls` (records when tool was executed)
- `args_values` (stores actual input values per call)

**Relationship:**
```
calls (id, tool_id)
  ↓ (via calls.id)
args_values (call_id, args_id, string_value|number_value|boolean_value)
  ↓ (via args_values.args_id)
args_resource (id)  -- Which argument this value is for
```

**Key Constraint:** Exactly ONE of `string_value`, `number_value`, or `boolean_value` must be set (check constraint).

---

### 5. Find Actual Output Values (Results from tool execution)

```sql
-- Get actual output values from calls
SELECT 
    aov.id,
    aov.call_id,
    aov.args_outputs_id,
    aor.name as output_name,
    aor.template,
    aov.string_value,
    aov.number_value,
    aov.boolean_value
FROM args_outputs_values aov
JOIN args_outputs_resource aor ON aor.id = aov.args_outputs_id
JOIN calls c ON c.id = aov.call_id
WHERE c.tool_id = '019b6ba0-df03-7337-b323-09bd3a69abac'
ORDER BY c.created_at DESC
LIMIT 10;
```

**Tables:**
- `calls` (records when tool was executed)
- `args_outputs_values` (stores actual output values per call)

**Relationship:**
```
calls (id, tool_id)
  ↓ (via calls.id)
args_outputs_values (call_id, args_outputs_id, string_value|number_value|boolean_value)
  ↓ (via args_outputs_values.args_outputs_id)
args_outputs_resource (id)  -- Which output template this value is for
```

**Key Constraint:** Exactly ONE of `string_value`, `number_value`, or `boolean_value` must be set (check constraint).

---

### 6. The `outputs` Table (Resource Output Catalog)

**Important:** The `outputs` table is a **separate catalog system** that defines what output field names can exist in the system. It's **not directly connected** to tool execution via `args_outputs_resource` or `args_outputs_values`.

**Purpose:** `outputs` acts as a registry/catalog of output field names (like "content", "name", "description", etc.) that can be associated with resources.

**Structure:**
```sql
outputs (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,      -- e.g., "content", "name", "description"
  field_type text NOT NULL,        -- e.g., "string", "number"
  description text NOT NULL,
  created_at timestamptz,
  updated_at timestamptz
)
```

**Relationship:**
```
resources (created by tools)
  ↓ (via resource_outputs.resource)
resource_outputs (resource, outputs_id)
  ↓ (via resource_outputs.outputs_id)
outputs (id, name, field_type)  -- Catalog of output field names
```

**Key Points:**
- `outputs` is a **catalog/registry** table - it defines what output field names exist
- `resource_outputs` links actual resources to these output definitions
- `outputs.name` may match `args_outputs_resource.name` by convention, but they're **not foreign key linked**
- `outputs` is used for **resource metadata** (what outputs a resource type can have)
- `args_outputs_resource` is used for **tool execution** (templates for transforming inputs to outputs)

**When to use `outputs`:**
- To find what output fields a resource type supports
- To understand the schema of outputs for a resource
- To link resources to their output field definitions
- **To find the return structure for a resource type** (this is the key use case!)

**When NOT to use `outputs`:**
- To trace tool execution flow (use `args_outputs_resource` → `args_outputs_values` instead)
- To find actual output values from tool calls (use `args_outputs_values` instead)

### 7. Finding the Return Structure for a Resource Type

**Purpose:** Determine what output fields a resource type has (its return structure/schema)

**SQL Function:** `api_get_resource_schema_fields_v4(resource_type text)`

**Query:**
```sql
-- Get return structure for a resource type
SELECT 
    o.name,
    o.field_type,
    false as required,  -- outputs don't have required field
    0 as position,      -- outputs don't have position field
    ''::text as template  -- templates handled by args_outputs
FROM resource_outputs ro
JOIN outputs o ON o.id = ro.outputs_id
WHERE ro.resource = 'analyses'::resources  -- Replace with your resource type
ORDER BY o.name;
```

**Or use the function:**
```sql
SELECT * FROM api_get_resource_schema_fields_v4('analyses');
```

**Result for `analyses` resource:**
- `name`: `content`
- `field_type`: `string`

**Tables:**
- `resource_outputs` (junction: resource type → outputs)
- `outputs` (catalog of output field definitions)

**Relationship:**
```
resource_type (enum: 'analyses', 'personas', 'contents', etc.)
  ↓ (via resource_outputs.resource)
resource_outputs (resource, outputs_id)
  ↓ (via resource_outputs.outputs_id)
outputs (id, name, field_type)  -- Defines return structure
```

**Example: Finding return structure for `create_analysis` tool's resource:**

```sql
-- Step 1: Find what resource type the tool creates
-- (This would typically be in tool metadata or discovery logic)

-- Step 2: Get return structure for that resource type
SELECT * FROM api_get_resource_schema_fields_v4('analyses');

-- Result: Returns the output fields that analyses resources have
-- This tells you what fields will be in the return structure
```

**Key Insight:** The `outputs` table defines the **return structure** for resource types. When a tool creates a resource, the resource's return structure is defined by `resource_outputs` → `outputs`, not by `args_outputs_resource`.

---

## Complete Table Relationship Diagram

```
┌─────────────────┐
│ tool_artifact   │
│ (id)            │
└────────┬────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌─────────────────┐                  ┌──────────────────────┐
│ tool_args       │                  │ tool_args_outputs    │
│ (tool_id,       │                  │ (tool_id,            │
│  args_id)       │                  │  args_outputs_id)    │
└────────┬────────┘                  └──────────┬───────────┘
         │                                     │
         ▼                                     ▼
┌─────────────────┐                  ┌──────────────────────┐
│ args_resource   │◄─────────────────│ args_outputs_resource│
│ (id, name,      │  args_id          │ (id, name, template,│
│  field_type,    │                   │  args_id)           │
│  required, ...) │                   └──────────┬───────────┘
└────────┬────────┘                              │
         │                                       │
         │                                       │
         ▼                                       ▼
┌─────────────────┐                  ┌──────────────────────┐
│ args_values     │                  │ args_outputs_values  │
│ (call_id,       │                  │ (call_id,            │
│  args_id,       │                  │  args_outputs_id,    │
│  string_value,  │                  │  string_value,       │
│  number_value,  │                  │  number_value,       │
│  boolean_value) │                  │  boolean_value)      │
└────────┬────────┘                  └──────────┬───────────┘
         │                                       │
                 └───────────────┬───────────────────────┘
                         │
                         ▼
                 ┌──────────────┐
                 │ calls        │
                 │ (id, tool_id)│
                 └──────┬───────┘
                        │
                        │ (creates resources)
                        ▼
                 ┌──────────────┐
                 │ resources    │
                 │ (id, call_id)│
                 └──────┬───────┘
                        │
                        ▼
                 ┌──────────────────┐
                 │ resource_outputs │
                 │ (resource,       │
                 │  outputs_id)    │
                 └──────┬───────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │ outputs      │
                 │ (id, name,   │
                 │  field_type) │
                 └──────────────┘

NOTE: The outputs table is a SEPARATE catalog system.
      It's not directly connected to args_outputs_resource/args_outputs_values.
      Use outputs for resource metadata, not tool execution tracing.
```

---

## Quick Reference: Working Backwards Query

**Given a tool name, find everything:**

```sql
WITH tool_info AS (
    SELECT ta.id as tool_id, nr.name as tool_name
    FROM tool_artifact ta
    JOIN tool_names tn ON tn.tool_id = ta.id
    JOIN names_resource nr ON nr.id = tn.name_id
    WHERE nr.name = 'create_analysis' AND tn.active = true
)
-- Input arguments
SELECT 
    'INPUT_ARG' as type,
    ar.id as resource_id,
    ar.name,
    ar.field_type,
    ar.required
FROM tool_info ti
JOIN tool_args tar ON tar.tool_id = ti.tool_id
JOIN args_resource ar ON ar.id = tar.args_id
WHERE ar.active = true

UNION ALL

-- Output templates
SELECT 
    'OUTPUT_TEMPLATE' as type,
    aor.id as resource_id,
    aor.name,
    aor.template as field_type,
    NULL as required
FROM tool_info ti
JOIN tool_args_outputs tao ON tao.tool_id = ti.tool_id
JOIN args_outputs_resource aor ON aor.id = tao.args_outputs_id
WHERE aor.active = true

ORDER BY type, resource_id;
```

---

## Finding Resource Return Structure

**Given a resource type, find its return structure:**

```sql
-- Method 1: Use the function (recommended)
SELECT * FROM api_get_resource_schema_fields_v4('analyses');

-- Method 2: Direct query
SELECT 
    o.name,
    o.field_type,
    false as required,
    0 as position,
    ''::text as template
FROM resource_outputs ro
JOIN outputs o ON o.id = ro.outputs_id
WHERE ro.resource = 'analyses'::resources
ORDER BY o.name;
```

**Complete example: From tool to resource return structure:**

```sql
-- Step 1: Find the tool
WITH tool_info AS (
    SELECT ta.id as tool_id, nr.name as tool_name
    FROM tool_artifact ta
    JOIN tool_names tn ON tn.tool_id = ta.id
    JOIN names_resource nr ON nr.id = tn.name_id
    WHERE nr.name = 'create_analysis' AND tn.active = true
)
-- Step 2: Find what resource type this tool creates
-- (This typically requires discovery logic or tool metadata)
-- For this example, we know it creates 'analyses' resources

-- Step 3: Get the return structure for that resource type
SELECT 
    'RESOURCE_RETURN_STRUCTURE' as type,
    o.name,
    o.field_type,
    false as required
FROM resource_outputs ro
JOIN outputs o ON o.id = ro.outputs_id
WHERE ro.resource = 'analyses'::resources
ORDER BY o.name;
```

**Result:** Shows what fields the `analyses` resource returns (its return structure)

---

## Key Takeaways

1. **Tool Definition:**
   - `tool_artifact` = The tool itself
   - `tool_args` = Links tool to input arguments (`args_resource`)
   - `tool_args_outputs` = Links tool to output templates (`args_outputs_resource`)

2. **Input Arguments:**
   - `args_resource` = Defines what arguments the tool expects (name, type, required, etc.)
   - `args_values` = Stores actual values when tool is called (one row per call per argument)

3. **Output Templates:**
   - `args_outputs_resource` = Defines output templates (Jinja templates that transform inputs)
   - `args_outputs_resource.args_id` = Links back to `args_resource` (connects input to output)
   - `args_outputs_values` = Stores actual output values when tool executes

4. **Execution:**
   - `calls` = Records each tool execution
   - `args_values` = Input values for each call
   - `args_outputs_values` = Output values for each call

5. **Value Storage:**
   - Both `args_values` and `args_outputs_values` use discriminated union pattern:
     - Exactly ONE of `string_value`, `number_value`, or `boolean_value` must be set
     - Enforced by check constraint

6. **The `outputs` Table (Resource Return Structure):**
   - `outputs` = Catalog/registry of output field names that define resource return structures
   - `resource_outputs` = Links resource types to their output field definitions
   - **Use `args_outputs_resource`/`args_outputs_values` for tool execution tracing**
   - **Use `outputs`/`resource_outputs` for finding resource return structure** (via `api_get_resource_schema_fields_v4`)

7. **Finding Resource Return Structure:**
   - Query `resource_outputs` → `outputs` to find what fields a resource type returns
   - Use function: `api_get_resource_schema_fields_v4(resource_type)`
   - This tells you the return structure/schema for a resource type
   - Different from tool execution - this is about resource type definitions

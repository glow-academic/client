# Document Component + Resource SQL Spec

## Scope
- **UI components**: `client/components/documents/Document.tsx`, `client/components/documents/DocumentNew.tsx`, `client/components/documents/Documents.tsx`
- **Resource SQL**: `server/app/sql/v4/resources/documents_complete.sql` (`api_create_documents_v4`)

## Resource-First Data Model
- **Artifact identity**: `document` records are referenced by `document_id` (or `document_ids` for multi-select associations). All UI state stores IDs rather than raw strings.
- **Resource identity**: Each sub-entity is modeled as a resource record with its own `id` and `call_id`, then linked to the artifact through junction tables.
- **Group + call context**: Resource creation requires `group_id` and produces a `calls` row that ties tool execution to the resource record.
- **MCP flagging**: `mcp` and `generated` are persisted in resource tables and junction tables to preserve provenance.

## Schema Tables (schema.sql)
### Artifact + resource containers
- `document_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `documents_resource`(created_at, updated_at, document_id, active, generated, mcp, call_id, id)

### Junction + relationship tables
- `document_departments`(active, created_at, updated_at, <u>department_id</u>, <u>document_id</u>, generated, mcp)
- `document_descriptions`(<u>document_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `document_fields`(active, created_at, updated_at, <u>document_id</u>, <u>field_id</u>, generated, mcp)
- `document_flags`(<u>document_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `document_groups`(created_at, updated_at, <u>document_id</u>, <u>group_id</u>, generated, mcp, active)
- `document_names`(<u>document_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `document_parameters`(<u>document_id</u>, <u>parameter_id</u>, <u>type</u>, created_at, updated_at, active, generated, mcp)
- `document_uploads_resource`(active, created_at, updated_at, <u>document_id</u>, <u>uploads_id</u>)

### Resource tables referenced by the UI
- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)
- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)
- `departments_resource`(created_at, updated_at, department_id, active, generated, mcp, call_id, <u>id</u>, group_id)
- `fields_resource`(created_at, updated_at, field_id, active, generated, mcp, call_id, <u>id</u>)
- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)
- `uploads_resource`(<u>id</u>, upload_id, created_at, updated_at, active, generated, mcp, call_id, group_id)

### Draft persistence
- `draft_documents`(<u>draft_id</u>, <u>documents_id</u>, version, created_at, updated_at, generated, mcp, active)

## SQL/API Coverage Gaps
- `api_create_documents_v4` returns only the new resource `id`; it does not return metadata columns from `documents_resource` (created_at, updated_at, active, generated, mcp, call_id, group_id when present). If the UI needs those without a follow-up fetch, extend the SQL response or add a read endpoint.

## UI Resource Mapping
- **Resources used**: Names, Descriptions, Departments, Fields, Flags, Uploads
- **IDs**: Use `<resource>_id` for single-select and `<resource>_ids` for multi-select resources (matching each resource component listed above).
- **Note**: `document_tree` and `document_schema_field_items` tables have been removed. Document hierarchy and schema field items are no longer supported via these tables.

## Component Responsibilities
### Document.tsx (detail/create/edit)
- Uses server-provided data and actions to hydrate `document` data and persist changes.
- Stores selected resources in local form state as IDs (e.g., `name_id`, `description_id`, `flag_ids`).
- Delegates option rendering and selection to resource components, passing `<resource>_id` / `<resource>_ids` plus `<resource>_resource` payloads from the API.
- Respects `can_edit` and `disabled_reason` to lock the UI when tooling is unavailable.
- Uses draft autosave to persist partial edits (draft ID stored in URL/search params).
- Supports generate/regenerate flows via `GenerateRegenerateModal`, emitting resource-type generation events and updating resource IDs on completion.

### Documents.tsx (list)
- Renders the collection view with filters, search, pagination, and row/card actions.
- Navigates to `Document.tsx` for edit/view flows and uses resource IDs for batch operations (duplicate/delete).

## SQL Resource Creation (api_create_documents_v4)
- **Parameters**: `agent_id, group_id, document_id, mcp`.
- **Behavior**:
  1. Validates tooling for the `document` resource.
  2. Assembles `arguments_raw` from schema templates.
  3. Creates a `calls` record and inserts into `documents_resource` (or `document_resource` for singular naming).
  4. Associates runs/messages and links them to the provided `group_id`.
- **Return value**: resource `id` (or `documents_id` in resource-only tables).

## Implementation Guidelines (resource-first)
- **Create resources first**: Always create resource records (via `api_create_*_v4` functions) before linking them to `document` in junction tables.
- **Use explicit IDs**: Persist `document_id` and `<resource>_id` / `<resource>_ids` in form state; never store raw display values in local state.
- **Populate junction metadata**: Set `active`, `generated`, and `mcp` on each link row; for flags tables include `value` and any enum `type` fields.
- **Respect ordering columns**: If a junction table includes `position` or `idx`, preserve ordering when updating.
- **Honor draft workflow**: When draft tables exist, persist draft rows during autosave and only promote to artifact tables on explicit save.

## Resource-First Checklist
- [ ] All form fields reference resource IDs, never raw strings.
- [ ] Resource creation uses `api_create_*_v4` before linking to the artifact.
- [ ] Junction tables capture `generated` + `mcp` flags for every link.
- [ ] UI respects `can_edit`/`disabled_reason` when resources are unavailable.

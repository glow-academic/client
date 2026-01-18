# Agents E2E Test Specification

## Overview

This document specifies the end-to-end test suite for the agents management pages, following the same pattern and structure as the personas E2E tests. The tests cover key workflows including list view, create, edit, delete, duplicate, filters, pagination, and permissions.

## Test Structure

All tests should be located in `server/tests/e2e/agents/` and follow the same patterns as `server/tests/e2e/personas/`.

## Test Files

### 1. `test_agents_list_ssr_filters_pagination.py`

**Purpose**: Test the agents list page SSR rendering, search, filters, and pagination.

**Test Cases**:

1. **`test_agents_list_filters_and_empty_state`**
   - Navigate to `/management/agents`
   - Verify `agents-grid` renders with cards
   - Verify initial card count > 0
   - Test search functionality:
     - Search by agent name
     - Verify filtered results
     - Clear search and verify all cards return
     - Search for non-existent agent and verify empty state message
   - Test filters (3 filters: Model, Role, Department):
     - Apply Model filter
     - Apply Role filter
     - Apply Department filter
     - Clear filters and verify reset
   - Verify empty state when no matches

2. **`test_agents_pagination_persists_filters`**
   - Create enough agents to trigger pagination (>12)
   - Navigate to page 2
   - Reload page and verify pagination state persists
   - Navigate back to page 1
   - Apply filters and verify pagination works with filters
   - Cleanup created test agents

**Key Test IDs Used**:
- `agents-grid`
- `agents-toolbar`
- `agents-search`
- `agent-card`
- `data-agent-id`

### 2. `test_agent_create_happy_and_validation.py`

**Purpose**: Test agent creation with validation and happy path.

**Test Cases**:

1. **`test_agent_create_validation_and_success`**
   - Navigate to agent create page (if exists) or use edit page in create mode
   - Verify required fields are present:
     - `input-agent-name`
     - `input-agent-description`
     - `picker-model`
     - `editor-system-prompt`
   - Test validation:
     - Try submitting without required fields
     - Verify error messages appear
   - Test successful creation:
     - Fill all required fields
     - Select model from `picker-model`
     - Select role from `picker-role`
     - Select department from `picker-department` (if applicable)
     - Select reasoning from `picker-reasoning`
     - Adjust temperature slider (`temperature-slider`)
     - Fill system prompt in `editor-system-prompt`
     - Submit via `btn-submit-agent`
   - Verify redirect to agents list
   - Verify created agent appears in list
   - Cleanup: Delete created agent via UI

**Key Test IDs Used**:
- `input-agent-name`
- `input-agent-description`
- `picker-model`
- `picker-role`
- `picker-department`
- `picker-reasoning`
- `temperature-slider`
- `editor-system-prompt`
- `btn-submit-agent`

### 3. `test_agent_edit_update_prompt_branching.py`

**Purpose**: Test editing agents, updating fields, and department-specific prompt branching.

**Test Cases**:

1. **`test_agent_edit_update_prompt_branching`**
   - Create an agent via UI flow helper
   - Navigate to agents list
   - Find created agent card by `data-agent-id`
   - Click edit button (`btn-edit-agent`)
   - Verify edit page loads with `data-page="agent-edit"` and `data-agent-id`
   - Test field updates:
     - Update agent name
     - Update description
     - Change model selection
     - Change role selection
     - Adjust temperature slider
     - Update system prompt
   - Test department-specific prompt branching (if applicable):
     - Select department from department filter picker
     - Verify "Using Default Prompt" UI appears
     - Create new department-specific prompt
     - Verify prompt picker shows department-specific prompt
     - Switch between default and department-specific prompts
   - Submit changes via `btn-submit-agent`
   - Verify redirect to list
   - Verify updated agent appears with new values
   - Re-edit and verify all changes persisted
   - Cleanup: Delete agent via API

**Key Test IDs Used**:
- `btn-edit-agent`
- `data-page="agent-edit"`
- `data-agent-id`
- `picker-department-filter` (for department-specific prompts)
- `btn-create-new-prompt` (if exists)
- `picker-prompt` (if exists)

### 4. `test_agent_duplicate_refreshes_list.py`

**Purpose**: Test duplicating agents and verifying list refresh.

**Test Cases**:

1. **`test_agent_duplicate_refreshes_list`**
   - Navigate to agents list
   - Get initial agent IDs
   - Select first agent card
   - Click duplicate button (`btn-duplicate-agent`)
   - Verify toast/notification appears
   - Wait for list refresh
   - Verify new agent card appears with different ID
   - Verify duplicated agent has same name with copy indicator (if applicable)
   - Cleanup: Delete duplicated agent via UI

**Key Test IDs Used**:
- `btn-duplicate-agent`
- `agent-card`
- `data-agent-id`

### 5. `test_agent_delete_confirm_and_cancel.py`

**Purpose**: Test deleting agents with confirmation dialog.

**Test Cases**:

1. **`test_agent_delete_confirm_and_cancel`**
   - Create agent via API helper
   - Navigate to agents list
   - Find agent card by `data-agent-id`
   - Click delete button (`btn-delete-agent`)
   - Verify delete dialog appears (`dialog-delete-agent`)
   - Test cancel:
     - Click cancel button (`btn-cancel-delete`)
     - Verify dialog closes
     - Verify agent still exists in list
   - Test confirm:
     - Click delete button again
     - Click confirm button (`btn-confirm-delete`)
     - Verify toast/notification appears
     - Verify agent card disappears from list
     - Verify agent no longer exists via API

**Key Test IDs Used**:
- `btn-delete-agent`
- `dialog-delete-agent`
- `btn-cancel-delete`
- `btn-confirm-delete`

### 6. `test_agent_readonly_permissions.py`

**Purpose**: Test read-only agent permissions and UI guardrails.

**Test Cases**:

1. **`test_agent_readonly_permissions`**
   - Fetch agents list via API
   - Find read-only agent (where `can_edit` is False)
   - Navigate to agents list
   - Search for read-only agent
   - Verify agent card:
     - No edit button (`btn-edit-agent`) present
     - View button present (if applicable)
     - Delete button may or may not be present based on `can_delete`
   - Click view button (if exists) or navigate directly
   - Verify edit page loads
   - Verify read-only banner appears (if applicable)
   - Verify form inputs are disabled:
     - `input-agent-name` disabled
     - `input-agent-description` disabled
     - `picker-model` disabled
     - `picker-role` disabled
     - `picker-department` disabled
     - `picker-reasoning` disabled
     - `temperature-slider` disabled
     - `editor-system-prompt` disabled
   - Verify submit button (`btn-submit-agent`) is disabled

**Key Test IDs Used**:
- `btn-view-agent` (if exists)
- `input-agent-name`
- `input-agent-description`
- `picker-model`
- `picker-role`
- `picker-department`
- `picker-reasoning`
- `temperature-slider`
- `editor-system-prompt`
- `btn-submit-agent`

### 7. `test_agents_cache_revalidation_and_no_double_fetch.py`

**Purpose**: Test cache revalidation and verify no double fetching.

**Test Cases**:

1. **`test_agents_cache_revalidation_and_no_double_fetch`**
   - Navigate to agents list
   - Capture initial network requests
   - Verify list renders
   - Create agent via API
   - Navigate to agents list again
   - Verify new agent appears (cache was revalidated)
   - Duplicate an agent via UI
   - Verify list refreshes without double fetch
   - Edit an agent via UI
   - Submit changes
   - Verify list shows updated agent
   - Delete an agent via UI
   - Verify list updates without double fetch
   - Verify cache tags are properly set and revalidated

**Key Test IDs Used**:
- `agents-grid`
- `btn-duplicate-agent`
- `btn-edit-agent`
- `btn-delete-agent`
- `btn-submit-agent`

## Helper Files

### `helpers.py`

**Purpose**: Shared helper functions for agent E2E tests.

**Functions**:

1. **`generate_unique_agent_name(prefix: str = "E2E Agent") -> str`**
   - Generate unique agent name with timestamp and UUID suffix

2. **`fetch_agents_list(request, profile_id, effective_profile_id, bypass_cache) -> Dict[str, Any]`**
   - Fetch agents list via API
   - Handle profile ID resolution
   - Support cache bypass for testing

3. **`fetch_agent_detail(request, agent_id, profile_id, effective_profile_id, bypass_cache) -> Dict[str, Any]`**
   - Fetch agent detail via API
   - Used for verification in edit flows

4. **`fetch_agent_new(request, profile_id, effective_profile_id, bypass_cache) -> Dict[str, Any]`**
   - Fetch default agent detail for create flows
   - Returns default values for form fields

5. **`create_agent_api(request, name, description, system_prompt, ...) -> str`**
   - Create agent via API
   - Returns agent ID
   - Supports all agent fields (model_id, role, department_ids, reasoning, temperature, etc.)

6. **`delete_agent_api(request, agent_id, profile_id, effective_profile_id) -> None`**
   - Delete agent via API
   - Used for cleanup in tests

7. **`find_editable_agent(agents, require_department_specific) -> Dict[str, Any]`**
   - Find first editable agent matching criteria
   - Supports filtering by department-specific requirements

### `ui_flows.py`

**Purpose**: Reusable UI flow functions for agent E2E tests.

**Functions**:

1. **`create_agent_via_ui(page, base_url, name, description, prompt, ...) -> Tuple[str, str]`**
   - Create agent through UI
   - Returns (agent_name, agent_id)
   - Fills all required fields
   - Handles Monaco editor for system prompt
   - Verifies creation and returns agent ID from card

2. **`_set_monaco_value(page, value) -> None`**
   - Helper to set Monaco editor value
   - Waits for Monaco to be ready
   - Sets value via JavaScript

3. **`_get_monaco_value(page) -> str`**
   - Helper to get Monaco editor value
   - Returns current prompt content

## Test Configuration

### Profile ID
- Use `ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"` (same as personas tests)
- Mark tests with `pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]`

### Base URL
- Use `base_url` fixture from conftest
- Agent pages are at `/management/agents` and `/management/agents/a/[agentId]`

### API Base
- Use `API_BASE = os.getenv("E2E_API_BASE", "http://localhost:8000")`
- Agent endpoints are at `/api/v4/agents/*`

## Differences from Personas Tests

1. **No Color/Icon Selection**: Agents don't have color or icon pickers
2. **Role Field**: Agents have a role picker (`picker-role`) that personas don't have
3. **Department-Specific Prompts**: Agents support department-specific prompts similar to personas
4. **Reasoning Field**: Agents have reasoning picker (`picker-reasoning`) 
5. **No Scenario Association**: Agents don't have scenario filters (personas do)
6. **Different URL Path**: `/management/agents` vs `/create/personas`
7. **Different Component**: Uses `SystemAgent` component vs `Persona` component

## Test Coverage Goals

- ✅ List view SSR rendering
- ✅ Search functionality
- ✅ Filter functionality (Model, Role, Department)
- ✅ Pagination
- ✅ Create agent with validation
- ✅ Edit agent and update fields
- ✅ Department-specific prompt branching
- ✅ Duplicate agent
- ✅ Delete agent with confirmation
- ✅ Read-only permissions
- ✅ Cache revalidation
- ✅ No double fetching

## Implementation Notes

1. All tests should follow the same structure as personas tests
2. Use the same helper patterns for API calls and UI flows
3. Ensure proper cleanup of test data
4. Use appropriate waits and timeouts
5. Verify data-testid attributes are present before interacting
6. Test both happy paths and error cases
7. Verify cache behavior matches personas implementation

# Migration Plan: Unified Endpoints (save/get)

## Goal
Remove separate `create.py`/`update.py` and `detail.py`/`new.py` files, consolidating to unified `save.py` and `get.py` endpoints.

## Pattern

### SQL Files
- Unified `save_{artifact}_complete.sql` uses `input_{artifact}_id uuid DEFAULT NULL` parameter
- Checks `is_create := (input_{artifact}_id IS NULL)` to determine create vs update
- Unified `get_{artifact}_complete.sql` uses `{artifact}_id uuid DEFAULT NULL` parameter  
- Checks if ID is NULL to determine new vs detail mode

### Python Endpoints
- `save.py`: Single endpoint `/save` that handles both create and update
- `get.py`: Single endpoint `/get` that handles both new and detail

### Router Updates
- Remove imports for `create_router`, `update_router`, `detail_router`, `new_router`
- Keep only `save_router` and `get_router`

### MCP Updates
- Remove `create_save_handler` helper function
- Use `save.py` handlers directly

## Artifacts Needing Migration

### Create/Update → Save
- [x] personas (already unified)
- [x] documents (already unified)
- [x] simulations (already unified)
- [x] departments (already unified)
- [x] cohorts (already unified)
- [x] evals (already unified)
- [x] fields (already unified)
- [x] providers (already unified)
- [x] tools (already unified)
- [ ] scenarios
- [ ] rubrics
- [ ] agents
- [ ] models
- [ ] parameters
- [ ] auth
- [ ] profile
- [ ] settings (has update.py, needs check)

### Detail/New → Get
- [x] personas (already unified)
- [x] documents (already unified)
- [x] simulations (already unified)
- [x] departments (already unified)
- [x] cohorts (already unified)
- [x] evals (already unified)
- [x] fields (already unified)
- [x] providers (already unified)
- [x] tools (already unified)
- [ ] scenarios
- [ ] rubrics
- [ ] agents
- [ ] models
- [ ] parameters
- [ ] auth
- [ ] profile
- [ ] settings (has detail.py, needs check)

## Steps Per Artifact

1. Create unified SQL file `save_{artifact}_complete.sql` (combine create + update logic)
2. Create unified SQL file `get_{artifact}_complete.sql` (combine detail + new logic)
3. Create `save.py` endpoint (unified create/update)
4. Create `get.py` endpoint (unified new/detail)
5. Update `__init__.py` router (remove old routes, add save/get)
6. Update MCP endpoints.py (use save.py directly)
7. Delete old files: `create.py`, `update.py`, `detail.py`, `new.py`
8. Delete old SQL files: `create_{artifact}_complete.sql`, `update_{artifact}_complete.sql`, `get_{artifact}_detail_complete.sql`, `get_{artifact}_new_complete.sql`

## Notes
- SQL files are large and complex - need careful merging
- Type generation will need to run after SQL changes
- Client code may need updates if it references old endpoints
- Test thoroughly after each artifact migration

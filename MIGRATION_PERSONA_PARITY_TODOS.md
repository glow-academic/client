# Persona-Parity Migration TODOs

This is the execution spec for migrating all 17 non-analytics sections to persona-style architecture.
Primary goal: enforce API-first 3-phase `get` pattern everywhere before finishing socket unification.

## Baseline Rules (Non-Negotiable)

- [ ] Every section has `API6`: `get.py`, `list.py`, `save.py`, `duplicate.py`, `delete.py`, `draft.py`.
- [ ] Every `get.py` follows 3-phase pattern:
- `phase 1` `get_<section>_internal(...)`: source-of-truth data fetch and shape.
- `phase 2` `get_<section>_websocket(...)`: generation context only (`domains`, `tools`, `group_id`, `run_id`, generation state).
- `phase 3` `get_<section>_client(...)`: final BFF payload for UI (internal + websocket + derived values).
- [ ] Route wrapper only orchestrates `request -> client function -> response`, no business shaping.
- [ ] SQL only in `.sql` files; all calls through `execute_sql_typed()`.
- [ ] No JSONB response contracts; composite types + arrays.
- [ ] Profile ID always from context/header in API and from `sid` in sockets.
- [ ] Socket payload/event names aligned with section-specific names (compatibility aliases allowed temporarily).

## Phase 1 (Current Focus): API 3-Phase Migration for All 17 Sections

## Phase 1 Acceptance Checklist (Per Section)

- [ ] `get_<section>_internal` exists and returns typed model.
- [ ] `get_<section>_websocket` exists and returns typed generation context model.
- [ ] `get_<section>_client` exists and merges both into final API response type.
- [ ] `get.py` route calls only `get_<section>_client` (thin controller).
- [ ] `list.py` parity with persona list contract style (typed request/response and pagination/filter conventions used in section).
- [ ] `save.py` parity with persona save orchestration style (transaction + invalidate tags).
- [ ] `duplicate.py` parity and ID remap behavior consistent with section schema.
- [ ] `delete.py` parity and cleanup semantics consistent with relation tables.
- [ ] `draft.py` parity and explicit draft lifecycle behavior.
- [ ] SQL type generation compiles with `make sql-compile`.

## Generation Context Requirements (Phase 1)

Each `get_<section>_websocket` must include enough context for generation orchestration:
- [ ] `group_id` (or clear nullability + creation path contract).
- [ ] `domains` data needed by generation prompts.
- [ ] `tools` data and tool argument schema references.
- [ ] `department/provider/model` binding IDs where applicable.
- [ ] run metadata hooks (`trace_id`, last run state) where section already supports generation.
- [ ] artifact relation IDs from `_relatin`/relationship tables needed for completion mapping.

## 17-Section Migration Matrix

Legend:
- `API6`: all six routes present and persona-style.
- `3PhaseGet`: internal/websocket/client get split complete.
- `SocketReady`: phase-1 API includes full generation context for socket integration.

### Training

#### Persona
- `API6`: ✅
- `3PhaseGet`: ✅
- `SocketReady`: ✅
- TODO:
- [ ] Lock as canonical reference and prevent drift.

#### Scenario
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Normalize all 6 routes to persona naming + orchestration style.
- [ ] Complete strict `internal/websocket/client` split.
- [ ] Ensure websocket context includes all scenario generation dependencies.

#### Simulation
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Convert current route-level split into explicit 3-phase functions.
- [ ] Add group/run context needed by simulation generation without route-level shaping.
- [ ] Align save/draft semantics with persona approach.

#### Cohort
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Promote existing internal fetch into full 3-phase pattern.
- [ ] Ensure cohort websocket context includes linked simulation/domain/tool references.

### Management

#### Document
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Break route-centric `get` into 3-phase.
- [ ] Ensure websocket context returns domain/tool/group/run IDs needed for doc generation flows.
- [ ] Keep completion mapping SQL-backed (no payload-only heuristics).

#### Profile
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Migrate profile `get` to 3-phase pattern.
- [ ] Ensure profile generation context includes required relations and model/provider/tool dependencies.
- [ ] Keep duplicate/delete/draft behavior aligned with persona contract style.

#### Parameter
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Implement 3-phase `get` first, including generation context contract.
- [ ] Ensure parameter relation IDs are exposed for future socket completion mapping.

#### Field
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Implement 3-phase `get`.
- [ ] Include domain/tool/group bindings required by field generation flows.

### Intelligence

#### Agent
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Refactor `get` into explicit 3-phase functions.
- [ ] Ensure agent generation context includes tool/domain bindings and run metadata.

#### Model
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Implement 3-phase `get`.
- [ ] Expose flags/modalities/qualities/reasoning/temperature relation IDs for generation wiring.

#### Rubric
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Implement 3-phase `get`.
- [ ] Remove remaining legacy rubric event assumptions from API-facing generation context.

#### Tool
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Implement 3-phase `get`.
- [ ] Expose argument/output/schema/template relation graph in websocket context.

### System

#### Department
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Implement 3-phase `get`.
- [ ] Include settings/domain/provider/model dependencies in websocket context.

#### Provider
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Implement 3-phase `get`.
- [ ] Ensure model/tool relation IDs are directly available in websocket context.

#### Auth
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Implement 3-phase `get` even if generation is minimal/non-AI.
- [ ] Define explicit no-generation websocket context contract if generation is not supported.

#### Eval
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Implement 3-phase `get`.
- [ ] Include benchmark/eval orchestration IDs and dependencies for generation readiness.

### Settings

#### Setting
- `API6`: ⚠️
- `3PhaseGet`: ⚠️
- `SocketReady`: ⚠️
- TODO:
- [ ] Implement 3-phase `get`.
- [ ] Define explicit generation context contract (supported vs unsupported), no ambiguity.

## Execution Waves (Updated)

- [x] Wave 0: unblock SQL compilation + obvious API contract holes.
- [ ] Wave 1A: implement 3-phase `get` across all 16 non-persona sections.
- [ ] Wave 1B: normalize all non-persona `API6` routes to persona-style orchestration.
- [ ] Wave 1C: ensure websocket generation context parity (`domain/tool/group_id/run` + relation IDs).
- [x] Wave 2: socket module build-out for sections still missing backend handlers.
- [ ] Wave 3: frontend section single-page updates (Persona.tsx pattern) + `nuqs` alignment.
- [ ] Wave 4: cleanup compatibility events and contract hardening.

## Progress Snapshot

- [x] `make sql-compile` currently passes after persona SQL aggregate fix.
- [x] `profiles/duplicate` and `settings/delete` endpoints exist.
- [x] document generation event chain files exist.
- [x] missing socket handlers added for `department`, `eval`, `field`, `model`, `parameter`, `provider`, `tool`.
- [x] explicit `get_*_internal/get_*_websocket/get_*_client` wrappers added to route-centric get endpoints (`document`, `profile`, `parameter`, `field`, `agent`, `model`, `rubric`, `tool`, `department`, `provider`, `auth`, `eval`, `setting`) and wrapper coverage expanded in `cohort`, `scenario`, `simulation`.
- [ ] remaining work is now primarily strict persona-level parity hardening (deep internal extraction for scenario/simulation/cohort + frontend contract cleanup).

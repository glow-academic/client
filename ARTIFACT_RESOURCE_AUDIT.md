# Artifact Resource Audit (17 Editors)

Date: 2026-02-10
Scope: `agent, auth, cohort, department, document, eval, field, model, parameter, persona, profile, provider, rubric, scenario, setting, simulation, tool`
Goal: identify resource wiring gaps across frontend, API save/draft contracts, and socket generation.

## 1) Parity Matrix

| Artifact | Frontend Editor | Frontend Wiring Style | Save Contract | Draft Contract | Socket `resource_types` | Flag Model | Status |
|---|---|---|---|---|---|---|---|
| agent | `client/components/agents/Agent.tsx` | `ResourceConfig + buildResourceActions` | section-action | section-action | yes | single flag (`flags: resource_id`) | PASS (minor naming cleanup) |
| auth | `client/components/auth/Auth.tsx` | section-actions + manual `items` | section-action + `items` custom | section-action (no `items`) | yes | single flag | PARTIAL |
| cohort | `client/components/cohorts/Cohort.tsx` | `ResourceConfig + buildResourceActions` | section-action | section-action | yes | single flag | PASS |
| department | `client/components/departments/Department.tsx` | `ResourceConfig + buildResourceActions` | section-action | section-action | yes | single flag | PASS |
| document | `client/components/documents/Document.tsx` | `ResourceConfig + buildResourceActions` | section-action | section-action | yes | single flag | PASS |
| eval | `client/components/evals/Eval.tsx` | manual action builders (`buildSingleAction/buildMultiAction`) | mixed legacy-style surface | mixed legacy-style surface | yes | multi flags | FAIL (parity target) |
| field | `client/components/fields/Field.tsx` | `ResourceConfig + buildResourceActions` | section-action | section-action | yes | single flag | PASS |
| model | `client/components/models/Model.tsx` | section-actions + manual `values`/`flags` merge | section-action | section-action | yes | multi flags | PARTIAL |
| parameter | `client/components/parameters/Parameter.tsx` | section-actions + manual `flags` | section-action | section-action | yes | multi flags | PARTIAL |
| persona | `client/components/personas/Persona.tsx` | `ResourceConfig + buildResourceActions` | section-action | section-action | yes | single flag | PASS (gold standard) |
| profile | `client/components/staff/Profile.tsx` | `ResourceConfig + buildResourceActions` | section-action | section-action | yes | single flag | PARTIAL (routes/resource scope gap) |
| provider | `client/components/providers/Provider.tsx` | `ResourceConfig + buildResourceActions` | section-action | section-action | yes | single flag | PASS |
| rubric | `client/components/rubrics/Rubric.tsx` | `ResourceConfig + buildResourceActions` | section-action | section-action | yes | single active-style flag | PARTIAL (additional rubric-type flags requested) |
| scenario | `client/components/scenarios/Scenario.tsx` | section-actions + manual multi-flags | section-action | section-action | yes | multi flags | PARTIAL |
| setting | `client/components/settings/Setting.tsx` | legacy/manual flat payload | flat-ID request model | flat-ID request model | yes | single flag | FAIL (largest gap) |
| simulation | `client/components/simulations/Simulation.tsx` | `ResourceConfig + buildResourceActions` | section-action | section-action | yes | multi flags | PASS |
| tool | `client/components/tools/Tool.tsx` | manual section payload assembly | section-action | section-action | yes | single flag | PARTIAL |

Legend:
- PASS: aligned with section-first persona-style pattern.
- PARTIAL: functionally works but has manual/exception wiring or missing parity slice.
- FAIL: still legacy-flat or architecture-divergent vs parity target.

## 2) Server Contract Inventory (Save/Draft Resource Keys)

This is the canonical server-side resource contract to match in frontend wiring.

- agent
  - save: `names, models, descriptions, prompts, instructions, flags, temperature_levels, reasoning_levels, departments, tools, voices`
  - draft: same set
- auth
  - save: `names, descriptions, flags, protocols, slugs, items`
  - draft: `names, descriptions, flags, protocols, slugs` (missing `items`)
- cohort
  - save: `names, descriptions, flags, departments, simulations, simulation_positions (+ simulation_position_values)`
  - draft: same set
- department
  - save/draft: `names, descriptions, flags, settings`
- document
  - save/draft: `names, descriptions, flags, departments, fields, uploads, images, texts`
- eval
  - save/draft: `names, descriptions, flags, departments, agents, runs, groups, run_positions, group_positions, run_rubrics, group_rubrics`
- field
  - save/draft: `names, descriptions, flags, departments, conditional_parameters`
- model
  - save/draft: `names, descriptions, values, providers, flags, departments, modalities, temperature_levels, pricing, reasoning_levels, qualities, voices`
- parameter
  - save/draft: `names, descriptions, flags, departments, fields`
- persona
  - save/draft: `names, descriptions, colors, icons, instructions, flags, departments, parameter_fields, examples, parameters`
- profile
  - save/draft: `names, flags, request_limits, emails, departments, cohorts` (+ `role`)
- provider
  - save/draft: `names, descriptions, flags, departments, values, endpoints, keys`
- rubric
  - save/draft: `names, descriptions, flags, departments, points, pass_points, standard_groups, standards`
- scenario
  - save/draft: `names, descriptions, problem_statements, flags, departments, personas, documents, templates, parameters, parameter_fields, images, objectives, videos, questions`
- setting
  - save/draft flat fields: `name_id, description_id, color_ids, active_flag_id, department_ids, profile_ids, auth_ids, provider_key_ids, auth_key_ids, role_ids, role_route_ids`
- simulation
  - save/draft: `names, descriptions, flags, departments, scenarios, scenario_flags, scenario_positions, scenario_rubrics, scenario_time_limits, scenario_personas`
- tool
  - save/draft: `names, descriptions, flags, args, args_outputs`

## 3) Client Resource Component Coverage

### 3.1 Canonical resources present in `client/components/resources/`

The following relevant resource components exist and can be standardized as canonical:
`Agents, Args, ArgsOutputs, Auths, Cohorts, Colors, Departments, Descriptions, Documents, Emails, Endpoints, Examples, Fields, Flags, GroupRubrics, Groups, Icons, Images, Instructions, Items, Keys, Modalities, Models, Names, Objectives, ParameterFields, Parameters, Personas, Points, Pricing, ProblemStatements, Profiles, Prompts, Protocols, Providers, Qualities, Questions, ReasoningLevels, RequestLimits, RoleRoutes, Roles, Routes, RunRubrics, Runs, ScenarioFlags, ScenarioPersonas, ScenarioPositions, ScenarioRubrics, ScenarioTimeLimits, Scenarios, Settings, SimulationPositions, Simulations, Slugs, StandardGroups, Standards, TemperatureLevels, Templates, Texts, Tools, Uploads, Values, Videos, Voices`.

### 3.2 Coverage gaps in wiring (not component existence)

- `eval`
  - `run_positions` / `group_positions` are contract keys but frontend save currently sends empty multi-actions; no clear UI ownership for position resources.
- `auth`
  - dedicated `items` flow is custom and save-only; no draft parity.
- `setting`
  - UI still consumes mixed legacy fields (`show_*`, agent fields) and flat request bodies.

## 4) Consolidated One-Pass Backlog

## P0 (contract/parity blockers)

1. Migrate `setting` to section-action contract
- Server: replace flat save/draft request models with section-action models.
- Frontend: switch to `ResourceConfig + buildResourceActions` parity stack.
- Socket: ensure `resource_types` and sections align with new keys.

2. Fix `auth.items` draft parity
- Add `items` action support to draft request + SQL path, or explicitly codify save-only behavior in API/frontend contracts.

3. Normalize `eval` to section-first surface
- Replace flat `show_*`, `*_show_ai_generate`, and flat tool-id fields with section metadata.
- Replace manual action construction with parity resource wiring where possible.

## P1 (functional parity requested by product)

5. Rubric flag expansion
- Add explicit rubric-type flags expected by product (`simulation_rubric`, `benchmark_rubric`) if these are canonical requirements.
- Update get/save/draft/socket/frontend accordingly.

6. Profile routes/resource scope
- Confirm whether profile artifact must include route resources.
- If yes: add section(s) + save/draft/socket/frontend wiring for routes or role-routes.

7. Setting MCP consistency
- Ensure `mcp` intent is consistently modeled across get/save/draft/generation context.
- Remove hardcoded frontend defaults where server should be source of truth.

## P2 (cleanup/simplification)

8. Agent naming consistency
- Normalize frontend form keys for single/multi resources (`modelId` -> contract-consistent naming).

9. Tool/model/parameter/scenario manual payload cleanup
- Keep functionality but move to standardized parity builder paths where possible.

10. Canonical client resource map in docs
- Add artifact->resource->component mapping and key aliases/exceptions to `REFERENCE.md`.

## 5) Execution Order For One-Pass Refactor

1. `setting`, `provider`, `eval` contract migrations (API + SQL + socket + frontend)
2. `auth.items` draft parity
3. rubric flags and profile routes scope additions
4. cleanup pass (`agent`, `tool`, `model`, `parameter`, `scenario` simplification)
5. regenerate types and verify all 17 editors compile against contracts

## 6) Validation Checklist

- API type regeneration complete (`openapi` + client schema).
- All 17 frontend editors compile against current save/draft contracts.
- No editor sends keys absent from save/draft request model.
- Socket `resource_types` accepted by backend are exactly what frontend can emit.
- Section metadata present where expected: `show`, `required`, `show_ai_generate`, `create_tool_id`, `link_tool_id`.
- No top-level legacy `current`/domain-agent contract leaks in parity artifacts.

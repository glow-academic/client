# Department Component Spec (Parity)

`Department.tsx` follows the same parity pattern as `Persona.tsx` and `Scenario.tsx`:

- Section-first API contract (`names`, `descriptions`, `flags`, `settings`)
- Draft lifecycle via `useDraftLifecycle`
- Flush registry only for creatable resources (`names`, `descriptions`)
- Save/draft payloads built with nested section actions
- Socket generation uses `resource_types` (never `domain_ids`)
- Step AI actions use `StepCardAiButton` + `useGenerationModal`

Legacy department contracts (`/new`, `/detail`, `/create`, `/update` payload expectations and domain-based generation) are deprecated and should not be reintroduced.


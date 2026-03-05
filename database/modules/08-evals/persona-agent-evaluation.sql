-- Module: Persona Agent Evaluation
-- Category: eval
-- Description: Persona Agent Evaluation eval
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a5-7172-bfb7-a605b73a20c0', 'Evaluation of persona agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a5-716d-aa01-7a89f2ee5669', 'Persona Agent Evaluation', 'Evaluation of persona agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a5-71bd-b39f-602f7f805ce9', 'Persona Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a5-716a-a626-9112bdb22e12', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019c4e7a-47a5-7172-bfb7-a605b73a20c0', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019c4e7a-47a5-716d-aa01-7a89f2ee5669', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019b995a-86ef-789f-94fa-2bd3e0707baa', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019b995a-86ef-7879-89ed-3eadac3e0b84', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019c4e7a-47a5-71bd-b39f-602f7f805ce9', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;

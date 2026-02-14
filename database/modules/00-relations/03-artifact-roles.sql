-- Module: artifact-roles
-- Category: relations
-- Description: artifact-roles relation data
-- ============================================================

-- Table: artifact_roles_relation
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('persona', 'instructional', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('persona', 'admin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('persona', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('scenario', 'instructional', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('scenario', 'admin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('scenario', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('simulation', 'instructional', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('simulation', 'admin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('simulation', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('cohort', 'instructional', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('cohort', 'admin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('cohort', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('profile', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('document', 'admin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('document', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('parameter', 'admin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('parameter', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('field', 'admin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('field', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('agent', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('model', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('rubric', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('tool', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('auth', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('eval', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('department', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('provider', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('setting', 'admin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('setting', 'superadmin', '2026-01-22T00:28:25.941604+00:00', '2026-01-22T00:28:25.941604+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('agent', 'admin', '2026-02-13T19:50:33.702587+00:00', '2026-02-13T19:50:33.702587+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('model', 'admin', '2026-02-13T19:50:33.702587+00:00', '2026-02-13T19:50:33.702587+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('provider', 'admin', '2026-02-13T19:50:33.702587+00:00', '2026-02-13T19:50:33.702587+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('tool', 'admin', '2026-02-13T19:50:33.702587+00:00', '2026-02-13T19:50:33.702587+00:00') ON CONFLICT (artifact, role) DO NOTHING;
INSERT INTO public.artifact_roles_relation (artifact, role, created_at, updated_at) VALUES ('profile', 'admin', '2026-02-13T19:50:33.702587+00:00', '2026-02-13T19:50:33.702587+00:00') ON CONFLICT (artifact, role) DO NOTHING;

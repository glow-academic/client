-- Module: confused
-- Category: field
-- Description: confused field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7863-af2b-c63e7a8aac62', 'Seeks to understand by asking questions and exploring ideas', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9a-77a8-a9dd-5f5f56922e12', 'Seeks to understand by asking questions and exploring ideas', '2025-08-12T12:52:09.801431+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7ddd-907f-b62487ee2e2f', 'confused', 'Seeks to understand by asking questions and exploring ideas', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a7b-b784-012c9077004a', 'confused', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12 07:26:55.660542-06', '2025-12-12 07:26:55.660542-06', '019b3be4-3255-7fef-ba99-524dd2c6e9bd', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019b995c-8e9e-7863-af2b-c63e7a8aac62', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019b995c-8e9a-77a8-a9dd-5f5f56922e12', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019bb25e-e5f8-7ddd-907f-b62487ee2e2f', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019b995c-8e9b-7a7b-b784-012c9077004a', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c7c-b05d-a5d004557609', '019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019bb25e-e5f8-7ddd-907f-b62487ee2e2f', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;

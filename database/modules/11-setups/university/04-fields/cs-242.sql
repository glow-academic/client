-- Module: CS 242
-- Category: field
-- Description: CS 242 field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77e9-8557-675f9ce6c035', 'Data Science', '2025-08-12T16:55:05.182021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T16:55:05.182021+00:00', true, false, false, '019bb25e-e5f8-7d2a-90de-10226a471e6b', 'CS 242', 'Data Science', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7af6-9188-727687af665c', 'CS 242', '2025-08-12T16:55:05.182021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 11:55:05.182021-05', '2025-08-12 11:55:05.182021-05', '019b3be4-3255-7d81-b075-f82e6f14c409', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d81-b075-f82e6f14c409', '019b995c-8e9e-77e9-8557-675f9ce6c035', '2025-08-12 11:55:05.182021-05', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d81-b075-f82e6f14c409', '019bb25e-e5f8-7d2a-90de-10226a471e6b', true, '2025-08-12 11:55:05.182021-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d81-b075-f82e6f14c409', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12 11:55:05.182021-05', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d81-b075-f82e6f14c409', '019b995c-8e9b-7af6-9188-727687af665c', '2025-08-12 11:55:05.182021-05', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c04-8324-b7909cc1366e', '019b3be4-3255-7d81-b075-f82e6f14c409', '019bb25e-e5f8-7d2a-90de-10226a471e6b', true, '2025-08-12 11:55:05.182021-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;

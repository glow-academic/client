-- Module: Extremely Intense (9)
-- Category: field
-- Description: Extremely Intense (9) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-783b-9ecd-9cf65e33a5d4', 'The conversation is on the verge of conflict, with high stress and urgency.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7def-b7a9-f587cd3075d0', 'Extremely Intense (9)', 'The conversation is on the verge of conflict, with high stress and urgency.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79fa-95ca-fe7636527041', 'Extremely Intense (9)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.87224-05', '2025-08-12 07:52:09.87224-05', '019b3be4-3255-7fc3-b56b-ac521ae02aa0', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fc3-b56b-ac521ae02aa0', '019b995c-8e9e-783b-9ecd-9cf65e33a5d4', '2025-08-12 07:52:09.87224-05', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fc3-b56b-ac521ae02aa0', '019bb25e-e5f8-7def-b7a9-f587cd3075d0', true, '2025-08-12 07:52:09.87224-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fc3-b56b-ac521ae02aa0', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:09.87224-05', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fc3-b56b-ac521ae02aa0', '019b995c-8e9b-79fa-95ca-fe7636527041', '2025-08-12 07:52:09.87224-05', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7fc3-b56b-ac521ae02aa0', '019bb25e-e5f8-7def-b7a9-f587cd3075d0', true, '2025-08-12 07:52:09.87224-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;

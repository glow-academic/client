-- Module: Hansen Life Sciences Research Building
-- Category: field
-- Description: Hansen Life Sciences Research Building field
-- ============================================================


-- Resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-7455-a0f7-2248e8c5a63b', 'Biology', 'BIOL', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-782c-a993-1006eabb02fd', 'Several BIO faculty offices and labs.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d56-b92a-5223bc06fd2c', 'Hansen Life Sciences Research Building', 'Several BIO faculty offices and labs.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79d4-be04-ad704c102d36', 'Hansen Life Sciences Research Building', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7dd6-8ed3-69b60058e549', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7455-a0f7-2248e8c5a63b', '019b3be4-3255-7dd6-8ed3-69b60058e549', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dd6-8ed3-69b60058e549', '019b995c-8e9e-782c-a993-1006eabb02fd', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7dd6-8ed3-69b60058e549', '019bb25e-e5f8-7d56-b92a-5223bc06fd2c', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dd6-8ed3-69b60058e549', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dd6-8ed3-69b60058e549', '019b995c-8e9b-79d4-be04-ad704c102d36', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;

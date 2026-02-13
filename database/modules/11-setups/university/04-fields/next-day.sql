-- Module: Next day
-- Category: field
-- Description: Next day field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-780b-88b6-5a239dc2a8ad', 'Deadline is tomorrow. Prompt help is needed; this is a moderate-stress situation.', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.877101+00:00', true, false, false, '019bb25e-e5f8-7da3-b9ff-9b182608b49b', 'Next day', 'Deadline is tomorrow. Prompt help is needed; this is a moderate-stress situation.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a09-8281-a27528d672ed', 'Next day', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.877101+00:00', '2025-08-12T12:52:09.877101+00:00', '019b3be4-3255-7b04-8a07-7cbe3c6de0fc', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b04-8a07-7cbe3c6de0fc', '019b995c-8e9e-780b-88b6-5a239dc2a8ad', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7b04-8a07-7cbe3c6de0fc', '019bb25e-e5f8-7da3-b9ff-9b182608b49b', true, '2025-08-12T12:52:09.877101+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b04-8a07-7cbe3c6de0fc', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b04-8a07-7cbe3c6de0fc', '019b995c-8e9b-7a09-8281-a27528d672ed', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;

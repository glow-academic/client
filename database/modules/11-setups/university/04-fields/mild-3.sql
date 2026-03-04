-- Module: Mild (3)
-- Category: field
-- Description: Mild (3) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7758-bc8c-23b0a29c5c31', 'The conversation is mostly relaxed, but with occasional hints of concern or focus.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7e01-90e4-9a8120acb076', 'Mild (3)', 'The conversation is mostly relaxed, but with occasional hints of concern or focus.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7adc-8a9d-54bb2caaebd6', 'Mild (3)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.87224-05', '2025-08-12 07:52:09.87224-05', '019b3be4-3255-7f9c-875c-b4b0ad69bda3', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f9c-875c-b4b0ad69bda3', '019b995c-8e9e-7758-bc8c-23b0a29c5c31', '2025-08-12 07:52:09.87224-05', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f9c-875c-b4b0ad69bda3', '019bb25e-e5f8-7e01-90e4-9a8120acb076', true, '2025-08-12 07:52:09.87224-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f9c-875c-b4b0ad69bda3', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12 07:52:09.87224-05', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f9c-875c-b4b0ad69bda3', '019b995c-8e9b-7adc-8a9d-54bb2caaebd6', '2025-08-12 07:52:09.87224-05', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7f9c-875c-b4b0ad69bda3', '019bb25e-e5f8-7e01-90e4-9a8120acb076', true, '2025-08-12 07:52:09.87224-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;

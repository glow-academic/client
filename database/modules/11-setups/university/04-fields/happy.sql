-- Module: happy
-- Category: field
-- Description: happy field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7824-934b-d5d470e870b0', 'Provides uplifting feedback and cheerful responses', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7dda-b5c5-45f0ba4336bd', 'happy', 'Provides uplifting feedback and cheerful responses', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79ba-83a0-1ff98bd0964d', 'happy', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12 07:26:55.660542-06', '2025-12-12 07:26:55.660542-06', '019b3be4-3255-7ff4-bdda-ee6747f17f98', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ff4-bdda-ee6747f17f98', '019b995c-8e9e-7824-934b-d5d470e870b0', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ff4-bdda-ee6747f17f98', '019bb25e-e5f8-7dda-b5c5-45f0ba4336bd', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ff4-bdda-ee6747f17f98', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ff4-bdda-ee6747f17f98', '019b995c-8e9b-79ba-83a0-1ff98bd0964d', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c7c-b05d-a5d004557609', '019b3be4-3255-7ff4-bdda-ee6747f17f98', '019bb25e-e5f8-7dda-b5c5-45f0ba4336bd', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;

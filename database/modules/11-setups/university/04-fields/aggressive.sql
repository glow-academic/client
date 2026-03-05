-- Module: aggressive
-- Category: field
-- Description: aggressive field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7282-9dab-63dd6aebee75', '019bb25e-e621-7037-bc24-32292586d2d2', '2025-12-13T18:43:03.008799+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7850-98fe-e35f43a79d40', 'Pushes back on ideas and challenges assumptions', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7de4-b089-ca19b4ced746', 'aggressive', 'Pushes back on ideas and challenges assumptions', '', '{}', '{019c04f5-a160-7282-9dab-63dd6aebee75}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79e3-bafc-ab1273c5799b', 'aggressive', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12 07:26:55.660542-06', '2025-12-12 07:26:55.660542-06', '019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019c04f5-a160-7282-9dab-63dd6aebee75', '2025-12-13 12:43:03.008799-06', false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019b995c-8e9e-7850-98fe-e35f43a79d40', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019bb25e-e5f8-7de4-b089-ca19b4ced746', '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019b995c-8e9b-79e3-bafc-ab1273c5799b', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c7c-b05d-a5d004557609', '019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019bb25e-e5f8-7de4-b089-ca19b4ced746', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;

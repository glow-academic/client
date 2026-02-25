-- Module: aggressive
-- Category: field
-- Description: aggressive field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7282-9dab-63dd6aebee75', '019bb25e-e621-7037-bc24-32292586d2d2', '2025-12-13T18:43:03.008799+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7850-98fe-e35f43a79d40', 'Pushes back on ideas and challenges assumptions', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7de4-b089-ca19b4ced746', 'aggressive', 'Pushes back on ideas and challenges assumptions', NULL, '{}', '{019c04f5-a160-7282-9dab-63dd6aebee75}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79e3-bafc-ab1273c5799b', 'aggressive', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_conditional_parameters_junction
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction

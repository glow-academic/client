-- Module: Employee Level
-- Category: parameter
-- Description: Employee Level parameter
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dd000025-0001-0000-0000-000000000001', 'Employee Level', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000023-0001-0000-0000-000000000001', 'Employee Level', 'The seniority level of the employee.', NULL, '{019c3f8c-b97f-70eb-86fb-4f3fae4902f8}', false, false, true, false, '{dd000020-0001-0000-0000-000000000001,dd000020-0001-0000-0000-000000000002,dd000020-0001-0000-0000-000000000003,dd000020-0001-0000-0000-000000000004}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-19T09:59:35.509148+00:00', '2026-02-19T09:59:35.509148+00:00', 'dd000024-0001-0000-0000-000000000001', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('dd000024-0001-0000-0000-000000000001', 'dd000021-0001-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', false, false, true, 'dd000020-0001-0000-0000-000000000001') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('dd000024-0001-0000-0000-000000000001', 'dd000021-0001-0000-0000-000000000002', '2026-02-19T09:59:35.509148+00:00', false, false, true, 'dd000020-0001-0000-0000-000000000002') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('dd000024-0001-0000-0000-000000000001', 'dd000021-0001-0000-0000-000000000003', '2026-02-19T09:59:35.509148+00:00', false, false, true, 'dd000020-0001-0000-0000-000000000003') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('dd000024-0001-0000-0000-000000000001', 'dd000021-0001-0000-0000-000000000004', '2026-02-19T09:59:35.509148+00:00', false, false, true, 'dd000020-0001-0000-0000-000000000004') ON CONFLICT (parameter_id, field_id) DO NOTHING;
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('dd000024-0001-0000-0000-000000000001', 'dd000025-0001-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('dd000024-0001-0000-0000-000000000001', 'dd000023-0001-0000-0000-000000000001', true, '2026-02-19T09:59:35.509148+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;

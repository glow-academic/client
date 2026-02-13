-- Module: Role
-- Category: parameter
-- Description: Role parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7c9d-9a69-17ad01de09cd', 'Role types for neutral personas (Student, Professor, Instructional Staff)', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-7908-9436-fdcca16e3db4', 'Role', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e621-7030-880f-77ce9fc3a6fd', 'Role', 'Role types for neutral personas (Student, Professor, Instructional Staff)', NULL, '{}', false, false, false, true, '{019bb25e-e5f8-7e15-a5dc-909687146e61,019bb25e-e5f8-7e19-848b-6a558d93d931,019bb25e-e5f8-7e1f-a573-7804151ff56d}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-36df-7c84-8376-0c9fc3ca5dfe', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c84-8376-0c9fc3ca5dfe', '019b995c-8e92-7c9d-9a69-17ad01de09cd', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (parameter_id, description_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c84-8376-0c9fc3ca5dfe', '019b3be4-3256-7002-8465-fd30eac11b96', '2025-12-12T13:26:55.660542+00:00', false, false, true, '019bb25e-e5f8-7e1f-a573-7804151ff56d') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c84-8376-0c9fc3ca5dfe', '019b3be4-3256-700a-bef3-9c1c89344f4e', '2025-12-12T13:26:55.660542+00:00', false, false, true, '019bb25e-e5f8-7e15-a5dc-909687146e61') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c84-8376-0c9fc3ca5dfe', '019b3be4-3256-700c-8e71-a99bb835385c', '2025-12-12T13:26:55.660542+00:00', false, false, true, '019bb25e-e5f8-7e19-848b-6a558d93d931') ON CONFLICT (parameter_id, field_id) DO NOTHING;
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c84-8376-0c9fc3ca5dfe', '019b995c-8e91-7908-9436-fdcca16e3db4', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c84-8376-0c9fc3ca5dfe', '019bb25e-e621-7030-880f-77ce9fc3a6fd', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;

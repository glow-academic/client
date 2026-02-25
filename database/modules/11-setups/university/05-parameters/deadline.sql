-- Module: Deadline
-- Category: parameter
-- Description: Deadline parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7cbc-acca-ca5699ae55b1', 'How close it is to an assignment or project deadline', '2025-08-12T12:52:09.866818+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-7925-aaba-1bd6892e071e', 'Deadline', '2025-08-12T12:52:09.866818+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-08-12T12:52:09.866818+00:00', true, false, false, '019bb25e-e621-7014-938e-88976a9c0f43', 'Deadline', 'How close it is to an assignment or project deadline', NULL, '{}', false, false, true, false, '{019bb25e-e5f8-7d96-a1d3-fd6bd8c776ba,019bb25e-e5f8-7d9a-8829-428958099860,019bb25e-e5f8-7d9e-ad3f-a6eb897d8839,019bb25e-e5f8-7da3-b9ff-9b182608b49b,019bb25e-e5f8-7da6-bbe0-b96d4d72d25f}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.866818+00:00', '2025-12-08T22:19:28.202560+00:00', '019b3be4-36df-7c54-a911-f90c2cd8bf71', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c54-a911-f90c2cd8bf71', '019b995c-8e92-7cbc-acca-ca5699ae55b1', '2025-08-12T12:52:09.866818+00:00', false, false, true) ON CONFLICT (parameter_id, description_id) DO NOTHING;
-- parameter_fields_junction
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c54-a911-f90c2cd8bf71', '019b995c-8e91-7925-aaba-1bd6892e071e', '2025-08-12T12:52:09.866818+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c54-a911-f90c2cd8bf71', '019bb25e-e621-7014-938e-88976a9c0f43', true, '2025-08-12T12:52:09.866818+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;

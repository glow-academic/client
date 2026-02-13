-- Module: Document Type
-- Category: parameter
-- Description: Document Type parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7cb0-b771-0aed9e112acd', 'Categorizes documents by their type (homework, project, quiz, etc.)', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-7921-a430-81bc17829649', 'Document Type', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e621-7027-abc4-9b86171ee17b', 'Document Type', 'Categorizes documents by their type (homework, project, quiz, etc.)', NULL, '{}', false, true, false, false, '{019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b,019bb25e-e5f8-7d00-a623-09370b0a5ba8,019bb25e-e5f8-7d04-88c8-70ce34ceeea8,019bb25e-e5f8-7d08-946a-bd2457820f28,019bb25e-e5f8-7d0d-9207-6520a302d236,019bb25e-e5f8-7d13-a0e2-aa266d021fe8,019bb25e-e5f8-7d16-abec-e5e3db9386e2,019bb25e-e5f8-7d1b-b0a6-aa800efb90bf}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-03T13:30:24.007753+00:00', '2025-12-12T13:26:55.659579+00:00', '019b3be4-36df-7c71-b0e1-5997a42c1977', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b995c-8e92-7cb0-b771-0aed9e112acd', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (parameter_id, description_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b3be4-3255-7edf-ab02-fb72268d6fa5', '2025-12-03T13:30:24.007753+00:00', false, false, true, '019bb25e-e5f8-7d1b-b0a6-aa800efb90bf') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b3be4-3255-7ee4-85b7-3d4118e9b1cb', '2025-12-03T13:30:24.007753+00:00', false, false, true, '019bb25e-e5f8-7d16-abec-e5e3db9386e2') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b3be4-3255-7f0d-82d4-4784be4819f4', '2025-12-03T13:30:24.007753+00:00', false, false, true, '019bb25e-e5f8-7d13-a0e2-aa266d021fe8') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b3be4-3255-7f15-b619-230821058fd2', '2025-12-03T13:30:24.007753+00:00', false, false, true, '019bb25e-e5f8-7d0d-9207-6520a302d236') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b3be4-3255-7f1f-8666-8862eca11ff7', '2025-12-03T13:30:24.007753+00:00', false, false, true, '019bb25e-e5f8-7d08-946a-bd2457820f28') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b3be4-3255-7f24-8b25-90c48379e5ff', '2025-12-03T13:30:24.007753+00:00', false, false, true, '019bb25e-e5f8-7d04-88c8-70ce34ceeea8') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b3be4-3255-7f2e-869a-dfbd35f14e3a', '2025-12-03T13:30:24.007753+00:00', false, false, true, '019bb25e-e5f8-7d00-a623-09370b0a5ba8') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '2025-12-04T13:22:00.014150+00:00', false, false, true, '019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b') ON CONFLICT (parameter_id, field_id) DO NOTHING;
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b995c-8e91-7921-a430-81bc17829649', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019bb25e-e621-7027-abc4-9b86171ee17b', true, '2025-12-03T13:30:24.007753+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;

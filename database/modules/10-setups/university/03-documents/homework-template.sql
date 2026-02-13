-- Module: Homework Template
-- Category: document
-- Description: Homework Template document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77c7-a983-09ecb00042fe', 'Template document for homework', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id, html) VALUES ('2025-12-06T02:59:23.893847+00:00', true, false, false, '019bb25e-e619-7810-bc6e-9640cb15e1cf', 'Homework Template', 'Template document for homework', '{}', NULL, '019c29d6-003a-7f3d-9c60-a6c537f708ce', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a38-a9ec-630fbd96d375', 'Homework Template', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id, conditional_parameter_id) VALUES ('14a21ccc-2058-484d-8c5d-c2dc5a28a2c2', '019bb25e-e5f8-7d1b-b0a6-aa800efb90bf', true, false, '2025-12-06T02:59:23.893847+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7027-abc4-9b86171ee17b', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e621-7027-abc4-9b86171ee17b', 'Document Type', 'Categorizes documents by their type (homework, project, quiz, etc.)', NULL, '{}', false, true, false, false, '{019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b,019bb25e-e5f8-7d00-a623-09370b0a5ba8,019bb25e-e5f8-7d04-88c8-70ce34ceeea8,019bb25e-e5f8-7d08-946a-bd2457820f28,019bb25e-e5f8-7d0d-9207-6520a302d236,019bb25e-e5f8-7d13-a0e2-aa266d021fe8,019bb25e-e5f8-7d16-abec-e5e3db9386e2,019bb25e-e5f8-7d1b-b0a6-aa800efb90bf}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- document_artifact
INSERT INTO public.document_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-06T02:59:23.893847+00:00', '2025-12-08T22:19:28.214792+00:00', '019b3be4-324b-73d9-955a-abf489b79ad0', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- document_descriptions_junction
INSERT INTO public.document_descriptions_junction (document_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73d9-955a-abf489b79ad0', '019b995c-8e90-77c7-a983-09ecb00042fe', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, description_id) DO NOTHING;
-- document_documents_junction
INSERT INTO public.document_documents_junction (document_id, documents_id, active, created_at, generated, mcp) VALUES ('019b3be4-324b-73d9-955a-abf489b79ad0', '019bb25e-e619-7810-bc6e-9640cb15e1cf', true, '2025-12-06T02:59:23.893847+00:00', false, false) ON CONFLICT (document_id, documents_id) DO NOTHING;
-- document_flags_junction
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73d9-955a-abf489b79ad0', '019b995a-86ef-78bb-87a8-0de554b128bb', true, '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73d9-955a-abf489b79ad0', '019be334-bfc4-7b69-96a1-6cf5422bba50', true, '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73d9-955a-abf489b79ad0', '9e254089-4d7d-492e-9685-63967409e9ae', true, '2026-02-12T18:03:14.816509+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73d9-955a-abf489b79ad0', '019b995c-8e8e-7a38-a9ec-630fbd96d375', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_parameter_fields_junction
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73d9-955a-abf489b79ad0', '14a21ccc-2058-484d-8c5d-c2dc5a28a2c2', true, false, false, '2025-12-06T02:59:23.893847+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
-- document_parameters_junction
INSERT INTO public.document_parameters_junction (document_id, parameter_id, type, created_at, active, generated, mcp) VALUES ('019b3be4-324b-73d9-955a-abf489b79ad0', '019bb25e-e621-7027-abc4-9b86171ee17b', 'direct', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (document_id, parameter_id, type) DO NOTHING;

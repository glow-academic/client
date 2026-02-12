-- Module: Quiz Template
-- Category: document
-- Description: Quiz Template document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77d3-b672-9a7f0b03abfa', 'Template document for quiz', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id) VALUES ('2025-12-06T02:59:23.893847+00:00', true, false, false, '019bb25e-e619-781b-8652-f6e38264e233', 'Quiz Template', 'Template document for quiz', '{}', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a2a-82c5-d511d0998edf', 'Quiz Template', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('282de684-cb54-45f7-8cbe-2c5789a05b08', '019bb25e-e5f8-7d13-a0e2-aa266d021fe8', true, false, '2025-12-06T02:59:23.893847+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7027-abc4-9b86171ee17b') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e621-7027-abc4-9b86171ee17b', 'Document Type', 'Categorizes documents by their type (homework, project, quiz, etc.)', NULL, '{}', false, true, false, false, '{019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b,019bb25e-e5f8-7d00-a623-09370b0a5ba8,019bb25e-e5f8-7d04-88c8-70ce34ceeea8,019bb25e-e5f8-7d08-946a-bd2457820f28,019bb25e-e5f8-7d0d-9207-6520a302d236,019bb25e-e5f8-7d13-a0e2-aa266d021fe8,019bb25e-e5f8-7d16-abec-e5e3db9386e2,019bb25e-e5f8-7d1b-b0a6-aa800efb90bf}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- document_artifact
INSERT INTO public.document_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-06T02:59:23.893847+00:00', '2025-12-08T22:19:28.214792+00:00', '019b3be4-324b-73eb-9ee8-cf65a16294d2', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- document_descriptions_junction
INSERT INTO public.document_descriptions_junction (document_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73eb-9ee8-cf65a16294d2', '019b995c-8e90-77d3-b672-9a7f0b03abfa', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, description_id) DO NOTHING;
-- document_documents_junction
INSERT INTO public.document_documents_junction (document_id, documents_id, active, created_at, generated, mcp) VALUES ('019b3be4-324b-73eb-9ee8-cf65a16294d2', '019bb25e-e619-781b-8652-f6e38264e233', true, '2025-12-06T02:59:23.893847+00:00', false, false) ON CONFLICT (document_id, documents_id) DO NOTHING;
-- document_flags_junction
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73eb-9ee8-cf65a16294d2', '019b995a-86ef-78bb-87a8-0de554b128bb', true, '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73eb-9ee8-cf65a16294d2', '019be334-bfc4-7b69-96a1-6cf5422bba50', true, '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73eb-9ee8-cf65a16294d2', '019b995c-8e8e-7a2a-82c5-d511d0998edf', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_parameter_fields_junction
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73eb-9ee8-cf65a16294d2', '282de684-cb54-45f7-8cbe-2c5789a05b08', true, false, false, '2025-12-06T02:59:23.893847+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
-- document_parameters_junction
INSERT INTO public.document_parameters_junction (document_id, parameter_id, type, created_at, active, generated, mcp) VALUES ('019b3be4-324b-73eb-9ee8-cf65a16294d2', '019bb25e-e621-7027-abc4-9b86171ee17b', 'direct', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (document_id, parameter_id, type) DO NOTHING;

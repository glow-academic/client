-- Module: Project Template
-- Category: document
-- Description: Project Template document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77c1-b8c6-e265540379a2', 'Template document for project', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_resource (id, created_at, active, generated, mcp, text_id) VALUES ('019c29d6-005c-70a2-921b-6f8c3be52b7a', '2025-12-06T02:59:23.893847+00:00', true, false, false, '019c29d6-003a-7541-984b-5374263aa03b') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id, image_ids) VALUES ('2025-12-06T02:59:23.893847+00:00', true, false, false, '019bb25e-e619-7815-931e-fede8281ae8e', 'Project Template', 'Template document for project', '{}', NULL, '019c29d6-005c-70a2-921b-6f8c3be52b7a', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a6e-a01f-0933605e690d', 'Project Template', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id, conditional_parameter_id) VALUES ('4c10f131-af71-4219-93e4-bc6a54ff3180', '019bb25e-e5f8-7d16-abec-e5e3db9386e2', true, false, '2025-12-06T02:59:23.893847+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7027-abc4-9b86171ee17b', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- document_artifact
INSERT INTO public.document_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-06T02:59:23.893847+00:00', '2025-12-08T22:19:28.214792+00:00', '019b3be4-324b-73e0-834d-e62d15086a3d', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- document_descriptions_junction
INSERT INTO public.document_descriptions_junction (document_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73e0-834d-e62d15086a3d', '019b995c-8e90-77c1-b8c6-e265540379a2', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, description_id) DO NOTHING;
-- document_documents_junction
INSERT INTO public.document_documents_junction (document_id, documents_id, active, created_at, generated, mcp) VALUES ('019b3be4-324b-73e0-834d-e62d15086a3d', '019bb25e-e619-7815-931e-fede8281ae8e', true, '2025-12-06T02:59:23.893847+00:00', false, false) ON CONFLICT (document_id, documents_id) DO NOTHING;
-- document_flags_junction
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73e0-834d-e62d15086a3d', '019b995a-86ef-78bb-87a8-0de554b128bb', true, '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73e0-834d-e62d15086a3d', '019be334-bfc4-7b69-96a1-6cf5422bba50', true, '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73e0-834d-e62d15086a3d', '019b995c-8e8e-7a6e-a01f-0933605e690d', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_parameter_fields_junction
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73e0-834d-e62d15086a3d', '4c10f131-af71-4219-93e4-bc6a54ff3180', true, false, false, '2025-12-06T02:59:23.893847+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
-- document_parameters_junction
INSERT INTO public.document_parameters_junction (document_id, parameter_id, type, created_at, active, generated, mcp) VALUES ('019b3be4-324b-73e0-834d-e62d15086a3d', '019bb25e-e621-7027-abc4-9b86171ee17b', 'direct', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (document_id, parameter_id, type) DO NOTHING;
-- document_texts_junction
INSERT INTO public.document_texts_junction (document_id, texts_id, active, created_at) VALUES ('019b3be4-324b-73e0-834d-e62d15086a3d', '019c29d6-005c-70a2-921b-6f8c3be52b7a', true, '2026-02-13T20:09:41.891519+00:00') ON CONFLICT (document_id, texts_id) DO NOTHING;

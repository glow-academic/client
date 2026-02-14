-- Module: Policy Template
-- Category: document
-- Description: Policy Template document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77bb-adb4-7e01e6fe2310', 'Template document for policy', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_resource (id, created_at, active, generated, mcp, text_id) VALUES ('258ee632-aa7a-4fb5-b9a8-fd4a4635f283', '2026-02-11T23:50:02.269303+00:00', true, false, false, '97b50025-177e-4376-9bb0-997373e7bb40') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id, image_ids, template) VALUES ('2025-12-06T02:59:23.893847+00:00', true, false, false, '019bb25e-e619-782f-8894-e5d20003dbee', 'Policy Template', 'Template document for policy', '{}', NULL, '258ee632-aa7a-4fb5-b9a8-fd4a4635f283', '{}', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a91-9015-6ad20a273633', 'Policy Template', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id, conditional_parameter_id) VALUES ('336cdcc7-f331-42e5-9d16-28aaf94e9eaa', '019bb25e-e5f8-7ce8-825f-6d1d8ddcc6b9', true, false, '2025-12-08T22:19:28.213919+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id, conditional_parameter_id) VALUES ('0cb636f6-fd01-4cd1-99f9-cddecf4f9cb2', '019bb25e-e5f8-7cee-88ca-ae96d7297994', true, false, '2025-12-08T22:19:28.213919+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id, conditional_parameter_id) VALUES ('883475e9-ef6a-48cb-9cc5-a493eaf08996', '019bb25e-e5f8-7cf0-8ebd-24767ba27236', true, false, '2025-12-08T22:19:28.213919+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id, conditional_parameter_id) VALUES ('86264bfc-edde-499e-ad65-76452f68737f', '019bb25e-e5f8-7cf7-9bf8-831afbf7b736', true, false, '2025-12-08T22:19:28.213919+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id, conditional_parameter_id) VALUES ('570c1022-536d-4bc5-b8bb-ae2aea881cdd', '019bb25e-e5f8-7cfa-ab87-8b2a98bf6d9f', true, false, '2025-12-07T20:44:58.161092+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id, conditional_parameter_id) VALUES ('2026d5c3-ce92-43ce-8bf2-383cd287bfec', '019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b', true, false, '2025-12-06T02:59:23.893847+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7027-abc4-9b86171ee17b', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- document_artifact
INSERT INTO public.document_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-06T02:59:23.893847+00:00', '2025-12-08T22:19:28.214792+00:00', '019b3be4-324b-740f-a3c2-84236b76b323', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- document_descriptions_junction
INSERT INTO public.document_descriptions_junction (document_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '019b995c-8e90-77bb-adb4-7e01e6fe2310', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, description_id) DO NOTHING;
-- document_documents_junction
INSERT INTO public.document_documents_junction (document_id, documents_id, active, created_at, generated, mcp) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '019bb25e-e619-782f-8894-e5d20003dbee', true, '2025-12-06T02:59:23.893847+00:00', false, false) ON CONFLICT (document_id, documents_id) DO NOTHING;
-- document_flags_junction
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '019b995a-86ef-78bb-87a8-0de554b128bb', true, '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '019be334-bfc4-7b69-96a1-6cf5422bba50', true, '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '019b995c-8e8e-7a91-9015-6ad20a273633', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_parameter_fields_junction
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '336cdcc7-f331-42e5-9d16-28aaf94e9eaa', true, false, false, '2025-12-08T22:19:28.213919+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '0cb636f6-fd01-4cd1-99f9-cddecf4f9cb2', true, false, false, '2025-12-08T22:19:28.213919+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '883475e9-ef6a-48cb-9cc5-a493eaf08996', true, false, false, '2025-12-08T22:19:28.213919+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '86264bfc-edde-499e-ad65-76452f68737f', true, false, false, '2025-12-08T22:19:28.213919+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '570c1022-536d-4bc5-b8bb-ae2aea881cdd', true, false, false, '2025-12-07T20:44:58.161092+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '2026d5c3-ce92-43ce-8bf2-383cd287bfec', true, false, false, '2025-12-06T02:59:23.893847+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
-- document_parameters_junction
INSERT INTO public.document_parameters_junction (document_id, parameter_id, type, created_at, active, generated, mcp) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', 'direct', '2025-12-07T20:44:58.161092+00:00', true, false, false) ON CONFLICT (document_id, parameter_id, type) DO NOTHING;
INSERT INTO public.document_parameters_junction (document_id, parameter_id, type, created_at, active, generated, mcp) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '019bb25e-e621-7027-abc4-9b86171ee17b', 'direct', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (document_id, parameter_id, type) DO NOTHING;
-- document_texts_junction
INSERT INTO public.document_texts_junction (document_id, texts_id, active, created_at) VALUES ('019b3be4-324b-740f-a3c2-84236b76b323', '258ee632-aa7a-4fb5-b9a8-fd4a4635f283', true, '2026-02-13T20:09:41.891519+00:00') ON CONFLICT (document_id, texts_id) DO NOTHING;

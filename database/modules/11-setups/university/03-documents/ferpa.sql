-- Module: FERPA
-- Category: document
-- Description: FERPA document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c0af9-a701-7b34-8702-70c808e2f1fb', 'FERPA compliance and student privacy guidelines', '2026-01-29T18:17:39.327225+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.files_resource (id, created_at, active, generated, mcp) VALUES ('019bcc94-efb5-7817-954e-38e6c05e1d7a', '2026-01-17T15:31:11.407183+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id, image_ids, template, parameter_ids, parameter_field_ids) VALUES ('2025-12-02T21:29:26.457679+00:00', true, false, false, '019bb25e-e619-7839-b017-f8f078788555', 'FERPA', '', '{}', '019bcc94-efb5-7817-954e-38e6c05e1d7a', NULL, '{}', false, '{019bb25e-e621-7018-96b0-6fa0d0ec3d1d,019bb25e-e621-7027-abc4-9b86171ee17b}', '{1e6c2e8c-e6a9-4c99-a415-a70fc92f8cb6,26f7d32e-5e18-4c2e-8bd1-fed8aff752a8,5106e06b-c4c6-4f9b-ad78-29fcaf668a50,6ea7a6cb-983a-46b7-86cc-62e5d9a91571,83909008-2134-49a5-966e-d41ebec9be53,9e621a39-b306-4219-8e18-cfe98eed09c2}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a78-88b1-df0930e2f34a', 'FERPA', '2025-12-02T21:29:26.457679+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('5106e06b-c4c6-4f9b-ad78-29fcaf668a50', '019bb25e-e5f8-7ce8-825f-6d1d8ddcc6b9', true, false, '2025-12-08T22:19:28.213919+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('1e6c2e8c-e6a9-4c99-a415-a70fc92f8cb6', '019bb25e-e5f8-7cee-88ca-ae96d7297994', true, false, '2025-12-08T22:19:28.213919+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('9e621a39-b306-4219-8e18-cfe98eed09c2', '019bb25e-e5f8-7cf0-8ebd-24767ba27236', true, false, '2025-12-08T22:19:28.213919+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('6ea7a6cb-983a-46b7-86cc-62e5d9a91571', '019bb25e-e5f8-7cf7-9bf8-831afbf7b736', true, false, '2025-12-08T22:19:28.213919+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('83909008-2134-49a5-966e-d41ebec9be53', '019bb25e-e5f8-7cfa-ab87-8b2a98bf6d9f', true, false, '2025-12-07T20:44:58.161092+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('26f7d32e-5e18-4c2e-8bd1-fed8aff752a8', '019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b', true, false, '2025-12-04T13:22:00.014150+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7027-abc4-9b86171ee17b') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- document_artifact
INSERT INTO public.document_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T21:29:26.457679+00:00', '2026-01-07T07:25:51.823853+00:00', '019b3be4-324b-73d4-b4a8-bfeec508838d', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- document_descriptions_junction
INSERT INTO public.document_descriptions_junction (document_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '019c0af9-a701-7b34-8702-70c808e2f1fb', '2026-01-29T18:17:39.327225+00:00', false, false, true) ON CONFLICT (document_id, description_id) DO NOTHING;
-- document_documents_junction
INSERT INTO public.document_documents_junction (document_id, documents_id, active, created_at, generated, mcp) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '019bb25e-e619-7839-b017-f8f078788555', '2025-12-02T21:29:26.457679+00:00', false, false) ON CONFLICT (document_id, documents_id) DO NOTHING;
-- document_flags_junction
INSERT INTO public.document_flags_junction (document_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '019b995a-86ef-78bb-87a8-0de554b128bb', '2025-12-02T21:29:26.457679+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '019be334-bfc4-7b69-96a1-6cf5422bba50', '2025-12-02T21:29:26.457679+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '019b995c-8e8e-7a78-88b1-df0930e2f34a', '2025-12-02T21:29:26.457679+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_parameter_fields_junction
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '5106e06b-c4c6-4f9b-ad78-29fcaf668a50', true, false, false, '2025-12-08T22:19:28.213919+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '1e6c2e8c-e6a9-4c99-a415-a70fc92f8cb6', true, false, false, '2025-12-08T22:19:28.213919+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '9e621a39-b306-4219-8e18-cfe98eed09c2', true, false, false, '2025-12-08T22:19:28.213919+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '6ea7a6cb-983a-46b7-86cc-62e5d9a91571', true, false, false, '2025-12-08T22:19:28.213919+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '83909008-2134-49a5-966e-d41ebec9be53', true, false, false, '2025-12-07T20:44:58.161092+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73d4-b4a8-bfeec508838d', '26f7d32e-5e18-4c2e-8bd1-fed8aff752a8', true, false, false, '2025-12-04T13:22:00.014150+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
-- document_files_junction
INSERT INTO public.document_files_junction (active, created_at, files_id, document_id, generated, mcp) VALUES (true, '2025-12-02T21:29:26.457679+00:00', '019bcc94-efb5-7817-954e-38e6c05e1d7a', '019b3be4-324b-73d4-b4a8-bfeec508838d', false, false) ON CONFLICT (document_id, files_id) DO NOTHING;

-- Module: Lawson Computer Science Building
-- Category: field
-- Description: Lawson Computer Science Building field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7756-8c9c-b7147a76874a', 'An open, collaborative space in the Lawson building with high foot traffic.', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.014873+00:00', true, false, false, '019bb25e-e5f8-7d6a-b8a9-4b3d2d56e8ed', 'Lawson Computer Science Building', 'An open, collaborative space in the Lawson building with high foot traffic.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a41-86d8-f14c909f49ed', 'Lawson Computer Science Building', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:10.014873-05', '2025-08-12 07:52:10.014873-05', '019b3be4-3255-7d66-a6f8-b5416e286a74', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d66-a6f8-b5416e286a74', '019b995c-8e9e-7756-8c9c-b7147a76874a', '2025-08-12 07:52:10.014873-05', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d66-a6f8-b5416e286a74', '019bb25e-e5f8-7d6a-b8a9-4b3d2d56e8ed', true, '2025-08-12 07:52:10.014873-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d66-a6f8-b5416e286a74', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:10.014873-05', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d66-a6f8-b5416e286a74', '019b995c-8e9b-7a41-86d8-f14c909f49ed', '2025-08-12 07:52:10.014873-05', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c64-a57f-0e212bfec083', '019b3be4-3255-7d66-a6f8-b5416e286a74', '019bb25e-e5f8-7d6a-b8a9-4b3d2d56e8ed', true, '2025-08-12 07:52:10.014873-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;

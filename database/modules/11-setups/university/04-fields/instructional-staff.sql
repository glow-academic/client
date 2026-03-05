-- Module: Instructional Staff
-- Category: field
-- Description: Instructional Staff field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-779e-af8a-7bf39fc55442', 'Represents teaching assistants and instructional support staff', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7e19-848b-6a558d93d931', 'Instructional Staff', 'Represents teaching assistants and instructional support staff', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e99-783a-be61-470f68be3981', 'Instructional Staff', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12 07:26:55.660542-06', '2025-12-12 07:26:55.660542-06', '019b3be4-3256-700c-8e71-a99bb835385c', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-700c-8e71-a99bb835385c', '019b995c-8e9e-779e-af8a-7bf39fc55442', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3256-700c-8e71-a99bb835385c', '019bb25e-e5f8-7e19-848b-6a558d93d931', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-700c-8e71-a99bb835385c', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-700c-8e71-a99bb835385c', '019b995c-8e99-783a-be61-470f68be3981', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c84-8376-0c9fc3ca5dfe', '019b3be4-3256-700c-8e71-a99bb835385c', '019bb25e-e5f8-7e19-848b-6a558d93d931', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;

-- Module: policy
-- Category: field
-- Description: policy field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7251-b0bc-33dbff8e66a0', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', '2025-12-08T22:19:28.206394+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7751-87fd-edc2107801de', 'Policy documents, guidelines, and regulations', '2025-12-04T13:22:00.014150+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-04T13:22:00.014150+00:00', true, false, false, '019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b', 'policy', 'Policy documents, guidelines, and regulations', '', '{}', '{019c04f5-a160-7251-b0bc-33dbff8e66a0}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79ef-b5c4-96edebab8aa9', 'policy', '2025-12-04T13:22:00.014150+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-04 07:22:00.01415-06', '2025-12-04 07:22:00.01415-06', '019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019c04f5-a160-7251-b0bc-33dbff8e66a0', true, '2025-12-08 16:19:28.206394-06', false, false) ON CONFLICT (field_id, conditional_parameters_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019b995c-8e9e-7751-87fd-edc2107801de', '2025-12-04 07:22:00.01415-06', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b', true, '2025-12-04 07:22:00.01415-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-12-04 07:22:00.01415-06', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019b995c-8e9b-79ef-b5c4-96edebab8aa9', '2025-12-04 07:22:00.01415-06', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b', true, '2025-12-04 07:22:00.01415-06', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;

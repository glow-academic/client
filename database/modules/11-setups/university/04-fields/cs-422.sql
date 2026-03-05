-- Module: CS 422
-- Category: field
-- Description: CS 422 field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7817-90b5-c73c3e0d51fa', 'Network protocols, socket programming, network security, distributed systems, and network performance analysis. Covers TCP/IP, HTTP, DNS, and other networking fundamentals.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7d26-b989-3212a42e6b6f', 'CS 422', 'Network protocols, socket programming, network security, distributed systems, and network performance analysis. Covers TCP/IP, HTTP, DNS, and other networking fundamentals.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a44-a324-9532c3d8c5e5', 'CS 422', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:10.017187-05', '2025-08-12 07:52:10.017187-05', '019b3be4-3255-7d8a-b815-e06bfaa49b28', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d8a-b815-e06bfaa49b28', '019b995c-8e9e-7817-90b5-c73c3e0d51fa', '2025-08-12 07:52:10.017187-05', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d8a-b815-e06bfaa49b28', '019bb25e-e5f8-7d26-b989-3212a42e6b6f', true, '2025-08-12 07:52:10.017187-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d8a-b815-e06bfaa49b28', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:10.017187-05', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d8a-b815-e06bfaa49b28', '019b995c-8e9b-7a44-a324-9532c3d8c5e5', '2025-08-12 07:52:10.017187-05', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c04-8324-b7909cc1366e', '019b3be4-3255-7d8a-b815-e06bfaa49b28', '019bb25e-e5f8-7d26-b989-3212a42e6b6f', true, '2025-08-12 07:52:10.017187-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;

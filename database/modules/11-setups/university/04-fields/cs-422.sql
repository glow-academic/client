-- Module: CS 422
-- Category: field
-- Description: CS 422 field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7817-90b5-c73c3e0d51fa', 'Network protocols, socket programming, network security, distributed systems, and network performance analysis. Covers TCP/IP, HTTP, DNS, and other networking fundamentals.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7d26-b989-3212a42e6b6f', 'CS 422', 'Network protocols, socket programming, network security, distributed systems, and network performance analysis. Covers TCP/IP, HTTP, DNS, and other networking fundamentals.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a44-a324-9532c3d8c5e5', 'CS 422', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_departments_junction
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction

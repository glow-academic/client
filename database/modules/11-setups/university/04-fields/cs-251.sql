-- Module: CS 251
-- Category: field
-- Description: CS 251 field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7831-80ca-7deae123a52d', 'Running time analysis of algorithms and their implementations, one-dimensional data structures, trees, heaps, additional sorting algorithms, binary search trees, hash tables, graphs, directed graphs, weighted graph algorithms, additional topics.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7cd8-b47c-ac2bddf4f495', 'CS 251', 'Running time analysis of algorithms and their implementations, one-dimensional data structures, trees, heaps, additional sorting algorithms, binary search trees, hash tables, graphs, directed graphs, weighted graph algorithms, additional topics.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a8b-a778-b94058138184', 'CS 251', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.017187+00:00', '2025-08-12T12:52:10.017187+00:00', '019b3be4-3255-7da1-9077-471170325d94', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7da1-9077-471170325d94', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7da1-9077-471170325d94', '019b995c-8e9e-7831-80ca-7deae123a52d', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7da1-9077-471170325d94', '019bb25e-e5f8-7cd8-b47c-ac2bddf4f495', true, '2025-08-12T12:52:10.017187+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7da1-9077-471170325d94', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7da1-9077-471170325d94', '019b995c-8e9b-7a8b-a778-b94058138184', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;

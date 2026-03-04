-- Module: Class
-- Category: parameter
-- Description: Class parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7caa-af33-720342925c1f', 'Which course or subject the scenario is about', '2025-08-12T12:52:10.013081+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-7915-a286-b487aa33da4a', 'Class', '2025-08-12T12:52:10.013081+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-08-12T12:52:10.013081+00:00', true, false, false, '019bb25e-e620-7f9a-a3b6-8b7230c1e51c', 'Class', 'Which course or subject the scenario is about', '', '{}', false, false, true, false, '{019bb25e-e5f8-7c20-855d-7ccf9e162415,019bb25e-e5f8-7c96-8991-7110c1e2616e,019bb25e-e5f8-7c9d-854d-91181fc32658,019bb25e-e5f8-7ca3-ae71-235393296e6a,019bb25e-e5f8-7ca7-a23c-03fe824b4e20,019bb25e-e5f8-7cab-a50e-56f8f5be04bb,019bb25e-e5f8-7caf-ae53-4390d8e77372,019bb25e-e5f8-7cb0-a8f7-b733bdebb1ca,019bb25e-e5f8-7cb7-8af7-29a33317c819,019bb25e-e5f8-7cbb-ab67-3ccacb2df5aa,019bb25e-e5f8-7cbf-a83f-133510bc2166,019bb25e-e5f8-7cc0-9040-b01aa544b670,019bb25e-e5f8-7cc6-a9a9-c51bbec49f96,019bb25e-e5f8-7cc9-8987-b46dcfac9dcd,019bb25e-e5f8-7ccf-8161-efad11364f9b,019bb25e-e5f8-7cd3-aade-bc9cfbbaef93,019bb25e-e5f8-7cd7-b8ca-96716f527321,019bb25e-e5f8-7cd8-b47c-ac2bddf4f495,019bb25e-e5f8-7cdd-b4b0-cf61647ab5ac,019bb25e-e5f8-7ce3-a09b-4cf194441c1b,019bb25e-e5f8-7ce7-b68a-61e9a4e7308b,019bb25e-e5f8-7d1e-8311-f9e7e06555e2,019bb25e-e5f8-7d22-9d6f-d0976eea78ec,019bb25e-e5f8-7d26-b989-3212a42e6b6f,019bb25e-e5f8-7d2a-90de-10226a471e6b}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.013081+00:00', '2025-12-08T22:19:28.202560+00:00', '019b3be4-36df-7c04-8324-b7909cc1366e', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c04-8324-b7909cc1366e', '019b995c-8e92-7caa-af33-720342925c1f', '2025-08-12T12:52:10.013081+00:00', false, false, true) ON CONFLICT (parameter_id, description_id) DO NOTHING;
-- parameter_fields_junction
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c04-8324-b7909cc1366e', '019b995c-8e91-7915-a286-b487aa33da4a', '2025-08-12T12:52:10.013081+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c04-8324-b7909cc1366e', '019bb25e-e620-7f9a-a3b6-8b7230c1e51c', true, '2025-08-12T12:52:10.013081+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;

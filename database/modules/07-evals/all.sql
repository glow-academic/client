-- Module: all evals
-- Category: evals
-- Description: All eval artifacts
-- ============================================================

-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('cc000033-0000-0000-0000-000000000033', 'Evaluation of training agent performance', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:37:27.875564+00:00', true, false, false, 'cc000031-0000-0000-0000-000000000031', 'Training Agent Evaluation', 'Evaluation of training agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('cc000032-0000-0000-0000-000000000032', 'Training Agent Evaluation', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('cc000043-0000-0000-0000-000000000043', 'Evaluation of benchmark agent performance', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:37:27.875564+00:00', true, false, false, 'cc000041-0000-0000-0000-000000000041', 'Benchmark Agent Evaluation', 'Evaluation of benchmark agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('cc000042-0000-0000-0000-000000000042', 'Benchmark Agent Evaluation', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-4794-73c3-ab81-531c892e0306', 'Evaluation of provider agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-4794-73b1-917d-fcc0287078ad', 'Provider Agent Evaluation', 'Evaluation of provider agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-4794-7952-9557-2299865f98ab', 'Provider Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-479a-7a28-9a8f-88393d1ee1b3', 'Evaluation of scenario agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-479a-7a26-98ce-4b1e8fcf44ac', 'Scenario Agent Evaluation', 'Evaluation of scenario agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8c-7c8d-a86e-a0c71587cd9d', 'Scenario Agent Evaluation', '2025-12-18T16:04:45.638195+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-479b-7da8-aeb9-2cd19044a914', 'Evaluation of document agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-479b-7da5-b6fc-544f946d59cf', 'Document Agent Evaluation', 'Evaluation of document agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-479b-7e83-a1ee-7250230839b1', 'Document Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-479c-7c45-b932-b3def95379f8', 'Evaluation of rubric agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-479c-7c42-9203-41faf5fce9d9', 'Rubric Agent Evaluation', 'Evaluation of rubric agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-479c-7cf5-bc96-92d4458ebc21', 'Rubric Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-479d-7a31-88f7-e0ebcc3aeb8d', 'Evaluation of parameter agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-479d-7a2f-a740-bc57b908a66f', 'Parameter Agent Evaluation', 'Evaluation of parameter agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-479d-7adb-925c-c358bcf406a5', 'Parameter Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-479e-7b48-b50a-4368c85e49e5', 'Evaluation of auth agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-479e-7b45-ac1d-50686ee79a45', 'Auth Agent Evaluation', 'Evaluation of auth agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-479e-7c1a-ac43-697a12bcc32f', 'Auth Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-479f-7ac4-b32e-f1ac2a879a4a', 'Evaluation of profile agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-479f-7ac1-ae9d-9f3d3cab5470', 'Profile Agent Evaluation', 'Evaluation of profile agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-479f-7b17-bf0c-23ddf5407d93', 'Profile Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a0-75ff-a206-01dfb54af81f', 'Evaluation of department agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a0-75f8-a434-87ccb7030a63', 'Department Agent Evaluation', 'Evaluation of department agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a0-7656-b8be-4a5e54ddc101', 'Department Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a1-7195-b436-a932480867fc', 'Evaluation of cohort agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a1-7191-837a-06ae0f3b8c34', 'Cohort Agent Evaluation', 'Evaluation of cohort agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a1-7206-abca-02ba5156a578', 'Cohort Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a1-7cdb-9f70-683bf9f0ace0', 'Evaluation of setting agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a1-7cd4-afc0-e9b0c3b9c094', 'Setting Agent Evaluation', 'Evaluation of setting agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a1-7d2b-b672-72f4bc98016f', 'Setting Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a2-789e-8da0-671029ee96e7', 'Evaluation of agent agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a2-7898-9e79-cee8b222b3ca', 'Agent Agent Evaluation', 'Evaluation of agent agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a2-78fc-ae52-20a0d83f2219', 'Agent Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a3-76e8-84d2-d53df9f9a9bb', 'Evaluation of model agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a3-76e7-a873-60cd3c01e3dd', 'Model Agent Evaluation', 'Evaluation of model agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a3-77f4-afa8-ee29cfc6b297', 'Model Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a4-755b-88ee-db7a1f4527a3', 'Evaluation of tool agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a4-7556-90b4-2476f2dd9cd6', 'Tool Agent Evaluation', 'Evaluation of tool agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a4-75bd-8e13-8746fe0cd32f', 'Tool Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a5-7172-bfb7-a605b73a20c0', 'Evaluation of persona agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a5-716d-aa01-7a89f2ee5669', 'Persona Agent Evaluation', 'Evaluation of persona agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a5-71bd-b39f-602f7f805ce9', 'Persona Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a5-7da4-b4a6-dcdc6feafe34', 'Evaluation of simulation agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a5-7da1-950b-a442749bdcca', 'Simulation Agent Evaluation', 'Evaluation of simulation agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a5-7df9-9a35-457c8a67294a', 'Simulation Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a6-795e-8e51-115a26e782f5', 'Evaluation of chat agent agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a6-795b-96dd-10e9f11b81b3', 'Chat Agent Agent Evaluation', 'Evaluation of chat agent agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a6-79b7-9235-1cace55ddf13', 'Chat Agent Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a7-755a-8f30-a5245970693a', 'Evaluation of eval agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a7-7557-86dc-17a5b83926e3', 'Eval Agent Evaluation', 'Evaluation of eval agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a7-75b3-a315-2dfa63217850', 'Eval Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a8-727f-bd40-3820e221828e', 'Evaluation of grade agent agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a8-7279-9fa2-1992ba9df319', 'Grade Agent Agent Evaluation', 'Evaluation of grade agent agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a8-72cd-a854-6656de75a4ff', 'Grade Agent Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-47a8-7e8c-9bba-bae2f0f55580', 'Evaluation of field agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-47a8-7e88-a28b-3cccd31e949f', 'Field Agent Evaluation', 'Evaluation of field agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-47a8-7edb-bf4f-792da64f7d57', 'Field Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifacts
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:37:27.875564+00:00', '2026-02-11T20:37:27.875564+00:00', 'cc000003-0000-0000-0000-000000000003', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:37:27.875564+00:00', '2026-02-11T20:37:27.875564+00:00', 'cc000004-0000-0000-0000-000000000004', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-4794-739c-8361-b0401227847c', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-479a-7a20-9aab-060d29dfbe69', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-479b-7da3-8534-d832cfa860ae', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-479c-7c3d-bd8e-44daa22da6bc', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-479d-7a2b-9b03-a8c46af98ae0', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-479e-7b43-8b0d-556438b63229', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-479f-7abc-b3ea-61e82a842163', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a0-75f7-99dd-154cf20c98a2', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a1-718c-accd-d11772098c08', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a1-7cd1-964f-ed3f1d0d56a6', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a2-7896-9f5a-5f57ee554660', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a3-76e1-bfa9-b402c7625143', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a4-7552-970e-bddea1ef0176', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a5-716a-a626-9112bdb22e12', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a5-7d9f-9919-7e441e32a162', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a6-7955-bfd8-48ef668e5e2b', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a7-7553-8b10-6eb4663b8f4c', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a8-7275-93eb-681f5cf002bb', false, false) ON CONFLICT (id) DO NOTHING;
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-47a8-7e85-b75d-f4b48ab2ee19', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('cc000003-0000-0000-0000-000000000003', 'cc000033-0000-0000-0000-000000000033', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('cc000003-0000-0000-0000-000000000003', 'cc000031-0000-0000-0000-000000000031', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cc000003-0000-0000-0000-000000000003', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cc000003-0000-0000-0000-000000000003', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cc000003-0000-0000-0000-000000000003', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('cc000003-0000-0000-0000-000000000003', 'cc000032-0000-0000-0000-000000000032', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('cc000004-0000-0000-0000-000000000004', 'cc000043-0000-0000-0000-000000000043', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('cc000004-0000-0000-0000-000000000004', 'cc000041-0000-0000-0000-000000000041', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cc000004-0000-0000-0000-000000000004', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cc000004-0000-0000-0000-000000000004', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cc000004-0000-0000-0000-000000000004', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('cc000004-0000-0000-0000-000000000004', 'cc000042-0000-0000-0000-000000000042', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019c4e7a-4794-73c3-ab81-531c892e0306', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019c4e7a-4794-73b1-917d-fcc0287078ad', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019c4e7a-4794-7952-9557-2299865f98ab', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479a-7a20-9aab-060d29dfbe69', '019c4e7a-479a-7a28-9a8f-88393d1ee1b3', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-479a-7a20-9aab-060d29dfbe69', '019c4e7a-479a-7a26-98ce-4b1e8fcf44ac', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479a-7a20-9aab-060d29dfbe69', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479a-7a20-9aab-060d29dfbe69', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479a-7a20-9aab-060d29dfbe69', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479a-7a20-9aab-060d29dfbe69', '019b995c-8e8c-7c8d-a86e-a0c71587cd9d', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479b-7da3-8534-d832cfa860ae', '019c4e7a-479b-7da8-aeb9-2cd19044a914', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-479b-7da3-8534-d832cfa860ae', '019c4e7a-479b-7da5-b6fc-544f946d59cf', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479b-7da3-8534-d832cfa860ae', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479b-7da3-8534-d832cfa860ae', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479b-7da3-8534-d832cfa860ae', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479b-7da3-8534-d832cfa860ae', '019c4e7a-479b-7e83-a1ee-7250230839b1', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479c-7c3d-bd8e-44daa22da6bc', '019c4e7a-479c-7c45-b932-b3def95379f8', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-479c-7c3d-bd8e-44daa22da6bc', '019c4e7a-479c-7c42-9203-41faf5fce9d9', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479c-7c3d-bd8e-44daa22da6bc', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479c-7c3d-bd8e-44daa22da6bc', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479c-7c3d-bd8e-44daa22da6bc', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479c-7c3d-bd8e-44daa22da6bc', '019c4e7a-479c-7cf5-bc96-92d4458ebc21', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479d-7a2b-9b03-a8c46af98ae0', '019c4e7a-479d-7a31-88f7-e0ebcc3aeb8d', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-479d-7a2b-9b03-a8c46af98ae0', '019c4e7a-479d-7a2f-a740-bc57b908a66f', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479d-7a2b-9b03-a8c46af98ae0', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479d-7a2b-9b03-a8c46af98ae0', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479d-7a2b-9b03-a8c46af98ae0', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479d-7a2b-9b03-a8c46af98ae0', '019c4e7a-479d-7adb-925c-c358bcf406a5', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479e-7b43-8b0d-556438b63229', '019c4e7a-479e-7b48-b50a-4368c85e49e5', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-479e-7b43-8b0d-556438b63229', '019c4e7a-479e-7b45-ac1d-50686ee79a45', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479e-7b43-8b0d-556438b63229', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479e-7b43-8b0d-556438b63229', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479e-7b43-8b0d-556438b63229', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479e-7b43-8b0d-556438b63229', '019c4e7a-479e-7c1a-ac43-697a12bcc32f', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479f-7abc-b3ea-61e82a842163', '019c4e7a-479f-7ac4-b32e-f1ac2a879a4a', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-479f-7abc-b3ea-61e82a842163', '019c4e7a-479f-7ac1-ae9d-9f3d3cab5470', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479f-7abc-b3ea-61e82a842163', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479f-7abc-b3ea-61e82a842163', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-479f-7abc-b3ea-61e82a842163', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-479f-7abc-b3ea-61e82a842163', '019c4e7a-479f-7b17-bf0c-23ddf5407d93', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a0-75f7-99dd-154cf20c98a2', '019c4e7a-47a0-75ff-a206-01dfb54af81f', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a0-75f7-99dd-154cf20c98a2', '019c4e7a-47a0-75f8-a434-87ccb7030a63', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a0-75f7-99dd-154cf20c98a2', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a0-75f7-99dd-154cf20c98a2', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a0-75f7-99dd-154cf20c98a2', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a0-75f7-99dd-154cf20c98a2', '019c4e7a-47a0-7656-b8be-4a5e54ddc101', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a1-718c-accd-d11772098c08', '019c4e7a-47a1-7195-b436-a932480867fc', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a1-718c-accd-d11772098c08', '019c4e7a-47a1-7191-837a-06ae0f3b8c34', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a1-718c-accd-d11772098c08', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a1-718c-accd-d11772098c08', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a1-718c-accd-d11772098c08', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a1-718c-accd-d11772098c08', '019c4e7a-47a1-7206-abca-02ba5156a578', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a1-7cd1-964f-ed3f1d0d56a6', '019c4e7a-47a1-7cdb-9f70-683bf9f0ace0', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a1-7cd1-964f-ed3f1d0d56a6', '019c4e7a-47a1-7cd4-afc0-e9b0c3b9c094', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a1-7cd1-964f-ed3f1d0d56a6', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a1-7cd1-964f-ed3f1d0d56a6', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a1-7cd1-964f-ed3f1d0d56a6', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a1-7cd1-964f-ed3f1d0d56a6', '019c4e7a-47a1-7d2b-b672-72f4bc98016f', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a2-7896-9f5a-5f57ee554660', '019c4e7a-47a2-789e-8da0-671029ee96e7', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a2-7896-9f5a-5f57ee554660', '019c4e7a-47a2-7898-9e79-cee8b222b3ca', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a2-7896-9f5a-5f57ee554660', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a2-7896-9f5a-5f57ee554660', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a2-7896-9f5a-5f57ee554660', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a2-7896-9f5a-5f57ee554660', '019c4e7a-47a2-78fc-ae52-20a0d83f2219', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a3-76e1-bfa9-b402c7625143', '019c4e7a-47a3-76e8-84d2-d53df9f9a9bb', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a3-76e1-bfa9-b402c7625143', '019c4e7a-47a3-76e7-a873-60cd3c01e3dd', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a3-76e1-bfa9-b402c7625143', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a3-76e1-bfa9-b402c7625143', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a3-76e1-bfa9-b402c7625143', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a3-76e1-bfa9-b402c7625143', '019c4e7a-47a3-77f4-afa8-ee29cfc6b297', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a4-7552-970e-bddea1ef0176', '019c4e7a-47a4-755b-88ee-db7a1f4527a3', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a4-7552-970e-bddea1ef0176', '019c4e7a-47a4-7556-90b4-2476f2dd9cd6', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a4-7552-970e-bddea1ef0176', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a4-7552-970e-bddea1ef0176', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a4-7552-970e-bddea1ef0176', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a4-7552-970e-bddea1ef0176', '019c4e7a-47a4-75bd-8e13-8746fe0cd32f', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019c4e7a-47a5-7172-bfb7-a605b73a20c0', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019c4e7a-47a5-716d-aa01-7a89f2ee5669', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-716a-a626-9112bdb22e12', '019c4e7a-47a5-71bd-b39f-602f7f805ce9', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-7d9f-9919-7e441e32a162', '019c4e7a-47a5-7da4-b4a6-dcdc6feafe34', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a5-7d9f-9919-7e441e32a162', '019c4e7a-47a5-7da1-950b-a442749bdcca', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-7d9f-9919-7e441e32a162', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-7d9f-9919-7e441e32a162', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-7d9f-9919-7e441e32a162', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a5-7d9f-9919-7e441e32a162', '019c4e7a-47a5-7df9-9a35-457c8a67294a', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a6-7955-bfd8-48ef668e5e2b', '019c4e7a-47a6-795e-8e51-115a26e782f5', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a6-7955-bfd8-48ef668e5e2b', '019c4e7a-47a6-795b-96dd-10e9f11b81b3', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a6-7955-bfd8-48ef668e5e2b', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a6-7955-bfd8-48ef668e5e2b', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a6-7955-bfd8-48ef668e5e2b', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a6-7955-bfd8-48ef668e5e2b', '019c4e7a-47a6-79b7-9235-1cace55ddf13', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a7-7553-8b10-6eb4663b8f4c', '019c4e7a-47a7-755a-8f30-a5245970693a', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a7-7553-8b10-6eb4663b8f4c', '019c4e7a-47a7-7557-86dc-17a5b83926e3', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a7-7553-8b10-6eb4663b8f4c', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a7-7553-8b10-6eb4663b8f4c', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a7-7553-8b10-6eb4663b8f4c', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a7-7553-8b10-6eb4663b8f4c', '019c4e7a-47a7-75b3-a315-2dfa63217850', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a8-7275-93eb-681f5cf002bb', '019c4e7a-47a8-727f-bd40-3820e221828e', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a8-7275-93eb-681f5cf002bb', '019c4e7a-47a8-7279-9fa2-1992ba9df319', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a8-7275-93eb-681f5cf002bb', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a8-7275-93eb-681f5cf002bb', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a8-7275-93eb-681f5cf002bb', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a8-7275-93eb-681f5cf002bb', '019c4e7a-47a8-72cd-a854-6656de75a4ff', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a8-7e85-b75d-f4b48ab2ee19', '019c4e7a-47a8-7e8c-9bba-bae2f0f55580', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-47a8-7e85-b75d-f4b48ab2ee19', '019c4e7a-47a8-7e88-a28b-3cccd31e949f', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a8-7e85-b75d-f4b48ab2ee19', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a8-7e85-b75d-f4b48ab2ee19', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-47a8-7e85-b75d-f4b48ab2ee19', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-47a8-7e85-b75d-f4b48ab2ee19', '019c4e7a-47a8-7edb-bf4f-792da64f7d57', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;

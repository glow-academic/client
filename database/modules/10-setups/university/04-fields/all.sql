-- Module: all fields
-- Category: setup/university
-- Description: All field artifacts for university setup
-- ============================================================

-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7877-84a1-74dbf105b693', 'There is a line of students waiting for help; the room feels crowded.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d74-9400-96485f9608ae', 'Very Busy (7)', 'There is a line of students waiting for help; the room feels crowded.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aa9-89ba-87e78ab26a48', 'Very Busy (7)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77b8-b5df-a49652d587e1', 'Only a couple of students are present; no wait for help.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d92-a3bf-60eae43b4e2f', 'Very Few Students (2)', 'Only a couple of students are present; no wait for help.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79d1-9498-15e96fd9248b', 'Very Few Students (2)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77db-95f2-a4e9e7265978', 'The room is packed, and you will have to wait a significant amount of time.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d8e-98e2-39c536d21210', 'Crowded (8)', 'The room is packed, and you will have to wait a significant amount of time.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7acd-9a63-709d43364162', 'Crowded (8)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-785e-b347-eac70c95272f', 'There are almost no students present; the room is quiet and you can get help immediately.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d8b-9d8a-f467c26a681d', 'Almost Empty (1)', 'There are almost no students present; the room is quiet and you can get help immediately.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-799e-a15e-2e42d1fc4f37', 'Almost Empty (1)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77ca-98f7-468911790298', 'A few students scattered around; very short or no wait.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d87-a4b1-bcd3fc820916', 'Sparse (3)', 'A few students scattered around; very short or no wait.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79a4-a0b5-14d7c295394b', 'Sparse (3)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-776f-a2e9-4546257bffb1', 'Several students are present, but it is still easy to get help.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d82-98f3-a088341077c2', 'Some Students (4)', 'Several students are present, but it is still easy to get help.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7997-8741-065552fa0d5e', 'Some Students (4)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7855-ae28-f440d1562d90', 'A moderate number of students; you may have to wait a bit for help.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d7c-b9e1-01ded9af627f', 'Moderately Busy (5)', 'A moderate number of students; you may have to wait a bit for help.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7abc-9401-b7c4f982b20d', 'Moderately Busy (5)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-780c-89d2-52965872892b', 'The room is active with many students; expect a noticeable wait.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d78-a23f-f4249502a96f', 'Busy (6)', 'The room is active with many students; expect a noticeable wait.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a1f-a909-bffe91e9ee0e', 'Busy (6)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7780-b5ef-5ed31b2cc8d3', 'The room is overflowing with students, with a hectic atmosphere and a very long wait.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d6d-8546-2d286f9becbe', 'Hectic (10)', 'The room is overflowing with students, with a hectic atmosphere and a very long wait.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a70-9f2e-9ae666250cbb', 'Hectic (10)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-777c-bc59-c775178b9bc3', 'There are many students and a long line; it is difficult to get help.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d72-9424-f3298926911a', 'Extremely Crowded (9)', 'There are many students and a long line; it is difficult to get help.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aa7-8b7e-13f1d498edae', 'Extremely Crowded (9)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-774e-9a55-f7b572d7c6b3', 'There is some urgency or emotional energy, but it remains manageable.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7dfe-80eb-f1a07c2d4f85', 'Slightly Tense (4)', 'There is some urgency or emotional energy, but it remains manageable.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79c0-b5d1-e627b54c1cfa', 'Slightly Tense (4)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-787e-81a1-8dd6654ab8f0', 'The conversation is active, with clear engagement and some stress or excitement.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7df8-9280-e8be30cd3a0e', 'Moderate (5)', 'The conversation is active, with clear engagement and some stress or excitement.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ae1-8a3d-7f5402285107', 'Moderate (5)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7764-87e7-3fdbf634553d', 'The conversation is energetic, with raised voices or strong emotions.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7df7-886f-39fc7dd8ddeb', 'Noticeably Intense (6)', 'The conversation is energetic, with raised voices or strong emotions.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a35-9785-75fa053043c8', 'Noticeably Intense (6)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7818-b97e-0438815b829d', 'The conversation is heated, with clear signs of frustration, urgency, or pressure.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7df1-9a0e-6a65a69e75d5', 'Tense (7)', 'The conversation is heated, with clear signs of frustration, urgency, or pressure.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ac7-bed0-dfbc96b3109f', 'Tense (7)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-783b-9ecd-9cf65e33a5d4', 'The conversation is on the verge of conflict, with high stress and urgency.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7def-b7a9-f587cd3075d0', 'Extremely Intense (9)', 'The conversation is on the verge of conflict, with high stress and urgency.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79fa-95ca-fe7636527041', 'Extremely Intense (9)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-786e-8f9a-3157f91f6f6a', 'The conversation is explosive, with overwhelming emotion or confrontation.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7dea-be6e-3ba417f090e5', 'Maximum Intensity (10)', 'The conversation is explosive, with overwhelming emotion or confrontation.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79f5-ad1d-cbb93513e941', 'Maximum Intensity (10)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7775-808c-a787ba16adc5', 'The conversation is highly charged, with strong emotions and little calm.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7e0f-939f-41d5799c4bb3', 'Very Tense (8)', 'The conversation is highly charged, with strong emotions and little calm.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7991-8a26-cf3a2c4c3da2', 'Very Tense (8)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77d3-b806-df2a5814fb89', 'The conversation is relaxed, with no signs of stress or urgency.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7e09-9ae0-23cdc02687d3', 'Very Calm (1)', 'The conversation is relaxed, with no signs of stress or urgency.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a2c-8035-db756960c474', 'Very Calm (1)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7887-9045-548c8ad0467f', 'The conversation is easygoing, with minimal tension or pressure.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7e05-8724-d06378756d1d', 'Calm (2)', 'The conversation is easygoing, with minimal tension or pressure.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7b04-9d48-8dc3535728b3', 'Calm (2)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7758-bc8c-23b0a29c5c31', 'The conversation is mostly relaxed, but with occasional hints of concern or focus.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7e01-90e4-9a8120acb076', 'Mild (3)', 'The conversation is mostly relaxed, but with occasional hints of concern or focus.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7adc-8a9d-54bb2caaebd6', 'Mild (3)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77fc-a3fc-7e989fdc1b5e', 'Late afternoon session, sustained energy needed.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7dad-ad24-8aef6b327a68', '3:00 PM', 'Late afternoon session, sustained energy needed.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a05-9fd8-f8cf82c34299', '3:00 PM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7799-800a-f6ce13dea644', 'Mid-afternoon session, good focus time.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7db1-9803-293380427820', '2:00 PM', 'Mid-afternoon session, good focus time.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a11-be61-7a4373d7d15f', '2:00 PM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77f6-88c5-d2d6dcd53e89', 'Early afternoon session, post-lunch energy dip possible.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7db6-846c-6ae8e0b2fd91', '1:00 PM', 'Early afternoon session, post-lunch energy dip possible.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ad0-b2aa-92151d237272', '1:00 PM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7880-b22a-6ff7f983a8e7', 'Lunch time session, students may be hungry or rushed.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7db9-8a23-d98360e7fca0', '12:00 PM', 'Lunch time session, students may be hungry or rushed.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79da-8590-0b5748db19e4', '12:00 PM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7734-9651-8e74f8656d10', 'Late morning session, students are alert and engaged.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7dbe-843e-5cc6e2bb7241', '11:00 AM', 'Late morning session, students are alert and engaged.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aa1-8385-1cf9f5d35c27', '11:00 AM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-788d-b750-82065bafaab1', 'Mid-morning session, good energy levels.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7dc3-a9bb-2de7e73428a2', '10:00 AM', 'Mid-morning session, good energy levels.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ae6-9b15-b237bca2e2bc', '10:00 AM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-788a-87aa-27b4250bd2d7', 'Early morning session, students may be tired but focused.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7dc6-aac8-1aec8f456e02', '9:00 AM', 'Early morning session, students may be tired but focused.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a0f-a19f-cba50e52b7f7', '9:00 AM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-774b-8d70-a9c4f59cbaeb', 'Evening session, students may be tired from the day.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7dc8-9778-53b360889fc4', '4:00 PM', 'Evening session, students may be tired from the day.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a3a-84b0-1f16b176f5a4', '4:00 PM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-789c-95f4-f543aea247da', 'End of day session, students eager to finish.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7da8-b4cb-70247c1822cd', '5:00 PM', 'End of day session, students eager to finish.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a29-ac28-0f4e6f1e70b0', '5:00 PM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7784-b13b-beb8f523ed47', 'Deadline is at the end of the week. Ample time remains; stress is minimal.', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.877101+00:00', true, false, false, '019bb25e-e5f8-7d9a-8829-428958099860', 'End of week', 'Deadline is at the end of the week. Ample time remains; stress is minimal.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79fc-9115-b11bbbf2ee54', 'End of week', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7760-8c10-32ed822168ed', 'Deadline is in a couple of days. Some urgency, but stress is low.', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.877101+00:00', true, false, false, '019bb25e-e5f8-7d9e-ad3f-a6eb897d8839', 'Couple of days', 'Deadline is in a couple of days. Some urgency, but stress is low.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a3d-b6c6-a081909c0a5c', 'Couple of days', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-780b-88b6-5a239dc2a8ad', 'Deadline is tomorrow. Prompt help is needed; this is a moderate-stress situation.', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.877101+00:00', true, false, false, '019bb25e-e5f8-7da3-b9ff-9b182608b49b', 'Next day', 'Deadline is tomorrow. Prompt help is needed; this is a moderate-stress situation.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a09-8281-a27528d672ed', 'Next day', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-772c-b672-55746dc53d17', 'Deadline is in a few hours. Immediate help is required; this is a high-stress situation.', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.877101+00:00', true, false, false, '019bb25e-e5f8-7da6-bbe0-b96d4d72d25f', 'Few hours', 'Deadline is in a few hours. Immediate help is required; this is a high-stress situation.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a59-a437-be6020817dab', 'Few hours', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-777a-9ae6-376d10385faf', 'There is no specific deadline. The situation is relaxed and stress-free.', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.877101+00:00', true, false, false, '019bb25e-e5f8-7d96-a1d3-fd6bd8c776ba', 'No deadline', 'There is no specific deadline. The situation is relaxed and stress-free.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aeb-af19-0a5c60fae873', 'No deadline', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-08T14:16:28.317660+00:00', true, false, false, '019bb25e-e624-73da-8cef-166028a1065a', 'Purdue CS', 'Innovative base of knowledge in the emerging field of computing', '{}', '{019bb25e-e615-7952-a7d4-4fdee85d18cc}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7756-8c9c-b7147a76874a', 'An open, collaborative space in the Lawson building with high foot traffic.', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.014873+00:00', true, false, false, '019bb25e-e5f8-7d6a-b8a9-4b3d2d56e8ed', 'Lawson Computer Science Building', 'An open, collaborative space in the Lawson building with high foot traffic.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a41-86d8-f14c909f49ed', 'Lawson Computer Science Building', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77e2-858e-33ad3503b4c7', 'A specialized tech-focused lab environment in the basement of the Data Science/AI building.', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.014873+00:00', true, false, false, '019bb25e-e5f8-7d66-9e5a-6094e4b77a60', 'Data Science and Artificial Intelligence Building', 'A specialized tech-focused lab environment in the basement of the Data Science/AI building.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a84-ba34-8774e06e2d19', 'Data Science and Artificial Intelligence Building', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7864-89f5-5bc4289124ea', 'A quiet, focused study environment in the lower level of the HAAS building.', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.014873+00:00', true, false, false, '019bb25e-e5f8-7dcd-8f4e-a986b0a7ebba', 'Felix Haas Hall', 'A quiet, focused study environment in the lower level of the HAAS building.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ab0-80e7-306cf7cb8505', 'Felix Haas Hall', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-783f-977f-44945e77235e', 'Logic and proofs; sets, functions, relations, sequences and summations; number representations; counting; fundamentals of the analysis of algorithms; graphs and trees; proof techniques; recursion; Boolean logic; finite state machines; pushdown automata; computability and undecidability.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7cdd-b4b0-cf61647ab5ac', 'CS 182', 'Logic and proofs; sets, functions, relations, sequences and summations; number representations; counting; fundamentals of the analysis of algorithms; graphs and trees; proof techniques; recursion; Boolean logic; finite state machines; pushdown automata; computability and undecidability.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a6d-b2cf-d9fea99a0bc7', 'CS 182', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7831-80ca-7deae123a52d', 'Running time analysis of algorithms and their implementations, one-dimensional data structures, trees, heaps, additional sorting algorithms, binary search trees, hash tables, graphs, directed graphs, weighted graph algorithms, additional topics.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7cd8-b47c-ac2bddf4f495', 'CS 251', 'Running time analysis of algorithms and their implementations, one-dimensional data structures, trees, heaps, additional sorting algorithms, binary search trees, hash tables, graphs, directed graphs, weighted graph algorithms, additional topics.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a8b-a778-b94058138184', 'CS 251', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7897-b32c-6ed9a7e67cbf', 'Techniques for analyzing the time and space requirements of algorithms. Application of these techniques to sorting, searching, pattern-matching, graph problems, and other selected problems. Brief introduction to the intractable (NP-hard) problems.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7d22-9d6f-d0976eea78ec', 'CS 381', 'Techniques for analyzing the time and space requirements of algorithms. Application of these techniques to sorting, searching, pattern-matching, graph problems, and other selected problems. Brief introduction to the intractable (NP-hard) problems.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79ab-85b6-45f1a64011ac', 'CS 381', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7817-90b5-c73c3e0d51fa', 'Network protocols, socket programming, network security, distributed systems, and network performance analysis. Covers TCP/IP, HTTP, DNS, and other networking fundamentals.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7d26-b989-3212a42e6b6f', 'CS 422', 'Network protocols, socket programming, network security, distributed systems, and network performance analysis. Covers TCP/IP, HTTP, DNS, and other networking fundamentals.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a44-a324-9532c3d8c5e5', 'CS 422', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7898-b0e3-fb1a7194dd9d', 'Problem solving and algorithms, implementation of algorithms in a high level programming language, conditionals, the iterative approach and debugging, collections of data, searching and sorting, solving problems by decomposition, the object-oriented approach, subclasses of existing classes, handling exceptions that occur when the program is running, graphical user interfaces (GUIs), data stored in files, abstract data types, a glimpse at topics from other CS courses.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7ce3-a09b-4cf194441c1b', 'CS 180', 'Problem solving and algorithms, implementation of algorithms in a high level programming language, conditionals, the iterative approach and debugging, collections of data, searching and sorting, solving problems by decomposition, the object-oriented approach, subclasses of existing classes, handling exceptions that occur when the program is running, graphical user interfaces (GUIs), data stored in files, abstract data types, a glimpse at topics from other CS courses.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7af9-a0c5-b5aa37e26bc5', 'CS 180', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77cc-b961-4439f7e127c2', 'Introduction to machine learning algorithms, neural networks, feature engineering, model evaluation, and practical applications. Covers supervised and unsupervised learning techniques.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7d1e-8311-f9e7e06555e2', 'CS 373', 'Introduction to machine learning algorithms, neural networks, feature engineering, model evaluation, and practical applications. Covers supervised and unsupervised learning techniques.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a80-ac7f-f7aff45d47e8', 'CS 373', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77e9-8557-675f9ce6c035', 'Data Science', '2025-08-12T16:55:05.182021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T16:55:05.182021+00:00', true, false, false, '019bb25e-e5f8-7d2a-90de-10226a471e6b', 'CS 242', 'Data Science', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7af6-9188-727687af665c', 'CS 242', '2025-08-12T16:55:05.182021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-7450-8897-a72c55c26107', 'Purdue Chem', 'CHM', '{}', '{019bb25e-e615-7963-be87-7904de26729c}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-778e-82e0-2335bf0958e6', 'Organic Chemistry', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7cc6-a9a9-c51bbec49f96', 'CHM 225', 'Organic Chemistry', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ac0-bd4f-2fe3250a9b40', 'CHM 225', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-7461-ae69-85ba6cc54ae7', 'Statistics', 'STAT', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-781c-a73e-45f3f7343f61', 'Introduction to Statistics', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7c96-8991-7110c1e2616e', 'STAT 350', 'Introduction to Statistics', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79dc-ad33-1297278af887', 'STAT 350', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-745f-85ac-d4c79657d7e1', 'Physics', 'PHYS', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77fa-bcdd-7c385ca0d5c3', 'Solid State Physics', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7c9d-854d-91181fc32658', 'PHYS 545', 'Solid State Physics', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-798a-bded-d934bdb2a943', 'PHYS 545', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-773e-ae55-1a89c96a07d0', 'General Physics', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7ca3-ae71-235393296e6a', 'PHYS 220', 'General Physics', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a26-b607-a000a1d291db', 'PHYS 220', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77a6-9093-53f6102b5b0b', 'Modern Mechanics', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7ca7-a23c-03fe824b4e20', 'PHYS 172', 'Modern Mechanics', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79a0-8957-f9b7df6343b7', 'PHYS 172', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-744f-a6b0-21686815b719', 'Purdue Math', 'MA', '{}', '{019bb25e-e615-795d-bb66-8e09457dbcc6}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7771-a8dd-e2ef070285a0', 'Multivariate Calculus', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7cab-a50e-56f8f5be04bb', 'MA 261', 'Multivariate Calculus', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ab8-af3c-ce43ca26905c', 'MA 261', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7738-ba9b-eb1480a34e3d', 'Linear Algebra', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7caf-ae53-4390d8e77372', 'MA 265', 'Linear Algebra', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ab5-a648-9973452fc32f', 'MA 265', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77c3-a987-b764faa6a601', 'Linear Programming', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7cb0-a8f7-b733bdebb1ca', 'MA 421', 'Linear Programming', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79f1-ab55-5634609b0514', 'MA 421', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-7459-b42d-b7ee5595e1c7', 'Earth, Atmospheric, and Planetary Sciences', 'EAPS', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7740-a5da-120c2dc27932', 'Geography', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7cb7-8af7-29a33317c819', 'EAPS 120', 'Geography', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a8f-930d-cbd2bb4a3051', 'EAPS 120', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77a8-b41e-2ae32ca79fd3', 'Oceanography', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7cbb-ab67-3ccacb2df5aa', 'EAPS 104', 'Oceanography', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7af0-8d4d-debb35b8a1b5', 'EAPS 104', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77b6-9b6e-3d1b510f35a4', 'Geosciences in the Cinema', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7cbf-a83f-133510bc2166', 'EAPS 106', 'Geosciences in the Cinema', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a7c-8937-d193a893b3fc', 'EAPS 106', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7733-a67d-fa6b4b323ac2', 'Inorganic Chemistry', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7cc0-9040-b01aa544b670', 'CHM 342', 'Inorganic Chemistry', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79b4-a3fc-879b03735653', 'CHM 342', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77df-8bbe-62034aa13a97', 'Statistical Theory', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7c20-855d-7ccf9e162415', 'STAT 417', 'Statistical Theory', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a23-a4d2-9c54ddf31972', 'STAT 417', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7744-b8f1-3e99ed0577a9', 'General Chemistry', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7cc9-8987-b46dcfac9dcd', 'CHM 112', 'General Chemistry', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7b03-a703-43944e39f8fa', 'CHM 112', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-7455-a0f7-2248e8c5a63b', 'Biology', 'BIOL', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-778b-a7ef-38f17457e77d', 'Principles of Physiology', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7ccf-8161-efad11364f9b', 'BIOL 328', 'Principles of Physiology', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a97-b7f6-097da4c556e0', 'BIOL 328', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7878-998c-50d34535c1a5', 'Human Anatomy and Physiology', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7cd3-aade-bc9cfbbaef93', 'BIOL 204', 'Human Anatomy and Physiology', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a4f-a915-fa2e6de80be0', 'BIOL 204', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7842-b269-62e6f84aada2', 'Fundamentals of Biology', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7cd7-b8ca-96716f527321', 'BIOL 110', 'Fundamentals of Biology', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79b0-a7e7-4cc2f1a1c13b', 'BIOL 110', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-772a-a21c-ed2864a61dab', 'Probability', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7ce7-b68a-61e9a4e7308b', 'STAT 416', 'Probability', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ad8-8ea1-76c2b850f992', 'STAT 416', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7847-8d84-15299ad91f39', 'Physics-affiliated facilities.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d2f-b8bb-b6f7a0c2a1c4', 'Bindley Bioscience Center', 'Physics-affiliated facilities.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79bf-80e3-698615aa2b8e', 'Bindley Bioscience Center', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77a1-8877-ad6fc38c51c8', 'Physics research labs/quantum and nano.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d30-bcb8-46fcc520225a', 'Birck Nanotechnology Center', 'Physics research labs/quantum and nano.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a6a-8915-27f3b12180d9', 'Birck Nanotechnology Center', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77d5-b2d5-9010719334ac', 'Department address and offices.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d37-be12-589f245af871', 'Physics Building', 'Department address and offices.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7b12-884f-30b0c3bcfcff', 'Physics Building', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7795-a27d-59f9736d36a3', 'EAPS petrology facilities.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d3a-9658-532b7ac976cd', 'Brown Lab of Chemistry', 'EAPS petrology facilities.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79ce-adc7-f616ec85fd4d', 'Brown Lab of Chemistry', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d3d-8eee-efd2c83da86f', 'Neil Armstrong Hall of Engineering', 'EAPS petrology facilities.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aaf-8727-6e61c55f2320', 'Neil Armstrong Hall of Engineering', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7822-a250-8d2e033e1534', 'Main EAPS home.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d43-8b29-c328f173b660', 'Hampton Hall of Civil Engineering', 'Main EAPS home.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a74-a06a-1f95e0a672fe', 'Hampton Hall of Civil Engineering', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7807-863a-4c5876ab0157', 'NMR facility location (Chem resource).', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d45-9159-e9c511591ad8', 'Hansen Life Sciences', 'NMR facility location (Chem resource).', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a19-9fa2-e84486ff8d95', 'Hansen Life Sciences', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-775e-a657-5735185205a9', 'Departmental space.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d4a-8c27-a3231f31d512', 'Herbert C. Brown Laboratory of Chemistry', 'Departmental space.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a57-b7dd-0af8c925542f', 'Herbert C. Brown Laboratory of Chemistry', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d4d-a2be-5640bc74f115', 'Wetherill Laboratory of Chemistry', 'Departmental space.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79c6-9ddf-62c5296781ab', 'Wetherill Laboratory of Chemistry', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77e4-8ecf-2cf8f2a32a89', 'Life sciences research space used across BIO-related units.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d52-82ca-9a97f81a8690', 'Whistler Hall of Agricultural Research', 'Life sciences research space used across BIO-related units.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a93-bbfd-cee09a040f97', 'Whistler Hall of Agricultural Research', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-782c-a993-1006eabb02fd', 'Several BIO faculty offices and labs.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d56-b92a-5223bc06fd2c', 'Hansen Life Sciences Research Building', 'Several BIO faculty offices and labs.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79d4-be04-ad704c102d36', 'Hansen Life Sciences Research Building', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7858-ab9e-2deb22010b8a', 'Department main office and rooms.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d5b-954d-ff8fb5fc297c', 'Lilly Hall of Life Sciences', 'Department main office and rooms.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ad7-bd99-9bba162f204c', 'Lilly Hall of Life Sciences', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7792-ac86-c222f2d38fa4', 'Active learning spaces used by multiple departments for lectures and exams.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d5f-8670-f85c1a4ebf93', 'Wilmeth Active Learning Center', 'Active learning spaces used by multiple departments for lectures and exams.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7b0c-8a5b-45bfaa62f525', 'Wilmeth Active Learning Center', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-786b-a737-e5a738e7842d', 'Houses Math and Statistics departments. Shared teaching and office space.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d61-878f-223e4ac96b88', 'Mathematical Sciences Building', 'Houses Math and Statistics departments. Shared teaching and office space.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79cb-a6b6-14578088c63d', 'Mathematical Sciences Building', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7801-88f3-32f7a86e5c1d', 'A quiet, focused study environment in the lower level of the HAAS building. Used by multiple departments.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7e13-968e-8aad75ea70de', 'Felix Haas Hall', 'A quiet, focused study environment in the lower level of the HAAS building. Used by multiple departments.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-784b-9c58-1a4070f7f9d6', 'Process for students to request amendment of education records', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-02T23:06:38.169734+00:00', true, false, false, '019bb25e-e5f8-7cf0-8ebd-24767ba27236', 'Record Amendment Process', 'Process for students to request amendment of education records', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a9e-9a91-39e32cab5a55', 'Record Amendment Process', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7725-a5ea-341a3fea5b91', 'Rights students have to access their education records', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-02T23:06:38.169734+00:00', true, false, false, '019bb25e-e5f8-7cf7-9bf8-831afbf7b736', 'Student Access Rights', 'Rights students have to access their education records', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a48-823c-f141c3e84738', 'Student Access Rights', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7892-b96b-cb1e259a1f52', 'Understanding what constitutes education records and exceptions under FERPA', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-02T23:06:38.169734+00:00', true, false, false, '019bb25e-e5f8-7cfa-ab87-8b2a98bf6d9f', 'Education Records & Exceptions', 'Understanding what constitutes education records and exceptions under FERPA', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-799b-a4ba-65d06135cd83', 'Education Records & Exceptions', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77f3-ba07-66ac3926e5f8', 'Annual notification requirements for FERPA rights', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-02T23:06:38.169734+00:00', true, false, false, '019bb25e-e5f8-7ce8-825f-6d1d8ddcc6b9', 'Annual FERPA Rights Notification', 'Annual notification requirements for FERPA rights', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7afe-88e0-c6d1ec1b3245', 'Annual FERPA Rights Notification', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-784f-bccc-d6e92c15dcee', 'Understanding when consent is required vs. when disclosure is allowed without consent', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-02T23:06:38.169734+00:00', true, false, false, '019bb25e-e5f8-7cee-88ca-ae96d7297994', 'Consent vs. No-Consent Disclosures', 'Understanding when consent is required vs. when disclosure is allowed without consent', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aee-9f2b-74ff78ff910e', 'Consent vs. No-Consent Disclosures', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a15f-7e98-a94e-e505e4e33d48', '019bb25e-e620-7f9a-a3b6-8b7230c1e51c', '2025-12-08T22:19:28.206394+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7871-a4d4-2fe99f06dbb1', 'Short assessments, pop quizzes', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d13-a0e2-aa266d021fe8', 'quiz', 'Short assessments, pop quizzes', NULL, '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a64-844e-a726af0df5f2', 'quiz', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77b1-a736-a4fa7cf58772', 'Large assignments, final projects, group work', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d16-abec-e5e3db9386e2', 'project', 'Large assignments, final projects, group work', NULL, '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a5c-8370-4e4189c5e753', 'project', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7769-99a5-918878f4360f', 'Assignments, problem sets, exercises', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d1b-b0a6-aa800efb90bf', 'homework', 'Assignments, problem sets, exercises', NULL, '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a01-9d0c-bc5e2812ace2', 'homework', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77ee-9e5c-ac7ca864887f', 'Midterm exams, major tests', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d0d-9207-6520a302d236', 'midterm', 'Midterm exams, major tests', NULL, '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a63-ad61-acc2b699ef97', 'midterm', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77be-8236-aac2bd87e940', 'Laboratory exercises, practical work', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d08-946a-bd2457820f28', 'lab', 'Laboratory exercises, practical work', NULL, '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a9b-8b12-5b1c1867c599', 'lab', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7718-8206-04ebc4582b58', 'Lecture notes, slides, presentations', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d04-88c8-70ce34ceeea8', 'lecture', 'Lecture notes, slides, presentations', NULL, '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a30-91d3-4d826b7ef08e', 'lecture', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7720-9ce6-38f7a5bb2081', 'Course syllabus, course outline', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d00-a623-09370b0a5ba8', 'syllabus', 'Course syllabus, course outline', NULL, '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79e7-8c99-ce85b1a8882b', 'syllabus', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7251-b0bc-33dbff8e66a0', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', '2025-12-08T22:19:28.206394+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7751-87fd-edc2107801de', 'Policy documents, guidelines, and regulations', '2025-12-04T13:22:00.014150+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-04T13:22:00.014150+00:00', true, false, false, '019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b', 'policy', 'Policy documents, guidelines, and regulations', NULL, '{}', '{019c04f5-a160-7251-b0bc-33dbff8e66a0}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79ef-b5c4-96edebab8aa9', 'policy', '2025-12-04T13:22:00.014150+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7824-934b-d5d470e870b0', 'Provides uplifting feedback and cheerful responses', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7dda-b5c5-45f0ba4336bd', 'happy', 'Provides uplifting feedback and cheerful responses', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79ba-83a0-1ff98bd0964d', 'happy', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7268-b1ec-814bf8d45478', '019bb25e-e621-702e-a7ba-81fd751a9c61', '2025-12-12T13:26:55.660542+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7813-91de-e75f877117dc', 'Personas with emotional temperaments (aggressive, passive, confused, happy)', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7dd6-b648-490037cad081', 'Emotion', 'Personas with emotional temperaments (aggressive, passive, confused, happy)', NULL, '{}', '{019c04f5-a160-7268-b1ec-814bf8d45478}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79e8-8107-f2a74eb4c228', 'Emotion', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7275-905c-ccfbcdd8a5d5', '019bb25e-e621-7030-880f-77ce9fc3a6fd', '2025-12-12T13:26:55.660542+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7828-84ab-f486eaaf5bee', 'Personas with neutral roles (Student, Professor, Instructional Staff)', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7dd0-b701-64d18af393d9', 'Neutral', 'Personas with neutral roles (Student, Professor, Instructional Staff)', NULL, '{}', '{019c04f5-a160-7275-905c-ccfbcdd8a5d5}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aca-b3bf-1350cd583648', 'Neutral', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7836-a6e1-2a7c0c7761b7', 'Low engagement and tendency to avoid conflict or assertiveness', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7de3-be92-08efc9770684', 'passive', 'Low engagement and tendency to avoid conflict or assertiveness', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7b0a-8349-1bc84b5ae7ab', 'passive', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7282-9dab-63dd6aebee75', '019bb25e-e621-7037-bc24-32292586d2d2', '2025-12-13T18:43:03.008799+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7850-98fe-e35f43a79d40', 'Pushes back on ideas and challenges assumptions', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7de4-b089-ca19b4ced746', 'aggressive', 'Pushes back on ideas and challenges assumptions', NULL, '{}', '{019c04f5-a160-7282-9dab-63dd6aebee75}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79e3-bafc-ab1273c5799b', 'aggressive', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-779e-af8a-7bf39fc55442', 'Represents teaching assistants and instructional support staff', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7e19-848b-6a558d93d931', 'Instructional Staff', 'Represents teaching assistants and instructional support staff', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e99-783a-be61-470f68be3981', 'Instructional Staff', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77af-8ca4-0d1ba0a421e4', 'Represents a faculty member perspective', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7e15-a5dc-909687146e61', 'Professor', 'Represents a faculty member perspective', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e99-785d-90b3-859b0847de01', 'Professor', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7863-af2b-c63e7a8aac62', 'Seeks to understand by asking questions and exploring ideas', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9a-77a8-a9dd-5f5f56922e12', 'Seeks to understand by asking questions and exploring ideas', '2025-08-12T12:52:09.801431+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7ddd-907f-b62487ee2e2f', 'confused', 'Seeks to understand by asking questions and exploring ideas', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a7b-b784-012c9077004a', 'confused', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77c4-8695-c65b225ab8fb', 'Represents a typical student perspective', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7e1f-a573-7804151ff56d', 'Student', 'Represents a typical student perspective', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e99-7840-a4ac-852e6bcecfaf', 'Student', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifacts
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f73-bd02-1d3c49cbde07', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f3a-b5e7-7bae81d29469', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f40-ad08-ef781e786c0c', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f4b-a34e-52a93bc45d62', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f51-bdd6-846d84426500', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f5c-a207-f0102d63bbf4', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f67-a232-c5bebdfe5d83', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f6d-8702-a849bcc6241a', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f81-980c-cff2da3f3e6b', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f78-b716-00ec568debaf', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.872240+00:00', '2025-08-12T12:52:09.872240+00:00', '019b3be4-3255-7fa7-b257-52e79bf08459', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.872240+00:00', '2025-08-12T12:52:09.872240+00:00', '019b3be4-3255-7fac-86b9-909c3a6281ee', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.872240+00:00', '2025-08-12T12:52:09.872240+00:00', '019b3be4-3255-7fb6-963f-3581cfe5da84', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.872240+00:00', '2025-08-12T12:52:09.872240+00:00', '019b3be4-3255-7fbc-ac49-a405a72c4e7a', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.872240+00:00', '2025-08-12T12:52:09.872240+00:00', '019b3be4-3255-7fc3-b56b-ac521ae02aa0', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.872240+00:00', '2025-08-12T12:52:09.872240+00:00', '019b3be4-3255-7fca-9975-2a79d2177b6d', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.872240+00:00', '2025-08-12T12:52:09.872240+00:00', '019b3be4-3255-7f8b-a79c-ce7fedf50d0e', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.872240+00:00', '2025-08-12T12:52:09.872240+00:00', '019b3be4-3255-7f90-a069-928b5b6d5cba', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.872240+00:00', '2025-08-12T12:52:09.872240+00:00', '019b3be4-3255-7f9b-9557-8f5520e3978f', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.872240+00:00', '2025-08-12T12:52:09.872240+00:00', '019b3be4-3255-7f9c-875c-b4b0ad69bda3', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.874255+00:00', '2025-08-12T12:52:09.874255+00:00', '019b3be4-3255-7af2-b793-68999c0a3361', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.874255+00:00', '2025-08-12T12:52:09.874255+00:00', '019b3be4-3255-7aea-b6eb-977ad3b5a476', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.874255+00:00', '2025-08-12T12:52:09.874255+00:00', '019b3be4-3255-7ae1-bcfe-2fcc7b6fb034', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.874255+00:00', '2025-08-12T12:52:09.874255+00:00', '019b3be4-3255-7ada-becf-3e121925651f', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.874255+00:00', '2025-08-12T12:52:09.874255+00:00', '019b3be4-3255-7ad0-a4ca-f1824fe493a3', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.874255+00:00', '2025-08-12T12:52:09.874255+00:00', '019b3be4-3255-7ac5-b120-1a6f682010bf', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.874255+00:00', '2025-08-12T12:52:09.874255+00:00', '019b3be4-3255-7abb-b6e6-2e9c608895ec', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.874255+00:00', '2025-08-12T12:52:09.874255+00:00', '019b3be4-3255-775b-a3d9-c98dd98bb438', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.874255+00:00', '2025-08-12T12:52:09.874255+00:00', '019b3be4-3255-7af8-9a1c-3737e0e45bad', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.877101+00:00', '2025-08-12T12:52:09.877101+00:00', '019b3be4-3255-7b14-aa50-f3909de0706a', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.877101+00:00', '2025-08-12T12:52:09.877101+00:00', '019b3be4-3255-7b0d-a2dd-3bfa70e86acf', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.877101+00:00', '2025-08-12T12:52:09.877101+00:00', '019b3be4-3255-7b04-8a07-7cbe3c6de0fc', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.877101+00:00', '2025-08-12T12:52:09.877101+00:00', '019b3be4-3255-7afc-85a8-e40f75ff26c0', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.877101+00:00', '2025-08-12T12:52:09.877101+00:00', '019b3be4-3255-7b1c-bbf5-d279d27d6e51', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.014873+00:00', '2025-08-12T12:52:10.014873+00:00', '019b3be4-3255-7d66-a6f8-b5416e286a74', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.014873+00:00', '2025-08-12T12:52:10.014873+00:00', '019b3be4-3255-7d7b-a2d4-6c5f8599c654', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.014873+00:00', '2025-08-12T12:52:10.014873+00:00', '019b3be4-3255-7d73-8bb1-704b59eacfc7', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.017187+00:00', '2025-08-12T12:52:10.017187+00:00', '019b3be4-3255-7d99-95a0-da8a9a4bb732', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.017187+00:00', '2025-08-12T12:52:10.017187+00:00', '019b3be4-3255-7da1-9077-471170325d94', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.017187+00:00', '2025-08-12T12:52:10.017187+00:00', '019b3be4-3255-7da8-8b3a-21da5b688b2f', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.017187+00:00', '2025-08-12T12:52:10.017187+00:00', '019b3be4-3255-7d8a-b815-e06bfaa49b28', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.017187+00:00', '2025-08-12T12:52:10.017187+00:00', '019b3be4-3255-7d92-9059-28f13f3c27dd', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.017187+00:00', '2025-08-12T12:52:10.017187+00:00', '019b3be4-3255-7db2-893f-520fa192c854', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T16:55:05.182021+00:00', '2025-08-12T16:55:05.182021+00:00', '019b3be4-3255-7d81-b075-f82e6f14c409', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e1d-9bb6-0e552dd6783f', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e98-a92a-a72248c7e777', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e97-bde6-ecfedf41dea6', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e8d-95e4-213a2f70d364', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e85-913c-474e76513957', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e6b-b338-baae0376465a', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e60-93cd-b35219856111', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e5b-9616-231688fa5b3b', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e53-8250-c590534edfb2', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e4a-a481-e13bfbb551ca', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e47-a9c8-80c17ff87443', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e27-bb22-a6c01a8a25b8', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7eb3-8147-49612a90363c', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e16-892b-1f67dc9c7f44', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7df6-81b6-16014ab3b7f5', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7def-8a45-9fd15d9058ae', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7de5-9d1a-bcf18335f6ea', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7ea5-ad68-76569dd59032', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e7f-b225-9d8fc2942156', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e77-b785-292537588e91', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e73-bfa4-487dc0af3d69', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e3c-8102-57a723e6115d', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e37-8fd3-2b7166d8a777', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e2c-bfc9-50a8ce8e9107', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e10-998c-64c3ceb243c6', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e08-9a41-393e311c8598', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e00-9b1f-bc466c42baf6', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7ddf-97a7-027cc68ed040', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7dd6-8ed3-69b60058e549', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7dcd-bce7-254f82463873', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7dca-988f-7082cce11759', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7dc0-9ca5-bc85d7ee897f', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7db8-997f-48d99d18f382', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T23:06:38.169734+00:00', '2025-12-02T23:06:38.169734+00:00', '019b3be4-3255-7ec8-a739-8edccd5a6915', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T23:06:38.169734+00:00', '2025-12-02T23:06:38.169734+00:00', '019b3be4-3255-7ec1-9d9b-654ea70cca34', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T23:06:38.169734+00:00', '2025-12-02T23:06:38.169734+00:00', '019b3be4-3255-7eb8-aa10-9d53e18ba183', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T23:06:38.169734+00:00', '2025-12-02T23:06:38.169734+00:00', '019b3be4-3255-7ed6-b953-cc0f5a8973d6', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T23:06:38.169734+00:00', '2025-12-02T23:06:38.169734+00:00', '019b3be4-3255-7ed3-91d9-f6b1e35cf709', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-03T13:30:24.007753+00:00', '2025-12-03T13:30:24.007753+00:00', '019b3be4-3255-7f0d-82d4-4784be4819f4', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-03T13:30:24.007753+00:00', '2025-12-03T13:30:24.007753+00:00', '019b3be4-3255-7ee4-85b7-3d4118e9b1cb', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-03T13:30:24.007753+00:00', '2025-12-03T13:30:24.007753+00:00', '019b3be4-3255-7edf-ab02-fb72268d6fa5', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-03T13:30:24.007753+00:00', '2025-12-03T13:30:24.007753+00:00', '019b3be4-3255-7f15-b619-230821058fd2', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-03T13:30:24.007753+00:00', '2025-12-03T13:30:24.007753+00:00', '019b3be4-3255-7f1f-8666-8862eca11ff7', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-03T13:30:24.007753+00:00', '2025-12-03T13:30:24.007753+00:00', '019b3be4-3255-7f24-8b25-90c48379e5ff', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-03T13:30:24.007753+00:00', '2025-12-03T13:30:24.007753+00:00', '019b3be4-3255-7f2e-869a-dfbd35f14e3a', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-04T13:22:00.014150+00:00', '2025-12-04T13:22:00.014150+00:00', '019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-3255-7ff4-bdda-ee6747f17f98', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-3255-7fd0-bc67-fb69f3292a88', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-3255-7fd9-ae49-680e884c7d5f', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-3255-7fe8-a834-22c625c91dd4', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-3256-700c-8e71-a99bb835385c', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-3256-700a-bef3-9c1c89344f4e', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-3255-7fef-ba99-524dd2c6e9bd', false, false) ON CONFLICT (id) DO NOTHING;
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-3256-7002-8465-fd30eac11b96', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f73-bd02-1d3c49cbde07', '019b995c-8e9e-7877-84a1-74dbf105b693', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f73-bd02-1d3c49cbde07', '019bb25e-e5f8-7d74-9400-96485f9608ae', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f73-bd02-1d3c49cbde07', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f73-bd02-1d3c49cbde07', '019b995c-8e9b-7aa9-89ba-87e78ab26a48', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f3a-b5e7-7bae81d29469', '019b995c-8e9e-77b8-b5df-a49652d587e1', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f3a-b5e7-7bae81d29469', '019bb25e-e5f8-7d92-a3bf-60eae43b4e2f', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f3a-b5e7-7bae81d29469', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f3a-b5e7-7bae81d29469', '019b995c-8e9b-79d1-9498-15e96fd9248b', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f40-ad08-ef781e786c0c', '019b995c-8e9e-77db-95f2-a4e9e7265978', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f40-ad08-ef781e786c0c', '019bb25e-e5f8-7d8e-98e2-39c536d21210', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f40-ad08-ef781e786c0c', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f40-ad08-ef781e786c0c', '019b995c-8e9b-7acd-9a63-709d43364162', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f4b-a34e-52a93bc45d62', '019b995c-8e9e-785e-b347-eac70c95272f', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f4b-a34e-52a93bc45d62', '019bb25e-e5f8-7d8b-9d8a-f467c26a681d', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f4b-a34e-52a93bc45d62', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f4b-a34e-52a93bc45d62', '019b995c-8e9b-799e-a15e-2e42d1fc4f37', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f51-bdd6-846d84426500', '019b995c-8e9e-77ca-98f7-468911790298', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f51-bdd6-846d84426500', '019bb25e-e5f8-7d87-a4b1-bcd3fc820916', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f51-bdd6-846d84426500', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f51-bdd6-846d84426500', '019b995c-8e9b-79a4-a0b5-14d7c295394b', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f5c-a207-f0102d63bbf4', '019b995c-8e9e-776f-a2e9-4546257bffb1', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f5c-a207-f0102d63bbf4', '019bb25e-e5f8-7d82-98f3-a088341077c2', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f5c-a207-f0102d63bbf4', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f5c-a207-f0102d63bbf4', '019b995c-8e9b-7997-8741-065552fa0d5e', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f67-a232-c5bebdfe5d83', '019b995c-8e9e-7855-ae28-f440d1562d90', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f67-a232-c5bebdfe5d83', '019bb25e-e5f8-7d7c-b9e1-01ded9af627f', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f67-a232-c5bebdfe5d83', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f67-a232-c5bebdfe5d83', '019b995c-8e9b-7abc-9401-b7c4f982b20d', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f6d-8702-a849bcc6241a', '019b995c-8e9e-780c-89d2-52965872892b', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f6d-8702-a849bcc6241a', '019bb25e-e5f8-7d78-a23f-f4249502a96f', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f6d-8702-a849bcc6241a', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f6d-8702-a849bcc6241a', '019b995c-8e9b-7a1f-a909-bffe91e9ee0e', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f81-980c-cff2da3f3e6b', '019b995c-8e9e-7780-b5ef-5ed31b2cc8d3', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f81-980c-cff2da3f3e6b', '019bb25e-e5f8-7d6d-8546-2d286f9becbe', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f81-980c-cff2da3f3e6b', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f81-980c-cff2da3f3e6b', '019b995c-8e9b-7a70-9f2e-9ae666250cbb', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f78-b716-00ec568debaf', '019b995c-8e9e-777c-bc59-c775178b9bc3', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f78-b716-00ec568debaf', '019bb25e-e5f8-7d72-9424-f3298926911a', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f78-b716-00ec568debaf', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f78-b716-00ec568debaf', '019b995c-8e9b-7aa7-8b7e-13f1d498edae', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fa7-b257-52e79bf08459', '019b995c-8e9e-774e-9a55-f7b572d7c6b3', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fa7-b257-52e79bf08459', '019bb25e-e5f8-7dfe-80eb-f1a07c2d4f85', true, '2025-08-12T12:52:09.872240+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fa7-b257-52e79bf08459', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fa7-b257-52e79bf08459', '019b995c-8e9b-79c0-b5d1-e627b54c1cfa', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fac-86b9-909c3a6281ee', '019b995c-8e9e-787e-81a1-8dd6654ab8f0', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fac-86b9-909c3a6281ee', '019bb25e-e5f8-7df8-9280-e8be30cd3a0e', true, '2025-08-12T12:52:09.872240+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fac-86b9-909c3a6281ee', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fac-86b9-909c3a6281ee', '019b995c-8e9b-7ae1-8a3d-7f5402285107', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fb6-963f-3581cfe5da84', '019b995c-8e9e-7764-87e7-3fdbf634553d', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fb6-963f-3581cfe5da84', '019bb25e-e5f8-7df7-886f-39fc7dd8ddeb', true, '2025-08-12T12:52:09.872240+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fb6-963f-3581cfe5da84', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fb6-963f-3581cfe5da84', '019b995c-8e9b-7a35-9785-75fa053043c8', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fbc-ac49-a405a72c4e7a', '019b995c-8e9e-7818-b97e-0438815b829d', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fbc-ac49-a405a72c4e7a', '019bb25e-e5f8-7df1-9a0e-6a65a69e75d5', true, '2025-08-12T12:52:09.872240+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fbc-ac49-a405a72c4e7a', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fbc-ac49-a405a72c4e7a', '019b995c-8e9b-7ac7-bed0-dfbc96b3109f', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fc3-b56b-ac521ae02aa0', '019b995c-8e9e-783b-9ecd-9cf65e33a5d4', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fc3-b56b-ac521ae02aa0', '019bb25e-e5f8-7def-b7a9-f587cd3075d0', true, '2025-08-12T12:52:09.872240+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fc3-b56b-ac521ae02aa0', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fc3-b56b-ac521ae02aa0', '019b995c-8e9b-79fa-95ca-fe7636527041', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fca-9975-2a79d2177b6d', '019b995c-8e9e-786e-8f9a-3157f91f6f6a', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fca-9975-2a79d2177b6d', '019bb25e-e5f8-7dea-be6e-3ba417f090e5', true, '2025-08-12T12:52:09.872240+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fca-9975-2a79d2177b6d', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fca-9975-2a79d2177b6d', '019b995c-8e9b-79f5-ad1d-cbb93513e941', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f8b-a79c-ce7fedf50d0e', '019b995c-8e9e-7775-808c-a787ba16adc5', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f8b-a79c-ce7fedf50d0e', '019bb25e-e5f8-7e0f-939f-41d5799c4bb3', true, '2025-08-12T12:52:09.872240+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f8b-a79c-ce7fedf50d0e', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f8b-a79c-ce7fedf50d0e', '019b995c-8e9b-7991-8a26-cf3a2c4c3da2', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f90-a069-928b5b6d5cba', '019b995c-8e9e-77d3-b806-df2a5814fb89', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f90-a069-928b5b6d5cba', '019bb25e-e5f8-7e09-9ae0-23cdc02687d3', true, '2025-08-12T12:52:09.872240+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f90-a069-928b5b6d5cba', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f90-a069-928b5b6d5cba', '019b995c-8e9b-7a2c-8035-db756960c474', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f9b-9557-8f5520e3978f', '019b995c-8e9e-7887-9045-548c8ad0467f', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f9b-9557-8f5520e3978f', '019bb25e-e5f8-7e05-8724-d06378756d1d', true, '2025-08-12T12:52:09.872240+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f9b-9557-8f5520e3978f', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f9b-9557-8f5520e3978f', '019b995c-8e9b-7b04-9d48-8dc3535728b3', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f9c-875c-b4b0ad69bda3', '019b995c-8e9e-7758-bc8c-23b0a29c5c31', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f9c-875c-b4b0ad69bda3', '019bb25e-e5f8-7e01-90e4-9a8120acb076', true, '2025-08-12T12:52:09.872240+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f9c-875c-b4b0ad69bda3', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f9c-875c-b4b0ad69bda3', '019b995c-8e9b-7adc-8a9d-54bb2caaebd6', '2025-08-12T12:52:09.872240+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7af2-b793-68999c0a3361', '019b995c-8e9e-77fc-a3fc-7e989fdc1b5e', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7af2-b793-68999c0a3361', '019bb25e-e5f8-7dad-ad24-8aef6b327a68', true, '2025-08-12T12:52:09.874255+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7af2-b793-68999c0a3361', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7af2-b793-68999c0a3361', '019b995c-8e9b-7a05-9fd8-f8cf82c34299', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7aea-b6eb-977ad3b5a476', '019b995c-8e9e-7799-800a-f6ce13dea644', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7aea-b6eb-977ad3b5a476', '019bb25e-e5f8-7db1-9803-293380427820', true, '2025-08-12T12:52:09.874255+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7aea-b6eb-977ad3b5a476', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7aea-b6eb-977ad3b5a476', '019b995c-8e9b-7a11-be61-7a4373d7d15f', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ae1-bcfe-2fcc7b6fb034', '019b995c-8e9e-77f6-88c5-d2d6dcd53e89', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ae1-bcfe-2fcc7b6fb034', '019bb25e-e5f8-7db6-846c-6ae8e0b2fd91', true, '2025-08-12T12:52:09.874255+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ae1-bcfe-2fcc7b6fb034', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ae1-bcfe-2fcc7b6fb034', '019b995c-8e9b-7ad0-b2aa-92151d237272', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ada-becf-3e121925651f', '019b995c-8e9e-7880-b22a-6ff7f983a8e7', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ada-becf-3e121925651f', '019bb25e-e5f8-7db9-8a23-d98360e7fca0', true, '2025-08-12T12:52:09.874255+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ada-becf-3e121925651f', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ada-becf-3e121925651f', '019b995c-8e9b-79da-8590-0b5748db19e4', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ad0-a4ca-f1824fe493a3', '019b995c-8e9e-7734-9651-8e74f8656d10', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ad0-a4ca-f1824fe493a3', '019bb25e-e5f8-7dbe-843e-5cc6e2bb7241', true, '2025-08-12T12:52:09.874255+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ad0-a4ca-f1824fe493a3', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ad0-a4ca-f1824fe493a3', '019b995c-8e9b-7aa1-8385-1cf9f5d35c27', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ac5-b120-1a6f682010bf', '019b995c-8e9e-788d-b750-82065bafaab1', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ac5-b120-1a6f682010bf', '019bb25e-e5f8-7dc3-a9bb-2de7e73428a2', true, '2025-08-12T12:52:09.874255+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ac5-b120-1a6f682010bf', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ac5-b120-1a6f682010bf', '019b995c-8e9b-7ae6-9b15-b237bca2e2bc', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7abb-b6e6-2e9c608895ec', '019b995c-8e9e-788a-87aa-27b4250bd2d7', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7abb-b6e6-2e9c608895ec', '019bb25e-e5f8-7dc6-aac8-1aec8f456e02', true, '2025-08-12T12:52:09.874255+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7abb-b6e6-2e9c608895ec', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7abb-b6e6-2e9c608895ec', '019b995c-8e9b-7a0f-a19f-cba50e52b7f7', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-775b-a3d9-c98dd98bb438', '019b995c-8e9e-774b-8d70-a9c4f59cbaeb', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-775b-a3d9-c98dd98bb438', '019bb25e-e5f8-7dc8-9778-53b360889fc4', true, '2025-08-12T12:52:09.874255+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-775b-a3d9-c98dd98bb438', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-775b-a3d9-c98dd98bb438', '019b995c-8e9b-7a3a-84b0-1f16b176f5a4', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7af8-9a1c-3737e0e45bad', '019b995c-8e9e-789c-95f4-f543aea247da', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7af8-9a1c-3737e0e45bad', '019bb25e-e5f8-7da8-b4cb-70247c1822cd', true, '2025-08-12T12:52:09.874255+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7af8-9a1c-3737e0e45bad', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7af8-9a1c-3737e0e45bad', '019b995c-8e9b-7a29-ac28-0f4e6f1e70b0', '2025-08-12T12:52:09.874255+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b14-aa50-f3909de0706a', '019b995c-8e9e-7784-b13b-beb8f523ed47', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7b14-aa50-f3909de0706a', '019bb25e-e5f8-7d9a-8829-428958099860', true, '2025-08-12T12:52:09.877101+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b14-aa50-f3909de0706a', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b14-aa50-f3909de0706a', '019b995c-8e9b-79fc-9115-b11bbbf2ee54', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b0d-a2dd-3bfa70e86acf', '019b995c-8e9e-7760-8c10-32ed822168ed', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7b0d-a2dd-3bfa70e86acf', '019bb25e-e5f8-7d9e-ad3f-a6eb897d8839', true, '2025-08-12T12:52:09.877101+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b0d-a2dd-3bfa70e86acf', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b0d-a2dd-3bfa70e86acf', '019b995c-8e9b-7a3d-b6c6-a081909c0a5c', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b04-8a07-7cbe3c6de0fc', '019b995c-8e9e-780b-88b6-5a239dc2a8ad', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7b04-8a07-7cbe3c6de0fc', '019bb25e-e5f8-7da3-b9ff-9b182608b49b', true, '2025-08-12T12:52:09.877101+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b04-8a07-7cbe3c6de0fc', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b04-8a07-7cbe3c6de0fc', '019b995c-8e9b-7a09-8281-a27528d672ed', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7afc-85a8-e40f75ff26c0', '019b995c-8e9e-772c-b672-55746dc53d17', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7afc-85a8-e40f75ff26c0', '019bb25e-e5f8-7da6-bbe0-b96d4d72d25f', true, '2025-08-12T12:52:09.877101+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7afc-85a8-e40f75ff26c0', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7afc-85a8-e40f75ff26c0', '019b995c-8e9b-7a59-a437-be6020817dab', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b1c-bbf5-d279d27d6e51', '019b995c-8e9e-777a-9ae6-376d10385faf', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7b1c-bbf5-d279d27d6e51', '019bb25e-e5f8-7d96-a1d3-fd6bd8c776ba', true, '2025-08-12T12:52:09.877101+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b1c-bbf5-d279d27d6e51', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b1c-bbf5-d279d27d6e51', '019b995c-8e9b-7aeb-af19-0a5c60fae873', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7d66-a6f8-b5416e286a74', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d66-a6f8-b5416e286a74', '019b995c-8e9e-7756-8c9c-b7147a76874a', '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d66-a6f8-b5416e286a74', '019bb25e-e5f8-7d6a-b8a9-4b3d2d56e8ed', true, '2025-08-12T12:52:10.014873+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d66-a6f8-b5416e286a74', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d66-a6f8-b5416e286a74', '019b995c-8e9b-7a41-86d8-f14c909f49ed', '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7d7b-a2d4-6c5f8599c654', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d7b-a2d4-6c5f8599c654', '019b995c-8e9e-77e2-858e-33ad3503b4c7', '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d7b-a2d4-6c5f8599c654', '019bb25e-e5f8-7d66-9e5a-6094e4b77a60', true, '2025-08-12T12:52:10.014873+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d7b-a2d4-6c5f8599c654', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d7b-a2d4-6c5f8599c654', '019b995c-8e9b-7a84-ba34-8774e06e2d19', '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7d73-8bb1-704b59eacfc7', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d73-8bb1-704b59eacfc7', '019b995c-8e9e-7864-89f5-5bc4289124ea', '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d73-8bb1-704b59eacfc7', '019bb25e-e5f8-7dcd-8f4e-a986b0a7ebba', true, '2025-08-12T12:52:10.014873+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d73-8bb1-704b59eacfc7', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d73-8bb1-704b59eacfc7', '019b995c-8e9b-7ab0-80e7-306cf7cb8505', '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7d99-95a0-da8a9a4bb732', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d99-95a0-da8a9a4bb732', '019b995c-8e9e-783f-977f-44945e77235e', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d99-95a0-da8a9a4bb732', '019bb25e-e5f8-7cdd-b4b0-cf61647ab5ac', true, '2025-08-12T12:52:10.017187+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d99-95a0-da8a9a4bb732', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d99-95a0-da8a9a4bb732', '019b995c-8e9b-7a6d-b2cf-d9fea99a0bc7', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
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
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7da8-8b3a-21da5b688b2f', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7da8-8b3a-21da5b688b2f', '019b995c-8e9e-7897-b32c-6ed9a7e67cbf', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7da8-8b3a-21da5b688b2f', '019bb25e-e5f8-7d22-9d6f-d0976eea78ec', true, '2025-08-12T12:52:10.017187+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7da8-8b3a-21da5b688b2f', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7da8-8b3a-21da5b688b2f', '019b995c-8e9b-79ab-85b6-45f1a64011ac', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7d8a-b815-e06bfaa49b28', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d8a-b815-e06bfaa49b28', '019b995c-8e9e-7817-90b5-c73c3e0d51fa', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d8a-b815-e06bfaa49b28', '019bb25e-e5f8-7d26-b989-3212a42e6b6f', true, '2025-08-12T12:52:10.017187+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d8a-b815-e06bfaa49b28', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d8a-b815-e06bfaa49b28', '019b995c-8e9b-7a44-a324-9532c3d8c5e5', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7d92-9059-28f13f3c27dd', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d92-9059-28f13f3c27dd', '019b995c-8e9e-7898-b0e3-fb1a7194dd9d', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d92-9059-28f13f3c27dd', '019bb25e-e5f8-7ce3-a09b-4cf194441c1b', true, '2025-08-12T12:52:10.017187+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d92-9059-28f13f3c27dd', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d92-9059-28f13f3c27dd', '019b995c-8e9b-7af9-a0c5-b5aa37e26bc5', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7db2-893f-520fa192c854', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7db2-893f-520fa192c854', '019b995c-8e9e-77cc-b961-4439f7e127c2', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7db2-893f-520fa192c854', '019bb25e-e5f8-7d1e-8311-f9e7e06555e2', true, '2025-08-12T12:52:10.017187+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7db2-893f-520fa192c854', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7db2-893f-520fa192c854', '019b995c-8e9b-7a80-ac7f-f7aff45d47e8', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7d81-b075-f82e6f14c409', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d81-b075-f82e6f14c409', '019b995c-8e9e-77e9-8557-675f9ce6c035', '2025-08-12T16:55:05.182021+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d81-b075-f82e6f14c409', '019bb25e-e5f8-7d2a-90de-10226a471e6b', true, '2025-08-12T16:55:05.182021+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d81-b075-f82e6f14c409', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T16:55:05.182021+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d81-b075-f82e6f14c409', '019b995c-8e9b-7af6-9188-727687af665c', '2025-08-12T16:55:05.182021+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7450-8897-a72c55c26107', '019b3be4-3255-7e1d-9bb6-0e552dd6783f', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e1d-9bb6-0e552dd6783f', '019b995c-8e9e-778e-82e0-2335bf0958e6', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e1d-9bb6-0e552dd6783f', '019bb25e-e5f8-7cc6-a9a9-c51bbec49f96', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e1d-9bb6-0e552dd6783f', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e1d-9bb6-0e552dd6783f', '019b995c-8e9b-7ac0-bd4f-2fe3250a9b40', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7461-ae69-85ba6cc54ae7', '019b3be4-3255-7e98-a92a-a72248c7e777', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e98-a92a-a72248c7e777', '019b995c-8e9e-781c-a73e-45f3f7343f61', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e98-a92a-a72248c7e777', '019bb25e-e5f8-7c96-8991-7110c1e2616e', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e98-a92a-a72248c7e777', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e98-a92a-a72248c7e777', '019b995c-8e9b-79dc-ad33-1297278af887', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-745f-85ac-d4c79657d7e1', '019b3be4-3255-7e97-bde6-ecfedf41dea6', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e97-bde6-ecfedf41dea6', '019b995c-8e9e-77fa-bcdd-7c385ca0d5c3', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e97-bde6-ecfedf41dea6', '019bb25e-e5f8-7c9d-854d-91181fc32658', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e97-bde6-ecfedf41dea6', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e97-bde6-ecfedf41dea6', '019b995c-8e9b-798a-bded-d934bdb2a943', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-745f-85ac-d4c79657d7e1', '019b3be4-3255-7e8d-95e4-213a2f70d364', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e8d-95e4-213a2f70d364', '019b995c-8e9e-773e-ae55-1a89c96a07d0', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e8d-95e4-213a2f70d364', '019bb25e-e5f8-7ca3-ae71-235393296e6a', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e8d-95e4-213a2f70d364', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e8d-95e4-213a2f70d364', '019b995c-8e9b-7a26-b607-a000a1d291db', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-745f-85ac-d4c79657d7e1', '019b3be4-3255-7e85-913c-474e76513957', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e85-913c-474e76513957', '019b995c-8e9e-77a6-9093-53f6102b5b0b', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e85-913c-474e76513957', '019bb25e-e5f8-7ca7-a23c-03fe824b4e20', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e85-913c-474e76513957', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e85-913c-474e76513957', '019b995c-8e9b-79a0-8957-f9b7df6343b7', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-744f-a6b0-21686815b719', '019b3be4-3255-7e6b-b338-baae0376465a', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e6b-b338-baae0376465a', '019b995c-8e9e-7771-a8dd-e2ef070285a0', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e6b-b338-baae0376465a', '019bb25e-e5f8-7cab-a50e-56f8f5be04bb', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e6b-b338-baae0376465a', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e6b-b338-baae0376465a', '019b995c-8e9b-7ab8-af3c-ce43ca26905c', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-744f-a6b0-21686815b719', '019b3be4-3255-7e60-93cd-b35219856111', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e60-93cd-b35219856111', '019b995c-8e9e-7738-ba9b-eb1480a34e3d', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e60-93cd-b35219856111', '019bb25e-e5f8-7caf-ae53-4390d8e77372', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e60-93cd-b35219856111', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e60-93cd-b35219856111', '019b995c-8e9b-7ab5-a648-9973452fc32f', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-744f-a6b0-21686815b719', '019b3be4-3255-7e5b-9616-231688fa5b3b', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e5b-9616-231688fa5b3b', '019b995c-8e9e-77c3-a987-b764faa6a601', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e5b-9616-231688fa5b3b', '019bb25e-e5f8-7cb0-a8f7-b733bdebb1ca', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e5b-9616-231688fa5b3b', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e5b-9616-231688fa5b3b', '019b995c-8e9b-79f1-ab55-5634609b0514', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7459-b42d-b7ee5595e1c7', '019b3be4-3255-7e53-8250-c590534edfb2', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e53-8250-c590534edfb2', '019b995c-8e9e-7740-a5da-120c2dc27932', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e53-8250-c590534edfb2', '019bb25e-e5f8-7cb7-8af7-29a33317c819', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e53-8250-c590534edfb2', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e53-8250-c590534edfb2', '019b995c-8e9b-7a8f-930d-cbd2bb4a3051', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7459-b42d-b7ee5595e1c7', '019b3be4-3255-7e4a-a481-e13bfbb551ca', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e4a-a481-e13bfbb551ca', '019b995c-8e9e-77a8-b41e-2ae32ca79fd3', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e4a-a481-e13bfbb551ca', '019bb25e-e5f8-7cbb-ab67-3ccacb2df5aa', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e4a-a481-e13bfbb551ca', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e4a-a481-e13bfbb551ca', '019b995c-8e9b-7af0-8d4d-debb35b8a1b5', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7459-b42d-b7ee5595e1c7', '019b3be4-3255-7e47-a9c8-80c17ff87443', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e47-a9c8-80c17ff87443', '019b995c-8e9e-77b6-9b6e-3d1b510f35a4', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e47-a9c8-80c17ff87443', '019bb25e-e5f8-7cbf-a83f-133510bc2166', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e47-a9c8-80c17ff87443', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e47-a9c8-80c17ff87443', '019b995c-8e9b-7a7c-8937-d193a893b3fc', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7450-8897-a72c55c26107', '019b3be4-3255-7e27-bb22-a6c01a8a25b8', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e27-bb22-a6c01a8a25b8', '019b995c-8e9e-7733-a67d-fa6b4b323ac2', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e27-bb22-a6c01a8a25b8', '019bb25e-e5f8-7cc0-9040-b01aa544b670', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e27-bb22-a6c01a8a25b8', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e27-bb22-a6c01a8a25b8', '019b995c-8e9b-79b4-a3fc-879b03735653', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7461-ae69-85ba6cc54ae7', '019b3be4-3255-7eb3-8147-49612a90363c', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7eb3-8147-49612a90363c', '019b995c-8e9e-77df-8bbe-62034aa13a97', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7eb3-8147-49612a90363c', '019bb25e-e5f8-7c20-855d-7ccf9e162415', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7eb3-8147-49612a90363c', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7eb3-8147-49612a90363c', '019b995c-8e9b-7a23-a4d2-9c54ddf31972', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7450-8897-a72c55c26107', '019b3be4-3255-7e16-892b-1f67dc9c7f44', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e16-892b-1f67dc9c7f44', '019b995c-8e9e-7744-b8f1-3e99ed0577a9', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e16-892b-1f67dc9c7f44', '019bb25e-e5f8-7cc9-8987-b46dcfac9dcd', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e16-892b-1f67dc9c7f44', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e16-892b-1f67dc9c7f44', '019b995c-8e9b-7b03-a703-43944e39f8fa', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7455-a0f7-2248e8c5a63b', '019b3be4-3255-7df6-81b6-16014ab3b7f5', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7df6-81b6-16014ab3b7f5', '019b995c-8e9e-778b-a7ef-38f17457e77d', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7df6-81b6-16014ab3b7f5', '019bb25e-e5f8-7ccf-8161-efad11364f9b', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7df6-81b6-16014ab3b7f5', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7df6-81b6-16014ab3b7f5', '019b995c-8e9b-7a97-b7f6-097da4c556e0', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7455-a0f7-2248e8c5a63b', '019b3be4-3255-7def-8a45-9fd15d9058ae', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7def-8a45-9fd15d9058ae', '019b995c-8e9e-7878-998c-50d34535c1a5', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7def-8a45-9fd15d9058ae', '019bb25e-e5f8-7cd3-aade-bc9cfbbaef93', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7def-8a45-9fd15d9058ae', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7def-8a45-9fd15d9058ae', '019b995c-8e9b-7a4f-a915-fa2e6de80be0', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7455-a0f7-2248e8c5a63b', '019b3be4-3255-7de5-9d1a-bcf18335f6ea', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7de5-9d1a-bcf18335f6ea', '019b995c-8e9e-7842-b269-62e6f84aada2', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7de5-9d1a-bcf18335f6ea', '019bb25e-e5f8-7cd7-b8ca-96716f527321', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7de5-9d1a-bcf18335f6ea', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7de5-9d1a-bcf18335f6ea', '019b995c-8e9b-79b0-a7e7-4cc2f1a1c13b', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7461-ae69-85ba6cc54ae7', '019b3be4-3255-7ea5-ad68-76569dd59032', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ea5-ad68-76569dd59032', '019b995c-8e9e-772a-a21c-ed2864a61dab', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ea5-ad68-76569dd59032', '019bb25e-e5f8-7ce7-b68a-61e9a4e7308b', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ea5-ad68-76569dd59032', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ea5-ad68-76569dd59032', '019b995c-8e9b-7ad8-8ea1-76c2b850f992', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-745f-85ac-d4c79657d7e1', '019b3be4-3255-7e7f-b225-9d8fc2942156', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e7f-b225-9d8fc2942156', '019b995c-8e9e-7847-8d84-15299ad91f39', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e7f-b225-9d8fc2942156', '019bb25e-e5f8-7d2f-b8bb-b6f7a0c2a1c4', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e7f-b225-9d8fc2942156', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e7f-b225-9d8fc2942156', '019b995c-8e9b-79bf-80e3-698615aa2b8e', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-745f-85ac-d4c79657d7e1', '019b3be4-3255-7e77-b785-292537588e91', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e77-b785-292537588e91', '019b995c-8e9e-77a1-8877-ad6fc38c51c8', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e77-b785-292537588e91', '019bb25e-e5f8-7d30-bcb8-46fcc520225a', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e77-b785-292537588e91', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e77-b785-292537588e91', '019b995c-8e9b-7a6a-8915-27f3b12180d9', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-745f-85ac-d4c79657d7e1', '019b3be4-3255-7e73-bfa4-487dc0af3d69', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e73-bfa4-487dc0af3d69', '019b995c-8e9e-77d5-b2d5-9010719334ac', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e73-bfa4-487dc0af3d69', '019bb25e-e5f8-7d37-be12-589f245af871', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e73-bfa4-487dc0af3d69', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e73-bfa4-487dc0af3d69', '019b995c-8e9b-7b12-884f-30b0c3bcfcff', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7459-b42d-b7ee5595e1c7', '019b3be4-3255-7e3c-8102-57a723e6115d', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e3c-8102-57a723e6115d', '019b995c-8e9e-7795-a27d-59f9736d36a3', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e3c-8102-57a723e6115d', '019bb25e-e5f8-7d3a-9658-532b7ac976cd', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e3c-8102-57a723e6115d', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e3c-8102-57a723e6115d', '019b995c-8e9b-79ce-adc7-f616ec85fd4d', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7459-b42d-b7ee5595e1c7', '019b3be4-3255-7e37-8fd3-2b7166d8a777', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e37-8fd3-2b7166d8a777', '019b995c-8e9e-7795-a27d-59f9736d36a3', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e37-8fd3-2b7166d8a777', '019bb25e-e5f8-7d3d-8eee-efd2c83da86f', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e37-8fd3-2b7166d8a777', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e37-8fd3-2b7166d8a777', '019b995c-8e9b-7aaf-8727-6e61c55f2320', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7459-b42d-b7ee5595e1c7', '019b3be4-3255-7e2c-bfc9-50a8ce8e9107', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e2c-bfc9-50a8ce8e9107', '019b995c-8e9e-7822-a250-8d2e033e1534', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e2c-bfc9-50a8ce8e9107', '019bb25e-e5f8-7d43-8b29-c328f173b660', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e2c-bfc9-50a8ce8e9107', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e2c-bfc9-50a8ce8e9107', '019b995c-8e9b-7a74-a06a-1f95e0a672fe', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7450-8897-a72c55c26107', '019b3be4-3255-7e10-998c-64c3ceb243c6', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e10-998c-64c3ceb243c6', '019b995c-8e9e-7807-863a-4c5876ab0157', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e10-998c-64c3ceb243c6', '019bb25e-e5f8-7d45-9159-e9c511591ad8', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e10-998c-64c3ceb243c6', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e10-998c-64c3ceb243c6', '019b995c-8e9b-7a19-9fa2-e84486ff8d95', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7450-8897-a72c55c26107', '019b3be4-3255-7e08-9a41-393e311c8598', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e08-9a41-393e311c8598', '019b995c-8e9e-775e-a657-5735185205a9', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e08-9a41-393e311c8598', '019bb25e-e5f8-7d4a-8c27-a3231f31d512', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e08-9a41-393e311c8598', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e08-9a41-393e311c8598', '019b995c-8e9b-7a57-b7dd-0af8c925542f', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7450-8897-a72c55c26107', '019b3be4-3255-7e00-9b1f-bc466c42baf6', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e00-9b1f-bc466c42baf6', '019b995c-8e9e-775e-a657-5735185205a9', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e00-9b1f-bc466c42baf6', '019bb25e-e5f8-7d4d-a2be-5640bc74f115', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e00-9b1f-bc466c42baf6', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e00-9b1f-bc466c42baf6', '019b995c-8e9b-79c6-9ddf-62c5296781ab', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7455-a0f7-2248e8c5a63b', '019b3be4-3255-7ddf-97a7-027cc68ed040', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ddf-97a7-027cc68ed040', '019b995c-8e9e-77e4-8ecf-2cf8f2a32a89', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ddf-97a7-027cc68ed040', '019bb25e-e5f8-7d52-82ca-9a97f81a8690', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ddf-97a7-027cc68ed040', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ddf-97a7-027cc68ed040', '019b995c-8e9b-7a93-bbfd-cee09a040f97', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7455-a0f7-2248e8c5a63b', '019b3be4-3255-7dd6-8ed3-69b60058e549', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dd6-8ed3-69b60058e549', '019b995c-8e9e-782c-a993-1006eabb02fd', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7dd6-8ed3-69b60058e549', '019bb25e-e5f8-7d56-b92a-5223bc06fd2c', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dd6-8ed3-69b60058e549', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dd6-8ed3-69b60058e549', '019b995c-8e9b-79d4-be04-ad704c102d36', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7455-a0f7-2248e8c5a63b', '019b3be4-3255-7dcd-bce7-254f82463873', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dcd-bce7-254f82463873', '019b995c-8e9e-7858-ab9e-2deb22010b8a', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7dcd-bce7-254f82463873', '019bb25e-e5f8-7d5b-954d-ff8fb5fc297c', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dcd-bce7-254f82463873', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dcd-bce7-254f82463873', '019b995c-8e9b-7ad7-bd99-9bba162f204c', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-744f-a6b0-21686815b719', '019b3be4-3255-7dca-988f-7082cce11759', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7461-ae69-85ba6cc54ae7', '019b3be4-3255-7dca-988f-7082cce11759', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dca-988f-7082cce11759', '019b995c-8e9e-7792-ac86-c222f2d38fa4', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7dca-988f-7082cce11759', '019bb25e-e5f8-7d5f-8670-f85c1a4ebf93', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dca-988f-7082cce11759', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dca-988f-7082cce11759', '019b995c-8e9b-7b0c-8a5b-45bfaa62f525', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-744f-a6b0-21686815b719', '019b3be4-3255-7dc0-9ca5-bc85d7ee897f', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7461-ae69-85ba6cc54ae7', '019b3be4-3255-7dc0-9ca5-bc85d7ee897f', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dc0-9ca5-bc85d7ee897f', '019b995c-8e9e-786b-a737-e5a738e7842d', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7dc0-9ca5-bc85d7ee897f', '019bb25e-e5f8-7d61-878f-223e4ac96b88', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dc0-9ca5-bc85d7ee897f', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7dc0-9ca5-bc85d7ee897f', '019b995c-8e9b-79cb-a6b6-14578088c63d', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-744f-a6b0-21686815b719', '019b3be4-3255-7db8-997f-48d99d18f382', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7461-ae69-85ba6cc54ae7', '019b3be4-3255-7db8-997f-48d99d18f382', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7db8-997f-48d99d18f382', '019b995c-8e9e-7801-88f3-32f7a86e5c1d', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7db8-997f-48d99d18f382', '019bb25e-e5f8-7e13-968e-8aad75ea70de', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7db8-997f-48d99d18f382', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7db8-997f-48d99d18f382', '019b995c-8e9b-7ab0-80e7-306cf7cb8505', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ec8-a739-8edccd5a6915', '019b995c-8e9e-784b-9c58-1a4070f7f9d6', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ec8-a739-8edccd5a6915', '019bb25e-e5f8-7cf0-8ebd-24767ba27236', true, '2025-12-02T23:06:38.169734+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ec8-a739-8edccd5a6915', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ec8-a739-8edccd5a6915', '019b995c-8e9b-7a9e-9a91-39e32cab5a55', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ec1-9d9b-654ea70cca34', '019b995c-8e9e-7725-a5ea-341a3fea5b91', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ec1-9d9b-654ea70cca34', '019bb25e-e5f8-7cf7-9bf8-831afbf7b736', true, '2025-12-02T23:06:38.169734+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ec1-9d9b-654ea70cca34', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ec1-9d9b-654ea70cca34', '019b995c-8e9b-7a48-823c-f141c3e84738', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7eb8-aa10-9d53e18ba183', '019b995c-8e9e-7892-b96b-cb1e259a1f52', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7eb8-aa10-9d53e18ba183', '019bb25e-e5f8-7cfa-ab87-8b2a98bf6d9f', true, '2025-12-02T23:06:38.169734+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7eb8-aa10-9d53e18ba183', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7eb8-aa10-9d53e18ba183', '019b995c-8e9b-799b-a4ba-65d06135cd83', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ed6-b953-cc0f5a8973d6', '019b995c-8e9e-77f3-ba07-66ac3926e5f8', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ed6-b953-cc0f5a8973d6', '019bb25e-e5f8-7ce8-825f-6d1d8ddcc6b9', true, '2025-12-02T23:06:38.169734+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ed6-b953-cc0f5a8973d6', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ed6-b953-cc0f5a8973d6', '019b995c-8e9b-7afe-88e0-c6d1ec1b3245', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ed3-91d9-f6b1e35cf709', '019b995c-8e9e-784f-bccc-d6e92c15dcee', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ed3-91d9-f6b1e35cf709', '019bb25e-e5f8-7cee-88ca-ae96d7297994', true, '2025-12-02T23:06:38.169734+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ed3-91d9-f6b1e35cf709', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ed3-91d9-f6b1e35cf709', '019b995c-8e9b-7aee-9f2b-74ff78ff910e', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7f0d-82d4-4784be4819f4', '019c04f5-a15f-7e98-a94e-e505e4e33d48', '2025-12-08T22:19:28.206394+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f0d-82d4-4784be4819f4', '019b995c-8e9e-7871-a4d4-2fe99f06dbb1', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f0d-82d4-4784be4819f4', '019bb25e-e5f8-7d13-a0e2-aa266d021fe8', true, '2025-12-03T13:30:24.007753+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f0d-82d4-4784be4819f4', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f0d-82d4-4784be4819f4', '019b995c-8e9b-7a64-844e-a726af0df5f2', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7ee4-85b7-3d4118e9b1cb', '019c04f5-a15f-7e98-a94e-e505e4e33d48', '2025-12-08T22:19:28.206394+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ee4-85b7-3d4118e9b1cb', '019b995c-8e9e-77b1-a736-a4fa7cf58772', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ee4-85b7-3d4118e9b1cb', '019bb25e-e5f8-7d16-abec-e5e3db9386e2', true, '2025-12-03T13:30:24.007753+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ee4-85b7-3d4118e9b1cb', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ee4-85b7-3d4118e9b1cb', '019b995c-8e9b-7a5c-8370-4e4189c5e753', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7edf-ab02-fb72268d6fa5', '019c04f5-a15f-7e98-a94e-e505e4e33d48', '2025-12-08T22:19:28.206394+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7edf-ab02-fb72268d6fa5', '019b995c-8e9e-7769-99a5-918878f4360f', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7edf-ab02-fb72268d6fa5', '019bb25e-e5f8-7d1b-b0a6-aa800efb90bf', true, '2025-12-03T13:30:24.007753+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7edf-ab02-fb72268d6fa5', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7edf-ab02-fb72268d6fa5', '019b995c-8e9b-7a01-9d0c-bc5e2812ace2', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7f15-b619-230821058fd2', '019c04f5-a15f-7e98-a94e-e505e4e33d48', '2025-12-08T22:19:28.206394+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f15-b619-230821058fd2', '019b995c-8e9e-77ee-9e5c-ac7ca864887f', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f15-b619-230821058fd2', '019bb25e-e5f8-7d0d-9207-6520a302d236', true, '2025-12-03T13:30:24.007753+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f15-b619-230821058fd2', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f15-b619-230821058fd2', '019b995c-8e9b-7a63-ad61-acc2b699ef97', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7f1f-8666-8862eca11ff7', '019c04f5-a15f-7e98-a94e-e505e4e33d48', '2025-12-08T22:19:28.206394+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f1f-8666-8862eca11ff7', '019b995c-8e9e-77be-8236-aac2bd87e940', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f1f-8666-8862eca11ff7', '019bb25e-e5f8-7d08-946a-bd2457820f28', true, '2025-12-03T13:30:24.007753+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f1f-8666-8862eca11ff7', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f1f-8666-8862eca11ff7', '019b995c-8e9b-7a9b-8b12-5b1c1867c599', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7f24-8b25-90c48379e5ff', '019c04f5-a15f-7e98-a94e-e505e4e33d48', '2025-12-08T22:19:28.206394+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f24-8b25-90c48379e5ff', '019b995c-8e9e-7718-8206-04ebc4582b58', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f24-8b25-90c48379e5ff', '019bb25e-e5f8-7d04-88c8-70ce34ceeea8', true, '2025-12-03T13:30:24.007753+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f24-8b25-90c48379e5ff', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f24-8b25-90c48379e5ff', '019b995c-8e9b-7a30-91d3-4d826b7ef08e', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7f2e-869a-dfbd35f14e3a', '019c04f5-a15f-7e98-a94e-e505e4e33d48', '2025-12-08T22:19:28.206394+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f2e-869a-dfbd35f14e3a', '019b995c-8e9e-7720-9ce6-38f7a5bb2081', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f2e-869a-dfbd35f14e3a', '019bb25e-e5f8-7d00-a623-09370b0a5ba8', true, '2025-12-03T13:30:24.007753+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f2e-869a-dfbd35f14e3a', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f2e-869a-dfbd35f14e3a', '019b995c-8e9b-79e7-8c99-ce85b1a8882b', '2025-12-03T13:30:24.007753+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019c04f5-a160-7251-b0bc-33dbff8e66a0', '2025-12-08T22:19:28.206394+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019b995c-8e9e-7751-87fd-edc2107801de', '2025-12-04T13:22:00.014150+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b', true, '2025-12-04T13:22:00.014150+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-04T13:22:00.014150+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f34-a1a8-e73d1e2a1f9b', '019b995c-8e9b-79ef-b5c4-96edebab8aa9', '2025-12-04T13:22:00.014150+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ff4-bdda-ee6747f17f98', '019b995c-8e9e-7824-934b-d5d470e870b0', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ff4-bdda-ee6747f17f98', '019bb25e-e5f8-7dda-b5c5-45f0ba4336bd', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ff4-bdda-ee6747f17f98', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ff4-bdda-ee6747f17f98', '019b995c-8e9b-79ba-83a0-1ff98bd0964d', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7fd0-bc67-fb69f3292a88', '019c04f5-a160-7268-b1ec-814bf8d45478', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd0-bc67-fb69f3292a88', '019b995c-8e9e-7813-91de-e75f877117dc', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fd0-bc67-fb69f3292a88', '019bb25e-e5f8-7dd6-b648-490037cad081', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd0-bc67-fb69f3292a88', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd0-bc67-fb69f3292a88', '019b995c-8e9b-79e8-8107-f2a74eb4c228', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7fd9-ae49-680e884c7d5f', '019c04f5-a160-7275-905c-ccfbcdd8a5d5', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd9-ae49-680e884c7d5f', '019b995c-8e9e-7828-84ab-f486eaaf5bee', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fd9-ae49-680e884c7d5f', '019bb25e-e5f8-7dd0-b701-64d18af393d9', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd9-ae49-680e884c7d5f', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd9-ae49-680e884c7d5f', '019b995c-8e9b-7aca-b3bf-1350cd583648', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fe8-a834-22c625c91dd4', '019b995c-8e9e-7836-a6e1-2a7c0c7761b7', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fe8-a834-22c625c91dd4', '019bb25e-e5f8-7de3-be92-08efc9770684', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fe8-a834-22c625c91dd4', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fe8-a834-22c625c91dd4', '019b995c-8e9b-7b0a-8349-1bc84b5ae7ab', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, created_at, active, generated, mcp) VALUES ('019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019c04f5-a160-7282-9dab-63dd6aebee75', '2025-12-13T18:43:03.008799+00:00', true, false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019b995c-8e9e-7850-98fe-e35f43a79d40', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019bb25e-e5f8-7de4-b089-ca19b4ced746', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '019b995c-8e9b-79e3-bafc-ab1273c5799b', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-700c-8e71-a99bb835385c', '019b995c-8e9e-779e-af8a-7bf39fc55442', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3256-700c-8e71-a99bb835385c', '019bb25e-e5f8-7e19-848b-6a558d93d931', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3256-700c-8e71-a99bb835385c', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-700c-8e71-a99bb835385c', '019b995c-8e99-783a-be61-470f68be3981', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-700a-bef3-9c1c89344f4e', '019b995c-8e9e-77af-8ca4-0d1ba0a421e4', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3256-700a-bef3-9c1c89344f4e', '019bb25e-e5f8-7e15-a5dc-909687146e61', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3256-700a-bef3-9c1c89344f4e', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-700a-bef3-9c1c89344f4e', '019b995c-8e99-785d-90b3-859b0847de01', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019b995c-8e9e-7863-af2b-c63e7a8aac62', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019b995c-8e9a-77a8-a9dd-5f5f56922e12', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019bb25e-e5f8-7ddd-907f-b62487ee2e2f', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fef-ba99-524dd2c6e9bd', '019b995c-8e9b-7a7b-b784-012c9077004a', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-7002-8465-fd30eac11b96', '019b995c-8e9e-77c4-8695-c65b225ab8fb', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3256-7002-8465-fd30eac11b96', '019bb25e-e5f8-7e1f-a573-7804151ff56d', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3256-7002-8465-fd30eac11b96', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-7002-8465-fd30eac11b96', '019b995c-8e99-7840-a4ac-852e6bcecfaf', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;

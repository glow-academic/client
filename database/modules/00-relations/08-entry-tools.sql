-- Module: entry-tools
-- Category: relations
-- Description: entry-tools relation data
-- ============================================================

-- Table: entry_tools_relation
INSERT INTO public.entry_tools_relation (entry, tool_id, created_at, updated_at, generated, mcp, active) VALUES ('highlights', '019c16d8-a128-7352-b010-39432de8e0dc', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (entry, tool_id) DO NOTHING;
INSERT INTO public.entry_tools_relation (entry, tool_id, created_at, updated_at, generated, mcp, active) VALUES ('replacements', '019c16d8-a128-7f6f-a6f8-c9c5aa236504', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (entry, tool_id) DO NOTHING;
INSERT INTO public.entry_tools_relation (entry, tool_id, created_at, updated_at, generated, mcp, active) VALUES ('debug_info', '019b71cc-0154-7343-b89d-96d865c3b7b8', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (entry, tool_id) DO NOTHING;
INSERT INTO public.entry_tools_relation (entry, tool_id, created_at, updated_at, generated, mcp, active) VALUES ('responses', '019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (entry, tool_id) DO NOTHING;

# Unused Python Files - Manual Review Required

This document lists Python files that appear unused but require manual review due to:
- Socket handlers registered via decorators (not imports)
- Dynamic imports
- Route registration patterns
- Utility functions that may be imported dynamically

## Files Requiring Review

### API Routes (may be registered in __init__.py)
- `server/app/api/v3/agents/detail_default.py`
- `server/app/api/v3/auth/detail_default.py`
- `server/app/api/v3/cohorts/detail_default.py`
- `server/app/api/v3/cohorts/detail_with_profiles.py`
- `server/app/api/v3/departments/detail_default.py`
- `server/app/api/v3/keys/detail_default.py`
- `server/app/api/v3/models/detail_default.py`
- `server/app/api/v3/parameters/detail_default.py`
- `server/app/api/v3/personas/detail_default.py`
- `server/app/api/v3/prompts/detail_default.py`
- `server/app/api/v3/rubrics/detail_default.py`
- `server/app/api/v3/simulations/detail_default.py`
- `server/app/api/v3/videos/detail_default.py`
- `server/app/api/v3/profile/search_simulatable_profiles.py`
- `server/app/api/v3/reports/export.py`
- `server/app/api/v3/runs/full.py`
- `server/app/api/v3/attempts/update_chat_completed_at.py`
- `server/app/api/v3/attempts/update_chat_created_at.py`
- `server/app/api/v3/router.py` - **IMPORTANT: This is the main router file, DO NOT DELETE**

### Socket Handlers (registered via decorators)
- `server/app/socket/connect.py`
- `server/app/socket/disconnect.py`
- `server/app/socket/documents/generate.py`
- `server/app/socket/images/complete.py`
- `server/app/socket/images/generate.py`
- `server/app/socket/log.py`
- `server/app/socket/quizzes/complete.py`
- `server/app/socket/quizzes/create.py`
- `server/app/socket/quizzes/submit_response.py`
- `server/app/socket/scenarios/generate.py`
- `server/app/socket/scenarios/regenerate.py`
- `server/app/socket/scenarios/tools/document.py`
- `server/app/socket/scenarios/tools/image.py`
- `server/app/socket/scenarios/tools/objectives.py`
- `server/app/socket/scenarios/tools/statement.py`
- `server/app/socket/simulations/join.py`
- `server/app/socket/simulations/leave.py`
- `server/app/socket/simulations/text/end.py`
- `server/app/socket/simulations/text/next.py`
- `server/app/socket/simulations/text/practice.py`
- `server/app/socket/simulations/text/send.py`
- `server/app/socket/simulations/text/start.py`
- `server/app/socket/simulations/text/stop.py`
- `server/app/socket/simulations/voice/assistant/delta.py`
- `server/app/socket/simulations/voice/assistant/done.py`
- `server/app/socket/simulations/voice/assistant/interrupted.py`
- `server/app/socket/simulations/voice/debug.py`
- `server/app/socket/simulations/voice/start.py`
- `server/app/socket/simulations/voice/stop.py`
- `server/app/socket/simulations/voice/user/delta.py`
- `server/app/socket/simulations/voice/user/speech.py`
- `server/app/socket/simulations/voice/user/start.py`
- `server/app/socket/simulations/voice/user/text.py`
- `server/app/socket/simulations/voice/user/transcript.py`
- `server/app/socket/videos/generate.py`
- `server/app/socket/videos/outline.py`
- `server/app/socket/videos/tools/document.py`
- `server/app/socket/videos/tools/image.py`
- `server/app/socket/videos/tools/outline.py`
- `server/app/socket/videos/tools/questions.py`
- `server/app/socket/videos/tools/video.py`

### Utility Functions (may be imported dynamically)
- `server/app/utils/agents/build_document_agent.py`
- `server/app/utils/agents/build_hint_agent.py`
- `server/app/utils/agents/build_voice_agent.py`
- `server/app/utils/agents/generic_agent.py`
- `server/app/utils/agents/run_document_agent.py`
- `server/app/utils/agents/tools/build_template_model.py`
- `server/app/utils/agents/tools/create_classification_function.py`
- `server/app/utils/agents/tools/create_classification_tools.py`
- `server/app/utils/agents/tools/create_document_tools.py`
- `server/app/utils/agents/tools/create_dynamic_document_function.py`
- `server/app/utils/agents/tools/create_grading_function.py`
- `server/app/utils/agents/tools/create_grading_tools.py`
- `server/app/utils/agents/tools/create_hint_function.py`
- `server/app/utils/agents/tools/create_hint_tools.py`
- `server/app/utils/agents/tools/create_objectives_function.py`
- `server/app/utils/agents/tools/create_outline_tools.py`
- `server/app/utils/agents/tools/create_persona_tools.py`
- `server/app/utils/agents/tools/create_question_tools.py`
- `server/app/utils/agents/tools/create_safe_field_name.py`
- `server/app/utils/agents/tools/create_scenario_tools.py`
- `server/app/utils/agents/tools/create_summary_function.py`
- `server/app/utils/agents/tools/create_title_description_function.py`
- `server/app/utils/analytics_query_builder.py`
- `server/app/utils/auth/decrypt_api_key.py`
- `server/app/utils/auth/derive_key.py`
- `server/app/utils/auth/encrypt_api_key.py`
- `server/app/utils/cache/cache_key.py`
- `server/app/utils/cache/get_cached.py`
- `server/app/utils/cache/get_cached_response.py`
- `server/app/utils/cache/invalidate_tags.py`
- `server/app/utils/cache/set_cached.py`
- `server/app/utils/cache/set_cached_response.py`
- `server/app/utils/cache/stable_dumps.py`
- `server/app/utils/cache/tag_set_name.py`
- `server/app/utils/chat/format_chat_scenario.py`
- `server/app/utils/chat/get_realtime_history.py`
- `server/app/utils/chat/get_simulation_conversation_history.py`
- `server/app/utils/csv/parse_csv_file.py`
- `server/app/utils/csv/validate_csv_format.py`
- `server/app/utils/debug_info.py`
- `server/app/utils/document/format_document_info.py`
- `server/app/utils/document/format_document_template_context.py`
- `server/app/utils/document/pdf_first_page_to_image_bytes.py`
- `server/app/utils/document/pdf_pages_to_image_data_urls.py`
- `server/app/utils/document/read_pdf_text_pages.py`
- `server/app/utils/document/read_text_file.py`
- `server/app/utils/documents/create_dynamic_document.py`
- `server/app/utils/error/handle_route_error.py`
- `server/app/utils/error/log_and_raise_error.py`
- `server/app/utils/evals/run_eval_worker.py`
- `server/app/utils/health.py`
- `server/app/utils/images/generate_image.py`
- `server/app/utils/images/generate_image_background.py`
- `server/app/utils/jinja_renderer.py`
- `server/app/utils/logging/db_logger.py`
- `server/app/utils/messages/log_regeneration_messages.py`
- `server/app/utils/messages/log_run_messages.py`
- `server/app/utils/metrics/collector.py`
- `server/app/utils/mime/get_content_type.py`
- `server/app/utils/mime/infer_mime_from_name.py`
- `server/app/utils/permissions.py`
- `server/app/utils/personas.py`
- `server/app/utils/rubric.py`
- `server/app/utils/scenario/generate_problem_statement.py`
- `server/app/utils/scenario/image_generation.py`
- `server/app/utils/schema.py`
- `server/app/utils/search.py`
- `server/app/utils/socket_contract.py`
- `server/app/utils/sql_helper.py`
- `server/app/utils/storage/request_storage.py`
- `server/app/utils/test_db.py`
- `server/app/utils/text/normalize_text.py`
- `server/app/utils/text/read_document_content_for_similarity.py`
- `server/app/utils/text/tokenize.py`
- `server/app/utils/text/weighted_choice.py`
- `server/app/utils/text/weighted_sample_without_replacement.py`
- `server/app/utils/theme/color_utils.py`
- `server/app/utils/theme/oklch_to_hex.py`
- `server/app/utils/video/format_policy_info.py`
- `server/app/utils/video/format_question_info.py`
- `server/app/utils/websocket/add_guest_socket.py`
- `server/app/utils/websocket/cancel_active_result.py`
- `server/app/utils/websocket/cancel_active_run.py`
- `server/app/utils/websocket/cleanup_profile_connection.py`
- `server/app/utils/websocket/decrement_guest_count.py`
- `server/app/utils/websocket/find_chat_by_socket.py`
- `server/app/utils/websocket/find_chats_by_socket.py`
- `server/app/utils/websocket/find_profile_by_socket.py`
- `server/app/utils/websocket/get_active_connection.py`
- `server/app/utils/websocket/get_active_run.py`
- `server/app/utils/websocket/get_guest_count.py`
- `server/app/utils/websocket/get_socket_owner.py`
- `server/app/utils/websocket/increment_guest_count.py`
- `server/app/utils/websocket/is_guest_socket.py`
- `server/app/utils/websocket/is_run_cancelled.py`
- `server/app/utils/websocket/remove_active_connection.py`
- `server/app/utils/websocket/remove_active_result.py`
- `server/app/utils/websocket/remove_active_run.py`
- `server/app/utils/websocket/remove_guest_socket.py`
- `server/app/utils/websocket/remove_socket_owner.py`
- `server/app/utils/websocket/set_active_connection.py`
- `server/app/utils/websocket/set_active_run.py`
- `server/app/utils/websocket/set_socket_owner.py`
- `server/app/utils/websocket/store_active_events.py`
- `server/app/utils/websocket/store_active_result.py`
- `server/app/utils/websocket/store_active_run.py`

## Review Instructions

1. **Socket Handlers**: Check `server/app/main.py` or socket registration files to verify these are registered via decorators
2. **API Routes**: Check `server/app/api/v3/[resource]/__init__.py` files to see if routes are registered
3. **Utils**: Search codebase for dynamic imports or string-based imports of these utilities
4. **Test Files**: Check if any of these are used in test files

## Important Notes

- **DO NOT DELETE** `server/app/api/v3/router.py` - This is the main router file
- Socket handlers are registered via decorators, not imports, so they won't show up in import analysis
- Many utility functions may be imported dynamically using `importlib` or similar
- Some files may be used in tests or other contexts not captured by static analysis


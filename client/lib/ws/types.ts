/**
 * This file was auto-generated from ws.json.
 * Do not make direct changes to this file.
 */

export type ServerToClientEvents = {
  start_assistant_error: (payload: {
    success: boolean;
    message: string;
    chat_id: string;
    error: string;
  }) => void;
  assistant_started: (payload: {
    success: boolean;
    message: string;
    chat_id: string;
  }) => void;
  title_updated: (payload: {
    chat_id: string;
    title: string;
  }) => void;
  assistant_new_message: (payload: {
    message_id: string;
    chat_id: string;
    role: string;
    content: string;
    completed: boolean;
    created_at: string;
  }) => void;
  message_complete: (payload: {
    message_id: string;
    chat_id: string;
    final_content: string;
  }) => void;
  tool_call_created: (payload: {
    tool_call_id: string;
    chat_id: string;
    tool_name: string;
    tool_type: string;
  }) => void;
  tool_call_completed: (payload: {
    tool_call_id: string;
    chat_id: string;
    tool_name: string;
  }) => void;
  assistant_message_token: (payload: {
    message_id: string;
    chat_id: string;
    token: string;
    accumulated_content: string;
  }) => void;
  assistant_message_complete: (payload: {
    message_id: string;
    chat_id: string;
    final_content: string;
  }) => void;
  assistant_message_cancelled: (payload: {
    message_id: string;
    chat_id: string;
    final_content: string;
  }) => void;
  assistant_stopped: (payload: {
    chat_id: string;
    success: boolean;
    message: string;
  }) => void;
  start_simulation_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  stop_simulation_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  send_simulation_message_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  continue_simulation_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  simulation_started: (payload: {
    success: boolean;
    message: string;
    attempt_id: string;
    chat_id: string;
  }) => void;
  simulation_message_cancelled: (payload: {
    message_id: string;
    chat_id: string;
    final_content: string;
  }) => void;
  simulation_stopped: (payload: {
    chat_id: string;
    success: boolean;
    message: string;
  }) => void;
  simulation_new_message: (payload: {
    message_id: string;
    chat_id: string;
    role: string;
    content: string;
    completed: boolean;
    created_at: string;
  }) => void;
  simulation_message_token: (payload: {
    message_id: string;
    chat_id: string;
    token: string;
    accumulated_content: string;
  }) => void;
  simulation_message_complete: (payload: {
    message_id: string;
    chat_id: string;
    final_content: string;
  }) => void;
  simulation_message_error: (payload: {
    chat_id: string;
    error: string;
  }) => void;
  message_sent: (payload: {
    message_id: string;
    chat_id: string;
    message: string;
    created_at: string;
  }) => void;
  hint_generation_progress: (payload: {
    type: string;
    message: string;
    error: string;
    chat_id: string;
    message_id: string;
    hint_ids: string[];
    hints_count: number;
    hints: { idx: number; hint: string }[];
  }) => void;
  simulation_grading_progress: (payload: {
    type: string;
    chat_id: string;
    message: string;
    error: string;
    rubric_name: string;
    standards_count: number;
    grade_id: string;
    total_score: number;
    passed: boolean;
    standards_graded: number;
    time_taken: number;
    summary: string;
    standard_group_name: string;
    standard_group_short_name: string;
    score: number;
    feedback_preview: string;
    completed_count: number;
    total_count: number;
    summary_preview: string;
  }) => void;
  simulation_continued: (payload: {
    success: boolean;
    message: string;
    completed_chat_id: string;
    next_chat_id: string;
    is_attempt_finished: boolean;
    simulation_grade_id: string;
  }) => void;
  end_all_started: (payload: {
    chat_id: string;
    attempt_id: string;
  }) => void;
  end_chat_started: (payload: {
    chat_id: string;
    attempt_id: string;
  }) => void;
  end_all_completed: (payload: {
    success: boolean;
    message: string;
    chat_id: string;
    attempt_id: string;
    completed_chat_ids: string[];
    next_chat_ids: string[];
    all_completed: boolean;
  }) => void;
  connection_confirmed: (payload: {
    sid: string;
    profile_id: string;
    guest_id: string;
    server_time: number;
  }) => void;
  joined_chat: (payload: {
    chat_id: string;
    chat_type: string;
  }) => void;
  chat_stopped: (payload: {
    chat_id: string;
    chat_type: string;
  }) => void;
};

export type ClientToServerEvents = {
  send_assistant_message: (payload: {
    chat_id: string;
    message: string;
    is_retry: boolean;
  }) => void;
  start_assistant: (payload: {
    profile_id: string;
    initial_message: string;
  }) => void;
  stop_assistant: (payload: {
    chat_id: string;
  }) => void;
  send_simulation_message: (payload: {
    chat_id: string;
    message: string;
    is_retry: boolean;
  }) => void;
  start_simulation: (payload: {
    simulation_id: string;
    profile_id: string;
    scenario_id: string;
    infinite: boolean;
    infinite_time_limit: number;
  }) => void;
  stop_simulation: (payload: {
    chat_id: string;
  }) => void;
  continue_simulation: (payload: {
    chat_id: string;
    attempt_id: string;
    end_all: boolean;
    previous_chat_id: string;
    previous_chat_map: string;
  }) => void;
  join_chat: (payload: {
    chat_id: string;
    chat_type: string;
  }) => void;
  leave_chat: (payload: {
    chat_id: string;
    chat_type: string;
  }) => void;
  stop_chat: (payload: {
    chat_id: string;
    chat_type: string;
  }) => void;
};

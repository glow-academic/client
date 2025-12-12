/**
 * This file was auto-generated from ws.json.
 * Do not make direct changes to this file.
 */

export type ServerToClientEvents = {
  simulation_text_start_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  simulation_text_stop_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  simulation_text_send_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  simulation_text_next_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  simulation_text_practice_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  simulation_started: (payload: {
    success: boolean;
    message: string;
    attempt_id: string;
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
    persona_id?: string;
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
    message?: string;
    error?: string;
    chat_id: string;
    message_id: string;
    hint_ids?: string[];
    hints_count?: number;
    hints?: { idx: number; hint: string }[];
  }) => void;
  simulation_grading_progress: (payload: {
    type: string;
    chat_id: string;
    message?: string;
    error?: string;
    rubric_name?: string;
    standards_count?: number;
    grade_id?: string;
    total_score?: number;
    passed?: boolean;
    standards_graded?: number;
    time_taken?: number;
    summary?: string;
    standard_group_name?: string;
    standard_group_short_name?: string;
    score?: number;
    feedback_preview?: string;
    completed_count?: number;
    total_count?: number;
    summary_preview?: string;
  }) => void;
  simulation_continued: (payload: {
    success: boolean;
    message: string;
    completed_chat_id: string;
    next_chat_id?: string;
    is_attempt_finished?: boolean;
    simulation_grade_id?: string;
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
    attempt_id?: string;
    completed_chat_ids?: string[];
    next_chat_ids?: string[];
    all_completed?: boolean;
  }) => void;
  connection_confirmed: (payload: {
    sid: string;
    profile_id?: string;
    guest_id?: string;
    server_time: number;
  }) => void;
  simulation_joined: (payload: {
    chat_id: string;
    chat_type: string;
  }) => void;
  simulation_text_ended: (payload: {
    chat_id: string;
    chat_type: string;
  }) => void;
  scenario_generation_progress: (payload: {
    type: string;
    message?: string;
    tool_name?: string;
    trace_id?: string;
  }) => void;
  scenario_generation_complete: (payload: {
    success: boolean;
    message: string;
    trace_id?: string;
  }) => void;
  scenario_generation_error: (payload: {
    success: boolean;
    message: string;
    trace_id?: string;
  }) => void;
  video_outline_generation_progress: (payload: {
    type: string;
    message?: string;
    trace_id?: string;
  }) => void;
  video_outline_generation_complete: (payload: {
    success: boolean;
    message: string;
    name: string;
    outline: string;
    outline_id?: string;
    video_name?: string;
    questions?: { question_text: string; allow_multiple: boolean; options: string }[];
    question_timestamps: Record<string, unknown>;
    trace_id?: string;
  }) => void;
  video_outline_generation_error: (payload: {
    success: boolean;
    message: string;
    trace_id?: string;
  }) => void;
  video_generation_progress: (payload: {
    type: string;
    message?: string;
    status?: string;
    progress?: number;
    video_id?: string;
  }) => void;
  video_generation_complete: (payload: {
    success: boolean;
    message: string;
    videoUrl?: string;
    videoId?: string;
  }) => void;
  video_generation_error: (payload: {
    success: boolean;
    message: string;
    video_id?: string;
  }) => void;
  document_template_generation_progress: (payload: {
    type: string;
    message?: string;
    trace_id?: string;
  }) => void;
  document_template_generation_complete: (payload: {
    success: boolean;
    message: string;
    template_html: string;
    template_schema: Record<string, unknown>;
    upload_id: string;
    template_mapping: Record<string, unknown>;
    trace_id?: string;
  }) => void;
  document_template_generation_error: (payload: {
    success: boolean;
    message: string;
    trace_id?: string;
  }) => void;
  document_tool_complete: (payload: {
    success: boolean;
    document_id: string;
    parent_document_id: string;
    trace_id: string;
    message?: string;
  }) => void;
  problem_statement_tool_complete: (payload: {
    success: boolean;
    problem_statement_id: string;
    trace_id: string;
    message?: string;
  }) => void;
  objectives_tool_complete: (payload: {
    success: boolean;
    objective_ids: string[];
    trace_id: string;
    message?: string;
  }) => void;
  image_tool_complete: (payload: {
    success: boolean;
    image_id: string;
    trace_id: string;
    message?: string;
  }) => void;
  questions_tool_complete: (payload: {
    success: boolean;
    question_ids: string[];
    trace_id: string;
    message?: string;
  }) => void;
  outline_tool_complete: (payload: {
    success: boolean;
    outline_id: string;
    trace_id: string;
    message?: string;
  }) => void;
  video_tool_complete: (payload: {
    success: boolean;
    generation_id?: string;
    trace_id: string;
    message?: string;
  }) => void;
  simulation_voice_start_response: (payload: {
    success: boolean;
    message: string;
    ephemeral_key: string;
    persona_tools: string[];
    tool_context_map: Record<string, { persona_id: string; profile_id: string | null }>;
    instructions: string;
    model: string;
    voice?: string;
    transcription_model?: string;
    transcription_prompt?: string;
    history?: string[];
  }) => void;
  simulation_voice_start_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  simulation_voice_stop_response: (payload: {
    success: boolean;
    message: string;
  }) => void;
  simulation_voice_stop_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  simulation_voice_user_start_emit: (payload: {
    chat_id: string;
    item_id: string;
  }) => void;
  simulation_voice_user_delta_emit: (payload: {
    chat_id: string;
    item_id: string;
    delta: string;
    content_index: number;
  }) => void;
  simulation_voice_user_transcript_emit: (payload: {
    chat_id: string;
    item_id: string;
    transcript: string;
    upload_id?: string;
  }) => void;
  simulation_voice_user_text_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  voice_tool_call_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  quiz_create_response: (payload: {
    success: boolean;
    message: string;
    quizId?: string;
  }) => void;
  quiz_create_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  quiz_submit_response_response: (payload: {
    success: boolean;
    message: string;
    isCorrect: boolean;
  }) => void;
  quiz_submit_response_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  quiz_complete_response: (payload: {
    success: boolean;
    message: string;
    allCorrect: boolean;
  }) => void;
  quiz_complete_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
};

export type ClientToServerEvents = {
  simulation_join: (payload: {
    chat_id: string;
    chat_type?: string;
  }) => void;
  simulation_leave: (payload: {
    chat_id: string;
    chat_type?: string;
  }) => void;
  simulation_text_end: (payload: {
    chat_id: string;
    chat_type?: string;
  }) => void;
  quiz_create: (payload: {
    attemptId: string;
    videoId: string;
  }) => void;
  quiz_submit_response: (payload: {
    quizId: string;
    questionId: string;
    optionId: string;
  }) => void;
  quiz_complete: (payload: {
    quizId: string;
  }) => void;
};

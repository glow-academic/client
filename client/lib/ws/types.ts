/**
 * This file was auto-generated from ws.json.
 * Do not make direct changes to this file.
 */

export type ServerToClientEvents = {
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
  create_practice_scenario_error: (payload: {
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
  joined_chat: (payload: {
    chat_id: string;
    chat_type: string;
  }) => void;
  chat_stopped: (payload: {
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
    title: string;
    description: string;
    objectives: string[];
    dynamic_document_mapping: Record<string, string>;
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
  start_voice_response: (payload: {
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
  start_voice_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  stop_voice_response: (payload: {
    success: boolean;
    message: string;
  }) => void;
  stop_voice_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  voice_speech_started_emit: (payload: {
    chat_id: string;
    item_id: string;
  }) => void;
  voice_tool_call_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
  voice_transcript_delta_emit: (payload: {
    chat_id: string;
    item_id: string;
    delta: string;
    content_index: number;
  }) => void;
  voice_transcript_ready_emit: (payload: {
    chat_id: string;
    item_id: string;
    transcript: string;
    upload_id?: string;
  }) => void;
  voice_user_message_error: (payload: {
    success: boolean;
    message: string;
  }) => void;
};

export type ClientToServerEvents = {
  send_simulation_message: (payload: {
    chat_id: string;
    message?: string;
    is_retry?: boolean;
  }) => void;
  start_simulation: (payload: {
    simulation_id: string;
    profile_id?: string;
    scenario_id?: string;
    infinite?: boolean;
    infinite_time_limit?: number;
  }) => void;
  create_practice_scenario: (payload: {
    persona_id?: string;
    parameter_item_ids?: string[];
    department_id?: string;
    infinite_mode?: boolean;
    infinite_time_limit?: number;
    simulation_id?: string;
    profile_id?: string;
  }) => void;
  stop_simulation: (payload: {
    chat_id: string;
  }) => void;
  continue_simulation: (payload: {
    chat_id: string;
    attempt_id: string;
    end_all?: boolean;
    previous_chat_id?: string;
    previous_chat_map: Record<string, string | null>;
  }) => void;
  join_chat: (payload: {
    chat_id: string;
    chat_type?: string;
  }) => void;
  leave_chat: (payload: {
    chat_id: string;
    chat_type?: string;
  }) => void;
  stop_chat: (payload: {
    chat_id: string;
    chat_type?: string;
  }) => void;
  start_voice: (payload: {
    chat_id: string;
  }) => void;
  stop_voice: (payload: {
    chat_id: string;
  }) => void;
  voice_interrupted: (payload: {
    chat_id: string;
  }) => void;
  voice_response_done: (payload: {
    chat_id: string;
    event_id: string;
    response_id: string;
    conversation_id: string;
    usage: Record<string, unknown>;
  }) => void;
  voice_speech_started: (payload: {
    chat_id: string;
    item_id: string;
  }) => void;
  voice_transcript_delta: (payload: {
    chat_id: string;
    item_id: string;
    delta: string;
    content_index: number;
  }) => void;
  voice_transcript_ready: (payload: {
    chat_id: string;
    item_id: string;
    transcript: string;
    upload_id?: string;
  }) => void;
  voice_user_message: (payload: {
    chat_id: string;
    message: string;
    transcription_id?: string;
  }) => void;
  generate_video_outline: (payload: {
    departmentId: string;
    documentIds?: string[];
    questionIds?: string[];
    parameterItemIds?: string[];
    existingQuestions?: { question_id: string | null; question_text: string; allow_multiple: boolean; times: number | null; options: string | null }[];
    profileId?: string;
    videoId?: string;
    videoLengthSeconds?: number;
    useQuestions?: boolean;
    personaIds?: string[];
  }) => void;
  generate_video: (payload: {
    videoId: string;
    prompt: string;
    imageReferenceId?: string;
  }) => void;
  generate_document_template: (payload: {
    departmentId: string;
    profileId?: string;
    documentId?: string;
    documentName?: string;
    documentDescription?: string;
    fieldIds?: string[];
  }) => void;
};

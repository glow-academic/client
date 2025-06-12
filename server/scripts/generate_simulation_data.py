#!/usr/bin/env python3
"""
Bulk generator – 300 chats across six simulations
 * 50 chats per simulation (300 total)
 * Scores show gradual improvement over past 90 days
 * 80% of Active-Listening feedback is 1 or 2 (biased low)
 * Diverse data with realistic progression
Dates span past 90 days to today (UTC)
"""

import random, uuid, datetime, pathlib

# ---------------------------------------------------------------------------#
# 1.  CONFIGURATION                                                          #
# ---------------------------------------------------------------------------#
# ---- TA roster ------------------------------------------------------------#
TA_USERS = {
    # full original TA dict + the 10 extra from the previous answer  (truncated)
    "99b90118-7b9e-4e12-8e81-d7ccc2916601": ["44444444-1111-1111-1111-111111111111"],
    "99b90118-7b9e-4e12-8e81-d7ccc2916602": ["44444444-1111-1111-1111-111111111111"],
    "99b90118-7b9e-4e12-8e81-d7ccc2916603": ["55555555-2222-2222-2222-222222222222"],
    "99b90118-7b9e-4e12-8e81-d7ccc2916604": ["55555555-2222-2222-2222-222222222222"],
    "99b90118-7b9e-4e12-8e81-d7ccc2916605": ["66666666-3333-3333-3333-333333333333"],
    "99b90118-7b9e-4e12-8e81-d7ccc2916606": ["66666666-3333-3333-3333-333333333333"],
    "99b90118-7b9e-4e12-8e81-d7ccc2916607": ["77777777-4444-4444-4444-444444444444"],
    "99b90118-7b9e-4e12-8e81-d7ccc2916608": ["77777777-4444-4444-4444-444444444444"],
    "99b90118-7b9e-4e12-8e81-d7ccc2916609": [
        "44444444-1111-1111-1111-111111111111",
        "55555555-2222-2222-2222-222222222222",
    ],
    "99b90118-7b9e-4e12-8e81-d7ccc2916610": [
        "66666666-3333-3333-3333-333333333333",
        "77777777-4444-4444-4444-444444444444",
    ],
    # (keep the rest of your original TA list)
}

# ---- Six simulations ------------------------------------------------------#
SIMULATIONS = [
    # 3 single-scenario practice
    "aaaaaaaa-1111-2222-3333-444444444444",  # Aggressive Student Practice
    "bbbbbbbb-1111-2222-3333-444444444444",  # Happy Student Practice
    "cccccccc-1111-2222-3333-444444444444",  # Confused Student Practice
    # 3 multi-scenario course
    "c5a0b001-aaaa-bbbb-cccc-dddddddddddd",  # CS-180 Programming Challenge
    "c5a0b002-bbbb-cccc-dddd-eeeeeeeeeeee",  # Multi-Course Algorithm
    "c5a0b003-cccc-dddd-eeee-ffffffffffff",  # Advanced Theory Deep Dive
]
SIM_QUOTA = [50, 50, 50, 50, 50, 50]   # 50 chats per simulation (300 total)

# ---- Rubric & Standards ---------------------------------------------------#
RUBRIC_ID = "33333333-3333-3333-3333-333333333333"

STD_LISTEN_LOW   = ["11111111-4444-aaaa-bbbb-333333333333",  # 2
                    "11111111-5555-aaaa-bbbb-333333333333"]  # 1
STD_LISTEN_OTHER = ["11111111-1111-aaaa-bbbb-333333333333",  # 5
                    "11111111-2222-aaaa-bbbb-333333333333",  # 4
                    "11111111-3333-aaaa-bbbb-333333333333"]  # 3
STD_CM  = "22222222-2222-aaaa-bbbb-333333333333"
STD_TM  = "33333333-2222-aaaa-bbbb-333333333333"
STD_ADP = "44444444-2222-aaaa-bbbb-333333333333"

# Diverse question and answer banks for more realistic data
QUESTION_BANK = [
    "Can you explain this output?",
    "Why is this line null?",
    "What does this recursion actually do?",
    "How do I optimize this loop?",
    "Is my DFA minimal?",
    "Why am I getting a segmentation fault?",
    "How do I handle this edge case?",
    "What's the time complexity here?",
    "Can you help me debug this function?",
    "Why isn't my algorithm working?",
    "How do I implement this data structure?",
    "What's wrong with my logic?",
    "Can you explain this concept?",
    "How do I approach this problem?",
    "Why is my code so slow?"
]

ANSWER_BANK = [
    "Let's trace the variable values.",
    "Initialize the array before use.",
    "Your base case is missing; it never terminates.",
    "Pre-allocate the vector to avoid re-allocation.",
    "Remove state Q3 – it's unreachable.",
    "Check your pointer arithmetic carefully.",
    "Consider what happens when the input is empty.",
    "This is O(n²) - can we do better?",
    "Let's add some print statements to see what's happening.",
    "The issue is in your loop condition.",
    "You need to handle the case where the list is empty.",
    "Think about the invariant you're trying to maintain.",
    "Let me draw a diagram to explain this.",
    "Break this down into smaller steps.",
    "Try using a different approach - maybe recursion?"
]

CHAT_TITLES = [
    "Debug Help", "Algorithm Q", "Concept Check", "Code Review", 
    "Logic Error", "Performance Issue", "Implementation Help",
    "Understanding Concepts", "Problem Solving", "Optimization Question"
]

# Past 90 days
TODAY = datetime.datetime.now(datetime.timezone.utc)
START = TODAY - datetime.timedelta(days=90)

random.seed(42)

# ---------------------------------------------------------------------------#
# 2.  Helpers                                                                #
# ---------------------------------------------------------------------------#
def rand_ts_with_trend(progress: float) -> str:
    """
    Random timestamp with trend - progress is 0.0 to 1.0
    Earlier timestamps (progress near 0) are closer to START
    Later timestamps (progress near 1) are closer to TODAY
    """
    # Add some randomness but bias toward the trend
    jitter = random.uniform(-0.1, 0.1)
    adjusted_progress = max(0, min(1, progress + jitter))
    
    delta = adjusted_progress * (TODAY - START)
    return (START + delta).isoformat(timespec="seconds")

def get_score_with_improvement(progress: float) -> int:
    """
    Generate scores that improve over time
    Early: 20-60 range, Later: 50-95 range
    """
    base_min = 20 + int(progress * 30)  # 20 -> 50
    base_max = 60 + int(progress * 35)  # 60 -> 95
    
    # Still allow some outliers
    roll = random.random()
    if roll < 0.03:  # 3% chance of very low score
        return random.randint(0, 25)
    elif roll < 0.06:  # 3% chance of perfect score
        return 100
    else:
        return random.randint(base_min, base_max)

def get_listening_score_biased_low(progress: float) -> tuple[str, int]:
    """
    Get listening standard and score, biased toward low scores
    80% chance of score 1 or 2, with slight improvement over time
    """
    # Bias toward low scores, but allow some improvement over time
    low_bias = 0.8 - (progress * 0.2)  # 80% -> 60% chance of low score
    
    if random.random() < low_bias:
        std = random.choice(STD_LISTEN_LOW)
        score = 1 if std == STD_LISTEN_LOW[1] else 2
    else:
        std = random.choice(STD_LISTEN_OTHER)
        score = int(std[-2])  # Extract score from standard ID
    
    return std, score

def q(val: str) -> str:
    return "'" + val.replace("'", "''") + "'"

# ---------------------------------------------------------------------------#
# 3.  Row buckets                                                            #
# ---------------------------------------------------------------------------#
attempt_rows, chat_rows, message_rows, grade_rows, fb_rows = ([] for _ in range(5))

# ---------------------------------------------------------------------------#
# 4.  Generate per-simulation with time-based improvement                    #
# ---------------------------------------------------------------------------#
total_chats = sum(SIM_QUOTA)
chat_counter = 0

for sim_id, quota in zip(SIMULATIONS, SIM_QUOTA):
    for i in range(quota):
        # Calculate progress (0.0 to 1.0) for this chat
        progress = chat_counter / (total_chats - 1)
        chat_counter += 1
        
        ta_id, class_ids = random.choice(list(TA_USERS.items()))
        class_id = random.choice(class_ids)

        attempt_id = str(uuid.uuid4())
        chat_id    = str(uuid.uuid4())
        grade_id   = str(uuid.uuid4())

        # ----- simulation_attempt -----------------------------------------#
        attempt_rows.append(
            f"({q(attempt_id)}, {q(rand_ts_with_trend(progress))}, {q(ta_id)}, {q(class_id)}, {q(sim_id)})"
        )

        # ----- simulation_chat -------------------------------------------#
        # Completion rate improves over time
        completed = random.random() < (0.6 + progress * 0.3)  # 60% -> 90%
        created_at = rand_ts_with_trend(progress)
        completed_at = q(rand_ts_with_trend(progress + 0.01)) if completed else "NULL"
        scenario_id = "11111111-aaaa-aaaa-aaaa-111111111111"
        title = random.choice(CHAT_TITLES)

        chat_rows.append(
            f"({q(chat_id)}, {q(created_at)}, {completed_at}, {q(title)}, "
            f"{q(scenario_id)}, {str(completed).lower()}, {q(attempt_id)})"
        )

        # ----- simulation_messages (2-12, more variety) ------------------#
        msg_count = random.randint(2, 12)
        for j in range(msg_count):
            msg_id = str(uuid.uuid4())
            msg_progress = progress + (j / msg_count) * 0.01  # Slight progression within chat
            message_rows.append(
                f"({q(msg_id)}, {q(rand_ts_with_trend(msg_progress))}, {q(chat_id)}, "
                f"{q(random.choice(QUESTION_BANK))}, "
                f"{q(random.choice(ANSWER_BANK))}, false)"
            )

        # ----- simulation_chat_grades ------------------------------------#
        score = get_score_with_improvement(progress)
        passed = score >= 70
        # Time taken improves slightly over time (people get faster)
        base_time = random.randint(600, 2400)
        time_taken = max(300, int(base_time * (1.2 - progress * 0.4)))  # Slight improvement

        grade_rows.append(
            f"({q(grade_id)}, {q(rand_ts_with_trend(progress))}, {str(passed).lower()}, {score}, "
            f"{time_taken}, {q(RUBRIC_ID)}, {q(chat_id)})"
        )

        # ----- simulation_chat_feedbacks (4 per chat) ---------------------#
        listen_std, listen_score = get_listening_score_biased_low(progress)
        
        # Other scores improve slightly over time
        cm_score = min(5, 3 + int(progress * 2) + random.randint(0, 1))
        tm_score = min(5, 3 + int(progress * 2) + random.randint(0, 1))
        adp_score = min(5, 3 + int(progress * 2) + random.randint(0, 1))
        
        fb_rows.extend([
            f"({q(str(uuid.uuid4()))}, {q(rand_ts_with_trend(progress))}, {q(listen_std)}, {q(grade_id)}, "
            f"{listen_score}, 'Active listening feedback')",
            f"({q(str(uuid.uuid4()))}, {q(rand_ts_with_trend(progress))}, {q(STD_CM)},  {q(grade_id)}, {cm_score}, 'Content mastery feedback')",
            f"({q(str(uuid.uuid4()))}, {q(rand_ts_with_trend(progress))}, {q(STD_TM)},  {q(grade_id)}, {tm_score}, 'Time management feedback')",
            f"({q(str(uuid.uuid4()))}, {q(rand_ts_with_trend(progress))}, {q(STD_ADP)}, {q(grade_id)}, {adp_score}, 'Adaptation feedback')",
        ])

# ---------------------------------------------------------------------------#
# 5.  Emit INSERT statements                                                 #
# ---------------------------------------------------------------------------#
def build_insert(table: str, cols: str, rows: list[str]) -> str:
    return f"INSERT INTO {table} ({cols}) VALUES\n  " + ",\n  ".join(rows) + ";\n\n"

sql = "".join([
    build_insert("simulation_attempts",
                 "id, created_at, profile_id, class_id, simulation_id", attempt_rows),
    build_insert("simulation_chats",
                 "id, created_at, completed_at, title, scenario_id, completed, attempt_id", chat_rows),
    build_insert("simulation_messages",
                 "id, created_at, chat_id, query, response, completed", message_rows),
    build_insert("simulation_chat_grades",
                 "id, created_at, passed, score, time_taken, rubric_id, simulation_chat_id", grade_rows),
    build_insert("simulation_chat_feedbacks",
                 "id, created_at, standard_id, simulation_chat_grade_id, total, feedback", fb_rows),
])

# Write to database/init directory
output_path = pathlib.Path("database/init/generated_simulation_data.sql")
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(sql)

print(f"✅  Generated {len(chat_rows)} chats ({len(message_rows)} messages)")
print(f"📊  Data spans past 90 days with gradual improvement trend")
print(f"🎯  80% of active listening scores are 1 or 2 (biased low)")
print(f"📁  Output: {output_path}")

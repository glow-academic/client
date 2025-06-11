#!/usr/bin/env python3
"""
generate_simulation_data_grouped.py
Creates `generated_data.sql` with ONE multi-row INSERT per table.
≈5-10 chats per TA, time-stamped within last week.
(No external dependencies.)
"""

import random, uuid, datetime, pathlib

# ---------------------------------------------------------------------------#
# 1.  Static configuration pulled from your seed data
# ---------------------------------------------------------------------------#
# TA ID → list[class_id]  (unchanged - truncated in this snippet for brevity)
TA_USERS = {
    # ---- CS-180 -----------------------------------------------------------#
    "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb": ["44444444-1111-1111-1111-111111111111"],
    # … (keep the rest of the dict exactly as in your original script) …
    "c5abc005-aaaa-bbbb-cccc-dddddddddddd": [
        "55555555-2222-2222-2222-222222222222",
        "77777777-4444-4444-4444-444444444444",
    ],
}

# --- the six simulations you told me to use --------------------------------#
SIMULATIONS = [
    # 3 single-scenario practice simulations
    "aaaaaaaa-1111-2222-3333-444444444444",  # Aggressive Student Practice
    "bbbbbbbb-1111-2222-3333-444444444444",  # Happy Student Practice
    "cccccccc-1111-2222-3333-444444444444",  # Confused Student Practice
    # 3 multi-scenario course simulations
    "c5a0b001-aaaa-bbbb-cccc-dddddddddddd",  # CS 180 Programming Challenge
    "c5a0b002-bbbb-cccc-dddd-eeeeeeeeeeee",  # Multi-Course Algorithm Assessment
    "c5a0b003-cccc-dddd-eeee-ffffffffffff",  # Advanced Theory Deep Dive
]

RUBRIC_ID = "33333333-3333-3333-3333-333333333333"
STANDARD_IDS = [
    "11111111-2222-aaaa-bbbb-333333333333",
    "22222222-2222-aaaa-bbbb-333333333333",
    "33333333-2222-aaaa-bbbb-333333333333",
    "44444444-2222-aaaa-bbbb-333333333333",
]

QUESTION_BANK = [
    "Can you explain this output?",
    "I don't get why this line is null.",
    "What does this recursion actually do?",
    "How do I optimize this loop?",
    "Is my DFA minimal?",
]
ANSWER_BANK = [
    "Great question! Let's trace the variable values.",
    "Remember to initialize the array before use.",
    "Your base case is missing - that's why it never terminates.",
    "Try pre-allocating the vector; it avoids re-allocation.",
    "Yes, remove state Q3 - it's unreachable.",
]

NOW = datetime.datetime.now(datetime.timezone.utc)
ONE_WEEK = datetime.timedelta(days=7)
random.seed(42)

# ---------------------------------------------------------------------------#
# 2.  Helpers
# ---------------------------------------------------------------------------#
def rand_ts() -> str:
    delta = datetime.timedelta(seconds=random.randint(0, int(ONE_WEEK.total_seconds())))
    return (NOW - delta).isoformat(timespec="seconds")


def q(val: str) -> str:
    return "'" + val.replace("'", "''") + "'"


# ---------------------------------------------------------------------------#
# 3.  Data holders
# ---------------------------------------------------------------------------#
attempt_rows, chat_rows, message_rows, grade_rows, fb_rows = ([] for _ in range(5))

# ---------------------------------------------------------------------------#
# 4.  Data generation
# ---------------------------------------------------------------------------#
for ta_id, class_ids in TA_USERS.items():
    for _ in range(random.randint(5, 10)):  # chats per TA
        attempt_id = str(uuid.uuid4())
        chat_id = str(uuid.uuid4())
        grade_id = str(uuid.uuid4())

        class_id = random.choice(class_ids)
        sim_id = random.choice(SIMULATIONS)          # ← your 6 sims only

        attempt_rows.append(
            f"({q(attempt_id)}, {q(rand_ts())}, {q(ta_id)}, {q(class_id)}, {q(sim_id)})"
        )

        completed = random.choice([True, False])
        created_at = rand_ts()
        completed_at = q(rand_ts()) if completed else "NULL"
        scenario_id = "11111111-aaaa-aaaa-aaaa-111111111111"  # any existing scenario
        title = random.choice(
            ["Debug Help", "Algorithm Question", "Concept Check", "Syntax Error"]
        )

        chat_rows.append(
            f"({q(chat_id)}, {q(created_at)}, {completed_at}, {q(title)}, "
            f"{q(scenario_id)}, {str(completed).lower()}, {q(attempt_id)})"
        )

        for _ in range(random.randint(5, 15)):  # messages
            msg_id = str(uuid.uuid4())
            message_rows.append(
                f"({q(msg_id)}, {q(rand_ts())}, {q(chat_id)}, "
                f"{q(random.choice(QUESTION_BANK))}, "
                f"{q(random.choice(ANSWER_BANK))}, false)"
            )

        passed = random.choice([True, False])
        score = random.randint(60, 95)
        time_taken = random.randint(600, 2000)
        grade_rows.append(
            f"({q(grade_id)}, {q(rand_ts())}, {str(passed).lower()}, {score}, "
            f"{time_taken}, {q(RUBRIC_ID)}, {q(chat_id)})"
        )

        for sid in STANDARD_IDS:
            fb_id = str(uuid.uuid4())
            feedback_text = random.choice(
                [
                    "Solid explanation.",
                    "Good scaffolding.",
                    "Nice pacing.",
                    "Adapted well to student.",
                ]
            )
            fb_rows.append(
                f"({q(fb_id)}, {q(rand_ts())}, {q(sid)}, {q(grade_id)}, 4, {q(feedback_text)})"
            )

# ---------------------------------------------------------------------------#
# 5.  Emit SQL file
# ---------------------------------------------------------------------------#
def build_insert(table: str, columns: str, rows: list[str]) -> str:
    return f"INSERT INTO {table} ({columns}) VALUES\n  " + ",\n  ".join(rows) + ";\n"


sql_script = "".join(
    [
        build_insert(
            "simulation_attempts",
            "id, created_at, user_id, class_id, simulation_id",
            attempt_rows,
        ),
        build_insert(
            "simulation_chats",
            "id, created_at, completed_at, title, scenario_id, completed, attempt_id",
            chat_rows,
        ),
        build_insert(
            "simulation_messages",
            "id, created_at, chat_id, query, response, completed",
            message_rows,
        ),
        build_insert(
            "simulation_chat_grades",
            "id, created_at, passed, score, time_taken, rubric_id, simulation_chat_id",
            grade_rows,
        ),
        build_insert(
            "simulation_chat_feedbacks",
            "id, created_at, standard_id, simulation_chat_grade_id, total, feedback",
            fb_rows,
        ),
    ]
)

path = pathlib.Path("generated_data.sql")
path.write_text(sql_script)
print(f"✅ Wrote grouped INSERTs to {path} ({len(chat_rows)} chats)")

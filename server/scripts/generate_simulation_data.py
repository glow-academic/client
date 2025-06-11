#!/usr/bin/env python3
"""
generate_simulation_data_grouped.py
Creates `generated_data.sql` with ONE multi-row INSERT per table.
≈5-10 chats per TA, time-stamped within last week.
(No external dependencies.)
"""

import random, uuid, datetime, textwrap, pathlib

# ---------------------------------------------------------------------------#
# ----------- 1.  Static configuration pulled from your seed data -----------#
TA_USERS = {
    # CS-180
    "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb": ["44444444-1111-1111-1111-111111111111"],
    "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee": ["44444444-1111-1111-1111-111111111111"],
    "ffffffff-ffff-ffff-ffff-ffffffffffff": ["44444444-1111-1111-1111-111111111111"],
    "abcdef12-3456-7890-abcd-ef1234567890": ["44444444-1111-1111-1111-111111111111"],
    "a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6": ["44444444-1111-1111-1111-111111111111"],
    "c5180001-1111-2222-3333-444444444444": ["44444444-1111-1111-1111-111111111111"],
    "c5180002-1111-2222-3333-444444444444": ["44444444-1111-1111-1111-111111111111"],
    # CS-182
    "dddddddd-dddd-dddd-dddd-dddddddddddd": ["55555555-2222-2222-2222-222222222222"],
    "12345678-abcd-efab-cdef-123456789abc": ["55555555-2222-2222-2222-222222222222"],
    "abcd1234-efab-cdef-abcd-123456abcdef": ["55555555-2222-2222-2222-222222222222"],
    "c5182001-2222-3333-4444-555555555555": ["55555555-2222-2222-2222-222222222222"],
    "c5182002-2222-3333-4444-555555555555": ["55555555-2222-2222-2222-222222222222"],
    "c5182003-2222-3333-4444-555555555555": ["55555555-2222-2222-2222-222222222222"],
    # CS-251
    "cccccccc-cccc-cccc-cccc-cccccccccccc": ["66666666-3333-3333-3333-333333333333"],
    "87654321-dcba-fedc-baef-987654321cba": ["66666666-3333-3333-3333-333333333333"],
    "c5251001-3333-4444-5555-666666666666": ["66666666-3333-3333-3333-333333333333"],
    "c5251002-3333-4444-5555-666666666666": ["66666666-3333-3333-3333-333333333333"],
    "c5251003-3333-4444-5555-666666666666": ["66666666-3333-3333-3333-333333333333"],
    "c5251004-3333-4444-5555-666666666666": ["66666666-3333-3333-3333-333333333333"],
    # CS-381
    "12ab34cd-56ef-78ab-90cd-12ef34567890": ["77777777-4444-4444-4444-444444444444"],
    "c5381001-4444-5555-6666-777777777777": ["77777777-4444-4444-4444-444444444444"],
    "c5381002-4444-5555-6666-777777777777": ["77777777-4444-4444-4444-444444444444"],
    "c5381003-4444-5555-6666-777777777777": ["77777777-4444-4444-4444-444444444444"],
    "c5381004-4444-5555-6666-777777777777": ["77777777-4444-4444-4444-444444444444"],
    # Multi-class TAs
    "c5abc001-aaaa-bbbb-cccc-dddddddddddd": [
        "44444444-1111-1111-1111-111111111111",
        "55555555-2222-2222-2222-222222222222",
    ],
    "c5abc002-aaaa-bbbb-cccc-dddddddddddd": [
        "55555555-2222-2222-2222-222222222222",
        "66666666-3333-3333-3333-333333333333",
    ],
    "c5abc003-aaaa-bbbb-cccc-dddddddddddd": [
        "66666666-3333-3333-3333-333333333333",
        "77777777-4444-4444-4444-444444444444",
    ],
    "c5abc004-aaaa-bbbb-cccc-dddddddddddd": [
        "44444444-1111-1111-1111-111111111111",
        "66666666-3333-3333-3333-333333333333",
        "77777777-4444-4444-4444-444444444444",
    ],
    "c5abc005-aaaa-bbbb-cccc-dddddddddddd": [
        "55555555-2222-2222-2222-222222222222",
        "77777777-4444-4444-4444-444444444444",
    ],
}

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
# ----------------------------- 2.  Helpers ---------------------------------#
def rand_ts() -> str:
    delta = datetime.timedelta(seconds=random.randint(0, int(ONE_WEEK.total_seconds())))
    return (NOW - delta).isoformat(timespec="seconds")


def q(val: str) -> str:
    return "'" + val.replace("'", "''") + "'"


# ---------------------------------------------------------------------------#
# --------------------------- 3.  Data holders ------------------------------#
attempt_rows = []
chat_rows = []
message_rows = []
grade_rows = []
fb_rows = []

# ---------------------------------------------------------------------------#
# --------------------------- 4.  Data generation ---------------------------#
for ta_id, class_ids in TA_USERS.items():
    for _ in range(random.randint(5, 10)):  # chats per TA
        attempt_id = str(uuid.uuid4())
        chat_id = str(uuid.uuid4())
        grade_id = str(uuid.uuid4())

        class_id = random.choice(class_ids)
        # Use ANY simulation for that class (1st one found)
        sim_select = f"(SELECT id FROM simulations WHERE class_id = {q(class_id)} LIMIT 1)"
        attempt_rows.append(
            f"({q(attempt_id)}, {q(rand_ts())}, {q(ta_id)}, {q(class_id)}, {sim_select})"
        )

        completed = random.choice([True, False])
        created_at = rand_ts()
        completed_at = q(rand_ts()) if completed else "NULL"
        scenario_id = "11111111-aaaa-aaaa-aaaa-111111111111"  # any valid
        title = random.choice(
            ["Debug Help", "Algorithm Question", "Concept Check", "Syntax Error"]
        )
        chat_rows.append(
            f"({q(chat_id)}, {q(created_at)}, {completed_at}, {q(title)}, "
            f"{q(scenario_id)}, {str(completed).lower()}, {q(attempt_id)})"
        )

        # 5-15 messages
        for _ in range(random.randint(5, 15)):
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
# --------------------------- 5.  Emit SQL file -----------------------------#
def build_insert(table: str, columns: str, rows: list[str]) -> str:
    joined = ",\n  ".join(rows)
    return f"INSERT INTO {table} ({columns}) VALUES\n  {joined};\n"


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

#!/usr/bin/env python3
"""
Bulk generator – 300 chats across six simulations
• 50 chats per simulation (300 total)
• Scores show gradual improvement over past 90 days
• 4 standard groups with 5 standards each (20 total)
• Generates SQL ready for the **new** table structure (see README)
"""

import datetime
import pathlib
import random
import uuid

# ---------------------------------------------------------------------------#
# 1.  CONFIGURATION                                                          #
# ---------------------------------------------------------------------------#
TA_USERS = [
    f"99b90118-7b9e-4e12-8e81-d7ccc29166{str(i).zfill(2)}" for i in range(1, 11)
]

SIMULATIONS = [
    # single-scenario practice sims
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",  # Aggressive Practice
    "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",  # Happy Practice
    "cccccccc-cccc-cccc-cccc-cccccccccccc",  # Confused Practice
    # Week-1 beginner multi-scenario sims
    "f2511b01-aaaa-bbbb-cccc-dddddddddddd",  # Arrays
    "f2511b02-aaaa-bbbb-cccc-dddddddddddd",  # Loops
    "f2511b03-aaaa-bbbb-cccc-dddddddddddd",  # File-I/O
]
SIM_QUOTA = [50] * len(SIMULATIONS)

# ------------------------------------------------------------------#
# lookup so chats always reference a scenario that belongs to the
# simulation they're generated for
# (fill the lists with the UUIDs visible in your scenarios seed)
SCENARIOS_BY_SIM = {
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa": ["aaaaaaaa-1111-2222-3333-444444444444"],
    "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb": ["bbbbbbbb-1111-2222-3333-444444444444"],
    "cccccccc-cccc-cccc-cccc-cccccccccccc": ["cccccccc-1111-2222-3333-444444444444"],
    "f2511b01-aaaa-bbbb-cccc-dddddddddddd": [
        "f2511b01-aaaa-bbbb-cccc-111111111111",
        "f2511b02-aaaa-bbbb-cccc-222222222222",
        "f2511b03-aaaa-bbbb-cccc-333333333333",
    ],
    "f2511b02-aaaa-bbbb-cccc-dddddddddddd": [
        "f2511b01-aaaa-bbbb-cccc-111111111111",
        "f2511b02-aaaa-bbbb-cccc-222222222222",
        "f2511b03-aaaa-bbbb-cccc-333333333333",
    ],
    "f2511b03-aaaa-bbbb-cccc-dddddddddddd": [
        "f2511b01-aaaa-bbbb-cccc-111111111111",
        "f2511b02-aaaa-bbbb-cccc-222222222222",
        "f2511b03-aaaa-bbbb-cccc-333333333333",
    ],
}

RUBRIC_ID = "33333333-3333-3333-3333-333333333333"

STANDARD_GROUPS = {
    "Problem Understanding": [
        f"11111111-{i}{i}{i}{i}-aaaa-bbbb-333333333333" for i in range(1, 6)
    ],
    "Algorithm Design": [
        f"22222222-{i}{i}{i}{i}-aaaa-bbbb-333333333333" for i in range(1, 6)
    ],
    "Code Implementation": [
        f"33333333-{i}{i}{i}{i}-aaaa-bbbb-333333333333" for i in range(1, 6)
    ],
    "Testing & Debugging": [
        f"44444444-{i}{i}{i}{i}-aaaa-bbbb-333333333333" for i in range(1, 6)
    ],
}
ALL_STANDARDS = [s for g in STANDARD_GROUPS.values() for s in g]

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
    "Why is my code so slow?",
]
ANSWER_BANK = [
    "Let's trace the variable values.",
    "Initialize the array before use.",
    "Your base case is missing; it never terminates.",
    "Pre-allocate the vector to avoid re-allocation.",
    "Remove state Q3 – it's unreachable.",
    "Check your pointer arithmetic carefully.",
    "Consider what happens when the input is empty.",
    "This is O(n²); can we do better?",
    "Add some print statements to see what's happening.",
    "The issue is in your loop condition.",
    "Handle the case where the list is empty.",
    "Think about the invariant you're trying to maintain.",
    "Let me draw a diagram to explain this.",
    "Break this down into smaller steps.",
    "Try using a different approach – maybe recursion?",
]
CHAT_TITLES = [
    "Debug Help",
    "Algorithm Q",
    "Concept Check",
    "Code Review",
    "Logic Error",
    "Performance Issue",
    "Implementation Help",
    "Understanding Concepts",
    "Problem Solving",
    "Optimization Question",
]

TODAY = datetime.datetime.now(datetime.timezone.utc)
START = TODAY - datetime.timedelta(days=90)
random.seed(42)

# ---------------------------------------------------------------------------#
# 2.  Helper functions                                                       #
# ---------------------------------------------------------------------------#
q = lambda s: "'" + s.replace("'", "''") + "'"


def rand_ts(progress: float, jitter: float = 0.1) -> str:
    adj = max(0, min(1, progress + random.uniform(-jitter, jitter)))
    return (START + adj * (TODAY - START)).isoformat(timespec="seconds")


def get_score(progress: float) -> int:
    base_min = 4 + int(progress * 6)  # 4 → 10
    base_max = 12 + int(progress * 7)  # 12 → 19
    roll = random.random()
    if roll < 0.03:
        return random.randint(0, 5)
    if roll < 0.06:
        return 20
    return random.randint(base_min, base_max)


def generate_standard_scores(progress: float) -> tuple[int, list[int]]:
    total = get_score(progress)
    scores, s = [], 0
    for i in range(19):
        left_pts = total - s
        left_stand = 20 - i
        if left_pts <= 0:
            p = 0
        elif left_pts >= left_stand:
            p = 1
        else:
            tgt = left_pts / left_stand
            p = int((tgt + (0.3 + progress * 0.5)) / 2)
        val = 1 if random.random() < p else 0
        scores.append(val)
        s += val
    scores.append(max(0, min(1, total - s)))
    # small correction if off
    diff = total - sum(scores)
    pool = [
        i
        for i, v in enumerate(scores)
        if (v == 0 and diff > 0) or (v == 1 and diff < 0)
    ]
    while diff and pool:
        idx = random.choice(pool)
        scores[idx] += 1 if diff > 0 else -1
        diff += -1 if diff > 0 else 1
    return sum(scores), scores


# ---------------------------------------------------------------------------#
# 3.  Buckets for VALUES clauses                                             #
# ---------------------------------------------------------------------------#
attempt_rows, chat_rows, message_rows, grade_rows, fb_rows = ([] for _ in range(5))

total_chats = sum(SIM_QUOTA)
chat_counter = 0

for sim_id, quota in zip(SIMULATIONS, SIM_QUOTA):
    for _ in range(quota):
        prog = chat_counter / (total_chats - 1)
        chat_counter += 1

        ta_id = random.choice(TA_USERS)
        attempt_id = str(uuid.uuid4())
        chat_id = str(uuid.uuid4())
        grade_id = str(uuid.uuid4())
        created_ts = rand_ts(prog)

        # ---------- simulation_attempts ----------
        attempt_rows.append(
            f"({q(attempt_id)}, {q(created_ts)}, {q(ta_id)}, {q(sim_id)})"
        )

        # ---------- simulation_chats -------------
        completed = random.random() < (0.6 + prog * 0.3)
        completed_ts = q(rand_ts(prog + 0.01)) if completed else "NULL"
        scenario_id = random.choice(SCENARIOS_BY_SIM[sim_id])
        title = random.choice(CHAT_TITLES)
        chat_rows.append(
            f"({q(chat_id)}, {q(created_ts)}, {q(created_ts)}, "
            f"{completed_ts}, {q(title)}, {q(scenario_id)}, {q(attempt_id)}, "
            f"{str(completed).lower()}, NULL)"
        )

        # ---------- simulation_messages ----------
        pairs = random.randint(2, 12)
        for j in range(pairs):
            base_ts = rand_ts(prog + j / pairs * 0.01, jitter=0.02)
            # query
            msg_id = str(uuid.uuid4())
            message_rows.append(
                f"({q(msg_id)}, {q(base_ts)}, {q(base_ts)}, {q(chat_id)}, "
                f"{q(random.choice(QUESTION_BANK))}, false, NULL, 'query', false)"
            )
            # response
            msg_id = str(uuid.uuid4())
            resp_ts = rand_ts(prog + j / pairs * 0.01 + 0.001, jitter=0.02)
            message_rows.append(
                f"({q(msg_id)}, {q(resp_ts)}, {q(resp_ts)}, {q(chat_id)}, "
                f"{q(random.choice(ANSWER_BANK))}, false, NULL, 'response', false)"
            )

        # ---------- simulation_chat_grades -------
        score, std_scores = generate_standard_scores(prog)
        passed = score >= 14
        time_taken = max(300, int(random.randint(600, 2400) * (1.2 - prog * 0.4)))
        grade_rows.append(
            f"({q(grade_id)}, {q(created_ts)}, {str(passed).lower()}, {score}, "
            f"{time_taken}, {q(RUBRIC_ID)}, {q(chat_id)})"
        )

        # ---------- simulation_chat_feedbacks ----
        for std_id, pts in zip(ALL_STANDARDS, std_scores):
            fb_rows.append(
                f"({q(str(uuid.uuid4()))}, {q(created_ts)}, {q(std_id)}, "
                f"{q(grade_id)}, {pts}, {q(f'Feedback for standard {std_id[-4:]}')})"
            )


# ---------------------------------------------------------------------------#
# 4.  Emit INSERT statements                                                 #
# ---------------------------------------------------------------------------#
def build(table, cols, rows):
    return f"INSERT INTO {table} ({cols}) VALUES\n  " + ",\n  ".join(rows) + ";\n\n"


sql = "".join(
    [
        build(
            "simulation_attempts",
            "id, created_at, profile_id, simulation_id",
            attempt_rows,
        ),
        build(
            "simulation_chats",
            "id, created_at, updated_at, completed_at, title, scenario_id, "
            "attempt_id, completed, trace_id",
            chat_rows,
        ),
        build(
            "simulation_messages",
            "id, created_at, updated_at, chat_id, content, audio, file_path, "
            "type, completed",
            message_rows,
        ),
        build(
            "simulation_chat_grades",
            "id, created_at, passed, score, time_taken, rubric_id, simulation_chat_id",
            grade_rows,
        ),
        build(
            "simulation_chat_feedbacks",
            "id, created_at, standard_id, simulation_chat_grade_id, total, feedback",
            fb_rows,
        ),
    ]
)

out_path = pathlib.Path("database/init/generated_simulation_data.sql")
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(sql)

# Quick "mock run" preview – first 3 rows of each table
preview = (
    ("simulation_attempts", attempt_rows[:3]),
    ("simulation_chats", chat_rows[:3]),
    ("simulation_messages", message_rows[:3]),
    ("simulation_chat_grades", grade_rows[:3]),
    ("simulation_chat_feedbacks", fb_rows[:3]),
)
print("=== MOCK RUN PREVIEW (first 3 rows each) ===")
for name, rows in preview:
    print(f"\n{name}:")
    for r in rows:
        print(" ", r)
print(
    f"\n✅  Generated {len(chat_rows)} chats "
    f"({len(message_rows)} messages, {len(grade_rows)} grades)"
)
print("📊  Data spans the past 90 days with gradual improvement")
print(f"📁  Output SQL written to {out_path.resolve()}")

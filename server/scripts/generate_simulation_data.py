#!/usr/bin/env python3
"""
Bulk generator – 300 chats across six simulations
 * 50 chats per simulation (300 total)
 * Scores show gradual improvement over past 90 days
 * 4 standard groups with 5 standards each (20 total standards, 1 point each)
 * Diverse data with realistic progression
Dates span past 90 days to today (UTC)
"""

import datetime
import pathlib
import random
import uuid

# ---------------------------------------------------------------------------#
# 1.  CONFIGURATION                                                          #
# ---------------------------------------------------------------------------#
# ---- TA roster ------------------------------------------------------------#
TA_USERS = [
    "99b90118-7b9e-4e12-8e81-d7ccc2916601",
    "99b90118-7b9e-4e12-8e81-d7ccc2916602",
    "99b90118-7b9e-4e12-8e81-d7ccc2916603",
    "99b90118-7b9e-4e12-8e81-d7ccc2916604",
    "99b90118-7b9e-4e12-8e81-d7ccc2916605",
    "99b90118-7b9e-4e12-8e81-d7ccc2916606",
    "99b90118-7b9e-4e12-8e81-d7ccc2916607",
    "99b90118-7b9e-4e12-8e81-d7ccc2916608",
    "99b90118-7b9e-4e12-8e81-d7ccc2916609",
    "99b90118-7b9e-4e12-8e81-d7ccc2916610",
]

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
SIM_QUOTA = [50, 50, 50, 50, 50, 50]  # 50 chats per simulation (300 total)

# ---- Rubric & Standards ---------------------------------------------------#
RUBRIC_ID = "33333333-3333-3333-3333-333333333333"

# 4 standard groups with 5 standards each (20 total standards, 1 point each)
STANDARD_GROUPS = {
    "Problem Understanding": [
        "11111111-1111-aaaa-bbbb-333333333333",  # Standard 1
        "11111111-2222-aaaa-bbbb-333333333333",  # Standard 2
        "11111111-3333-aaaa-bbbb-333333333333",  # Standard 3
        "11111111-4444-aaaa-bbbb-333333333333",  # Standard 4
        "11111111-5555-aaaa-bbbb-333333333333",  # Standard 5
    ],
    "Algorithm Design": [
        "22222222-1111-aaaa-bbbb-333333333333",  # Standard 6
        "22222222-2222-aaaa-bbbb-333333333333",  # Standard 7
        "22222222-3333-aaaa-bbbb-333333333333",  # Standard 8
        "22222222-4444-aaaa-bbbb-333333333333",  # Standard 9
        "22222222-5555-aaaa-bbbb-333333333333",  # Standard 10
    ],
    "Code Implementation": [
        "33333333-1111-aaaa-bbbb-333333333333",  # Standard 11
        "33333333-2222-aaaa-bbbb-333333333333",  # Standard 12
        "33333333-3333-aaaa-bbbb-333333333333",  # Standard 13
        "33333333-4444-aaaa-bbbb-333333333333",  # Standard 14
        "33333333-5555-aaaa-bbbb-333333333333",  # Standard 15
    ],
    "Testing & Debugging": [
        "44444444-1111-aaaa-bbbb-333333333333",  # Standard 16
        "44444444-2222-aaaa-bbbb-333333333333",  # Standard 17
        "44444444-3333-aaaa-bbbb-333333333333",  # Standard 18
        "44444444-4444-aaaa-bbbb-333333333333",  # Standard 19
        "44444444-5555-aaaa-bbbb-333333333333",  # Standard 20
    ],
}

# Flatten all standards for easy iteration
ALL_STANDARDS = [std for group in STANDARD_GROUPS.values() for std in group]

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
    "Why is my code so slow?",
]

ANSWER_BANK = [
    "Let's trace the variable values.",
    "Initialize the array before use.",
    "Your base case is missing; it never terminates.",
    "Pre-allocate the vector to avoid re-allocation.",
    "Remove state Q3 - it's unreachable.",
    "Check your pointer arithmetic carefully.",
    "Consider what happens when the input is empty.",
    "This is O(n²) - can we do better?",
    "Let's add some print statements to see what's happening.",
    "The issue is in your loop condition.",
    "You need to handle the case where the list is empty.",
    "Think about the invariant you're trying to maintain.",
    "Let me draw a diagram to explain this.",
    "Break this down into smaller steps.",
    "Try using a different approach - maybe recursion?",
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
    Generate scores that improve over time (out of 20)
    Early: 4-12 range, Later: 10-19 range
    """
    base_min = 4 + int(progress * 6)  # 4 -> 10
    base_max = 12 + int(progress * 7)  # 12 -> 19

    # Still allow some outliers
    roll = random.random()
    if roll < 0.03:  # 3% chance of very low score
        return random.randint(0, 5)
    elif roll < 0.06:  # 3% chance of perfect score
        return 20
    else:
        return random.randint(base_min, base_max)


def get_standard_score(progress: float) -> int:
    """
    Generate individual standard scores (0 or 1) with improvement over time
    Each standard is worth 1 point maximum
    """
    # Probability of getting 1 point improves over time
    success_rate = 0.3 + (progress * 0.5)  # 30% -> 80% success rate
    
    # Add some randomness
    jitter = random.uniform(-0.1, 0.1)
    adjusted_rate = max(0.1, min(0.9, success_rate + jitter))
    
    return 1 if random.random() < adjusted_rate else 0


def generate_consistent_scores(progress: float) -> tuple[int, list[int]]:
    """
    Generate a total score and individual standard scores that are consistent
    Returns (total_score, individual_scores_list)
    """
    # First generate the target total score
    total_score = get_score_with_improvement(progress)
    
    # Generate individual scores that add up close to the total
    individual_scores = []
    current_sum = 0
    
    # Generate scores for first 19 standards
    for i in range(19):
        # Calculate how many points we still need
        remaining_standards = 20 - i
        remaining_points = total_score - current_sum
        
        # Decide probability based on remaining needs
        if remaining_points <= 0:
            score = 0
        elif remaining_points >= remaining_standards:
            score = 1  # We need all remaining to be 1
        else:
            # Calculate probability to hit target
            target_rate = remaining_points / remaining_standards
            # Add progress-based improvement
            base_rate = 0.3 + (progress * 0.5)
            final_rate = (target_rate + base_rate) / 2
            score = 1 if random.random() < final_rate else 0
        
        individual_scores.append(score)
        current_sum += score
    
    # For the last standard, adjust to match total exactly
    last_score = max(0, min(1, total_score - current_sum))
    individual_scores.append(last_score)
    
    # Verify and adjust if needed
    actual_sum = sum(individual_scores)
    if actual_sum != total_score:
        # If we're off, randomly adjust some scores
        diff = total_score - actual_sum
        if diff > 0:  # Need to add points
            zeros = [i for i, score in enumerate(individual_scores) if score == 0]
            for _ in range(min(diff, len(zeros))):
                if zeros:
                    idx = random.choice(zeros)
                    individual_scores[idx] = 1
                    zeros.remove(idx)
        elif diff < 0:  # Need to remove points
            ones = [i for i, score in enumerate(individual_scores) if score == 1]
            for _ in range(min(-diff, len(ones))):
                if ones:
                    idx = random.choice(ones)
                    individual_scores[idx] = 0
                    ones.remove(idx)
    
    return total_score, individual_scores


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

        ta_id = random.choice(TA_USERS)

        attempt_id = str(uuid.uuid4())
        chat_id = str(uuid.uuid4())
        grade_id = str(uuid.uuid4())

        # ----- simulation_attempt -----------------------------------------#
        attempt_rows.append(
            f"({q(attempt_id)}, {q(rand_ts_with_trend(progress))}, {q(ta_id)}, {q(sim_id)})"
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
            f"{q(scenario_id)}, {q(attempt_id)}, {str(completed).lower()})"
        )

        # ----- simulation_messages (2-12, more variety) ------------------#
        msg_count = random.randint(2, 12)
        for j in range(msg_count):
            msg_id = str(uuid.uuid4())
            msg_progress = (
                progress + (j / msg_count) * 0.01
            )  # Slight progression within chat
            message_rows.append(
                f"({q(msg_id)}, {q(rand_ts_with_trend(msg_progress))}, {q(chat_id)}, "
                f"{q(random.choice(QUESTION_BANK))}, "
                f"{q(random.choice(ANSWER_BANK))}, false)"
            )

        # ----- simulation_chat_grades ------------------------------------#
        score, individual_scores = generate_consistent_scores(progress)
        passed = score >= 14  # 70% of 20 = 14
        # Time taken improves slightly over time (people get faster)
        base_time = random.randint(600, 2400)
        time_taken = max(
            300, int(base_time * (1.2 - progress * 0.4))
        )  # Slight improvement

        grade_rows.append(
            f"({q(grade_id)}, {q(rand_ts_with_trend(progress))}, {str(passed).lower()}, {score}, "
            f"{time_taken}, {q(RUBRIC_ID)}, {q(chat_id)})"
        )

        # ----- simulation_chat_feedbacks (4 per chat) ---------------------#
        # Generate diverse scores for all 4 standards
        for standard_id in ALL_STANDARDS:
            standard_score = individual_scores[ALL_STANDARDS.index(standard_id)]
            feedback_text = f"Feedback for standard {standard_id[-4:]}"

            fb_rows.append(
                f"({q(str(uuid.uuid4()))}, {q(rand_ts_with_trend(progress))}, {q(standard_id)}, {q(grade_id)}, "
                f"{standard_score}, {q(feedback_text)})"
            )


# ---------------------------------------------------------------------------#
# 5.  Emit INSERT statements                                                 #
# ---------------------------------------------------------------------------#
def build_insert(table: str, cols: str, rows: list[str]) -> str:
    return f"INSERT INTO {table} ({cols}) VALUES\n  " + ",\n  ".join(rows) + ";\n\n"


sql = "".join(
    [
        build_insert(
            "simulation_attempts",
            "id, created_at, profile_id, simulation_id",
            attempt_rows,
        ),
        build_insert(
            "simulation_chats",
            "id, created_at, completed_at, title, scenario_id, attempt_id, completed",
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

# Write to database/init directory
output_path = pathlib.Path("database/init/generated_simulation_data.sql")
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(sql)

print(f"✅  Generated {len(chat_rows)} chats ({len(message_rows)} messages)")
print("📊  Data spans past 90 days with gradual improvement trend")
print("🎯  20 standards (4 groups × 5 standards), 1 point each (total out of 20)")
print(f"📁  Output: {output_path}")

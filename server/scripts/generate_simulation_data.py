#!/usr/bin/env python3
"""
Dynamic bulk data generator for the GLOW platform.

This script connects to the live database to fetch all simulations, TA profiles,
and rubric structures using the project's auto-generated SQLModels. It then
generates realistic seed data for every simulation found.
"""

import datetime
import random
import uuid
from typing import List, Optional

# Assumes database.py (for DB connection) and models.py (for schema) are in the same directory
from app.db import get_session
from app.models import (Profiles, Rubrics, Simulations, StandardGroups,
                        Standards)
from sqlmodel import Session, col, select

# =========================================================================== #
# 1. Data Fetching and Generation Logic
# =========================================================================== #

def fetch_source_data(session: Session) -> dict:
    """Queries the database to get all necessary source data for generation."""
    print("🔍 Fetching source data from the database...")

    # Fetch all simulations that have at least one scenario
    sim_statement = select(Simulations)
    simulations = [sim for sim in session.exec(sim_statement).all() if sim.scenario_ids and len(sim.scenario_ids) > 0]
    if not simulations:
        raise ValueError("No simulations with linked scenarios found. Please seed the database first.")
    print(f"  > Found {len(simulations)} simulations with scenarios.")

    # Fetch all TA profiles
    ta_statement = select(Profiles).where(Profiles.role == "ta")
    ta_profiles = session.exec(ta_statement).all()
    ta_user_ids = [str(p.id) for p in ta_profiles]
    if not ta_user_ids:
        raise ValueError("No 'ta' role profiles found in the database. Please seed the profiles table first.")
    print(f"  > Found {len(ta_user_ids)} TA profiles.")

    # Fetch the default rubric and its full structure
    rubric_statement = select(Rubrics).where(Rubrics.default_rubric == True).where(Rubrics.active == True)
    default_rubric = session.exec(rubric_statement).first()
    if not default_rubric:
        raise ValueError("No default rubric found in the database.")

    # Dynamically build the standards dictionary from the rubric's relationships
    standards_by_rubric = {}
    for group in default_rubric.standard_groups:
        sorted_standards = sorted(group.standards, key=lambda s: s.points)
        standards_by_rubric[str(group.id)] = [str(s.id) for s in sorted_standards]
    
    print(f"  > Loaded default rubric '{default_rubric.name}' with {len(standards_by_rubric)} standard groups.")

    return {
        "simulations": simulations,
        "ta_user_ids": ta_user_ids,
        "rubric_id": str(default_rubric.id),
        "standards_by_rubric": standards_by_rubric,
    }

def q(s: str) -> str:
    """Wraps a string in single quotes and escapes internal single quotes."""
    return "'" + str(s).replace("'", "''") + "'"

def rand_ts(base_date: datetime.datetime) -> str:
    """Generates a random timestamp around a base date with some jitter."""
    jitter = datetime.timedelta(seconds=random.randint(-3600, 3600))
    return (base_date + jitter).isoformat(timespec="seconds")

def generate_grades_and_feedback(standards_by_rubric: dict) -> tuple[int, list[tuple]]:
    """
    Generates a total score and four feedback records, one for each standard group.
    The score is based on a normal distribution to ensure most TAs are passing.
    """
    # Generate total score from a normal distribution, clamped between 0 and 20.
    # Mean: 18, StdDev: 1.5. Most scores will be in the passing range (17+).
    total_score = max(0, min(20, round(random.gauss(18, 1.5))))

    # Distribute the total score among the 4 standard groups
    group_scores = [total_score / 4] * 4
    for _ in range(10):  # Shuffle points around for variability
        i, j = random.sample(range(4), 2)
        amount = random.uniform(0, min(group_scores[i], 5 - group_scores[j], 1.0))
        group_scores[i] -= amount
        group_scores[j] += amount

    # Convert to integers in the 1-5 range
    group_scores = [max(1, min(5, int(round(s)))) for s in group_scores]

    # Correct sum to match total_score
    diff = int(total_score) - sum(group_scores)
    while diff != 0:
        idx = random.randrange(4)
        if diff > 0 and group_scores[idx] < 5:
            group_scores[idx] += 1
            diff -= 1
        elif diff < 0 and group_scores[idx] > 1:
            group_scores[idx] -= 1
            diff += 1

    feedback_list = []
    standard_group_keys = list(standards_by_rubric.keys())
    for i, score in enumerate(group_scores):
        group_id = standard_group_keys[i]
        # Standard ID corresponds to the score (1-5), so its index is score-1
        standard_id = standards_by_rubric[group_id][score - 1]
        feedback_list.append((standard_id, score))

    return int(sum(group_scores)), feedback_list

# =========================================================================== #
# 2. Main Execution Block
# =========================================================================== #

def main():
    """Main function to run the data generation process."""
    # --- Configuration ---
    QUESTION_BANK = [ "Can you explain this output?", "Why is this line null?", "How do I optimize this loop?"]
    ANSWER_BANK = [ "Let's trace the variable values.", "Initialize the array before use.", "Your base case is missing; it never terminates."]
    CHAT_TITLES = ["Debug Help", "Algorithm Question", "Concept Check", "Code Review"]
    TOTAL_CHATS_TO_GENERATE = 300
    TODAY = datetime.datetime.now(datetime.timezone.utc)
    START_DATE = TODAY - datetime.timedelta(days=90)
    random.seed(42)

    # Use the session from the provided database.py
    session = next(get_session())

    try:
        source_data = fetch_source_data(session)
        simulations = source_data["simulations"]
        ta_user_ids = source_data["ta_user_ids"]
        rubric_id = source_data["rubric_id"]
        standards_by_rubric = source_data["standards_by_rubric"]
        
        # --- Buckets for SQL VALUE clauses ---
        attempt_rows, chat_rows, message_rows, grade_rows, fb_rows = ([] for _ in range(5))

        print(f"\n🚀 Generating ~{TOTAL_CHATS_TO_GENERATE} chats across {len(simulations)} simulations...")
        
        chats_per_sim = TOTAL_CHATS_TO_GENERATE // len(simulations)
        chat_counter = 0

        for sim in simulations:
            for _ in range(chats_per_sim):
                progress = chat_counter / (TOTAL_CHATS_TO_GENERATE - 1)
                chat_counter += 1

                ta_id = random.choice(ta_user_ids)
                attempt_id, chat_id, grade_id = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
                base_date = START_DATE + progress * (TODAY - START_DATE)
                created_ts = rand_ts(base_date)

                # 1. simulation_attempts
                attempt_rows.append(f"({q(attempt_id)}, {q(created_ts)}, {q(ta_id)}, {q(sim.id)})")

                # 2. simulation_chats
                completed = random.random() < 0.95
                scenario_id = random.choice(sim.scenario_ids)
                chat_rows.append(
                    f"({q(chat_id)}, {q(created_ts)}, {q(created_ts)}, {q(created_ts) if completed else 'NULL'}, "
                    f"{q(random.choice(CHAT_TITLES))}, {q(scenario_id)}, {q(attempt_id)}, {str(completed).lower()}, NULL)"
                )

                # 3. simulation_messages (2 pairs = 4 messages)
                chat_start_time = datetime.datetime.fromisoformat(created_ts.replace("'", ""))
                for i in range(2):
                    q_time = chat_start_time + datetime.timedelta(seconds=i * 20 + random.randint(1, 5))
                    message_rows.append(f"({q(uuid.uuid4())}, {q(q_time)}, {q(q_time)}, {q(chat_id)}, {q(random.choice(QUESTION_BANK))}, 'query', true)")
                    r_time = q_time + datetime.timedelta(seconds=random.randint(5, 15))
                    message_rows.append(f"({q(uuid.uuid4())}, {q(r_time)}, {q(r_time)}, {q(chat_id)}, {q(random.choice(ANSWER_BANK))}, 'response', true)")

                # 4. simulation_chat_grades & 5. simulation_chat_feedbacks
                score, feedback_data = generate_grades_and_feedback(standards_by_rubric)
                grade_rows.append(f"({q(grade_id)}, {q(created_ts)}, {str(score >= 17).lower()}, {score}, {random.randint(180, 600)}, {q(rubric_id)}, {q(chat_id)})")
                for std_id, pts in feedback_data:
                    fb_rows.append(f"({q(uuid.uuid4())}, {q(created_ts)}, {q(std_id)}, {q(grade_id)}, {pts}, {q(f'Performance rated {pts}/5.')})")

        # --- Assemble and write the final SQL script ---
        def build_sql(table: str, cols: str, rows: list) -> str:
            if not rows: return ""
            return f"INSERT INTO {table} ({cols}) VALUES\n  " + ",\n  ".join(rows) + ";\n\n"

        sql_output = "".join([
            build_sql("simulation_attempts", "id, created_at, profile_id, simulation_id", attempt_rows),
            build_sql("simulation_chats", "id, created_at, updated_at, completed_at, title, scenario_id, attempt_id, completed, trace_id", chat_rows),
            build_sql("simulation_messages", "id, created_at, updated_at, chat_id, content, type, completed", message_rows),
            build_sql("simulation_chat_grades", "id, created_at, passed, score, time_taken, rubric_id, simulation_chat_id", grade_rows),
            build_sql("simulation_chat_feedbacks", "id, created_at, standard_id, simulation_chat_grade_id, total, feedback", fb_rows),
        ])
        
        output_path = "generated_simulation_data.sql"
        with open(output_path, "w") as f: f.write(sql_output)
        
        print("\n" + "="*50)
        print("✅ DYNAMIC DATA GENERATION COMPLETE")
        print("="*50)
        print(f"  - {len(attempt_rows)} simulation attempts created.")
        print(f"  - {len(message_rows)} messages for {len(chat_rows)} chats.")
        print(f"  - {len(grade_rows)} grades with {len(fb_rows)} feedback entries.")
        print("\n📁 SQL output written to: " + output_path)
        print("="*50)

    finally:
        session.close()

if __name__ == "__main__":
    main()
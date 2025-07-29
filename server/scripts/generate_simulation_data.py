#!/usr/bin/env python3
"""
Dynamic bulk data generator for the GLOW platform.

This script connects to the live database to fetch all simulations, TA profiles,
and rubric structures using the project's auto-generated SQLModels. It then
generates realistic seed data for every simulation found, ensuring:
- TAs only have grades for cohorts/simulations they are assigned to
- Grades are created for all rubric items
- Diverse set of passing, failing, and no data scenarios
- Realistic distribution of performance data
"""

import datetime
import random
import uuid
from typing import Dict, List, Optional, Tuple

# Assumes database.py (for DB connection) and models.py (for schema) are in the same directory
from app.db import get_session
from app.models import (Cohorts, Profiles, Rubrics, SimulationAttempts,
                        SimulationChatFeedbacks, SimulationChatGrades,
                        SimulationChats, SimulationMessages, Simulations,
                        StandardGroups, Standards)
from sqlmodel import Session, select

# =========================================================================== #
# 1. Data Fetching and Generation Logic
# =========================================================================== #


def fetch_source_data(session: Session) -> dict:
    """Queries the database to get all necessary source data for generation."""
    print("🔍 Fetching source data from the database...")

    # Fetch all active simulations that have at least one scenario
    sim_statement = select(Simulations).where(Simulations.active == True)
    simulations = [
        sim
        for sim in session.exec(sim_statement).all()
        if sim.scenario_ids and len(sim.scenario_ids) > 0
    ]
    if not simulations:
        raise ValueError(
            "No active simulations with linked scenarios found. Please seed the database first."
        )
    print(f"  > Found {len(simulations)} active simulations with scenarios.")

    # Fetch all TA profiles (role = 'ta') from the database
    ta_profiles_statement = select(Profiles).where(Profiles.role == "ta")
    ta_profiles = session.exec(ta_profiles_statement).all()
    if not ta_profiles:
        raise ValueError("No TA profiles found in the database.")
    print(f"  > Found {len(ta_profiles)} TA profiles.")

    # Fetch all active cohorts
    cohorts_statement = select(Cohorts).where(Cohorts.active == True)
    cohorts = session.exec(cohorts_statement).all()
    if not cohorts:
        raise ValueError("No active cohorts found in the database.")
    print(f"  > Found {len(cohorts)} active cohorts.")

    # Fetch all rubrics and their complete structure
    rubrics_statement = select(Rubrics).where(Rubrics.active == True)
    rubrics = session.exec(rubrics_statement).all()
    if not rubrics:
        raise ValueError("No active rubrics found in the database.")
    
    # Build complete rubric structure for each rubric
    rubrics_data = {}
    for rubric in rubrics:
        # Get standard groups for this rubric
        groups_statement = select(StandardGroups).where(StandardGroups.rubric_id == rubric.id)
        standard_groups = session.exec(groups_statement).all()
        
        # Get standards for each group
        standards_by_group = {}
        for group in standard_groups:
            standards_statement = select(Standards).where(Standards.standard_group_id == group.id)
            standards = session.exec(standards_statement).all()
            # Sort standards by points (1-5 scale)
            standards_sorted = sorted(standards, key=lambda s: s.points)
            standards_by_group[str(group.id)] = standards_sorted
        
        rubrics_data[str(rubric.id)] = {
            'rubric': rubric,
            'standard_groups': standard_groups,
            'standards_by_group': standards_by_group
        }
    
    print(f"  > Loaded {len(rubrics)} active rubrics with complete grading structures.")

    return {
        "simulations": simulations,
        "ta_profiles": ta_profiles,
        "cohorts": cohorts,
        "rubrics_data": rubrics_data,
    }


def get_ta_simulations(ta_profile: Profiles, cohorts: List[Cohorts], simulations: List[Simulations]) -> List[Simulations]:
    """
    Get simulations that a TA is assigned to based on their cohort memberships.
    """
    ta_simulations = []
    
    for cohort in cohorts:
        # Check if TA is in this cohort
        if ta_profile.id in cohort.profile_ids:
            # Get simulations assigned to this cohort
            for simulation in simulations:
                if simulation.id in cohort.simulation_ids:
                    ta_simulations.append(simulation)
    
    return ta_simulations


def generate_realistic_grade(ta_profile: Profiles, simulation: Simulations, rubrics_data: dict) -> Tuple[int, List[Tuple], bool]:
    """
    Generate a realistic grade based on TA profile and simulation context.
    Returns (total_score, feedback_data, passed)
    """
    rubric_data = rubrics_data.get(str(simulation.rubric_id))
    if not rubric_data:
        raise ValueError(f"No rubric data found for simulation {simulation.id}")
    
    rubric = rubric_data['rubric']
    standard_groups = rubric_data['standard_groups']
    standards_by_group = rubric_data['standards_by_group']
    
    # Generate realistic performance based on various factors
    # Base performance with some randomness
    base_performance = random.gauss(0.7, 0.15)  # Mean 70%, std dev 15%
    
    # Adjust based on simulation difficulty (practice vs regular)
    if simulation.practice_simulation:
        base_performance += 0.1  # Practice simulations are easier
    
    # Add some variability based on TA experience (using profile ID as seed)
    profile_seed = hash(str(ta_profile.id)) % 1000
    random.seed(profile_seed)
    experience_bonus = random.uniform(-0.1, 0.1)
    base_performance += experience_bonus
    
    # Clamp to reasonable range
    base_performance = max(0.1, min(0.95, base_performance))
    
    # Convert to score out of rubric total points
    total_score = int(round(base_performance * rubric.points))
    
    # Determine if passed
    passed = total_score >= rubric.pass_points
    
    # Generate individual standard group scores
    feedback_data = []
    remaining_points = total_score
    
    for group in standard_groups:
        group_standards = standards_by_group.get(str(group.id), [])
        if not group_standards:
            continue
        
        # Distribute points for this group (1-5 scale)
        if len(standard_groups) == 1:
            # Single group, use all points
            group_score = min(5, max(1, remaining_points))
        else:
            # Multiple groups, distribute more evenly
            group_score = min(5, max(1, random.randint(1, 5)))
        
        # Find the standard that matches this score
        matching_standard = None
        for standard in group_standards:
            if standard.points == group_score:
                matching_standard = standard
                break
        
        if matching_standard:
            feedback_data.append((str(matching_standard.id), group_score))
            remaining_points -= group_score
    
    # Ensure we don't have negative remaining points
    if remaining_points < 0:
        # Redistribute excess points
        for i in range(len(feedback_data)):
            if feedback_data[i][1] > 1:
                feedback_data[i] = (feedback_data[i][0], feedback_data[i][1] - 1)
                remaining_points += 1
                if remaining_points >= 0:
                    break
    
    return total_score, feedback_data, passed


def generate_diverse_performance_scenarios(ta_profiles: List[Profiles], simulations: List[Simulations], 
                                         cohorts: List[Cohorts], rubrics_data: dict) -> List[Dict]:
    """
    Generate diverse performance scenarios including passing, failing, and no data.
    """
    scenarios = []
    
    for ta_profile in ta_profiles:
        # Get simulations this TA is assigned to
        ta_simulations = get_ta_simulations(ta_profile, cohorts, simulations)
        
        if not ta_simulations:
            # TA not assigned to any simulations - no data scenario
            continue
        
        # Determine how many simulations this TA will attempt
        # Some TAs will attempt all, some will attempt some, some will attempt none
        attempt_probability = random.random()
        
        if attempt_probability < 0.3:
            # 30% of TAs attempt all their assigned simulations
            simulations_to_attempt = ta_simulations
        elif attempt_probability < 0.7:
            # 40% of TAs attempt some of their assigned simulations
            num_to_attempt = random.randint(1, len(ta_simulations))
            simulations_to_attempt = random.sample(ta_simulations, num_to_attempt)
        else:
            # 30% of TAs attempt none (no data scenario)
            simulations_to_attempt = []
        
        for simulation in simulations_to_attempt:
            # Generate realistic grade
            total_score, feedback_data, passed = generate_realistic_grade(
                ta_profile, simulation, rubrics_data
            )
            
            scenarios.append({
                'ta_profile': ta_profile,
                'simulation': simulation,
                'total_score': total_score,
                'feedback_data': feedback_data,
                'passed': passed,
                'will_attempt': True
            })
    
    return scenarios


def q(s: str) -> str:
    """Wraps a string in single quotes and escapes internal single quotes."""
    return "'" + str(s).replace("'", "''") + "'"


def rand_ts(base_date: datetime.datetime) -> str:
    """Generates a random timestamp around a base date with some jitter."""
    jitter = datetime.timedelta(seconds=random.randint(-3600, 3600))
    return (base_date + jitter).isoformat(timespec="seconds")


# =========================================================================== #
# 2. Main Execution Block
# =========================================================================== #


def main():
    """Main function to run the data generation process."""
    # --- Configuration ---
    QUESTION_BANK = [
        "Can you explain this output?",
        "Why is this line null?",
        "How do I optimize this loop?",
        "What's wrong with my algorithm?",
        "I don't understand this concept.",
        "Can you help me debug this?",
        "How do I implement this feature?",
        "What's the best way to approach this problem?",
    ]
    ANSWER_BANK = [
        "Let's trace through the code step by step.",
        "The issue is in your initialization - you need to set a default value.",
        "Your loop condition is causing an infinite loop.",
        "The algorithm is correct, but you're missing the base case.",
        "Let me explain this concept with a simple example.",
        "Let's add some debug prints to see what's happening.",
        "Here's how you can implement this feature:",
        "The best approach is to break this down into smaller steps.",
    ]
    CHAT_TITLES = [
        "Debug Help", "Algorithm Question", "Concept Check", "Code Review",
        "Problem Solving", "Implementation Help", "Understanding Request",
        "Best Practice Discussion"
    ]
    
    # Configuration for data generation - reduced for testing
    TOTAL_SCENARIOS_TO_GENERATE = 500  # Reduced from 500 for testing
    TODAY = datetime.datetime.now(datetime.timezone.utc)
    START_DATE = TODAY - datetime.timedelta(days=90)
    random.seed(42)  # For reproducible results

    # Use the session from the provided database.py
    session = next(get_session())

    try:
        source_data = fetch_source_data(session)
        simulations = source_data["simulations"]
        ta_profiles = source_data["ta_profiles"]
        cohorts = source_data["cohorts"]
        rubrics_data = source_data["rubrics_data"]

        print(f"\n🎯 Generating realistic simulation data...")
        print(f"  - {len(ta_profiles)} TA profiles")
        print(f"  - {len(simulations)} simulations")
        print(f"  - {len(cohorts)} cohorts")
        print(f"  - {len(rubrics_data)} rubrics")

        # Generate diverse performance scenarios
        scenarios = generate_diverse_performance_scenarios(
            ta_profiles, simulations, cohorts, rubrics_data
        )
        
        # Limit to target number if we have more
        if len(scenarios) > TOTAL_SCENARIOS_TO_GENERATE:
            scenarios = random.sample(scenarios, TOTAL_SCENARIOS_TO_GENERATE)
        
        print(f"  - Generated {len(scenarios)} performance scenarios")

        # --- Buckets for SQL VALUE clauses ---
        attempt_rows, chat_rows, message_rows, grade_rows, fb_rows = (
            [] for _ in range(5)
        )

        print(f"\n🚀 Generating simulation data for {len(scenarios)} scenarios...")

        for i, scenario in enumerate(scenarios):
            progress = i / (len(scenarios) - 1) if len(scenarios) > 1 else 0
            
            ta_profile = scenario['ta_profile']
            simulation = scenario['simulation']
            
            # Generate unique IDs
            attempt_id, chat_id, grade_id = (
                str(uuid.uuid4()),
                str(uuid.uuid4()),
                str(uuid.uuid4()),
            )
            
            # Generate realistic timestamp
            base_date = START_DATE + progress * (TODAY - START_DATE)
            created_ts = rand_ts(base_date)

            # 1. simulation_attempts
            attempt_rows.append(
                f"({q(attempt_id)}, {q(created_ts)}, {q(ta_profile.id)}, {q(simulation.id)})"
            )

            # 2. simulation_chats
            completed = random.random() < 0.95  # 95% completion rate
            scenario_id = random.choice(simulation.scenario_ids)
            chat_rows.append(
                f"({q(chat_id)}, {q(created_ts)}, {q(created_ts)}, {q(created_ts) if completed else 'NULL'}, "
                f"{q(random.choice(CHAT_TITLES))}, {q(scenario_id)}, {q(attempt_id)}, {str(completed).lower()}, NULL)"
            )

            # 3. simulation_messages (2-4 message pairs for realistic conversations)
            chat_start_time = datetime.datetime.fromisoformat(
                created_ts.replace("'", "")
            )
            num_exchanges = random.randint(2, 4)
            
            for i in range(num_exchanges):
                q_time = chat_start_time + datetime.timedelta(
                    seconds=i * 30 + random.randint(1, 10)
                )
                message_rows.append(
                    f"({q(uuid.uuid4())}, {q(q_time)}, {q(q_time)}, {q(chat_id)}, {q(random.choice(QUESTION_BANK))}, 'query', true)"
                )
                r_time = q_time + datetime.timedelta(seconds=random.randint(10, 25))
                message_rows.append(
                    f"({q(uuid.uuid4())}, {q(r_time)}, {q(r_time)}, {q(chat_id)}, {q(random.choice(ANSWER_BANK))}, 'response', true)"
                )

            # 4. simulation_chat_grades
            total_score = scenario['total_score']
            passed = scenario['passed']
            time_taken = random.randint(180, 600)  # 3-10 minutes
            rubric_id = simulation.rubric_id
            
            grade_rows.append(
                f"({q(grade_id)}, {q(created_ts)}, {str(passed).lower()}, {total_score}, {time_taken}, {q(rubric_id)}, {q(chat_id)})"
            )

            # 5. simulation_chat_feedbacks (one for each standard group)
            feedback_data = scenario['feedback_data']
            for standard_id, points in feedback_data:
                feedback_text = f"Performance rated {points}/5 for this standard."
                fb_rows.append(
                    f"({q(uuid.uuid4())}, {q(created_ts)}, {q(standard_id)}, {q(grade_id)}, {points}, {q(feedback_text)})"
                )

        # --- Assemble and write the final SQL script ---
        def build_sql(table: str, cols: str, rows: list) -> str:
            if not rows:
                return ""
            return (
                f"INSERT INTO {table} ({cols}) VALUES\n  "
                + ",\n  ".join(rows)
                + ";\n\n"
            )

        sql_output = "".join(
            [
                build_sql(
                    "simulation_attempts",
                    "id, created_at, profile_id, simulation_id",
                    attempt_rows,
                ),
                build_sql(
                    "simulation_chats",
                    "id, created_at, updated_at, completed_at, title, scenario_id, attempt_id, completed, trace_id",
                    chat_rows,
                ),
                build_sql(
                    "simulation_messages",
                    "id, created_at, updated_at, chat_id, content, type, completed",
                    message_rows,
                ),
                build_sql(
                    "simulation_chat_grades",
                    "id, created_at, passed, score, time_taken, rubric_id, simulation_chat_id",
                    grade_rows,
                ),
                build_sql(
                    "simulation_chat_feedbacks",
                    "id, created_at, standard_id, simulation_chat_grade_id, total, feedback",
                    fb_rows,
                ),
            ]
        )

        output_path = "generated_simulation_data.sql"
        with open(output_path, "w") as f:
            f.write(sql_output)

        # Calculate statistics
        total_attempts = len(attempt_rows)
        total_chats = len(chat_rows)
        total_messages = len(message_rows)
        total_grades = len(grade_rows)
        total_feedbacks = len(fb_rows)
        
        # Calculate passing rate
        passing_grades = sum(1 for row in grade_rows if "true" in row.split(", ")[2])
        passing_rate = (passing_grades / total_grades * 100) if total_grades > 0 else 0

        print("\n" + "=" * 60)
        print("✅ DYNAMIC SIMULATION DATA GENERATION COMPLETE")
        print("=" * 60)
        print(f"  📊 Statistics:")
        print(f"    - {total_attempts} simulation attempts created")
        print(f"    - {total_chats} simulation chats created")
        print(f"    - {total_messages} messages created")
        print(f"    - {total_grades} grades created")
        print(f"    - {total_feedbacks} feedback entries created")
        print(f"    - {passing_rate:.1f}% passing rate")
        print(f"\n  🎯 Features:")
        print(f"    - TAs only graded on assigned simulations")
        print(f"    - Complete rubric coverage (all standards)")
        print(f"    - Diverse performance distribution")
        print(f"    - Realistic conversation patterns")
        print(f"\n📁 SQL output written to: {output_path}")
        print("=" * 60)

    except Exception as e:
        print(f"❌ Error during data generation: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()


if __name__ == "__main__":
    main()

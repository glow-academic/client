# app/routes/users.py
import logging
import os
import statistics
import tempfile
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Tuple

# Set matplotlib to use non-interactive backend
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
from app.db import get_session
from app.models import (Agents, Profiles, Rubrics, Scenarios,
                        SimulationAttempts, SimulationChatFeedbacks,
                        SimulationChatGrades, SimulationChats, Simulations,
                        StandardGroups, Standards)
from fastapi import APIRouter, Depends, HTTPException, Query, Response
# PyLaTeX imports
from pylatex import (Document, Figure, Foot, Head, PageStyle, Section,
                     Subsection, Tabular)
from pylatex.utils import NoEscape, bold, escape_latex
from sqlmodel import Session, select

matplotlib.use("Agg")

logger = logging.getLogger(__name__)

router = APIRouter()


def create_student_type_chart(chat_agents: Dict[str, int], filename: str):
    """Create a pie chart showing distribution of student types the TA has interacted with"""
    labels = list(chat_agents.keys())
    sizes = list(chat_agents.values())
    colors = {
        "aggressive": "#ff6b6b",  # Red for aggressive
        "happy": "#51cf66",  # Green for happy
        "confused": "#fcc419",  # Yellow for confused
    }
    chart_colors = [colors.get(label, "#adb5bd") for label in labels]

    plt.figure(figsize=(8, 6))
    plt.pie(sizes, labels=labels, autopct="%1.1f%%", colors=chart_colors, startangle=90)
    plt.axis("equal")
    plt.title("Distribution of Student Types")
    plt.savefig(filename)
    plt.close()
    return filename


def create_score_radar_chart(scores: Dict[str, int], filename: str):
    """Create a radar chart showing scores across different categories"""
    categories = list(scores.keys())
    values = list(scores.values())

    # Number of variables
    N = len(categories)

    # Compute angle for each category
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]  # Close the loop

    # Add the values for the loop closure
    values += values[:1]

    plt.figure(figsize=(8, 8))
    ax = plt.subplot(111, polar=True)

    # Draw the chart
    ax.plot(angles, values, "o-", linewidth=2)
    ax.fill(angles, values, alpha=0.25)

    # Draw category labels
    plt.xticks(angles[:-1], categories)

    # Draw radial axes
    ax.set_rlabel_position(0)
    plt.yticks(
        [20, 40, 60, 80, 100], ["20", "40", "60", "80", "100"], color="grey", size=8
    )
    plt.ylim(0, 100)

    plt.title("Performance Across Categories", size=14)
    plt.savefig(filename)
    plt.close()
    return filename


def create_time_series_chart(time_data: List[Tuple[datetime, int]], filename: str):
    """Create a time series chart showing score progression over time"""
    dates = [item[0] for item in time_data]
    scores = [item[1] for item in time_data]

    plt.figure(figsize=(10, 6))
    plt.plot(dates, scores, marker="o", linestyle="-", color="#4c6ef5")

    plt.xlabel("Date")
    plt.ylabel("Score")
    plt.title("Performance Score Over Time")
    plt.grid(True, linestyle="--", alpha=0.7)

    # Format the date axis
    plt.gcf().autofmt_xdate()

    plt.tight_layout()
    plt.savefig(filename)
    plt.close()
    return filename


def create_student_type_performance(
    performance_by_type: Dict[str, List[int]], filename: str
):
    """Create a bar chart showing performance across different student types"""
    student_types = list(performance_by_type.keys())
    avg_scores = [
        statistics.mean(scores) if scores else 0
        for scores in performance_by_type.values()
    ]

    colors = {
        "aggressive": "#ff6b6b",  # Red for aggressive
        "happy": "#51cf66",  # Green for happy
        "confused": "#fcc419",  # Yellow for confused
    }
    bar_colors = [colors.get(stype, "#adb5bd") for stype in student_types]

    plt.figure(figsize=(8, 6))
    bars = plt.bar(student_types, avg_scores, color=bar_colors)

    # Add score labels on top of bars
    for bar, score in zip(bars, avg_scores):
        plt.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 1,
            f"{score:.1f}",
            ha="center",
            va="bottom",
        )

    plt.xlabel("Student Types")
    plt.ylabel("Average Score")
    plt.title("Performance by Student Type")
    plt.ylim(0, 105)  # Set y-axis limit to accommodate labels

    plt.tight_layout()
    plt.savefig(filename)
    plt.close()
    return filename


def create_score_table(
    grades: List[SimulationChatGrades],
    chats: List[SimulationChats],
    attempts: List[SimulationAttempts],
    simulations: List[Simulations],
    doc,
):
    """Create a detailed performance score table"""
    # Create a mapping for quick lookups
    chat_map = {chat.id: chat for chat in chats}
    attempt_map = {attempt.id: attempt for attempt in attempts}
    simulation_map = {sim.id: sim for sim in simulations}

    # Define the tabular environment
    with doc.create(Tabular("|c|c|c|c|c|", booktabs=True)) as table:
        table.add_hline()
        table.add_row(
            (
                "Simulation",
                "Score",
                "Time Taken (min)",
                "Passed",
                "Date",
            ),
            mapper=[bold],
        )
        table.add_hline()

        # Add data rows
        for grade in grades[:10]:  # Limit to 10 rows for readability
            # Get simulation name through the relationship chain
            chat = chat_map.get(grade.simulation_chat_id)
            simulation_name = "Unknown"
            if chat:
                attempt = attempt_map.get(chat.attempt_id)
                if attempt:
                    simulation = simulation_map.get(attempt.simulation_id)
                    if simulation:
                        simulation_name = (
                            simulation.title[:30] + "..."
                            if len(simulation.title) > 30
                            else simulation.title
                        )

            time_minutes = round(grade.time_taken / 60) if grade.time_taken else 0
            passed_text = "Yes" if grade.passed else "No"
            date_str = (
                grade.created_at.strftime("%Y-%m-%d") if grade.created_at else "N/A"
            )

            table.add_row(
                (
                    simulation_name,
                    grade.score,
                    time_minutes,
                    passed_text,
                    date_str,
                )
            )
            table.add_hline()

        # Add average row if we have grades
        if grades:
            avg_score = int(statistics.mean([g.score for g in grades]))
            avg_time = (
                int(
                    statistics.mean([g.time_taken for g in grades if g.time_taken]) / 60
                )
                if any(g.time_taken for g in grades)
                else 0
            )
            pass_rate = int((sum(1 for g in grades if g.passed) / len(grades)) * 100)

            table.add_row(
                ("Average", avg_score, avg_time, f"{pass_rate}%", ""),
                mapper=[bold],
            )
            table.add_hline()


@router.get("/{profile_id}")
async def get_report(
    profile_id: str,
    session: Session = Depends(get_session),
    includeStudentTypeChart: bool = Query(
        True, description="Include student type distribution chart"
    ),
    includePerformanceChart: bool = Query(
        True, description="Include performance by student type chart"
    ),
    includeRadarChart: bool = Query(True, description="Include skills radar chart"),
    includeTimeChart: bool = Query(
        True, description="Include performance over time chart"
    ),
    includeDetailedScores: bool = Query(
        True, description="Include detailed score table"
    ),
    includeFeedback: bool = Query(
        True, description="Include detailed feedback section"
    ),
):
    """
    Generate and return a comprehensive PDF report for a user's performance.
    """
    # Find the user in the database
    profile = session.exec(
        select(Profiles).where(Profiles.id == profile_id)
    ).one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Get the chats for the user through attempts
    attempts = session.exec(
        select(SimulationAttempts).where(SimulationAttempts.profile_id == profile_id)
    ).all()
    if not attempts:
        raise HTTPException(status_code=404, detail="No attempts found for this user")

    # Get all chats from the user's attempts
    attempt_ids = [attempt.id for attempt in attempts]
    chats = session.exec(
        select(SimulationChats).where(SimulationChats.attempt_id.in_(attempt_ids))
    ).all()
    if not chats:
        raise HTTPException(status_code=404, detail="No chats found for this user")

    # Get all grades for the user's chats
    chat_ids = [chat.id for chat in chats]
    grades = session.exec(
        select(SimulationChatGrades).where(
            SimulationChatGrades.simulation_chat_id.in_(chat_ids)
        )
    ).all()

    # Get all feedbacks for the user's grades
    grade_ids = [grade.id for grade in grades]
    feedbacks = session.exec(
        select(SimulationChatFeedbacks).where(
            SimulationChatFeedbacks.simulation_chat_grade_id.in_(grade_ids)
        )
    ).all()

    # Get reference data
    rubrics = session.exec(select(Rubrics)).all()
    standard_groups = session.exec(select(StandardGroups)).all()
    standards = session.exec(select(Standards)).all()

    # Get all agents for dynamic descriptions
    agents = session.exec(select(Agents)).all()
    agent_map = {agent.id: agent for agent in agents}

    # Get all simulations for the table
    simulation_ids = list(set(attempt.simulation_id for attempt in attempts))
    simulations = session.exec(
        select(Simulations).where(Simulations.id.in_(simulation_ids))
    ).all()

    # Create temporary directory for the report files
    with tempfile.TemporaryDirectory() as temp_dir:
        # Prepare data for charts

        # 1. Student type distribution
        chat_agents = defaultdict(int)
        for chat in chats:
            # Get the scenario first, then the agent
            scenario = session.exec(
                select(Scenarios).where(Scenarios.id == chat.scenario_id)
            ).one_or_none()
            if scenario:
                agent = session.exec(
                    select(Agents).where(Agents.id == scenario.agent_id)
                ).one_or_none()
                if agent:
                    chat_agents[agent.name] += 1

        # 2. Performance by student type
        performance_by_type = defaultdict(list)
        for chat in chats:
            # Get the scenario first, then the agent
            scenario = session.exec(
                select(Scenarios).where(Scenarios.id == chat.scenario_id)
            ).one_or_none()
            if scenario:
                agent = session.exec(
                    select(Agents).where(Agents.id == scenario.agent_id)
                ).one_or_none()
                if agent:
                    for grade in grades:
                        if grade.simulation_chat_id == chat.id:
                            performance_by_type[agent.name].append(grade.score)

        # 3. Average scores for different skill categories (similar to Overview.tsx)
        skill_categories = {}
        for group in standard_groups:
            group_standards = [s for s in standards if s.standard_group_id == group.id]
            group_feedbacks = [
                f
                for f in feedbacks
                if any(s.id == f.standard_id for s in group_standards)
            ]

            if group_feedbacks and group_standards:
                max_points = (
                    max([s.points for s in group_standards]) if group_standards else 1
                )
                avg_score = int(
                    (
                        sum(f.total for f in group_feedbacks)
                        / len(group_feedbacks)
                        / max_points
                    )
                    * 100
                )
                skill_categories[group.short_name] = avg_score

        # 4. Score progression over time
        time_series_data = [(g.created_at, g.score) for g in grades if g.created_at]
        time_series_data.sort(key=lambda x: x[0])  # Sort by date

        # Generate charts based on options
        chart_files = {}

        if includeStudentTypeChart and chat_agents:
            agent_chart = os.path.join(temp_dir, "student_types.png")
            create_student_type_chart(chat_agents, agent_chart)
            chart_files["student_types"] = agent_chart

        if includePerformanceChart and performance_by_type:
            performance_chart = os.path.join(temp_dir, "performance_by_type.png")
            create_student_type_performance(performance_by_type, performance_chart)
            chart_files["performance_by_type"] = performance_chart

        if includeRadarChart and skill_categories:
            radar_chart = os.path.join(temp_dir, "radar_chart.png")
            create_score_radar_chart(skill_categories, radar_chart)
            chart_files["radar"] = radar_chart

        if includeTimeChart and len(time_series_data) > 1:
            time_chart = os.path.join(temp_dir, "time_chart.png")
            create_time_series_chart(time_series_data, time_chart)
            chart_files["time_series"] = time_chart

        # Create PDF using PyLaTeX
        pdf_filename = f"TA_Report_{profile.first_name.replace(' ', '_')}.pdf"
        doc = Document(os.path.join(temp_dir, "report"))

        # Add document preamble for better formatting
        doc.preamble.append(NoEscape(r"\usepackage{geometry}"))
        doc.preamble.append(NoEscape(r"\geometry{a4paper,margin=1in}"))
        doc.preamble.append(NoEscape(r"\usepackage{fancyhdr}"))
        doc.preamble.append(NoEscape(r"\usepackage{xcolor}"))
        doc.preamble.append(NoEscape(r"\usepackage{graphicx}"))
        doc.preamble.append(NoEscape(r"\usepackage{booktabs}"))

        # Create custom page style
        header = PageStyle("header")
        with header.create(Head("L")):
            header.append("TA Performance Report")
        with header.create(Head("R")):
            header.append(f"Generated: {datetime.now().strftime('%Y-%m-%d')}")
        with header.create(Foot("C")):
            header.append("Page ")
            header.append(NoEscape(r"\thepage"))

        doc.preamble.append(header)
        doc.change_document_style("header")

        # Title Page
        doc.append(NoEscape(r"\begin{titlepage}"))
        doc.append(NoEscape(r"\centering"))
        doc.append(NoEscape(r"{\Huge\bfseries TA Performance Report\par}"))
        doc.append(NoEscape(r"\vspace{2cm}"))
        doc.append(
            NoEscape(
                r"{\Large\bfseries "
                + escape_latex(profile.first_name)
                + " "
                + escape_latex(profile.last_name)
                + r"\par}"
            )
        )
        doc.append(NoEscape(r"\vspace{1cm}"))
        doc.append(
            NoEscape(
                r"{\Large Generated on "
                + datetime.now().strftime("%B %d, %Y")
                + r"\par}"
            )
        )
        doc.append(NoEscape(r"\vfill"))

        # Add a small "Generated by Glow" footer
        doc.append(NoEscape(r"\begin{flushright}"))
        doc.append(NoEscape(r"{\small Generated by Glow TA Training System\par}"))
        doc.append(NoEscape(r"\end{flushright}"))
        doc.append(NoEscape(r"\end{titlepage}"))

        # Executive Summary Section
        with doc.create(Section("Executive Summary")):
            total_score = int(
                statistics.mean([g.score for g in grades]) if grades else 0
            )

            doc.append(
                "This report summarizes your performance as a Teaching Assistant "
            )
            doc.append(f"based on {len(chats)} student interactions. ")
            doc.append(NoEscape(r"\par\medskip"))

            # Add key metrics in a formatted way
            doc.append(NoEscape(r"\begin{itemize}"))
            doc.append(
                NoEscape(
                    r"\item \textbf{Overall Performance Score}: "
                    + f"{total_score}\\%"
                    + r""
                )
            )
            doc.append(
                NoEscape(
                    r"\item \textbf{Student Types Encountered}: "
                    + f"{', '.join(chat_agents.keys())}"
                    + r""
                )
            )

            if skill_categories:
                strength = max(skill_categories.items(), key=lambda x: x[1])
                weakness = min(skill_categories.items(), key=lambda x: x[1])
                doc.append(
                    NoEscape(
                        r"\item \textbf{Strongest Area}: "
                        + f"{strength[0]} ({strength[1]}\\%)"
                        + r""
                    )
                )
                doc.append(
                    NoEscape(
                        r"\item \textbf{Area for Improvement}: "
                        + f"{weakness[0]} ({weakness[1]}\\%)"
                        + r""
                    )
                )

            doc.append(NoEscape(r"\end{itemize}"))

            # Add radar chart to summary section if enabled
            if includeRadarChart and "radar" in chart_files:
                with doc.create(Figure(position="h!")) as fig:
                    fig.add_image(
                        chart_files["radar"], width=NoEscape(r"0.7\textwidth")
                    )
                    fig.add_caption("Performance Across Categories")

        # Agent Analysis (formerly Student Types Analysis)
        if includeStudentTypeChart or includePerformanceChart:
            with doc.create(Section("Agent Analysis")):
                doc.append(
                    "This section analyzes your interactions with different AI agent personality types that simulate various student behaviors."
                )
                doc.append(NoEscape(r"\par\medskip"))

                # Add pie chart if enabled
                if includeStudentTypeChart and "student_types" in chart_files:
                    with doc.create(Figure(position="h!")) as fig:
                        fig.add_image(
                            chart_files["student_types"],
                            width=NoEscape(r"0.6\textwidth"),
                        )
                        fig.add_caption("Distribution of Agent Types")

                # Add dynamic explanation text for each agent type encountered
                if chat_agents:
                    doc.append(NoEscape(r"\subsection{Agent Descriptions}"))
                    doc.append(NoEscape(r"\begin{description}"))

                    # Get unique agent IDs from the chats
                    encountered_agent_ids = set()
                    for chat in chats:
                        scenario = session.exec(
                            select(Scenarios).where(Scenarios.id == chat.scenario_id)
                        ).one_or_none()
                        if scenario:
                            encountered_agent_ids.add(scenario.agent_id)

                    # Add descriptions for encountered agents
                    for agent_id in encountered_agent_ids:
                        agent = agent_map.get(agent_id)
                        if agent:
                            # Escape special LaTeX characters in the description
                            escaped_description = escape_latex(agent.description)
                            doc.append(
                                NoEscape(
                                    f"\\item[{escape_latex(agent.name)}] {escaped_description}"
                                )
                            )

                    doc.append(NoEscape(r"\end{description}"))

                # Add performance by agent type chart if enabled
                if includePerformanceChart and "performance_by_type" in chart_files:
                    with doc.create(Figure(position="h!")) as fig:
                        fig.add_image(
                            chart_files["performance_by_type"],
                            width=NoEscape(r"0.7\textwidth"),
                        )
                        fig.add_caption("Performance by Agent Type")

        # Performance Trends
        if includeTimeChart and "time_series" in chart_files:
            with doc.create(Section("Performance Over Time")):
                doc.append(
                    "This section shows how your performance scores have changed over time."
                )
                doc.append(NoEscape(r"\par\medskip"))

                with doc.create(Figure(position="h!")) as fig:
                    fig.add_image(
                        chart_files["time_series"], width=NoEscape(r"0.8\textwidth")
                    )
                    fig.add_caption("Score Trend")

        # Detailed Scores
        if includeDetailedScores and grades:
            with doc.create(Section("Detailed Performance Metrics")):
                doc.append(
                    "This table shows your scores across different performance categories for each interaction."
                )
                doc.append(NoEscape(r"\par\medskip"))

                create_score_table(grades, chats, attempts, simulations, doc)

        # Feedback Section
        if includeFeedback and feedbacks:
            with doc.create(Section("Detailed Feedback")):
                doc.append(
                    "This section provides specific feedback on your performance in key areas."
                )
                doc.append(NoEscape(r"\par\medskip"))

                # Group feedbacks by standard groups
                feedback_by_group = defaultdict(list)
                for feedback in feedbacks:
                    # Find the standard and its group
                    standard = next(
                        (s for s in standards if s.id == feedback.standard_id), None
                    )
                    if standard:
                        group = next(
                            (
                                g
                                for g in standard_groups
                                if g.id == standard.standard_group_id
                            ),
                            None,
                        )
                        if group and feedback.feedback:
                            feedback_by_group[group.name].append(feedback.feedback)

                for group_name, group_feedbacks in feedback_by_group.items():
                    if group_feedbacks:
                        with doc.create(Subsection(group_name)):
                            # Take the most recent feedback
                            doc.append(NoEscape(r"\begin{itemize}"))
                            for feedback_text in group_feedbacks[
                                -3:
                            ]:  # Show last 3 feedbacks
                                doc.append(
                                    NoEscape(r"\item " + escape_latex(feedback_text))
                                )
                            doc.append(NoEscape(r"\end{itemize}"))

        # Generate the PDF
        doc.generate_pdf(clean_tex=True)

        # Read the generated PDF to return it
        pdf_path = os.path.join(temp_dir, "report.pdf")
        with open(pdf_path, "rb") as file:
            pdf_bytes = file.read()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={pdf_filename}"},
        )


@router.post("/{profile_id}")
async def generate_report(
    profile_id: str,
    session: Session = Depends(get_session),
    includeStudentTypeChart: bool = Query(
        True, description="Include student type distribution chart"
    ),
    includePerformanceChart: bool = Query(
        True, description="Include performance by student type chart"
    ),
    includeRadarChart: bool = Query(True, description="Include skills radar chart"),
    includeTimeChart: bool = Query(
        True, description="Include performance over time chart"
    ),
    includeDetailedScores: bool = Query(
        True, description="Include detailed score table"
    ),
    includeFeedback: bool = Query(
        True, description="Include detailed feedback section"
    ),
):
    """
    This endpoint is used to initiate report generation for a user.
    It will return the same response as the GET endpoint.
    """
    return await get_report(
        profile_id,
        session,
        includeStudentTypeChart,
        includePerformanceChart,
        includeRadarChart,
        includeTimeChart,
        includeDetailedScores,
        includeFeedback,
    )

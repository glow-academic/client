# app/routes/report.py
from fastapi import APIRouter, Depends, HTTPException, Response
from app.db import get_session
from sqlmodel import Session, select
import logging
import os
import tempfile
from datetime import datetime
import statistics
from app.models import Users, Chats, Rubrics
from typing import Dict, List, Tuple
from collections import defaultdict

# PyLaTeX imports
from pylatex import Document, Section, Subsection, Tabular, Figure
from pylatex import PageStyle, Head, Foot
from pylatex.utils import bold, NoEscape, escape_latex
import matplotlib.pyplot as plt
import numpy as np

# Set matplotlib to use non-interactive backend
import matplotlib

matplotlib.use("Agg")

logger = logging.getLogger(__name__)

router = APIRouter()


def create_student_type_chart(chat_profiles: Dict[str, int], filename: str):
    """Create a pie chart showing distribution of student types the TA has interacted with"""
    labels = list(chat_profiles.keys())
    sizes = list(chat_profiles.values())
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


def create_score_table(rubrics: List[Rubrics], doc):
    """Create a detailed performance score table"""
    # Define the tabular environment
    with doc.create(Tabular("|c|c|c|c|c|c|", booktabs=True)) as table:
        table.add_hline()
        table.add_row(
            (
                "Chat ID",
                "Adaptability",
                "Listening",
                "Objectives",
                "Time Mgmt",
                "Overall",
            ),
            mapper=[bold],
        )
        table.add_hline()

        # Add data rows
        for r in rubrics[:10]:  # Limit to 10 rows for readability
            chat_id = str(r.chat_id)[:8] + "..."  # Truncate UUID for display
            table.add_row(
                (
                    chat_id,
                    r.adaptability,
                    r.listening,
                    r.objectives,
                    r.time_management,
                    r.score,
                )
            )
            table.add_hline()

        # Add average row if we have rubrics
        if rubrics:
            avg_adapt = int(statistics.mean([r.adaptability for r in rubrics]))
            avg_listen = int(statistics.mean([r.listening for r in rubrics]))
            avg_obj = int(statistics.mean([r.objectives for r in rubrics]))
            avg_time = int(statistics.mean([r.time_management for r in rubrics]))
            avg_score = int(statistics.mean([r.score for r in rubrics]))

            table.add_row(
                ("Average", avg_adapt, avg_listen, avg_obj, avg_time, avg_score),
                mapper=[bold],
            )
            table.add_hline()


@router.get("/{user_id}")
async def get_report(
    user_id: str,
    session: Session = Depends(get_session),
):
    """
    Generate and return a comprehensive PDF report for a user's performance.
    """
    # Find the user in the database
    user = session.exec(select(Users).where(Users.id == user_id)).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get the chats for the user
    chats = session.exec(select(Chats).where(Chats.user_id == user_id)).all()
    if not chats:
        raise HTTPException(status_code=404, detail="No chats found for this user")

    # Get all rubrics for the user's chats
    chat_ids = [chat.id for chat in chats]
    rubrics = session.exec(select(Rubrics).where(Rubrics.chat_id.in_(chat_ids))).all()

    # Create temporary directory for the report files
    with tempfile.TemporaryDirectory() as temp_dir:
        # Prepare data for charts

        # 1. Student type distribution
        chat_profiles = defaultdict(int)
        for chat in chats:
            chat_profiles[chat.profile] += 1

        # 2. Performance by student type
        performance_by_type = defaultdict(list)
        for chat in chats:
            for rubric in rubrics:
                if rubric.chat_id == chat.id:
                    performance_by_type[chat.profile].append(rubric.score)

        # 3. Average scores for different categories
        avg_scores = {
            "Adaptability": int(
                statistics.mean([r.adaptability for r in rubrics]) if rubrics else 0
            ),
            "Listening": int(
                statistics.mean([r.listening for r in rubrics]) if rubrics else 0
            ),
            "Objectives": int(
                statistics.mean([r.objectives for r in rubrics]) if rubrics else 0
            ),
            "Time Management": int(
                statistics.mean([r.time_management for r in rubrics]) if rubrics else 0
            ),
        }

        # 4. Score progression over time
        time_series_data = [(r.created_at, r.score) for r in rubrics]
        time_series_data.sort(key=lambda x: x[0])  # Sort by date

        # Generate charts
        profile_chart = os.path.join(temp_dir, "student_types.png")
        create_student_type_chart(chat_profiles, profile_chart)

        performance_chart = os.path.join(temp_dir, "performance_by_type.png")
        create_student_type_performance(performance_by_type, performance_chart)

        radar_chart = os.path.join(temp_dir, "radar_chart.png")
        create_score_radar_chart(avg_scores, radar_chart)

        time_chart = os.path.join(temp_dir, "time_chart.png")
        if (
            len(time_series_data) > 1
        ):  # Only create time chart if we have multiple data points
            create_time_series_chart(time_series_data, time_chart)

        # Create PDF using PyLaTeX
        pdf_filename = f"TA_Report_{user.name.replace(' ', '_')}.pdf"
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
        doc.append(NoEscape(r"{\Large\bfseries " + escape_latex(user.name) + r"\par}"))
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
                statistics.mean([r.score for r in rubrics]) if rubrics else 0
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
                    + f"{', '.join(chat_profiles.keys())}"
                    + r""
                )
            )

            if avg_scores:
                strength = max(avg_scores.items(), key=lambda x: x[1])
                weakness = min(avg_scores.items(), key=lambda x: x[1])
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

            # Add radar chart to summary section
            with doc.create(Figure(position="h!")) as fig:
                fig.add_image(radar_chart, width=NoEscape(r"0.7\textwidth"))
                fig.add_caption("Performance Across Categories")

        # Student Types Analysis
        with doc.create(Section("Student Type Analysis")):
            doc.append(
                "This section analyzes your interactions with different student personality types."
            )
            doc.append(NoEscape(r"\par\medskip"))

            # Add pie chart
            with doc.create(Figure(position="h!")) as fig:
                fig.add_image(profile_chart, width=NoEscape(r"0.6\textwidth"))
                fig.add_caption("Distribution of Student Types")

            # Add explanation text for each student type
            doc.append(NoEscape(r"\subsection{Student Type Descriptions}"))
            doc.append(NoEscape(r"\begin{description}"))
            doc.append(
                NoEscape(
                    r"\item[Happy Students] These students are engaged, understanding the material well, and responsive to teaching."
                )
            )
            doc.append(
                NoEscape(
                    r"\item[Confused Students] These students struggle to understand concepts and require additional explanation and patience."
                )
            )
            doc.append(
                NoEscape(
                    r"\item[Aggressive Students] These students are frustrated, possibly confrontational, and need careful handling."
                )
            )
            doc.append(NoEscape(r"\end{description}"))

            # Add performance by student type chart
            with doc.create(Figure(position="h!")) as fig:
                fig.add_image(performance_chart, width=NoEscape(r"0.7\textwidth"))
                fig.add_caption("Performance by Student Type")

        # Performance Trends
        if len(time_series_data) > 1:
            with doc.create(Section("Performance Over Time")):
                doc.append(
                    "This section shows how your performance scores have changed over time."
                )
                doc.append(NoEscape(r"\par\medskip"))

                with doc.create(Figure(position="h!")) as fig:
                    fig.add_image(time_chart, width=NoEscape(r"0.8\textwidth"))
                    fig.add_caption("Score Trend")

        # Detailed Scores
        with doc.create(Section("Detailed Performance Metrics")):
            doc.append(
                "This table shows your scores across different performance categories for each interaction."
            )
            doc.append(NoEscape(r"\par\medskip"))

            create_score_table(rubrics, doc)

        # Feedback Section
        with doc.create(Section("Detailed Feedback")):
            doc.append(
                "This section provides specific feedback on your performance in key areas."
            )
            doc.append(NoEscape(r"\par\medskip"))

            feedback_categories = [
                (
                    "Adaptability",
                    [
                        r.adaptability_feedback
                        for r in rubrics
                        if r.adaptability_feedback
                    ],
                ),
                (
                    "Listening",
                    [r.listening_feedback for r in rubrics if r.listening_feedback],
                ),
                (
                    "Objectives",
                    [r.objectives_feedback for r in rubrics if r.objectives_feedback],
                ),
                (
                    "Time Management",
                    [
                        r.time_management_feedback
                        for r in rubrics
                        if r.time_management_feedback
                    ],
                ),
            ]

            for category, feedbacks in feedback_categories:
                if feedbacks:
                    with doc.create(Subsection(category)):
                        # Take the most recent feedback
                        doc.append(NoEscape(r"\begin{itemize}"))
                        for feedback in feedbacks[-3:]:  # Show last 3 feedbacks
                            doc.append(NoEscape(r"\item " + escape_latex(feedback)))
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


@router.post("/{user_id}")
async def generate_report(
    user_id: str,
    session: Session = Depends(get_session),
):
    """
    This endpoint is used to initiate report generation for a user.
    It will return the same response as the GET endpoint.
    """
    return await get_report(user_id, session)

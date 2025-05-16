import pandas as pd
from ace_tools import display_dataframe_to_user

# Define the professionalized rubric
data = {
    "Criteria": [
        "Facilitates student-driven problem solving",
        "Demonstrates deep understanding of course objectives",
        "Manages session time effectively",
        "Adapts approach to individual student needs"
    ],
    "5 - Excellent": [
        "Consistently employs open-ended questions that empower students to discover solutions independently.",
        "Clearly articulates course objectives and aligns explanations with learning goals, ensuring conceptual clarity.",
        "Begins and concludes sessions within scheduled times, maximizing productivity and respecting student availability.",
        "Tailors explanations and examples to the student's background and learning style, demonstrating high adaptability."
    ],
    "4 - Good": [
        "Regularly uses guided questioning, encouraging student reasoning with occasional prompts.",
        "Explains course objectives accurately and relates examples to key learning outcomes.",
        "Generally adheres to time allocations with minor deviations that do not impact session quality.",
        "Adapts instructional approach to most student profiles with minor adjustments needed."
    ],
    "3 - Acceptable": [
        "Occasionally guides students with questions but sometimes provides direct answers.",
        "Provides a basic overview of objectives but with occasional inaccuracies or lack of depth.",
        "Sometimes exceeds or finishes early, slightly affecting pacing yet maintaining core engagement.",
        "Offers somewhat generic guidance with occasional attempts to adjust to student needs."
    ],
    "2 - Marginal": [
        "Rarely uses questioning techniques, often resorting to hints or partial solutions.",
        "Demonstrates limited awareness of course goals and offers explanations with minor misconceptions.",
        "Frequently mismanages time, leading to rushed explanations or unnecessary prolongation.",
        "Shows limited adaptation, often applying one-size-fits-all strategies regardless of student differences."
    ],
    "1 - Poor": [
        "Primarily provides answers without encouraging critical thinking or student engagement.",
        "Lacks understanding of course objectives, leading to inaccurate or irrelevant guidance.",
        "Poor time management resulting in incomplete discussions or wasted student time.",
        "Does not adjust approach, failing to consider individual student context and needs."
    ]
}

# Create DataFrame
rubric_df = pd.DataFrame(data)

# Display to user
display_dataframe_to_user(name="Professionalized Graduate TA Office Hours Interaction Rubric", dataframe=rubric_df)


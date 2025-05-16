from agents.items import TResponseInputItem

rubric = """
;5 - Excellent;4 - Good;3 - Acceptable;2 - Marginal;1 - Poor
Facilitates student-driven learning (listen);Consistently employs open-ended questions that empower students to discover solutions independently.;Regularly uses guided questioning, encouraging student reasoning with occasional prompts.;Occasionally guides students with questions but sometimes provides direct answers.;Rarely uses questioning techniques, often resorting to hints or partial solutions.;Directly provided the answer
Demonstrates understanding of course objectives (obj);Clearly articulates course objectives and aligns explanations with learning goals, ensuring conceptual clarity.;Explains course objectives accurately and relates examples to key learning outcomes.;Provides a basic overview of objectives but with occasional inaccuracies or lack of depth.;Demonstrates limited awareness of course goals and offers explanations with minor misconceptions.;Didn't know the course material, had to ask students, or clear demonstration of not knowing
Manages session time effectively (time);Begins and concludes sessions within scheduled times, maximizing productivity and respecting student availability.;Generally adheres to time allocations with minor deviations that do not impact session quality.;Sometimes exceeds or finishes early, slightly affecting pacing yet maintaining core engagement.;Frequently mismanages time, leading to rushed explanations or unnecessary prolongation.;Ended the conversation really early, or made it last longer than needed
Adapts approach to individual student needs (adapt);Perfectly adapts approach to diverse student emotional and attitude types;Mostly seamlessly adjusted communication and teaching style to effectively engage students across a wide range of emotional;Demonstrates thoughtful adjustments to support most student types, maintaining a supportive and responsive demeanor.;Shows minimal ability to adjust to varied student behaviors, occasionally missing cues or responding inappropriately.;Fails to adapt to different student types, responding uniformly without consideration of individual emotional or behavioral needs.
"""


def get_rubric() -> TResponseInputItem:
    return {
        "role": "assistant",
        "content": f"The following is the rubric for the evaluation: {rubric}",
    }

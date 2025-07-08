Your purpose is to create a scenario for a chat between a student and a GTA. The scenario should be a short description of the situation that the student and GTA (Graduate Teaching Assistant) are in. The scenario should be 1-2 sentences long. The scenario should be specific to the content that you will recieve. The scenario should be in the style of a real conversation between a student and a GTA. 

Moreover, you will be given a student agent, a course, a list of documents, a seniority, a crowdedness, intensity, time of day, location, and urgency. You must design the scenario and title to be for this agent, course, documents, seniority, crowdedness, intensity, time of day, location, and urgency without giving it away. You can make the title of the chat be related to the course, but not the profile.

Your goal is to just describe the situation without giving things away. For example, you might say that the office hours is for CS 253 (typically sophomores), when referring to the seniority. Assume the course numbers scale logically, CS 1XX -> freshman, CS 2XX -> sophmore, CS 3xx -> junior, and CS 4xx -> senior. If the class and seniority do not line up, you can use this as information to guide you about what type of student you are taking on (advanced for their grade or behind).

You want to help the GTA with working through the process of dealing with a student.

Try to always give a sense of how many other people are in line, to test the ability of the GTA to manage time.

You can also create a chat title to go along with the scenario. Here is an example of a scenario: 'Student is visibly agitated, approaches you quickly, you are a CS-253 GTA, and there are 10 people in line'. Here is an example of a chat title: 'Induction Homework Help'. You should output a JSON object with the following fields: title, scenario.
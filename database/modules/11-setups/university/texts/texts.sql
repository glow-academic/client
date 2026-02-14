-- Module: texts
-- Category: texts
-- Description: Text entries and connections for document texts
-- ============================================================

-- texts_entry
INSERT INTO public.texts_entry (id, content, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003a-7f3d-9c60-a6c537f708ce', '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Homework Assignment - Introduction to Computer Science</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px; }
        body { font-family: "Georgia", "Times New Roman", serif; background: #ffffff; color: #111827; line-height: 1.6; }
        .document-container { max-width: 850px; margin: 2.5rem auto 3rem; padding: 3rem 3.5rem; background: #ffffff; border: 1px solid #d4d4d8; }
        .document-title-section { padding-bottom: 1.75rem; margin-bottom: 1.75rem; border-bottom: 1.5px solid #9ca3af; text-align: center; }
        .document-title-section h1 { font-size: 2.25rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #111827; margin-bottom: 0.5rem; }
        .document-title-section .class-info { font-size: 0.95rem; color: #4b5563; }
        .meta-section { margin-bottom: 2.5rem; }
        .meta-grid { display: table; width: 100%; border-collapse: collapse; border-top: 1px solid #d4d4d8; border-bottom: 1px solid #d4d4d8; }
        .meta-item { display: table-row; }
        .meta-label, .meta-value { display: table-cell; padding: 0.5rem 0.25rem; vertical-align: top; font-size: 0.95rem; border-top: 1px solid #e5e7eb; }
        .meta-item:first-child .meta-label, .meta-item:first-child .meta-value { border-top: none; }
        .meta-label { width: 28%; font-weight: 600; color: #374151; padding-right: 1.5rem; white-space: nowrap; }
        .meta-value { color: #111827; }
        .section { margin-bottom: 2.5rem; }
        .section h2 { font-size: 1.35rem; font-weight: 700; color: #111827; margin-bottom: 1rem; border-bottom: 1px solid #9ca3af; padding-bottom: 0.4rem; }
        .instructions-content { border-left: 3px solid #111827; padding: 1.25rem 1.5rem; background: #f9fafb; font-size: 0.98rem; color: #111827; }
        .problem-set { margin-bottom: 2rem; border: 1px solid #d4d4d8; padding: 1.5rem; background: #ffffff; }
        .problem-set-title { font-size: 1.1rem; font-weight: 600; color: #111827; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; }
        .problem-item { margin-bottom: 1.25rem; padding-left: 1rem; }
        .problem-number { font-weight: 600; margin-right: 0.5rem; }
        .problem-text { margin-top: 0.5rem; }
        .problem-points { font-size: 0.85rem; font-weight: 600; color: #374151; padding: 0.15rem 0.5rem; border: 1px solid #d4d4d8; border-radius: 999px; display: inline-block; margin-left: 0.5rem; }
        .submission-info { border: 1px solid #d4d4d8; padding: 1rem 1.5rem; background: #f9fafb; margin-top: 2rem; }
        .submission-info h3 { font-size: 1rem; font-weight: 600; color: #111827; margin-bottom: 0.75rem; }
        .submission-info ul { list-style: none; padding-left: 0; }
        .submission-info li { margin-bottom: 0.5rem; padding-left: 1.5rem; position: relative; }
        .submission-info li:before { content: "\2022"; position: absolute; left: 0; color: #6b7280; }
        .document-footer { border-top: 1px solid #d4d4d8; padding: 1.5rem 0; margin-top: 1rem; font-size: 0.8rem; color: #4b5563; }
        .footer-content { max-width: 850px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .footer-branding { display: flex; align-items: center; gap: 0.75rem; }
        .footer-logo { width: 32px; height: 32px; border-radius: 2px; border: 1px solid #9ca3af; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem; color: #111827; }
        .footer-org-name { font-weight: 600; color: #111827; font-size: 0.9rem; }
        .footer-meta { font-size: 0.8rem; color: #4b5563; }
        @media print { body { background: #ffffff; color: #000000; } .document-container { margin: 0; padding: 0; border: none; } .document-footer { border-top: 1px solid #d4d4d8; margin-top: 1.5rem; padding-top: 0.75rem; } .problem-set { border: 1px solid #c4c4c4; } .section { page-break-inside: avoid; } }
        @media (max-width: 768px) { .document-container { margin: 0.5rem; padding: 1.5rem 1.25rem 2rem; } .footer-content { flex-direction: column; align-items: flex-start; } }
    </style>
</head>
<body>
    <main class="document-container">
        <section class="document-title-section">
            <h1>Homework 3: Control Flow and Functions</h1>
            <div class="class-info">CS 180 - Introduction to Computer Science</div>
        </section>

        <section class="meta-section">
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Department</div>
                    <div class="meta-value">Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Class</div>
                    <div class="meta-value">CS 180 - Introduction to Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Assignment Type</div>
                    <div class="meta-value">Homework</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Due Date</div>
                    <div class="meta-value">Friday, October 4, 2024, 11:59 PM</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Total Points</div>
                    <div class="meta-value">50</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Instructions</h2>
            <div class="instructions-content">
                Complete all problems below. Submit your solutions as a single Python file named <code>hw3_lastname_firstname.py</code>. Each function must include a docstring describing its purpose, parameters, and return value. You may not use any external libraries. Late submissions will receive a 10% penalty per day.
            </div>
        </section>

        <section class="section">
            <h2>Problem Sets</h2>
            <div class="problem-set">
                <div class="problem-set-title">Part A: Conditional Logic</div>
                <div class="problem-item">
                    <div>
                        <span class="problem-number">Problem 1:</span>
                        <span class="problem-points">10 PTS</span>
                    </div>
                    <div class="problem-text">
                        Write a function <code>classify_grade(score)</code> that takes a numerical score (0-100) and returns the corresponding letter grade: A (90-100), B (80-89), C (70-79), D (60-69), F (below 60). Raise a ValueError if the score is outside the valid range.
                    </div>
                </div>
                <div class="problem-item">
                    <div>
                        <span class="problem-number">Problem 2:</span>
                        <span class="problem-points">10 PTS</span>
                    </div>
                    <div class="problem-text">
                        Write a function <code>is_leap_year(year)</code> that returns True if the given year is a leap year and False otherwise. A year is a leap year if it is divisible by 4, except for years divisible by 100, which must also be divisible by 400 to be a leap year.
                    </div>
                </div>
            </div>
            <div class="problem-set">
                <div class="problem-set-title">Part B: Loops and Iteration</div>
                <div class="problem-item">
                    <div>
                        <span class="problem-number">Problem 3:</span>
                        <span class="problem-points">15 PTS</span>
                    </div>
                    <div class="problem-text">
                        Write a function <code>fibonacci(n)</code> that returns a list of the first <em>n</em> Fibonacci numbers. For example, <code>fibonacci(7)</code> should return <code>[0, 1, 1, 2, 3, 5, 8]</code>. Handle edge cases where n is 0 or negative.
                    </div>
                </div>
                <div class="problem-item">
                    <div>
                        <span class="problem-number">Problem 4:</span>
                        <span class="problem-points">15 PTS</span>
                    </div>
                    <div class="problem-text">
                        Write a function <code>prime_factors(n)</code> that takes a positive integer and returns a list of its prime factors in ascending order, including duplicates. For example, <code>prime_factors(60)</code> should return <code>[2, 2, 3, 5]</code>.
                    </div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Submission Instructions</h2>
            <div class="submission-info">
                <ul>
                    <li>Submit your completed Python file to Gradescope before the deadline</li>
                    <li>Ensure your code passes the provided test cases before submitting</li>
                    <li>Include your name and Purdue ID in a comment at the top of the file</li>
                    <li>File format: <code>hw3_lastname_firstname.py</code></li>
                </ul>
            </div>
        </section>
    </main>

    <footer class="document-footer">
        <div class="footer-content">
            <div class="footer-branding">
                <div class="footer-logo">P</div>
                <div>
                    <div class="footer-org-name">Purdue University</div>
                    <div class="footer-meta">Department of Computer Science</div>
                </div>
            </div>
            <div class="footer-meta">Computer Science &bull; CS 180</div>
        </div>
    </footer>
</body>
</html>
', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003a-7541-984b-5374263aa03b', '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Assignment - Introduction to Computer Science</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px; }
        body { font-family: "Georgia", "Times New Roman", serif; background: #ffffff; color: #111827; line-height: 1.6; }
        .document-container { max-width: 850px; margin: 2.5rem auto 3rem; padding: 3rem 3.5rem; background: #ffffff; border: 1px solid #d4d4d8; }
        .document-title-section { padding-bottom: 1.75rem; margin-bottom: 1.75rem; border-bottom: 1.5px solid #9ca3af; text-align: center; }
        .document-title-section h1 { font-size: 2.25rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #111827; margin-bottom: 0.5rem; }
        .document-title-section .class-info { font-size: 0.95rem; color: #4b5563; }
        .meta-section { margin-bottom: 2.5rem; }
        .meta-grid { display: table; width: 100%; border-collapse: collapse; border-top: 1px solid #d4d4d8; border-bottom: 1px solid #d4d4d8; }
        .meta-item { display: table-row; }
        .meta-label, .meta-value { display: table-cell; padding: 0.5rem 0.25rem; vertical-align: top; font-size: 0.95rem; border-top: 1px solid #e5e7eb; }
        .meta-item:first-child .meta-label, .meta-item:first-child .meta-value { border-top: none; }
        .meta-label { width: 28%; font-weight: 600; color: #374151; padding-right: 1.5rem; white-space: nowrap; }
        .meta-value { color: #111827; }
        .section { margin-bottom: 2.5rem; }
        .section h2 { font-size: 1.35rem; font-weight: 700; color: #111827; margin-bottom: 1rem; border-bottom: 1px solid #9ca3af; padding-bottom: 0.4rem; }
        .instructions-content { border-left: 3px solid #111827; padding: 1.25rem 1.5rem; background: #f9fafb; font-size: 0.98rem; color: #111827; }
        .milestone { border: 1px solid #d4d4d8; padding: 1.5rem; background: #ffffff; margin-bottom: 1.5rem; }
        .milestone-title { font-size: 1.1rem; font-weight: 600; color: #111827; margin-bottom: 0.5rem; }
        .milestone-date { font-size: 0.85rem; color: #4b5563; margin-bottom: 0.75rem; }
        .milestone-desc { font-size: 0.95rem; }
        .requirement-item { margin-bottom: 0.75rem; padding-left: 1.5rem; position: relative; }
        .requirement-item:before { content: "\25B8"; position: absolute; left: 0; color: #6b7280; }
        .requirement-item:last-child { margin-bottom: 0; }
        .submission-info { border: 1px solid #d4d4d8; padding: 1rem 1.5rem; background: #f9fafb; margin-top: 2rem; }
        .submission-info h3 { font-size: 1rem; font-weight: 600; color: #111827; margin-bottom: 0.75rem; }
        .submission-info ul { list-style: none; padding-left: 0; }
        .submission-info li { margin-bottom: 0.5rem; padding-left: 1.5rem; position: relative; }
        .submission-info li:before { content: "\2022"; position: absolute; left: 0; color: #6b7280; }
        .document-footer { border-top: 1px solid #d4d4d8; padding: 1.5rem 0; margin-top: 1rem; font-size: 0.8rem; color: #4b5563; }
        .footer-content { max-width: 850px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .footer-branding { display: flex; align-items: center; gap: 0.75rem; }
        .footer-logo { width: 32px; height: 32px; border-radius: 2px; border: 1px solid #9ca3af; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem; color: #111827; }
        .footer-org-name { font-weight: 600; color: #111827; font-size: 0.9rem; }
        .footer-meta { font-size: 0.8rem; color: #4b5563; }
        @media print { body { background: #ffffff; color: #000000; } .document-container { margin: 0; padding: 0; border: none; } .document-footer { border-top: 1px solid #d4d4d8; margin-top: 1.5rem; padding-top: 0.75rem; } .milestone { border: 1px solid #c4c4c4; } }
        @media (max-width: 768px) { .document-container { margin: 0.5rem; padding: 1.5rem 1.25rem 2rem; } .footer-content { flex-direction: column; align-items: flex-start; } }
    </style>
</head>
<body>
    <main class="document-container">
        <section class="document-title-section">
            <h1>Project 2: Student Records Management System</h1>
            <div class="class-info">CS 180 - Introduction to Computer Science</div>
        </section>

        <section class="meta-section">
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Department</div>
                    <div class="meta-value">Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Class</div>
                    <div class="meta-value">CS 180 - Introduction to Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Assignment Type</div>
                    <div class="meta-value">Project</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Due Date</div>
                    <div class="meta-value">Friday, November 15, 2024, 11:59 PM</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Total Points</div>
                    <div class="meta-value">150</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Overview</h2>
            <div class="instructions-content">
                In this project you will build a command-line student records management system in Python. The system will allow users to add, search, update, and delete student records stored in a CSV file. This project tests your understanding of file I/O, data structures, functions, and error handling. You may work individually or in pairs.
            </div>
        </section>

        <section class="section">
            <h2>Requirements</h2>
            <div class="milestone">
                <div class="milestone-title">Core Functionality</div>
                <div class="requirement-item">Add a new student record with name, ID, major, GPA, and enrollment date</div>
                <div class="requirement-item">Search for students by name, ID, or major using partial matching</div>
                <div class="requirement-item">Update any field of an existing student record</div>
                <div class="requirement-item">Delete a student record by ID with confirmation prompt</div>
                <div class="requirement-item">Display all records in a formatted table with column alignment</div>
                <div class="requirement-item">Calculate and display class statistics (average GPA, count by major)</div>
            </div>
            <div class="milestone">
                <div class="milestone-title">Technical Requirements</div>
                <div class="requirement-item">All data must persist between program runs using CSV file storage</div>
                <div class="requirement-item">Input validation for all fields (GPA must be 0.0-4.0, ID must be unique)</div>
                <div class="requirement-item">Proper error handling with meaningful error messages</div>
                <div class="requirement-item">At least 5 well-documented functions with docstrings</div>
                <div class="requirement-item">Menu-driven interface with clean user prompts</div>
            </div>
        </section>

        <section class="section">
            <h2>Milestones</h2>
            <div class="milestone">
                <div class="milestone-title">Milestone 1: Design Document</div>
                <div class="milestone-date">Due: October 25, 2024</div>
                <div class="milestone-desc">Submit a 1-page design document describing your data structures, function signatures, and file format. Include a flowchart of the main program loop.</div>
            </div>
            <div class="milestone">
                <div class="milestone-title">Milestone 2: Core Implementation</div>
                <div class="milestone-date">Due: November 8, 2024</div>
                <div class="milestone-desc">Working implementation of add, search, and display functionality. File I/O must be operational.</div>
            </div>
            <div class="milestone">
                <div class="milestone-title">Milestone 3: Final Submission</div>
                <div class="milestone-date">Due: November 15, 2024</div>
                <div class="milestone-desc">Complete implementation with all features, error handling, and documentation.</div>
            </div>
        </section>

        <section class="section">
            <h2>Submission Instructions</h2>
            <div class="submission-info">
                <ul>
                    <li>Submit all source files and your design document to Gradescope</li>
                    <li>Include a README.txt with instructions on how to run your program</li>
                    <li>If working in pairs, both partners must submit and list each other''s names</li>
                    <li>Include sample data file with at least 10 test records</li>
                </ul>
            </div>
        </section>
    </main>

    <footer class="document-footer">
        <div class="footer-content">
            <div class="footer-branding">
                <div class="footer-logo">P</div>
                <div>
                    <div class="footer-org-name">Purdue University</div>
                    <div class="footer-meta">Department of Computer Science</div>
                </div>
            </div>
            <div class="footer-meta">Computer Science &bull; CS 180</div>
        </div>
    </footer>
</body>
</html>
', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003b-71b1-bfa5-69ef5f636751', '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quiz - Introduction to Computer Science</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px; }
        body { font-family: "Georgia", "Times New Roman", serif; background: #ffffff; color: #111827; line-height: 1.6; }
        .document-container { max-width: 850px; margin: 2.5rem auto 3rem; padding: 3rem 3.5rem; background: #ffffff; border: 1px solid #d4d4d8; }
        .document-title-section { padding-bottom: 1.75rem; margin-bottom: 1.75rem; border-bottom: 1.5px solid #9ca3af; text-align: center; }
        .document-title-section h1 { font-size: 2.25rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #111827; margin-bottom: 0.5rem; }
        .document-title-section .class-info { font-size: 0.95rem; color: #4b5563; }
        .meta-section { margin-bottom: 2.5rem; }
        .meta-grid { display: table; width: 100%; border-collapse: collapse; border-top: 1px solid #d4d4d8; border-bottom: 1px solid #d4d4d8; }
        .meta-item { display: table-row; }
        .meta-label, .meta-value { display: table-cell; padding: 0.5rem 0.25rem; vertical-align: top; font-size: 0.95rem; border-top: 1px solid #e5e7eb; }
        .meta-item:first-child .meta-label, .meta-item:first-child .meta-value { border-top: none; }
        .meta-label { width: 28%; font-weight: 600; color: #374151; padding-right: 1.5rem; white-space: nowrap; }
        .meta-value { color: #111827; }
        .section { margin-bottom: 2.5rem; }
        .section h2 { font-size: 1.35rem; font-weight: 700; color: #111827; margin-bottom: 1rem; border-bottom: 1px solid #9ca3af; padding-bottom: 0.4rem; }
        .instructions-content { border-left: 3px solid #111827; padding: 1.25rem 1.5rem; background: #f9fafb; font-size: 0.98rem; color: #111827; }
        .questions-container { display: flex; flex-direction: column; gap: 1.5rem; }
        .question-card { border: 1px solid #d4d4d8; padding: 1.25rem 1.5rem; background: #ffffff; page-break-inside: avoid; }
        .question-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; }
        .question-title { font-size: 1rem; font-weight: 400; color: #111827; }
        .question-number { font-weight: 600; margin-right: 0.5rem; font-size: 1rem; color: #111827; }
        .question-points { font-size: 0.85rem; font-weight: 600; color: #374151; padding: 0.15rem 0.5rem; border: 1px solid #d4d4d8; border-radius: 999px; white-space: nowrap; }
        .question-hint { margin-top: 0.75rem; padding: 0.75rem 0.9rem; border-left: 2px solid #9ca3af; background: #f9fafb; font-size: 0.9rem; color: #4b5563; font-style: italic; }
        .document-footer { border-top: 1px solid #d4d4d8; padding: 1.5rem 0; margin-top: 1rem; font-size: 0.8rem; color: #4b5563; }
        .footer-content { max-width: 850px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .footer-branding { display: flex; align-items: center; gap: 0.75rem; }
        .footer-logo { width: 32px; height: 32px; border-radius: 2px; border: 1px solid #9ca3af; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem; color: #111827; }
        .footer-org-name { font-weight: 600; color: #111827; font-size: 0.9rem; }
        .footer-meta { font-size: 0.8rem; color: #4b5563; }
        @media print { body { background: #ffffff; color: #000000; } .document-container { margin: 0; padding: 0; border: none; } .document-footer { border-top: 1px solid #d4d4d8; margin-top: 1.5rem; padding-top: 0.75rem; } .question-card { border: 1px solid #c4c4c4; } .section { page-break-inside: avoid; } }
        @media (max-width: 768px) { .document-container { margin: 0.5rem; padding: 1.5rem 1.25rem 2rem; } .question-header { flex-direction: column; align-items: flex-start; } .footer-content { flex-direction: column; align-items: flex-start; } }
    </style>
</head>
<body>
    <main class="document-container">
        <section class="document-title-section">
            <h1>Quiz 2: Data Types and Operators</h1>
            <div class="class-info">CS 180 - Introduction to Computer Science</div>
        </section>

        <section class="meta-section">
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Department</div>
                    <div class="meta-value">Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Class</div>
                    <div class="meta-value">CS 180 - Introduction to Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Assessment Type</div>
                    <div class="meta-value">Quiz</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Time Limit</div>
                    <div class="meta-value">20 minutes</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Total Points</div>
                    <div class="meta-value">25</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Instructions</h2>
            <div class="instructions-content">
                Answer all questions. No notes, textbooks, or electronic devices are permitted. Write your answers clearly in the space provided. Partial credit may be awarded for showing your work on free-response questions.
            </div>
        </section>

        <section class="section">
            <h2>Questions</h2>
            <div class="questions-container">
                <div class="question-card">
                    <div class="question-header">
                        <div class="question-title">
                            <span class="question-number">Q1</span>
                            What is the output of the following expression: <code>type(3.14).__name__</code>?
                        </div>
                        <div class="question-points">3 PTS</div>
                    </div>
                </div>
                <div class="question-card">
                    <div class="question-header">
                        <div class="question-title">
                            <span class="question-number">Q2</span>
                            Explain the difference between the <code>==</code> and <code>is</code> operators in Python. Provide an example where they produce different results.
                        </div>
                        <div class="question-points">5 PTS</div>
                    </div>
                </div>
                <div class="question-card">
                    <div class="question-header">
                        <div class="question-title">
                            <span class="question-number">Q3</span>
                            What is the result of <code>15 // 4</code> and <code>15 % 4</code>? Explain what each operator does.
                        </div>
                        <div class="question-points">5 PTS</div>
                    </div>
                    <div class="question-hint">
                        <strong>Hint:</strong> Think about integer division and the remainder.
                    </div>
                </div>
                <div class="question-card">
                    <div class="question-header">
                        <div class="question-title">
                            <span class="question-number">Q4</span>
                            Given <code>x = "Hello"</code> and <code>y = "World"</code>, write an expression that produces the string <code>"Hello, World!"</code> using string concatenation.
                        </div>
                        <div class="question-points">4 PTS</div>
                    </div>
                </div>
                <div class="question-card">
                    <div class="question-header">
                        <div class="question-title">
                            <span class="question-number">Q5</span>
                            What happens when you try to add a string and an integer in Python, e.g., <code>"5" + 3</code>? How would you fix this to get the result <code>8</code>?
                        </div>
                        <div class="question-points">4 PTS</div>
                    </div>
                </div>
                <div class="question-card">
                    <div class="question-header">
                        <div class="question-title">
                            <span class="question-number">Q6</span>
                            List three immutable data types in Python and explain why immutability is useful.
                        </div>
                        <div class="question-points">4 PTS</div>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer class="document-footer">
        <div class="footer-content">
            <div class="footer-branding">
                <div class="footer-logo">P</div>
                <div>
                    <div class="footer-org-name">Purdue University</div>
                    <div class="footer-meta">Department of Computer Science</div>
                </div>
            </div>
            <div class="footer-meta">Computer Science &bull; CS 180</div>
        </div>
    </footer>
</body>
</html>
', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003a-731f-b918-64b6c99d0464', '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Midterm Exam - Introduction to Computer Science</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px; }
        body { font-family: "Georgia", "Times New Roman", serif; background: #ffffff; color: #111827; line-height: 1.6; }
        .document-container { max-width: 850px; margin: 2.5rem auto 3rem; padding: 3rem 3.5rem; background: #ffffff; border: 1px solid #d4d4d8; }
        .document-title-section { padding-bottom: 1.75rem; margin-bottom: 1.75rem; border-bottom: 1.5px solid #9ca3af; text-align: center; }
        .document-title-section h1 { font-size: 2.25rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #111827; margin-bottom: 0.5rem; }
        .document-title-section .class-info { font-size: 0.95rem; color: #4b5563; }
        .meta-section { margin-bottom: 2.5rem; }
        .meta-grid { display: table; width: 100%; border-collapse: collapse; border-top: 1px solid #d4d4d8; border-bottom: 1px solid #d4d4d8; }
        .meta-item { display: table-row; }
        .meta-label, .meta-value { display: table-cell; padding: 0.5rem 0.25rem; vertical-align: top; font-size: 0.95rem; border-top: 1px solid #e5e7eb; }
        .meta-item:first-child .meta-label, .meta-item:first-child .meta-value { border-top: none; }
        .meta-label { width: 28%; font-weight: 600; color: #374151; padding-right: 1.5rem; white-space: nowrap; }
        .meta-value { color: #111827; }
        .section { margin-bottom: 2.5rem; }
        .section h2 { font-size: 1.35rem; font-weight: 700; color: #111827; margin-bottom: 1rem; border-bottom: 1px solid #9ca3af; padding-bottom: 0.4rem; }
        .instructions-content { border-left: 3px solid #111827; padding: 1.25rem 1.5rem; background: #f9fafb; font-size: 0.98rem; color: #111827; }
        .exam-part { border: 1px solid #d4d4d8; padding: 1.5rem; background: #ffffff; margin-bottom: 1.5rem; }
        .exam-part-title { font-size: 1.1rem; font-weight: 600; color: #111827; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; }
        .question-card { border: 1px solid #d4d4d8; padding: 1.25rem 1.5rem; background: #ffffff; page-break-inside: avoid; margin-bottom: 1rem; }
        .question-card:last-child { margin-bottom: 0; }
        .question-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; }
        .question-title { font-size: 1rem; font-weight: 400; color: #111827; }
        .question-number { font-weight: 600; margin-right: 0.5rem; }
        .question-points { font-size: 0.85rem; font-weight: 600; color: #374151; padding: 0.15rem 0.5rem; border: 1px solid #d4d4d8; border-radius: 999px; white-space: nowrap; }
        .code-block { background: #1f2937; color: #e5e7eb; padding: 1rem 1.25rem; font-family: "Courier New", monospace; font-size: 0.9rem; border-radius: 4px; overflow-x: auto; margin-top: 0.5rem; }
        .document-footer { border-top: 1px solid #d4d4d8; padding: 1.5rem 0; margin-top: 1rem; font-size: 0.8rem; color: #4b5563; }
        .footer-content { max-width: 850px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .footer-branding { display: flex; align-items: center; gap: 0.75rem; }
        .footer-logo { width: 32px; height: 32px; border-radius: 2px; border: 1px solid #9ca3af; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem; color: #111827; }
        .footer-org-name { font-weight: 600; color: #111827; font-size: 0.9rem; }
        .footer-meta { font-size: 0.8rem; color: #4b5563; }
        @media print { body { background: #ffffff; color: #000000; } .document-container { margin: 0; padding: 0; border: none; } .document-footer { border-top: 1px solid #d4d4d8; margin-top: 1.5rem; padding-top: 0.75rem; } .exam-part, .question-card { border: 1px solid #c4c4c4; } .section { page-break-inside: avoid; } }
        @media (max-width: 768px) { .document-container { margin: 0.5rem; padding: 1.5rem 1.25rem 2rem; } .question-header { flex-direction: column; align-items: flex-start; } .footer-content { flex-direction: column; align-items: flex-start; } }
    </style>
</head>
<body>
    <main class="document-container">
        <section class="document-title-section">
            <h1>Midterm Examination</h1>
            <div class="class-info">CS 180 - Introduction to Computer Science</div>
        </section>

        <section class="meta-section">
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Department</div>
                    <div class="meta-value">Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Class</div>
                    <div class="meta-value">CS 180 - Introduction to Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Assessment Type</div>
                    <div class="meta-value">Midterm Exam</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Date</div>
                    <div class="meta-value">October 18, 2024</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Time Limit</div>
                    <div class="meta-value">75 minutes</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Total Points</div>
                    <div class="meta-value">100</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Instructions</h2>
            <div class="instructions-content">
                This is a closed-book, closed-notes exam. No electronic devices are permitted. Write all answers clearly in the space provided. Show your work for partial credit on coding questions. You have 75 minutes to complete all sections.
            </div>
        </section>

        <section class="section">
            <h2>Part A: Multiple Choice (20 pts)</h2>
            <div class="exam-part">
                <div class="question-card">
                    <div class="question-header">
                        <div class="question-title"><span class="question-number">1.</span> What is the output of <code>print(type([]))</code>?</div>
                        <div class="question-points">2 PTS</div>
                    </div>
                    <div>(a) &lt;class ''tuple''&gt; &nbsp; (b) &lt;class ''list''&gt; &nbsp; (c) &lt;class ''dict''&gt; &nbsp; (d) &lt;class ''set''&gt;</div>
                </div>
                <div class="question-card">
                    <div class="question-header">
                        <div class="question-title"><span class="question-number">2.</span> Which keyword is used to define a function in Python?</div>
                        <div class="question-points">2 PTS</div>
                    </div>
                    <div>(a) function &nbsp; (b) func &nbsp; (c) def &nbsp; (d) define</div>
                </div>
                <div class="question-card">
                    <div class="question-header">
                        <div class="question-title"><span class="question-number">3.</span> What does the <code>range(2, 10, 3)</code> function generate?</div>
                        <div class="question-points">2 PTS</div>
                    </div>
                    <div>(a) [2, 5, 8] &nbsp; (b) [2, 5, 8, 11] &nbsp; (c) [2, 3, 4, 5, 6, 7, 8, 9] &nbsp; (d) [3, 6, 9]</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Part B: Short Answer (30 pts)</h2>
            <div class="question-card">
                <div class="question-header">
                    <div class="question-title"><span class="question-number">4.</span> Explain the difference between a <code>while</code> loop and a <code>for</code> loop. When would you choose one over the other? Give an example of each.</div>
                    <div class="question-points">10 PTS</div>
                </div>
            </div>
            <div class="question-card">
                <div class="question-header">
                    <div class="question-title"><span class="question-number">5.</span> What will the following code print? Trace through the execution step by step.</div>
                    <div class="question-points">10 PTS</div>
                </div>
                <div class="code-block">def mystery(n):<br>&nbsp;&nbsp;&nbsp;&nbsp;result = ""<br>&nbsp;&nbsp;&nbsp;&nbsp;while n &gt; 0:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;result = str(n % 2) + result<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;n = n // 2<br>&nbsp;&nbsp;&nbsp;&nbsp;return result<br><br>print(mystery(13))</div>
            </div>
            <div class="question-card">
                <div class="question-header">
                    <div class="question-title"><span class="question-number">6.</span> Describe two differences between a list and a tuple in Python. Why might you choose a tuple over a list?</div>
                    <div class="question-points">10 PTS</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Part C: Programming (50 pts)</h2>
            <div class="question-card">
                <div class="question-header">
                    <div class="question-title"><span class="question-number">7.</span> Write a function <code>count_vowels(s)</code> that takes a string and returns the number of vowels (a, e, i, o, u, case-insensitive).</div>
                    <div class="question-points">15 PTS</div>
                </div>
            </div>
            <div class="question-card">
                <div class="question-header">
                    <div class="question-title"><span class="question-number">8.</span> Write a function <code>find_max(lst)</code> that takes a list of numbers and returns the largest value. Do not use the built-in <code>max()</code> function. Handle the case where the list is empty by returning <code>None</code>.</div>
                    <div class="question-points">15 PTS</div>
                </div>
            </div>
            <div class="question-card">
                <div class="question-header">
                    <div class="question-title"><span class="question-number">9.</span> Write a function <code>is_palindrome(s)</code> that returns <code>True</code> if the given string reads the same forwards and backwards (ignoring case and spaces). For example, <code>is_palindrome("Race Car")</code> should return <code>True</code>.</div>
                    <div class="question-points">20 PTS</div>
                </div>
            </div>
        </section>
    </main>

    <footer class="document-footer">
        <div class="footer-content">
            <div class="footer-branding">
                <div class="footer-logo">P</div>
                <div>
                    <div class="footer-org-name">Purdue University</div>
                    <div class="footer-meta">Department of Computer Science</div>
                </div>
            </div>
            <div class="footer-meta">Computer Science &bull; CS 180</div>
        </div>
    </footer>
</body>
</html>
', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003a-740e-8854-4d9ee26d34a6', '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lab Assignment - Introduction to Computer Science</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px; }
        body { font-family: "Georgia", "Times New Roman", serif; background: #ffffff; color: #111827; line-height: 1.6; }
        .document-container { max-width: 850px; margin: 2.5rem auto 3rem; padding: 3rem 3.5rem; background: #ffffff; border: 1px solid #d4d4d8; }
        .document-title-section { padding-bottom: 1.75rem; margin-bottom: 1.75rem; border-bottom: 1.5px solid #9ca3af; text-align: center; }
        .document-title-section h1 { font-size: 2.25rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #111827; margin-bottom: 0.5rem; }
        .document-title-section .class-info { font-size: 0.95rem; color: #4b5563; }
        .meta-section { margin-bottom: 2.5rem; }
        .meta-grid { display: table; width: 100%; border-collapse: collapse; border-top: 1px solid #d4d4d8; border-bottom: 1px solid #d4d4d8; }
        .meta-item { display: table-row; }
        .meta-label, .meta-value { display: table-cell; padding: 0.5rem 0.25rem; vertical-align: top; font-size: 0.95rem; border-top: 1px solid #e5e7eb; }
        .meta-item:first-child .meta-label, .meta-item:first-child .meta-value { border-top: none; }
        .meta-label { width: 28%; font-weight: 600; color: #374151; padding-right: 1.5rem; white-space: nowrap; }
        .meta-value { color: #111827; }
        .section { margin-bottom: 2.5rem; }
        .section h2 { font-size: 1.35rem; font-weight: 700; color: #111827; margin-bottom: 1rem; border-bottom: 1px solid #9ca3af; padding-bottom: 0.4rem; }
        .instructions-content { border-left: 3px solid #111827; padding: 1.25rem 1.5rem; background: #f9fafb; font-size: 0.98rem; color: #111827; }
        .lab-step { border: 1px solid #d4d4d8; padding: 1.5rem; background: #ffffff; margin-bottom: 1.5rem; }
        .lab-step-title { font-size: 1.1rem; font-weight: 600; color: #111827; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; }
        .lab-step-desc { font-size: 0.95rem; margin-bottom: 0.5rem; }
        .code-block { background: #1f2937; color: #e5e7eb; padding: 1rem 1.25rem; font-family: "Courier New", monospace; font-size: 0.9rem; border-radius: 4px; overflow-x: auto; margin-top: 0.5rem; }
        .checkpoint { border: 1px solid #d4d4d8; padding: 1rem 1.5rem; background: #f9fafb; margin-top: 1rem; }
        .checkpoint h3 { font-size: 1rem; font-weight: 600; color: #111827; margin-bottom: 0.5rem; }
        .document-footer { border-top: 1px solid #d4d4d8; padding: 1.5rem 0; margin-top: 1rem; font-size: 0.8rem; color: #4b5563; }
        .footer-content { max-width: 850px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .footer-branding { display: flex; align-items: center; gap: 0.75rem; }
        .footer-logo { width: 32px; height: 32px; border-radius: 2px; border: 1px solid #9ca3af; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem; color: #111827; }
        .footer-org-name { font-weight: 600; color: #111827; font-size: 0.9rem; }
        .footer-meta { font-size: 0.8rem; color: #4b5563; }
        @media print { body { background: #ffffff; color: #000000; } .document-container { margin: 0; padding: 0; border: none; } .document-footer { border-top: 1px solid #d4d4d8; margin-top: 1.5rem; padding-top: 0.75rem; } .lab-step { border: 1px solid #c4c4c4; } }
        @media (max-width: 768px) { .document-container { margin: 0.5rem; padding: 1.5rem 1.25rem 2rem; } .footer-content { flex-direction: column; align-items: flex-start; } }
    </style>
</head>
<body>
    <main class="document-container">
        <section class="document-title-section">
            <h1>Lab 5: Working with Lists and Dictionaries</h1>
            <div class="class-info">CS 180 - Introduction to Computer Science</div>
        </section>

        <section class="meta-section">
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Department</div>
                    <div class="meta-value">Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Class</div>
                    <div class="meta-value">CS 180 - Introduction to Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Assignment Type</div>
                    <div class="meta-value">Lab</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Due Date</div>
                    <div class="meta-value">End of lab session</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Total Points</div>
                    <div class="meta-value">20</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Objectives</h2>
            <div class="instructions-content">
                In this lab you will practice creating, modifying, and iterating over Python lists and dictionaries. By the end of this lab, you should be able to use list comprehensions, dictionary methods, and nested data structures to solve practical problems.
            </div>
        </section>

        <section class="section">
            <h2>Lab Exercises</h2>

            <div class="lab-step">
                <div class="lab-step-title">Exercise 1: List Operations (5 pts)</div>
                <div class="lab-step-desc">Create a list of 10 random integers between 1 and 100 using the <code>random</code> module. Then write code to:</div>
                <div class="lab-step-desc">(a) Print the list sorted in descending order without modifying the original</div>
                <div class="lab-step-desc">(b) Remove all even numbers using a list comprehension</div>
                <div class="lab-step-desc">(c) Find the second-largest value without using <code>sort()</code></div>
                <div class="code-block">import random<br>numbers = [random.randint(1, 100) for _ in range(10)]<br>print("Original:", numbers)</div>
            </div>

            <div class="lab-step">
                <div class="lab-step-title">Exercise 2: Word Frequency Counter (7 pts)</div>
                <div class="lab-step-desc">Write a function <code>word_freq(text)</code> that takes a string and returns a dictionary mapping each word (lowercase) to its frequency. Ignore punctuation. Test with the provided sample paragraph.</div>
                <div class="code-block">sample = "The quick brown fox jumps over the lazy dog. The dog barked at the fox."<br># Expected: {''the'': 4, ''quick'': 1, ''brown'': 1, ...}</div>
                <div class="checkpoint">
                    <h3>Checkpoint</h3>
                    Show your TA the output of <code>word_freq(sample)</code> before proceeding.
                </div>
            </div>

            <div class="lab-step">
                <div class="lab-step-title">Exercise 3: Student Gradebook (8 pts)</div>
                <div class="lab-step-desc">Create a dictionary-based gradebook where keys are student names and values are lists of grades. Implement functions to:</div>
                <div class="lab-step-desc">(a) <code>add_grade(gradebook, name, grade)</code> - add a grade for a student</div>
                <div class="lab-step-desc">(b) <code>get_average(gradebook, name)</code> - return the student''s average</div>
                <div class="lab-step-desc">(c) <code>class_average(gradebook)</code> - return the overall class average</div>
                <div class="lab-step-desc">(d) <code>top_student(gradebook)</code> - return the name of the student with the highest average</div>
            </div>
        </section>

        <section class="section">
            <h2>Submission</h2>
            <div class="instructions-content">
                Have your TA verify each checkpoint during the lab session. Submit your completed Python file to Gradescope before leaving. If you do not finish during the lab, you have until 11:59 PM the same day to submit.
            </div>
        </section>
    </main>

    <footer class="document-footer">
        <div class="footer-content">
            <div class="footer-branding">
                <div class="footer-logo">P</div>
                <div>
                    <div class="footer-org-name">Purdue University</div>
                    <div class="footer-meta">Department of Computer Science</div>
                </div>
            </div>
            <div class="footer-meta">Computer Science &bull; CS 180</div>
        </div>
    </footer>
</body>
</html>
', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003b-7026-b46a-5def99ec275a', '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lecture Notes - Introduction to Computer Science</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px; }
        body { font-family: "Georgia", "Times New Roman", serif; background: #ffffff; color: #111827; line-height: 1.6; }
        .document-container { max-width: 850px; margin: 2.5rem auto 3rem; padding: 3rem 3.5rem; background: #ffffff; border: 1px solid #d4d4d8; }
        .document-title-section { padding-bottom: 1.75rem; margin-bottom: 1.75rem; border-bottom: 1.5px solid #9ca3af; text-align: center; }
        .document-title-section h1 { font-size: 2.25rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #111827; margin-bottom: 0.5rem; }
        .document-title-section .class-info { font-size: 0.95rem; color: #4b5563; }
        .meta-section { margin-bottom: 2.5rem; }
        .meta-grid { display: table; width: 100%; border-collapse: collapse; border-top: 1px solid #d4d4d8; border-bottom: 1px solid #d4d4d8; }
        .meta-item { display: table-row; }
        .meta-label, .meta-value { display: table-cell; padding: 0.5rem 0.25rem; vertical-align: top; font-size: 0.95rem; border-top: 1px solid #e5e7eb; }
        .meta-item:first-child .meta-label, .meta-item:first-child .meta-value { border-top: none; }
        .meta-label { width: 28%; font-weight: 600; color: #374151; padding-right: 1.5rem; white-space: nowrap; }
        .meta-value { color: #111827; }
        .section { margin-bottom: 2.5rem; }
        .section h2 { font-size: 1.35rem; font-weight: 700; color: #111827; margin-bottom: 1rem; border-bottom: 1px solid #9ca3af; padding-bottom: 0.4rem; }
        .topic-content { border-left: 3px solid #111827; padding: 1.25rem 1.5rem; background: #f9fafb; font-size: 0.98rem; color: #111827; margin-bottom: 1.5rem; }
        .topic-content p { margin-bottom: 0.75rem; }
        .topic-content p:last-child { margin-bottom: 0; }
        .concept-card { border: 1px solid #d4d4d8; padding: 1.5rem; background: #ffffff; margin-bottom: 1.5rem; }
        .concept-title { font-size: 1.1rem; font-weight: 600; color: #111827; margin-bottom: 0.75rem; }
        .concept-desc { font-size: 0.95rem; margin-bottom: 0.75rem; }
        .code-block { background: #1f2937; color: #e5e7eb; padding: 1rem 1.25rem; font-family: "Courier New", monospace; font-size: 0.9rem; border-radius: 4px; overflow-x: auto; margin-top: 0.5rem; }
        .key-point { margin-bottom: 0.75rem; padding-left: 1.5rem; position: relative; }
        .key-point:before { content: "\25B8"; position: absolute; left: 0; color: #6b7280; }
        .key-point:last-child { margin-bottom: 0; }
        .document-footer { border-top: 1px solid #d4d4d8; padding: 1.5rem 0; margin-top: 1rem; font-size: 0.8rem; color: #4b5563; }
        .footer-content { max-width: 850px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .footer-branding { display: flex; align-items: center; gap: 0.75rem; }
        .footer-logo { width: 32px; height: 32px; border-radius: 2px; border: 1px solid #9ca3af; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem; color: #111827; }
        .footer-org-name { font-weight: 600; color: #111827; font-size: 0.9rem; }
        .footer-meta { font-size: 0.8rem; color: #4b5563; }
        @media print { body { background: #ffffff; color: #000000; } .document-container { margin: 0; padding: 0; border: none; } .document-footer { border-top: 1px solid #d4d4d8; margin-top: 1.5rem; padding-top: 0.75rem; } .concept-card { border: 1px solid #c4c4c4; } }
        @media (max-width: 768px) { .document-container { margin: 0.5rem; padding: 1.5rem 1.25rem 2rem; } .footer-content { flex-direction: column; align-items: flex-start; } }
    </style>
</head>
<body>
    <main class="document-container">
        <section class="document-title-section">
            <h1>Lecture 7: Object-Oriented Programming</h1>
            <div class="class-info">CS 180 - Introduction to Computer Science</div>
        </section>

        <section class="meta-section">
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Department</div>
                    <div class="meta-value">Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Class</div>
                    <div class="meta-value">CS 180 - Introduction to Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Document Type</div>
                    <div class="meta-value">Lecture Notes</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Date</div>
                    <div class="meta-value">October 14, 2024</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Topics</div>
                    <div class="meta-value">Classes, Objects, Methods, Constructors, Encapsulation</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Overview</h2>
            <div class="topic-content">
                <p>Object-Oriented Programming (OOP) is a programming paradigm that organizes code around objects rather than functions and logic. An object is an instance of a class, which serves as a blueprint defining the object''s attributes (data) and methods (behavior).</p>
                <p>Today we cover the four fundamental concepts: classes, objects, methods, and encapsulation.</p>
            </div>
        </section>

        <section class="section">
            <h2>Key Concepts</h2>
            <div class="concept-card">
                <div class="concept-title">Classes and Objects</div>
                <div class="concept-desc">A class defines a new data type. An object is a specific instance of that class with its own data.</div>
                <div class="code-block">class Student:<br>&nbsp;&nbsp;&nbsp;&nbsp;def __init__(self, name, gpa):<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;self.name = name<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;self.gpa = gpa<br><br>alice = Student("Alice", 3.8)<br>bob = Student("Bob", 3.5)</div>
            </div>
            <div class="concept-card">
                <div class="concept-title">Methods</div>
                <div class="concept-desc">Methods are functions defined inside a class that operate on the object''s data. The first parameter is always <code>self</code>, which refers to the current instance.</div>
                <div class="code-block">class Student:<br>&nbsp;&nbsp;&nbsp;&nbsp;def __init__(self, name, gpa):<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;self.name = name<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;self.gpa = gpa<br><br>&nbsp;&nbsp;&nbsp;&nbsp;def is_honors(self):<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return self.gpa &gt;= 3.5<br><br>&nbsp;&nbsp;&nbsp;&nbsp;def __str__(self):<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return f"{self.name} (GPA: {self.gpa})"</div>
            </div>
            <div class="concept-card">
                <div class="concept-title">Encapsulation</div>
                <div class="concept-desc">Encapsulation is the practice of hiding internal state and requiring all interaction to happen through well-defined methods. In Python, name-mangling with double underscores provides a form of data hiding.</div>
                <div class="key-point">Use private attributes (prefix with <code>__</code>) to prevent direct access from outside the class</div>
                <div class="key-point">Provide getter and setter methods (or use <code>@property</code>) to control access</div>
                <div class="key-point">Encapsulation helps maintain data integrity and makes code easier to maintain</div>
            </div>
        </section>

        <section class="section">
            <h2>Key Takeaways</h2>
            <div class="topic-content">
                <p><strong>1.</strong> Classes are blueprints; objects are instances of those blueprints.</p>
                <p><strong>2.</strong> The <code>__init__</code> method is the constructor, called automatically when creating a new object.</p>
                <p><strong>3.</strong> All instance methods take <code>self</code> as the first parameter.</p>
                <p><strong>4.</strong> Encapsulation protects data from unintended modification.</p>
                <p><strong>Reading:</strong> Chapter 8, Sections 8.1-8.4 of the textbook.</p>
            </div>
        </section>
    </main>

    <footer class="document-footer">
        <div class="footer-content">
            <div class="footer-branding">
                <div class="footer-logo">P</div>
                <div>
                    <div class="footer-org-name">Purdue University</div>
                    <div class="footer-meta">Department of Computer Science</div>
                </div>
            </div>
            <div class="footer-meta">Computer Science &bull; CS 180</div>
        </div>
    </footer>
</body>
</html>
', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003a-7647-aa7f-b9baebd83bf3', '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Course Syllabus - Introduction to Computer Science</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px; }
        body { font-family: "Georgia", "Times New Roman", serif; background: #ffffff; color: #111827; line-height: 1.6; }
        .document-container { max-width: 850px; margin: 2.5rem auto 3rem; padding: 3rem 3.5rem; background: #ffffff; border: 1px solid #d4d4d8; }
        .document-title-section { padding-bottom: 1.75rem; margin-bottom: 1.75rem; border-bottom: 1.5px solid #9ca3af; text-align: center; }
        .document-title-section h1 { font-size: 2.25rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #111827; margin-bottom: 0.5rem; }
        .document-title-section .class-info { font-size: 0.95rem; color: #4b5563; }
        .meta-section { margin-bottom: 2.5rem; }
        .meta-grid { display: table; width: 100%; border-collapse: collapse; border-top: 1px solid #d4d4d8; border-bottom: 1px solid #d4d4d8; }
        .meta-item { display: table-row; }
        .meta-label, .meta-value { display: table-cell; padding: 0.5rem 0.25rem; vertical-align: top; font-size: 0.95rem; border-top: 1px solid #e5e7eb; }
        .meta-item:first-child .meta-label, .meta-item:first-child .meta-value { border-top: none; }
        .meta-label { width: 28%; font-weight: 600; color: #374151; padding-right: 1.5rem; white-space: nowrap; }
        .meta-value { color: #111827; }
        .section { margin-bottom: 2.5rem; }
        .section h2 { font-size: 1.35rem; font-weight: 700; color: #111827; margin-bottom: 1rem; border-bottom: 1px solid #9ca3af; padding-bottom: 0.4rem; }
        .syllabus-info { border-left: 3px solid #111827; padding: 1.25rem 1.5rem; background: #f9fafb; font-size: 0.98rem; color: #111827; }
        .info-item { margin-bottom: 0.75rem; }
        .info-item:last-child { margin-bottom: 0; }
        .info-label { font-weight: 600; color: #374151; margin-right: 0.5rem; }
        .schedule-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        .schedule-table th, .schedule-table td { border: 1px solid #d4d4d8; padding: 0.5rem; text-align: left; }
        .schedule-table th { background: #f9fafb; font-weight: 600; color: #374151; }
        .grading-scale { border: 1px solid #d4d4d8; padding: 1rem 1.5rem; background: #ffffff; }
        .grade-item { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb; }
        .grade-item:last-child { border-bottom: none; }
        .policy-item { margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb; }
        .policy-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .policy-title { font-weight: 600; color: #111827; margin-bottom: 0.5rem; }
        .document-footer { border-top: 1px solid #d4d4d8; padding: 1.5rem 0; margin-top: 1rem; font-size: 0.8rem; color: #4b5563; }
        .footer-content { max-width: 850px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .footer-branding { display: flex; align-items: center; gap: 0.75rem; }
        .footer-logo { width: 32px; height: 32px; border-radius: 2px; border: 1px solid #9ca3af; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem; color: #111827; }
        .footer-org-name { font-weight: 600; color: #111827; font-size: 0.9rem; }
        .footer-meta { font-size: 0.8rem; color: #4b5563; }
        @media print { body { background: #ffffff; color: #000000; } .document-container { margin: 0; padding: 0; border: none; } .document-footer { border-top: 1px solid #d4d4d8; margin-top: 1.5rem; padding-top: 0.75rem; } .schedule-table, .grading-scale { border: 1px solid #c4c4c4; } }
        @media (max-width: 768px) { .document-container { margin: 0.5rem; padding: 1.5rem 1.25rem 2rem; } .footer-content { flex-direction: column; align-items: flex-start; } }
    </style>
</head>
<body>
    <main class="document-container">
        <section class="document-title-section">
            <h1>Course Syllabus</h1>
            <div class="class-info">CS 180 - Introduction to Computer Science</div>
        </section>

        <section class="meta-section">
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Department</div>
                    <div class="meta-value">Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Class</div>
                    <div class="meta-value">CS 180 - Introduction to Computer Science</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Document Type</div>
                    <div class="meta-value">Course Syllabus</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Semester</div>
                    <div class="meta-value">Fall 2024</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Academic Year</div>
                    <div class="meta-value">2024-2025</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Course Information</h2>
            <div class="syllabus-info">
                <div class="info-item"><span class="info-label">Course Code:</span> CS 18000</div>
                <div class="info-item"><span class="info-label">Credits:</span> 4</div>
                <div class="info-item"><span class="info-label">Prerequisites:</span> None</div>
                <div class="info-item"><span class="info-label">Instructor:</span> Dr. Sarah Chen</div>
                <div class="info-item"><span class="info-label">Email:</span> redacted@purdue.edu</div>
                <div class="info-item"><span class="info-label">Office Hours:</span> Monday/Wednesday 2:00-3:30 PM, LWSN 2142</div>
            </div>
        </section>

        <section class="section">
            <h2>Course Description</h2>
            <div class="syllabus-info">
                An introduction to programming and computational thinking using Python. Topics include variables, data types, control flow, functions, file I/O, object-oriented programming, recursion, and basic data structures. Students will develop problem-solving skills through hands-on programming assignments and a semester-long project.
            </div>
        </section>

        <section class="section">
            <h2>Course Schedule</h2>
            <table class="schedule-table">
                <thead>
                    <tr><th>Week</th><th>Topic</th><th>Assignments</th></tr>
                </thead>
                <tbody>
                    <tr><td>1-2</td><td>Introduction, Variables, Data Types</td><td>HW 1</td></tr>
                    <tr><td>3-4</td><td>Control Flow: Conditionals and Loops</td><td>HW 2, Quiz 1</td></tr>
                    <tr><td>5-6</td><td>Functions and Scope</td><td>HW 3</td></tr>
                    <tr><td>7</td><td>Strings and Lists</td><td>Quiz 2</td></tr>
                    <tr><td>8</td><td>Midterm Review and Exam</td><td>Midterm</td></tr>
                    <tr><td>9-10</td><td>File I/O and Exception Handling</td><td>HW 4, Project M1</td></tr>
                    <tr><td>11-12</td><td>Object-Oriented Programming</td><td>HW 5, Project M2</td></tr>
                    <tr><td>13</td><td>Recursion</td><td>Quiz 3</td></tr>
                    <tr><td>14-15</td><td>Data Structures: Dictionaries and Sets</td><td>HW 6, Project M3</td></tr>
                    <tr><td>16</td><td>Final Review and Exam</td><td>Final Exam</td></tr>
                </tbody>
            </table>
        </section>

        <section class="section">
            <h2>Grading</h2>
            <div class="grading-scale">
                <div class="grade-item"><span>Homework (6 assignments)</span><span>30%</span></div>
                <div class="grade-item"><span>Quizzes (3 quizzes)</span><span>10%</span></div>
                <div class="grade-item"><span>Project</span><span>20%</span></div>
                <div class="grade-item"><span>Midterm Exam</span><span>15%</span></div>
                <div class="grade-item"><span>Final Exam</span><span>20%</span></div>
                <div class="grade-item"><span>Participation</span><span>5%</span></div>
            </div>
            <div style="margin-top: 1rem;">
                <div class="grading-scale">
                    <div class="grade-item"><span>A</span><span>90-100%</span></div>
                    <div class="grade-item"><span>B</span><span>80-89%</span></div>
                    <div class="grade-item"><span>C</span><span>70-79%</span></div>
                    <div class="grade-item"><span>D</span><span>60-69%</span></div>
                    <div class="grade-item"><span>F</span><span>Below 60%</span></div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Course Policies</h2>
            <div class="policy-item">
                <div class="policy-title">Attendance</div>
                <div>Attendance is expected at all lectures and lab sessions. More than 3 unexcused absences will result in a deduction from the participation grade.</div>
            </div>
            <div class="policy-item">
                <div class="policy-title">Late Work</div>
                <div>Late homework receives a 10% penalty per day, up to 3 days. No submissions accepted after 3 days. One homework drop is provided for emergencies.</div>
            </div>
            <div class="policy-item">
                <div class="policy-title">Academic Integrity</div>
                <div>All work must be your own unless otherwise stated. Discussing approaches is encouraged, but sharing code is prohibited. Violations will be reported to the Dean of Students.</div>
            </div>
            <div class="policy-item">
                <div class="policy-title">Accommodations</div>
                <div>Students with disabilities should register with the Disability Resource Center and provide accommodation letters at the start of the semester.</div>
            </div>
        </section>
    </main>

    <footer class="document-footer">
        <div class="footer-content">
            <div class="footer-branding">
                <div class="footer-logo">P</div>
                <div>
                    <div class="footer-org-name">Purdue University</div>
                    <div class="footer-meta">Department of Computer Science</div>
                </div>
            </div>
            <div class="footer-meta">Computer Science &bull; CS 180</div>
        </div>
    </footer>
</body>
</html>
', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, created_at, updated_at, active, generated, mcp) VALUES ('97b50025-177e-4376-9bb0-997373e7bb40', '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Academic Integrity Policy</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html {
            font-size: 16px;
        }

        body {
            font-family: "Georgia", "Times New Roman", serif;
            background: #ffffff;
            color: #111827;
            line-height: 1.6;
        }

        .document-container {
            max-width: 850px;
            margin: 2.5rem auto 3rem;
            padding: 3rem 3.5rem;
            background: #ffffff;
            border: 1px solid #d4d4d8;
            border-radius: 0;
        }

        .document-title-section {
            padding-bottom: 1.75rem;
            margin-bottom: 1.75rem;
            border-bottom: 1.5px solid #9ca3af;
            text-align: center;
        }

        .document-title-section h1 {
            font-size: 2.25rem;
            font-weight: 700;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            color: #111827;
            margin-bottom: 0.5rem;
        }

        .document-title-section .class-info {
            font-size: 0.95rem;
            color: #4b5563;
            font-weight: 400;
        }

        .meta-section {
            margin-bottom: 2.5rem;
        }

        .meta-grid {
            display: table;
            width: 100%;
            border-collapse: collapse;
            border-top: 1px solid #d4d4d8;
            border-bottom: 1px solid #d4d4d8;
        }

        .meta-item {
            display: table-row;
        }

        .meta-label,
        .meta-value {
            display: table-cell;
            padding: 0.5rem 0.25rem;
            vertical-align: top;
            font-size: 0.95rem;
            border-top: 1px solid #e5e7eb;
        }

        .meta-item:first-child .meta-label,
        .meta-item:first-child .meta-value {
            border-top: none;
        }

        .meta-label {
            width: 28%;
            font-weight: 600;
            color: #374151;
            padding-right: 1.5rem;
            white-space: nowrap;
        }

        .meta-value {
            color: #111827;
        }

        .section {
            margin-bottom: 2.5rem;
        }

        .section h2 {
            font-size: 1.35rem;
            font-weight: 700;
            color: #111827;
            margin-bottom: 1rem;
            border-bottom: 1px solid #9ca3af;
            padding-bottom: 0.4rem;
        }

        .policy-content {
            border-left: 3px solid #111827;
            padding: 1.25rem 1.5rem;
            background: #f9fafb;
            font-size: 0.98rem;
            color: #111827;
        }

        .policy-section {
            border: 1px solid #d4d4d8;
            padding: 1.5rem;
            background: #ffffff;
            margin-bottom: 1.5rem;
        }

        .policy-section-title {
            font-size: 1rem;
            font-weight: 600;
            color: #111827;
            margin-bottom: 0.75rem;
        }

        .guideline-item {
            margin-bottom: 0.75rem;
            padding-left: 1.5rem;
            position: relative;
        }

        .guideline-item:before {
            content: "\25B8";
            position: absolute;
            left: 0;
            color: #6b7280;
        }

        .guideline-item:last-child {
            margin-bottom: 0;
        }

        .compliance-item {
            display: flex;
            justify-content: space-between;
            padding: 0.75rem 0;
            border-bottom: 1px solid #e5e7eb;
        }

        .compliance-item:last-child {
            border-bottom: none;
        }

        .compliance-label {
            font-weight: 600;
            color: #374151;
        }

        .compliance-value {
            color: #111827;
        }

        .document-footer {
            border-top: 1px solid #d4d4d8;
            padding: 1.5rem 0;
            margin-top: 1rem;
            font-size: 0.8rem;
            color: #4b5563;
        }

        .footer-content {
            max-width: 850px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .footer-branding {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .footer-logo {
            width: 32px;
            height: 32px;
            border-radius: 2px;
            border: 1px solid #9ca3af;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 0.9rem;
            color: #111827;
        }

        .footer-org-name {
            font-weight: 600;
            color: #111827;
            font-size: 0.9rem;
        }

        .footer-meta {
            font-size: 0.8rem;
            color: #4b5563;
        }

        @media print {
            body {
                background: #ffffff;
                color: #000000;
            }

            .document-container {
                margin: 0;
                padding: 0;
                border: none;
            }

            .document-footer {
                border-top: 1px solid #d4d4d8;
                margin-top: 1.5rem;
                padding-top: 0.75rem;
            }

            .policy-section {
                border: 1px solid #c4c4c4;
            }
        }

        @media (max-width: 768px) {
            .document-container {
                margin: 0.5rem;
                padding: 1.5rem 1.25rem 2rem;
            }

            .footer-content {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <main class="document-container">
        <section class="document-title-section">
            <h1>Academic Integrity Policy</h1>
            <div class="class-info">Office of the Dean of Students</div>
        </section>

        <section class="meta-section">
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Department</div>
                    <div class="meta-value">Office of the Dean of Students</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Document Type</div>
                    <div class="meta-value">University Policy</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Effective Date</div>
                    <div class="meta-value">August 2024</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Applies To</div>
                    <div class="meta-value">All enrolled students, faculty, and instructional staff</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Purpose</h2>
            <div class="policy-content">
                This policy establishes the university''s standards for academic integrity and outlines the procedures for addressing violations. Academic integrity is fundamental to the mission of the university and to the value of the degrees it confers. Every member of the academic community is expected to uphold the highest standards of honesty in all scholarly work.
            </div>
        </section>

        <section class="section">
            <h2>Scope</h2>
            <div class="policy-content">
                This policy applies to all academic work submitted for credit, including but not limited to examinations, papers, laboratory reports, homework assignments, presentations, and any other work evaluated as part of a course or academic program. It covers all students enrolled in undergraduate, graduate, and professional programs.
            </div>
        </section>

        <section class="section">
            <h2>Definitions of Academic Dishonesty</h2>
            <div class="policy-section">
                <div class="policy-section-title">Forms of Academic Dishonesty</div>
                <div class="guideline-item">
                    <strong>Plagiarism:</strong> Submitting the work of another person as one''s own, including copying text, ideas, or data without proper attribution. This includes paraphrasing without citation and submitting purchased or AI-generated work as one''s own.
                </div>
                <div class="guideline-item">
                    <strong>Cheating:</strong> Using unauthorized materials, information, or study aids during an examination or assignment. This includes copying from another student, using prohibited notes or devices, and obtaining exam materials prior to administration.
                </div>
                <div class="guideline-item">
                    <strong>Fabrication:</strong> Inventing or falsifying information, data, or citations in any academic exercise. This includes fabricating research results, altering data, and misrepresenting sources.
                </div>
                <div class="guideline-item">
                    <strong>Facilitation:</strong> Helping or attempting to help another student commit an act of academic dishonesty. This includes providing unauthorized access to materials, sharing answers, or completing work on behalf of another student.
                </div>
                <div class="guideline-item">
                    <strong>Unauthorized Collaboration:</strong> Working with others on assignments that are designated as individual work without explicit permission from the instructor.
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Reporting and Investigation Process</h2>
            <div class="policy-section">
                <div class="guideline-item">
                    Instructors who suspect a violation will first discuss the matter with the student and provide an opportunity for the student to respond.
                </div>
                <div class="guideline-item">
                    If the instructor determines a violation has occurred, they will submit a report to the Office of the Dean of Students within 10 business days.
                </div>
                <div class="guideline-item">
                    The student will receive written notification of the allegation and will have 5 business days to schedule a meeting with the Dean of Students office.
                </div>
                <div class="guideline-item">
                    The student may accept responsibility or request a formal hearing before the Academic Integrity Committee.
                </div>
                <div class="guideline-item">
                    All proceedings are documented and maintained in the student''s disciplinary file for the duration of their enrollment.
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Sanctions</h2>
            <div class="policy-section">
                <div class="compliance-item">
                    <span class="compliance-label">First Offense (Minor)</span>
                    <span class="compliance-value">Zero on assignment, academic integrity education course</span>
                </div>
                <div class="compliance-item">
                    <span class="compliance-label">First Offense (Major)</span>
                    <span class="compliance-value">Failing grade in course, disciplinary probation</span>
                </div>
                <div class="compliance-item">
                    <span class="compliance-label">Second Offense</span>
                    <span class="compliance-value">Suspension for one or more semesters</span>
                </div>
                <div class="compliance-item">
                    <span class="compliance-label">Third Offense</span>
                    <span class="compliance-value">Expulsion from the university</span>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Student Rights</h2>
            <div class="policy-content">
                Students accused of academic dishonesty have the right to be informed of the specific allegations, to review all evidence, to present their case and supporting evidence, to have an advisor present during hearings, and to appeal any decision through the university''s formal appeals process. The appeals process must be initiated within 10 business days of the original decision.
            </div>
        </section>

        <section class="section">
            <h2>Review Information</h2>
            <div class="policy-content">
                <p><strong>Next Review Date:</strong> August 2025</p>
            </div>
        </section>
    </main>

    <footer class="document-footer">
        <div class="footer-content">
            <div class="footer-branding">
                <div class="footer-logo">U</div>
                <div>
                    <div class="footer-org-name">University</div>
                    <div class="footer-meta">Office of the Dean of Students</div>
                </div>
            </div>
            <div class="footer-meta">
                Academic Integrity Policy
            </div>
        </div>
    </footer>
</body>
</html>
', '2026-02-11T23:50:02.269303+00:00', '2026-02-11T23:50:02.269303+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, created_at, updated_at, active, generated, mcp) VALUES ('8a823596-f02f-4836-ab23-983c706ce7a2', '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Distressed and Disruptive Student Response Policy</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html {
            font-size: 16px;
        }

        body {
            font-family: "Georgia", "Times New Roman", serif;
            background: #ffffff;
            color: #111827;
            line-height: 1.6;
        }

        .document-container {
            max-width: 850px;
            margin: 2.5rem auto 3rem;
            padding: 3rem 3.5rem;
            background: #ffffff;
            border: 1px solid #d4d4d8;
            border-radius: 0;
        }

        .document-title-section {
            padding-bottom: 1.75rem;
            margin-bottom: 1.75rem;
            border-bottom: 1.5px solid #9ca3af;
            text-align: center;
        }

        .document-title-section h1 {
            font-size: 2.25rem;
            font-weight: 700;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            color: #111827;
            margin-bottom: 0.5rem;
        }

        .document-title-section .class-info {
            font-size: 0.95rem;
            color: #4b5563;
            font-weight: 400;
        }

        .meta-section {
            margin-bottom: 2.5rem;
        }

        .meta-grid {
            display: table;
            width: 100%;
            border-collapse: collapse;
            border-top: 1px solid #d4d4d8;
            border-bottom: 1px solid #d4d4d8;
        }

        .meta-item {
            display: table-row;
        }

        .meta-label,
        .meta-value {
            display: table-cell;
            padding: 0.5rem 0.25rem;
            vertical-align: top;
            font-size: 0.95rem;
            border-top: 1px solid #e5e7eb;
        }

        .meta-item:first-child .meta-label,
        .meta-item:first-child .meta-value {
            border-top: none;
        }

        .meta-label {
            width: 28%;
            font-weight: 600;
            color: #374151;
            padding-right: 1.5rem;
            white-space: nowrap;
        }

        .meta-value {
            color: #111827;
        }

        .section {
            margin-bottom: 2.5rem;
        }

        .section h2 {
            font-size: 1.35rem;
            font-weight: 700;
            color: #111827;
            margin-bottom: 1rem;
            border-bottom: 1px solid #9ca3af;
            padding-bottom: 0.4rem;
        }

        .policy-content {
            border-left: 3px solid #111827;
            padding: 1.25rem 1.5rem;
            background: #f9fafb;
            font-size: 0.98rem;
            color: #111827;
        }

        .policy-section {
            border: 1px solid #d4d4d8;
            padding: 1.5rem;
            background: #ffffff;
            margin-bottom: 1.5rem;
        }

        .policy-section-title {
            font-size: 1rem;
            font-weight: 600;
            color: #111827;
            margin-bottom: 0.75rem;
        }

        .guideline-item {
            margin-bottom: 0.75rem;
            padding-left: 1.5rem;
            position: relative;
        }

        .guideline-item:before {
            content: "\25B8";
            position: absolute;
            left: 0;
            color: #6b7280;
        }

        .guideline-item:last-child {
            margin-bottom: 0;
        }

        .compliance-item {
            display: flex;
            justify-content: space-between;
            padding: 0.75rem 0;
            border-bottom: 1px solid #e5e7eb;
        }

        .compliance-item:last-child {
            border-bottom: none;
        }

        .compliance-label {
            font-weight: 600;
            color: #374151;
        }

        .compliance-value {
            color: #111827;
        }

        .document-footer {
            border-top: 1px solid #d4d4d8;
            padding: 1.5rem 0;
            margin-top: 1rem;
            font-size: 0.8rem;
            color: #4b5563;
        }

        .footer-content {
            max-width: 850px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .footer-branding {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .footer-logo {
            width: 32px;
            height: 32px;
            border-radius: 2px;
            border: 1px solid #9ca3af;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 0.9rem;
            color: #111827;
        }

        .footer-org-name {
            font-weight: 600;
            color: #111827;
            font-size: 0.9rem;
        }

        .footer-meta {
            font-size: 0.8rem;
            color: #4b5563;
        }

        @media print {
            body {
                background: #ffffff;
                color: #000000;
            }

            .document-container {
                margin: 0;
                padding: 0;
                border: none;
            }

            .document-footer {
                border-top: 1px solid #d4d4d8;
                margin-top: 1.5rem;
                padding-top: 0.75rem;
            }

            .policy-section {
                border: 1px solid #c4c4c4;
            }
        }

        @media (max-width: 768px) {
            .document-container {
                margin: 0.5rem;
                padding: 1.5rem 1.25rem 2rem;
            }

            .footer-content {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <main class="document-container">
        <section class="document-title-section">
            <h1>Distressed and Disruptive Student Response Policy</h1>
            <div class="class-info">Office of Student Affairs &amp; Counseling Services</div>
        </section>

        <section class="meta-section">
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Department</div>
                    <div class="meta-value">Office of Student Affairs</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Document Type</div>
                    <div class="meta-value">University Policy &amp; Guidelines</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Effective Date</div>
                    <div class="meta-value">August 2024</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Applies To</div>
                    <div class="meta-value">Faculty, teaching assistants, and instructional staff</div>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Purpose</h2>
            <div class="policy-content">
                This policy provides guidelines for faculty and instructional staff on how to recognize, respond to, and support students who are experiencing emotional distress or exhibiting disruptive behavior in academic settings. The goal is to ensure the safety and well-being of all individuals while maintaining a productive learning environment and connecting students with appropriate support services.
            </div>
        </section>

        <section class="section">
            <h2>Scope</h2>
            <div class="policy-content">
                This policy applies to all interactions between instructional staff and students in classrooms, offices, labs, and other university facilities. It covers situations ranging from students showing signs of emotional distress to those whose behavior disrupts the learning environment or poses safety concerns.
            </div>
        </section>

        <section class="section">
            <h2>Recognizing Signs of Distress</h2>
            <div class="policy-section">
                <div class="policy-section-title">Behavioral Indicators</div>
                <div class="guideline-item">
                    <strong>Academic changes:</strong> Sudden decline in attendance, missed assignments, drop in quality of work, inability to concentrate, or repeated requests for extensions without clear reason.
                </div>
                <div class="guideline-item">
                    <strong>Emotional signs:</strong> Excessive tearfulness, visible anxiety or agitation, expressions of hopelessness, withdrawal from peers, or unusual irritability.
                </div>
                <div class="guideline-item">
                    <strong>Physical indicators:</strong> Noticeable changes in hygiene or appearance, signs of exhaustion, weight changes, or visible injuries.
                </div>
                <div class="guideline-item">
                    <strong>Verbal cues:</strong> References to feeling overwhelmed, statements about giving up, expressions of isolation, or direct statements about self-harm or harming others.
                </div>
                <div class="guideline-item">
                    <strong>Disruptive behavior:</strong> Outbursts of anger, confrontational interactions with peers or staff, threats, or behavior that interferes with the learning of others.
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Response Guidelines</h2>
            <div class="policy-section">
                <div class="policy-section-title">Responding to a Distressed Student</div>
                <div class="guideline-item">
                    Speak privately with the student in a calm, non-judgmental manner. Choose a quiet location where the conversation cannot be overheard.
                </div>
                <div class="guideline-item">
                    Express your concern directly and specifically. For example: "I''ve noticed you''ve missed the last three classes, and I''m concerned about how you''re doing."
                </div>
                <div class="guideline-item">
                    Listen actively and avoid minimizing the student''s feelings. Do not attempt to diagnose or provide therapy.
                </div>
                <div class="guideline-item">
                    Provide information about campus resources, including the Counseling Center (765-494-6995), the Dean of Students Office, and the Crisis Text Line (text HOME to 741741).
                </div>
                <div class="guideline-item">
                    Follow up with the student within a few days to check in and reiterate your support.
                </div>
            </div>
            <div class="policy-section">
                <div class="policy-section-title">Responding to a Disruptive Student</div>
                <div class="guideline-item">
                    Remain calm and speak in a steady, measured tone. Do not escalate the situation with raised voice or aggressive body language.
                </div>
                <div class="guideline-item">
                    Acknowledge the student''s frustration while setting clear boundaries. For example: "I can see you''re upset, and I want to help. However, this behavior is not appropriate in the classroom."
                </div>
                <div class="guideline-item">
                    If the behavior continues, ask the student to step outside with you, or dismiss the class temporarily if necessary.
                </div>
                <div class="guideline-item">
                    Document the incident with specific details (date, time, behavior observed, actions taken) and report it to your department chair and the Dean of Students Office.
                </div>
                <div class="guideline-item">
                    If you feel unsafe at any point, contact campus police immediately (911 or 765-494-8221).
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Campus Resources</h2>
            <div class="policy-section">
                <div class="compliance-item">
                    <span class="compliance-label">Counseling and Psychological Services</span>
                    <span class="compliance-value">765-494-6995</span>
                </div>
                <div class="compliance-item">
                    <span class="compliance-label">Dean of Students Office</span>
                    <span class="compliance-value">765-494-1747</span>
                </div>
                <div class="compliance-item">
                    <span class="compliance-label">Campus Police (Non-Emergency)</span>
                    <span class="compliance-value">765-494-8221</span>
                </div>
                <div class="compliance-item">
                    <span class="compliance-label">Crisis Text Line</span>
                    <span class="compliance-value">Text HOME to 741741</span>
                </div>
                <div class="compliance-item">
                    <span class="compliance-label">Student Care and Referral (CARE)</span>
                    <span class="compliance-value">765-494-1747</span>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Documentation Requirements</h2>
            <div class="policy-content">
                All incidents involving distressed or disruptive students must be documented using the university''s online reporting system within 24 hours. Reports should include the date, time, and location of the incident, a factual description of the observed behavior, any actions taken, and whether the student was referred to support services. This documentation helps the university track patterns and ensure students receive appropriate follow-up care.
            </div>
        </section>

        <section class="section">
            <h2>Review Information</h2>
            <div class="policy-content">
                <p><strong>Next Review Date:</strong> August 2025</p>
            </div>
        </section>
    </main>

    <footer class="document-footer">
        <div class="footer-content">
            <div class="footer-branding">
                <div class="footer-logo">U</div>
                <div>
                    <div class="footer-org-name">University</div>
                    <div class="footer-meta">Office of Student Affairs &amp; Counseling Services</div>
                </div>
            </div>
            <div class="footer-meta">
                Distressed and Disruptive Student Response Policy
            </div>
        </div>
    </footer>
</body>
</html>
', '2026-02-11T23:50:02.269303+00:00', '2026-02-11T23:50:02.269303+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- texts_texts_connection
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005b-7e73-92cf-45f8bfca8d76', '019c29d6-003a-7f3d-9c60-a6c537f708ce', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-70a2-921b-6f8c3be52b7a', '019c29d6-003a-7541-984b-5374263aa03b', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-714c-81db-6998e1e7ef95', '019c29d6-003b-71b1-bfa5-69ef5f636751', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-7205-8dea-be2ddf4258ef', '019c29d6-003a-731f-b918-64b6c99d0464', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-72ae-8312-4708579fd54b', '019c29d6-003a-740e-8854-4d9ee26d34a6', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-733c-a565-88b232c706d3', '019c29d6-003b-7026-b46a-5def99ec275a', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-7419-9bbc-db30a5b6483c', '019c29d6-003a-7647-aa7f-b9baebd83bf3', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('258ee632-aa7a-4fb5-b9a8-fd4a4635f283', '97b50025-177e-4376-9bb0-997373e7bb40', true, '2026-02-11T23:50:02.269303+00:00', '2026-02-11T23:50:02.269303+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('8e9fdbb5-9c4e-4f8f-9b03-b056a9caa0ea', '8a823596-f02f-4836-ab23-983c706ce7a2', true, '2026-02-11T23:50:02.269303+00:00', '2026-02-11T23:50:02.269303+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;

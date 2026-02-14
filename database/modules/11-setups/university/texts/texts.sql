-- Module: texts
-- Category: texts
-- Description: Text entries and connections for document texts
-- ============================================================

-- texts_entry
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003a-7f3d-9c60-a6c537f708ce', '<!DOCTYPE html>
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
', 'f00bc10d10db2ba0292316a875c1a05d', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003a-7541-984b-5374263aa03b', '<!DOCTYPE html>
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
', 'a2d19faa2ac59a14cb0a9a01392ea7f3', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003b-71b1-bfa5-69ef5f636751', '<!DOCTYPE html>
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
', '6d86801ce52ecbb89db00d008e57ea9b', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003a-731f-b918-64b6c99d0464', '<!DOCTYPE html>
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
', 'aa5b00e4c52b003ae6a89f9163142074', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003a-740e-8854-4d9ee26d34a6', '<!DOCTYPE html>
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
', 'f2bd2f1cc3507d19b376149b56d6b399', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003b-7026-b46a-5def99ec275a', '<!DOCTYPE html>
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
', '4b580db9b061e12e419a6dbf460ff653', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('019c29d6-003a-7647-aa7f-b9baebd83bf3', '<!DOCTYPE html>
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
', '8281feef8a15f157dc90225a16c474ed', '2025-12-06T02:59:23.893847+00:00', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('019c5ad4-73da-75a6-a9bf-5c4c5e79178e', 'Academic Integrity
Academic Integrity
A new phone number and email address have been established to facilitate the reporting of
student academic integrity issues.
Individuals can email a concern to redacted@purdue.edu or call 765-494-8778 to speak with a
staff member in the Office of Student Rights and Responsibilities about the matter. OSRR staff will
then investigate the situation and provide feedback to the reporter.
Concerns may also be reported anonymously. 
"Academic Integrity: A Guide for Students"
Written by: Stephen Akers, PhD
Executive Associate Dean of Students
1995, Revised 1999, 2003, 2009
Published by the Office of the Dean of Students
in cooperation with Purdue Student Government
Helen B. Schleman Hall, Suite 216
656 Oval Drive
West Lafayette, IN 47907-2050
Telephone: 765-494-1747
Purdue University values intellectual integrity and the highest standards of academic conduct. To
be prepared to meet societal needs as leaders and role models, students must be educated in an
ethical learning environment that promotes a high standard of honor in scholastic work. Academic
dishonesty undermines institutional integrity and threatens the academic fabric of Purdue
University. Dishonesty is not an acceptable avenue to success. It diminishes the quality of a Purdue
education, which is valued because of Purdue''s high academic standards.
Office of Student Rights andResponsibilities


Fostering an appreciation for academic standards and values is a shared responsibility among
students, faculty, and staff. The information in this brochure is directed to students to define
academic dishonesty and how to avoid it.
Definition of Academic Dishonesty
Purdue prohibits "dishonesty in connection with any University activity. Cheating, plagiarism, or
knowingly furnishing false information to the University are examples of dishonesty" (Part 5,
Section III-B-2-a,  Furthermore, the University Senate has stipulated that
"the commitment of acts of cheating, lying, and deceit in any of their diverse forms (such as the use
of substitutes for taking examinations, the use of illegal cribs, plagiarism, and copying during
examinations) is dishonest and must not be tolerated. Moreover, knowingly to aid and abet, directly
or indirectly, other parties in committing dishonest acts is in itself dishonest" (University Senate
Document 72-18, December 15, 1972).
More specifically, the following are a few examples of academic dishonesty that have been
discovered at Purdue University.
Student Regulations).
o
o
substituting on an exam for another student
substituting in a course for another student
paying someone else to write a paper and submitting it as one''s own work
giving or receiving answers by use of signals during an exam
copying with or without the other person''s knowledge during an exam
doing class assignments for someone else
plagiarizing published material, class assignments or lab reports
turning in a paper that has been purchased from a commercial research firm or obtained from
the Internet
padding items of a bibliography
obtaining an unauthorized copy of a test in advance of its scheduled administration
using unauthorized notes during an exam
collaborating with other students on assignments when it is not allowed
obtaining a test from the exam site, completing and submitting it later
altering answers on a scored test and submitting it for a regrade
accessing and altering grade records
↑

Plagiarism is a special kind of academic dishonesty in which one person steals another person''s
ideas or words and falsely presents them as the plagiarist''s own product. This is most likely to
occur in the following ways:
Basic Tips on Avoiding Claims of
Dishonesty
Careful attention to your own academic duties is the best way to avoid allegations of academic
dishonesty. If you are asked to do something that you feel is wrong or unethical, it probably is.
Aiding someone in committing an academically dishonest act is just as serious as receiving the aid.
Review course syllabi and make sure you understand your instructors'' expectations and responses
regarding academic dishonesty. The following tips may help you avoid problems:
stealing class assignments from other students and submitting them as one''s own
fabricating data
destroying or stealing the work of other students
using the exact language of someone else without the use of quotation marks and without
giving proper credit to the author
presenting the sequence of ideas or arranging the material of someone else even though such is
expressed in one''s own words, without giving appropriate acknowledgment
submitting a document written by someone else but representing it as one''s own
Do not look around, particularly in the direction of other students'' papers, during an exam since
it may appear you are trying to copy from others.
When taking an exam, shield your answer sheet. If you feel someone is trying to copy from you,
ask the proctor if you may move. This will alert the proctor to a potential problem and help
remove suspicion from you as aiding the other student if a claim of cheating arises.
If you are allowed to take materials into a testing site, make sure no notes or materials are
exposed or accessible that could cause one to believe you are using unauthorized aids (cribs)
Should there be any doubt, clarify with your instructor how much collaboration, if any, is
permitted or expected when working on projects or assignments with other students
Know that it is risky to electronically copy or transmit a computer program or file to other
students. You could be implicated in a cheating incident if others alter that program and submit
it as their own work.

What To Do if You Suspect or Become
Aware of Cheating
Students who cheat gain an unfair advantage over honest students. Although reporting suspected
or observed cheating may seem difficult, failure to do so hurts you as well as Purdue. Observations
or knowledge of academic dishonesty should be reported immediately to course instructors. Even
Protect your computer login identifications and passwords. Other students could use them to
access your work and subsequently implicate you in a cheating case.
Since it is impossible to write everything with complete originality, use quotation marks,
footnotes, and parenthetical textual notes to acknowledge other people''s words or ideas
employed in your paper. Check with your instructor for proper techniques for citations and
attribution if you have any doubts.
Do not include sources in a bibliography or reference list if you have not used the sources in the
preparation of your paper. To list unused sources is called padding the bibliography.
Do not acquire previous papers, lab reports, or assignments used in a course with the intention
of copying parts or all of the material. Consult with your instructor on how such materials may
be used as general guides.
Keep rough drafts and copies of papers submitted in courses since other students may get
access to your work and attempt to claim it as their own
Do not leave copies of assignments in computer labs
Do not share your current or former assignments, projects, papers, etc., with other students to
use as guides for their work. Such a practice could lead to claims of collaboration if part or all of
your work is lifted by another student. Sometimes friendly assistance may escalate into claims of
blatant dishonesty.
Check with your instructor before turning in a paper or project you submitted in another course
Do not give your homework papers, projects, or other assignments to other students to submit
for you. They may use parts of your work.
When completing take-home exams, do not collaborate with other persons unless approved by
the instructor
Keep your student identification card in your possession or secured. Never loan your
identification to anyone.
Do not make any marks on a graded exam if there is any chance you may submit it for a
regrade. Make all notations on a separate paper.

Academic Integrity and You: Undergraduate Edition
Academic Integrity and You: Graduate Edition
Academic Integrity and You: Faculty and Staff
if your observations are reported anonymously, such information may encourage instructors to do
further investigation, detect patterns of cheating or impose effective preventive measures. If you
are uncomfortable speaking directly with an instructor, you are urged to consult with staff in the
Office of the Dean of Students who will advise and assist you in addressing the problem.
Consequences for Academic Dishonesty
Before any formal action is taken against a student who is suspected of committing academic
dishonesty, the instructor is encouraged to meet with the student to discuss the facts surrounding
the suspicions. If the instructor concludes that the student is guilty, the matter may be resolved
with the student through punitive grading. Examples of punitive grading are giving a lower or
failing grade on the assignment, having the student repeat the assignment and perhaps some
additional assignment, or assessing a lower or failing grade for the course. The grade appeals
system offers recourse to a student whose grade has been reduced unfairly for alleged academic
dishonesty.
Additionally, instructors are encouraged to refer cases to the Office of the Dean of Students for
adjudication and/or appropriate record keeping. The Office of the Dean of Students will follow
established procedures as provided in Part 5, Section III, of Student Regulations. If a student is
found guilty, possible penalties include a warning, probation, probated suspension, suspension or
expulsion.
Feel free to make a print of this brochure for yourself. Copies of this brochure are available through
the Office of Student Rights and Responsibilities at no cost, 765-494-1250.
ACADEMIC INTEGRITY', '651151a3bad69a8dd4891932605429bf', '2026-02-14T06:26:38.435028+00:00', '2026-02-14T06:26:38.435028+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('019c5ad4-7a52-7a69-b03d-b31104496c0c', ' 
 
UNITED STATES DEPARTMENT OF EDUCATION 
STUDENT PRIVACY POLICY OFFICE 
Issued March 8, 2023 
SPPO-23-01 
 
An Eligible Student Guide to the  
Family Educational Rights and Privacy Act (FERPA) 
 
The Family Educational Rights and Privacy Act or FERPA (20 U.S.C. §1232g; 34 CFR Part 
99) provides certain rights for parents regarding their children’s education records. When a 
student reaches 18 years of age or attends an institution of postsecondary education at any 
age, the student becomes an “eligible student,” and all rights under FERPA transfer from the 
parent to the student. This guide discusses an eligible student’s rights under FERPA. A 
companion document discussing parents’ rights under FERPA is available on our website at 
https://studentprivacy.ed.gov/resources/ferpa-general-guidance-parents.  
FERPA is a Federal law that is administered by the Student Privacy Policy Office (SPPO) in 
the U.S. Department of Education (Department). FERPA protects “education records,” 
which are generally defined as records that are directly related to a student and maintained 
by an educational agency or institution or by a party acting for the agency or institution. An 
“educational agency or institution,” hereinafter referred to as a “school,” generally means a 
school district, a public elementary or secondary school, or an institution of postsecondary 
education, such as a college or university. There are also a few exemptions to the definition 
of “education records,” such as law enforcement unit records and sole possession records. 
More information is available at https://studentprivacy.ed.gov/faq/what-records-are-
exempted-ferpa.  
FERPA applies to all schools that receive funding under any program administered by the 
Department. Private and faith-based schools at the elementary and secondary levels 
generally do not receive such funding and are, therefore, generally not subject to FERPA. 
Private institutions of postsecondary education, however, generally do receive such funding 
(e.g., student aid under title IV of the Higher Education Act of 1965, as amended) and are, 
therefore, generally subject to FERPA. In addition, the confidentiality of personally 
identifiable information (PII) in the education records of students with disabilities is further 
protected by Part B of the Individuals with Disabilities Education Act (IDEA) (20 U.S.C. 
1417(c) and 34 CFR §§ 300.610-300.626). The IDEA and its implementing regulations 
contain confidentiality provisions that are similar to, but broader than, FERPA, and cover 
students with disabilities who have turned 18 but are still eligible under IDEA. Depending 
on State law, the rights accorded to parents under IDEA Part B may not automatically 
transfer to the student when the student with a disability reaches 18 years old or attends an 
institution of postsecondary education at any age. The IDEA-FERPA crosswalk contains 
additional information comparing IDEA and FERPA and is available at 
https://studentprivacy.ed.gov/resources/ferpaidea-crosswalk. 

2 
   
 
 
The rights provided by FERPA to an eligible student include, but are not limited to: 
• Access to Education Records 
Under FERPA, a school or State educational agency (SEA) must provide an eligible student 
with an opportunity to inspect and review their education records within a reasonable period 
of time, but not more than 45 calendar days following the receipt of a request. A school or 
SEA is generally not required to provide an eligible student with copies of education records 
unless circumstances effectively prevent an eligible student from exercising their right to 
inspect and review the education records. For example, if an eligible student who does not 
live within commuting distance of the school requests access to their education records, the 
school would be required to make other arrangements for the eligible student to inspect and 
review the requested records, or to provide a copy of the requested records.  
FERPA’s access provisions apply to education records maintained by educational agencies 
or institutions, including documents such as academic transcripts. While eligible students 
have a right to inspect and review their education records, including academic transcripts 
maintained by their schools, eligible students do not necessarily have a right to obtain a 
copy of such records under FERPA.  
• Amendment of Education Records 
Under FERPA, an eligible student has the right to seek amendment or correction of their 
education records that the eligible student believes to be inaccurate, misleading, or in 
violation of their rights of privacy. However, while a school is not required to amend an 
education record in accordance with an eligible student’s request, a school is required to 
consider the request for amendment, to inform the student of its decision, and, if the request 
is denied, to advise the student of their right to a hearing on the matter. If, as a result of the 
hearing, a school decides not to amend the education records, then the eligible student has 
the right to insert a statement in the record commenting on the contested information or 
stating why they disagree with the decision, or both. That statement must remain with the 
contested part of the education record for as long as the record is maintained and be 
included whenever the contested part is disclosed. 
While an eligible student has the right to seek to amend non-substantive factual errors in the 
student’s education records, the right is not unlimited. A school is not required by FERPA to 
afford an eligible student the right to seek to change substantive decisions made by school 
officials, such as substantive decisions made in the context of grades given to a student 
based on their performance, other evaluations of the student’s performance, or disciplinary 
decisions.  
• Disclosure of Education Records 
Under FERPA, a school generally may not disclose PII from an eligible student’s education 
records to a third party unless the eligible student has provided prior written consent. Even 
with the prior written consent of an eligible student, a school is not required by FERPA to 
disclose PII from education records to third parties. Accordingly, under FERPA, a school 

3 
   
 
 
may have a policy of not disclosing PII from education records to third parties if the eligible 
student owes money to the school. There are several exceptions to FERPA’s general consent 
requirement, some of which are described below. Under these exceptions, schools are 
permitted to disclose PII from education records without consent to a third party, but they 
are not required to do so by FERPA. 
School Official 
FERPA allows “school officials,” including faculty and staff within an institution of 
postsecondary education, to access PII from education records without consent, provided 
the school has determined that they have a “legitimate educational interest” in the 
information. The school’s annual notification of rights under FERPA must specify the 
criteria for determining which parties are “school officials” and what the school considers 
to be a “legitimate educational interest.” Typically, a school official has a legitimate 
educational interest if the official needs to review an education record in order to fulfill 
their professional responsibility. 
Also, under the “school official” exception to the consent requirement, FERPA permits a 
school to disclose PII from education records to contractors (e.g., software/application 
vendors or lawyers), consultants (e.g., nutritional or information technology consultants), 
volunteers (e.g., student volunteers or tutors) or other third parties to whom the school 
has outsourced institutional services or functions, provided that the outside party: 
1. Performs an institutional service or function for which the school would otherwise 
use employees;  
2. Is under the direct control of the school with respect to the use and maintenance of 
education records;  
3. Is subject to the requirements in FERPA that PII from education records may be used 
only for the purposes for which the disclosure was made, and which govern the 
redisclosure of PII from education records; and 
4. Meets the criteria specified in the school’s annual notification of FERPA rights for 
being a school official with a legitimate educational interest in the education records. 
Seeks or Intends to Enroll 
Another exception to FERPA’s general consent requirement permits a school to disclose 
PII from an eligible student’s education records, without consent, to another school in 
which the student seeks or intends to enroll, or where the student is already enrolled, as 
long as the purpose of the disclosure is related to the student’s enrollment or transfer. A 
school that discloses education records under this exception must make a reasonable 
attempt to notify the eligible student of the disclosure, unless the disclosure is initiated by 
the student, or the school’s annual notification of rights under FERPA includes a notice 
that it forwards education records to other schools that have requested the records and in 
which the student seeks or intends to enroll or is already enrolled, as long as the 
disclosure is for purposes related to the student’s enrollment or transfer. A school that 
discloses education records under this exception also must provide the student, upon 
request, a copy of the records that were disclosed and, upon request, an opportunity for a 

4 
   
 
 
hearing to amend the records that were disclosed. Under this exception, a school has the 
discretion to disclose academic, disciplinary, or any other PII from the student’s 
education records to the new school. Further, an eligible student does not, under FERPA, 
have the right to prevent a school from disclosing such PII from the student’s education 
records, or from communicating information about a student more generally, to the 
school in which the student seeks or intends to enroll. 
Directory Information 
FERPA also permits a school to disclose PII from an eligible student’s education records, 
without consent, when such information has been appropriately designated as “directory 
information,” and the eligible student has not opted out of the disclosure of such 
designated information. The FERPA regulations define “directory information” as 
information in a student’s education record that would not generally be considered 
harmful or an invasion of privacy if disclosed. Directory information may include 
information such as the student’s name, address, telephone number, email address, 
photograph, date and place of birth, major field of study, grade level, enrollment status 
(e.g., undergraduate or graduate, full-time or part-time), dates of attendance (i.e., the 
period of time during which the student attends or attended the school), participation in 
officially recognized activities and sports, weight and height of members of athletic 
teams, degrees, honors and awards received, and the most recent school attended. FERPA 
provides that a school may disclose, without consent, directory information if the school 
has given public notice to eligible students of the types of PII that it has designated as 
directory information and the process, including period of time, for eligible students to 
opt out of certain directory information disclosures. This notice is often included in the 
annual notification discussed below. For more information regarding directory 
information, visit https://studentprivacy.ed.gov/training/b-cs-student-directory-
information. 
Dependent Student 
FERPA provides ways in which a school may share, without the consent of an eligible 
student, education records of the eligible student with their parents. Schools may, but are 
not required to, disclose any and all PII from education records to parents, without the 
consent of the eligible student, if the student is a “dependent student,” as that term is 
defined in Section 152 of the Internal Revenue Code. Generally, if either parent has 
claimed the student as a dependent on the parent’s most recent income tax return, a 
school may disclose the student’s education records to either parent, without the eligible 
student’s consent. 
This exception to FERPA’s general consent rule, where applicable, also permits 
institutions of postsecondary education to share, without the prior written consent of an 
eligible student, PII from education records of students who are enrolled in both a high 
school and the college or university (dually enrolled) with the parents of such dually 
enrolled students. In this situation, the parents retain the rights over the student’s 
education records maintained by the high school, if the student is under the age of 18 

5 
   
 
 
years, but the student retains the rights over the education records maintained by the 
college or university. 
Other Exceptions 
Provided certain conditions are met that are not included in the summary below, other 
exceptions to FERPA’s general consent requirement that permit the disclosure of PII 
from education records include, but are not limited to: 
• To authorized representatives of, among others, the U.S. Secretary of Education, as 
well as State and local educational authorities, for audit or evaluation of Federal- or 
State-supported education programs, or for the enforcement of or compliance with 
Federal legal requirements that relate to those programs; 
• In connection with financial aid for which the student has applied or received; 
• To organizations conducting studies for, or on behalf of, the school for the purposes 
of administering predictive tests, administering student aid programs, or improving 
instruction; 
• To the victim of an alleged perpetrator of a crime of violence or a non-forcible sex 
offense concerning the final results of a disciplinary hearing conducted by an 
institution of postsecondary education against the alleged perpetrator of such crime or 
offense with respect to the alleged crime or offense;  
• To any third party the final results, as described in FERPA regulations, of a 
disciplinary proceeding conducted by an institution of postsecondary education 
against a student who is the alleged perpetrator of a crime of violence or non-forcible 
sex offense if the student is found by the institution to have violated its rules or 
policies as a result of the disciplinary proceeding, as long as the disclosure does not 
include the name of any other student, including a victim or witness, without the 
written consent of that other student;  
• To comply with a judicial order or a lawfully issued subpoena; 
• In connection with a health or safety emergency; and 
• To a parent of a student at an institution of postsecondary education regarding the 
student’s violation of any Federal, State, or local law, or of any rule or policy of the 
institution, governing the use or possession of alcohol or a controlled substance, 
where the institution determines that the student has committed a disciplinary 
violation with respect to that use or possession, and the student is under 21 years of 
age at the time of the disclosure to the parent.  
Annual Notification of FERPA Rights 
Under FERPA, a school must annually notify eligible students of their rights under FERPA. 
The annual notification must include information regarding an eligible student’s right to 
inspect and review their education records, the right to seek to amend their records, the right 
to consent to disclosure of PII from their records (except in certain circumstances), and the 
right to file a complaint with SPPO regarding an alleged failure by a school to comply with 
FERPA. The notification must also inform eligible students of the school’s criteria for the 
terms “school official” and “legitimate educational interest” in certain instances. A school is 
not required to notify eligible students individually, but rather is required to provide the 

6 
   
 
 
notice by any means that are reasonably likely to inform eligible students of their rights. 
These means could include publication in a school activities calendar, newsletter, student 
handbook, or on a school’s website. 
Complaints of Alleged Violations of FERPA 
Eligible students who believe that their FERPA rights may have been violated may file a 
complaint with SPPO at https://studentprivacy.ed.gov/file-a-complaint. SPPO will review 
the complaint to ensure that the complaint: 
• Is filed, in writing, by an eligible student who maintains FERPA rights over the 
education records that are the subject of the complaint; 
• Is submitted to SPPO within 180 days of the date of the alleged violation or of the 
date that the eligible student knew or reasonably should have known of the alleged 
violation; and 
• Contains specific allegations of fact giving reasonable cause to believe that a 
violation of FERPA has occurred. 
SPPO will then make a case-by-case determination of the best mechanism for resolving the 
complaint. Sometimes the action will be an investigation, while for other complaints, 
consistent with the statute and applicable regulations, we will take other appropriate actions, 
such as acting as an intermediary or providing resolution assistance. More information 
regarding our complaint process is available at https://studentprivacy.ed.gov/file-a-
complaint. 
Additional Information 
For more information regarding FERPA and other student privacy issues, please visit our 
website at https://studentprivacy.ed.gov. 
If you have questions about FERPA that are not addressed here, you may also submit a 
question through our website at https://studentprivacy.ed.gov/contact, or write to SPPO for 
additional guidance at the following address: 
Student Privacy Policy Office 
U.S. Department of Education  
400 Maryland Avenue, SW 
Washington, DC 20202-8520 ', 'f16fadab0c0461cdc7f88fd8502ef834', '2026-02-14T06:26:38.435028+00:00', '2026-02-14T06:26:38.435028+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('97b50025-177e-4376-9bb0-997373e7bb40', '<!DOCTYPE html>
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
', '05a2073597c9e5a8225428ec5826352e', '2026-02-11T23:50:02.269303+00:00', '2026-02-11T23:50:02.269303+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_entry (id, content, content_hash, created_at, updated_at, active, generated, mcp) VALUES ('8a823596-f02f-4836-ab23-983c706ce7a2', '<!DOCTYPE html>
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
', 'b8d610feb56fd75185898314227bb760', '2026-02-11T23:50:02.269303+00:00', '2026-02-11T23:50:02.269303+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- texts_texts_connection
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005b-7e73-92cf-45f8bfca8d76', '019c29d6-003a-7f3d-9c60-a6c537f708ce', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-70a2-921b-6f8c3be52b7a', '019c29d6-003a-7541-984b-5374263aa03b', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-714c-81db-6998e1e7ef95', '019c29d6-003b-71b1-bfa5-69ef5f636751', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-7205-8dea-be2ddf4258ef', '019c29d6-003a-731f-b918-64b6c99d0464', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-72ae-8312-4708579fd54b', '019c29d6-003a-740e-8854-4d9ee26d34a6', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-733c-a565-88b232c706d3', '019c29d6-003b-7026-b46a-5def99ec275a', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c29d6-005c-7419-9bbc-db30a5b6483c', '019c29d6-003a-7647-aa7f-b9baebd83bf3', true, '2026-02-04T18:06:56.587632+00:00', '2026-02-04T18:06:56.587632+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c5ad4-73dd-7afc-ac7b-972114b48ba0', '019c5ad4-73da-75a6-a9bf-5c4c5e79178e', true, '2026-02-14T06:26:38.435028+00:00', '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c5ad4-7a54-77ae-94c4-4bd448fa05c6', '019c5ad4-7a52-7a69-b03d-b31104496c0c', true, '2026-02-14T06:26:38.435028+00:00', '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('019c5ad4-7b3e-76d5-9816-e3781d964ea5', '019c5ad4-7a52-7a69-b03d-b31104496c0c', true, '2026-02-14T06:26:38.435028+00:00', '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('258ee632-aa7a-4fb5-b9a8-fd4a4635f283', '97b50025-177e-4376-9bb0-997373e7bb40', true, '2026-02-11T23:50:02.269303+00:00', '2026-02-11T23:50:02.269303+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;
INSERT INTO public.texts_texts_connection (texts_id, text_id, active, created_at, updated_at) VALUES ('8e9fdbb5-9c4e-4f8f-9b03-b056a9caa0ea', '8a823596-f02f-4836-ab23-983c706ce7a2', true, '2026-02-11T23:50:02.269303+00:00', '2026-02-11T23:50:02.269303+00:00') ON CONFLICT (texts_id, text_id) DO NOTHING;

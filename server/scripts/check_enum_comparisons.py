#!/usr/bin/env python3
"""Check for weak enum comparisons in SQL files.

Detects:
1. Weak enum comparisons (enum column = 'string' without cast)
2. Old enum value references (e.g., 'simulation-text' for agent_role)
3. IN clauses with enum columns using raw strings
4. ANY clauses comparing enum columns to text arrays
5. CASE statements with weak enum comparisons
"""

import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import NamedTuple

# Add server directory to path for imports
server_dir = Path(__file__).parent.parent
workspace_root = server_dir.parent


class Violation(NamedTuple):
    """Represents a violation found in a SQL file."""

    file_path: Path
    line_no: int
    violation_type: str  # 'weak_comparison', 'old_enum_value', 'in_clause', 'any_clause', 'case_statement'
    column: str
    enum_type: str
    value: str
    context: str
    suggestion: str


# Enum type definitions from schema.sql and migrations
ENUM_TYPES = {
    "agent_role": {
        "current_values": [
            "classify",
            "grade",
            "hint",
            "scenario",
            "title",
            "image",
            "video",
            "simulation",
            "voice",
            "eval",
            "document",
            "audio",
            "member",
            "rubric",
        ],
        "old_values": {
            "simulation-text": "simulation",
            "simulation-voice": "voice",
            "grade-text": "grade",
            "grade-voice": "audio",
            "outline": "scenario",
        },
    },
    "profile_role": {
        "current_values": ["superadmin", "admin", "instructional", "member", "guest"],
        "old_values": {},
    },
    "message_role": {
        "current_values": ["user", "assistant", "system", "developer"],
        "old_values": {},
    },
    "pricing_type": {
        "current_values": ["input", "output", "cached"],
        "old_values": {},
    },
    "feedback_type": {
        "current_values": ["feature", "bug", "question", "other"],
        "old_values": {},
    },
    "message_feedback_type": {
        "current_values": ["strength", "improvement"],
        "old_values": {},
    },
    "modality_type": {
        "current_values": ["text", "video", "audio", "image"],
        "old_values": {},
    },
    "option_type": {
        "current_values": ["discrete", "freeform"],
        "old_values": {},
    },
    "quality": {
        "current_values": ["low", "medium", "high"],
        "old_values": {},
    },
    "reasoning_effort": {
        "current_values": ["minimal", "low", "medium", "high", "none"],
        "old_values": {},
    },
    "tool_type": {
        "current_values": [
            "title_description",
            "objectives",
            "document",
            "image",
            "video",
            "questions_batch",
            "question_multiple_choice",
            "question_free_response",
            "question_multi_select",
            "outline",
            "video_name",
            "speak",
            "hint",
            "grading_standard_group",
            "message_strength",
            "message_improvement",
            "grade_audio",
            "classification",
            "end_conversation",
            "statement",
            "objective",
            "question",
            "grade",
            "feedback_strength",
            "feedback_improvement",
            "analysis",
            "title",
        ],
        "old_values": {},
    },
    "unit_category": {
        "current_values": ["tokens", "seconds", "units"],
        "old_values": {},
    },
    "voice": {
        "current_values": [
            "alloy",
            "ash",
            "ballad",
            "coral",
            "echo",
            "fable",
            "onyx",
            "nova",
            "sage",
            "shimmer",
            "verse",
        ],
        "old_values": {},
    },
}

# Map table.column to enum type (from schema.sql analysis)
ENUM_COLUMNS = {
    "agents.role": "agent_role",
    "a.role": "agent_role",  # Common alias
    "tools.agent_role": "agent_role",
    "t.agent_role": "agent_role",  # Common alias
    "rubrics.agent_role": "agent_role",
    "r.agent_role": "agent_role",  # Common alias
    "rga_sb.agent_role": "agent_role",  # Common alias
    "r2.agent_role": "agent_role",  # Common alias
    "profiles.role": "profile_role",
    "p.role": "profile_role",  # Common alias
    "up.role": "profile_role",  # Common alias
    "uc.role": "profile_role",  # Common alias
    "epr.role": "profile_role",  # Common alias
    "p_actual.role": "profile_role",  # Common alias
    "p_effective.role": "profile_role",  # Common alias
    "p_attempt.role": "profile_role",  # Common alias
    "hvr.role": "profile_role",  # Common alias
    "rr.role": "profile_role",  # Common alias
    "cur.role": "profile_role",  # Common alias
    "pr.role": "profile_role",  # Common alias
    "tp.role": "profile_role",  # Common alias
    "vp.role": "profile_role",  # Common alias
    "pe.role": "profile_role",  # Common alias
    "messages.role": "message_role",
    "m.role": "message_role",  # Common alias
    "model_pricing.pricing_type": "pricing_type",
    "mp.pricing_type": "pricing_type",  # Common alias
}


def find_sql_files() -> list[Path]:
    """Find all SQL files in server/app/sql/v3/."""
    sql_dir = server_dir / "app" / "sql" / "v3"
    if not sql_dir.exists():
        print(f"❌ SQL directory not found: {sql_dir}")
        sys.exit(1)

    sql_files = list(sql_dir.rglob("*.sql"))
    return sorted(sql_files)


def extract_enum_value_from_string(s: str) -> str | None:
    """Extract enum value from a string literal, handling quotes."""
    # Match 'value' or "value"
    match = re.match(r"^['\"]([^'\"]+)['\"]", s.strip())
    if match:
        return match.group(1)
    return None


def is_strong_comparison(value_str: str) -> bool:
    """Check if a comparison value uses strong enum syntax."""
    # Check for enum_type.label syntax
    if re.search(r"\w+\.\w+", value_str):
        return True
    # Check for explicit cast 'value'::enum_type
    if re.search(r"::\w+", value_str):
        return True
    return False


def check_file(file_path: Path) -> list[Violation]:
    """Check a single SQL file for enum comparison violations."""
    violations: list[Violation] = []

    try:
        content = file_path.read_text(encoding="utf-8")
        lines = content.split("\n")
    except Exception:
        return violations

    # Pattern 1: Direct equality - column = 'value' (without cast)
    # Match: column = 'value' or column='value'
    equality_pattern = re.compile(
        r"(\w+(?:\.\w+)?)\s*=\s*['\"]([^'\"]+)['\"]", re.IGNORECASE
    )

    # Pattern 2: IN clause - column IN ('value1', 'value2')
    in_pattern = re.compile(
        r"(\w+(?:\.\w+)?)\s+IN\s*\(([^)]+)\)", re.IGNORECASE
    )

    # Pattern 3: ANY clause - column = ANY(text_array) or 'value' = ANY(text_array)
    any_pattern = re.compile(
        r"(\w+(?:\.\w+)?)\s*=\s*ANY\s*\([^)]*::text\[\]", re.IGNORECASE
    )

    # Pattern 4: CASE statement - CASE WHEN column = 'value'
    case_pattern = re.compile(
        r"CASE\s+WHEN\s+(\w+(?:\.\w+)?)\s*=\s*['\"]([^'\"]+)['\"]", re.IGNORECASE
    )

    for line_no, line in enumerate(lines, start=1):
        # Skip comments
        if line.strip().startswith("--"):
            continue

        # Pattern 1: Direct equality
        for match in equality_pattern.finditer(line):
            column = match.group(1)
            value = match.group(2)

            if column.lower() in ENUM_COLUMNS:
                enum_type = ENUM_COLUMNS[column.lower()]
                value_str = match.group(0)

                # Check if it's a strong comparison
                if not is_strong_comparison(value_str):
                    # Check if it's an old enum value
                    if (
                        enum_type in ENUM_TYPES
                        and value in ENUM_TYPES[enum_type]["old_values"]
                    ):
                        old_mapping = ENUM_TYPES[enum_type]["old_values"][value]
                        violations.append(
                            Violation(
                                file_path=file_path,
                                line_no=line_no,
                                violation_type="old_enum_value",
                                column=column,
                                enum_type=enum_type,
                                value=value,
                                context=line.strip(),
                                suggestion=f"Replace '{value}' with '{old_mapping}' and use strong comparison: {column} = {enum_type}.{old_mapping} or {column} = '{old_mapping}'::{enum_type}",
                            )
                        )
                    elif (
                        enum_type in ENUM_TYPES
                        and value in ENUM_TYPES[enum_type]["current_values"]
                    ):
                        violations.append(
                            Violation(
                                file_path=file_path,
                                line_no=line_no,
                                violation_type="weak_comparison",
                                column=column,
                                enum_type=enum_type,
                                value=value,
                                context=line.strip(),
                                suggestion=f"Use strong comparison: {column} = {enum_type}.{value} or {column} = '{value}'::{enum_type}",
                            )
                        )

        # Pattern 2: IN clause
        for match in in_pattern.finditer(line):
            column = match.group(1)
            values_str = match.group(2)

            if column.lower() in ENUM_COLUMNS:
                enum_type = ENUM_COLUMNS[column.lower()]

                # Extract values from IN clause
                # Match 'value' or "value" patterns
                value_matches = re.findall(r"['\"]([^'\"]+)['\"]", values_str)

                # Check if any values are raw strings (not cast)
                has_weak = False
                old_values_found = []

                for val in value_matches:
                    # Check if it's an old enum value
                    if (
                        enum_type in ENUM_TYPES
                        and val in ENUM_TYPES[enum_type]["old_values"]
                    ):
                        old_mapping = ENUM_TYPES[enum_type]["old_values"][val]
                        old_values_found.append((val, old_mapping))
                    elif (
                        enum_type in ENUM_TYPES
                        and val in ENUM_TYPES[enum_type]["current_values"]
                    ):
                        # Check if the value is cast (look for ::enum_type in the original string)
                        if f"::{enum_type}" not in values_str and f".{val}" not in values_str:
                            has_weak = True

                if old_values_found:
                    for old_val, new_val in old_values_found:
                        violations.append(
                            Violation(
                                file_path=file_path,
                                line_no=line_no,
                                violation_type="old_enum_value",
                                column=column,
                                enum_type=enum_type,
                                value=old_val,
                                context=line.strip(),
                                suggestion=f"Replace '{old_val}' with '{new_val}' in IN clause and use strong comparison",
                            )
                        )
                elif has_weak:
                    violations.append(
                        Violation(
                            file_path=file_path,
                            line_no=line_no,
                            violation_type="in_clause",
                            column=column,
                            enum_type=enum_type,
                            value="",
                            context=line.strip(),
                            suggestion=f"Use strong comparison: {column} IN ({enum_type}.value1, {enum_type}.value2) or cast values",
                        )
                    )

        # Pattern 3: ANY clause with text array
        for match in any_pattern.finditer(line):
            column = match.group(1)

            if column.lower() in ENUM_COLUMNS:
                enum_type = ENUM_COLUMNS[column.lower()]
                violations.append(
                    Violation(
                        file_path=file_path,
                        line_no=line_no,
                        violation_type="any_clause",
                        column=column,
                        enum_type=enum_type,
                        value="",
                        context=line.strip(),
                        suggestion=f"Convert text array to enum array: {column} = ANY($param::{enum_type}[]) or cast elements",
                    )
                )

        # Pattern 4: CASE statement
        for match in case_pattern.finditer(line):
            column = match.group(1)
            value = match.group(2)

            if column.lower() in ENUM_COLUMNS:
                enum_type = ENUM_COLUMNS[column.lower()]

                # Check if it's an old enum value
                if (
                    enum_type in ENUM_TYPES
                    and value in ENUM_TYPES[enum_type]["old_values"]
                ):
                    old_mapping = ENUM_TYPES[enum_type]["old_values"][value]
                    violations.append(
                        Violation(
                            file_path=file_path,
                            line_no=line_no,
                            violation_type="old_enum_value",
                            column=column,
                            enum_type=enum_type,
                            value=value,
                            context=line.strip(),
                            suggestion=f"Replace '{value}' with '{old_mapping}' and use strong comparison: CASE WHEN {column} = {enum_type}.{old_mapping}",
                        )
                    )
                elif (
                    enum_type in ENUM_TYPES
                    and value in ENUM_TYPES[enum_type]["current_values"]
                ):
                    # Check if it's a strong comparison
                    if not is_strong_comparison(match.group(0)):
                        violations.append(
                            Violation(
                                file_path=file_path,
                                line_no=line_no,
                                violation_type="case_statement",
                                column=column,
                                enum_type=enum_type,
                                value=value,
                                context=line.strip(),
                                suggestion=f"Use strong comparison: CASE WHEN {column} = {enum_type}.{value} or {column} = '{value}'::{enum_type}",
                            )
                        )

    return violations


def group_by_directory(
    violations: list[Violation],
) -> dict[str, list[Violation]]:
    """Group violations by their resource directory."""
    grouped = defaultdict(list)
    for violation in violations:
        # Extract resource directory (e.g., "reports" from "server/app/sql/v3/reports/file.sql")
        parts = violation.file_path.parts
        if "sql" in parts and "v3" in parts:
            try:
                v3_idx = parts.index("v3")
                if v3_idx + 1 < len(parts):
                    resource = parts[v3_idx + 1]
                    grouped[resource].append(violation)
            except (ValueError, IndexError):
                grouped["other"].append(violation)
        else:
            grouped["other"].append(violation)
    return dict(grouped)


def main() -> int:
    """Main entry point."""
    print("🔍 Checking for weak enum comparisons...")
    print()

    # Find all SQL files
    sql_files = find_sql_files()
    print(f"Found {len(sql_files)} SQL files")

    # Check each file
    all_violations: list[Violation] = []
    for sql_file in sql_files:
        violations = check_file(sql_file)
        all_violations.extend(violations)

    # Print summary
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Files scanned:         {len(sql_files)}")
    print(f"Violations found:     {len(all_violations)}")
    print()

    if all_violations:
        print("=" * 70)
        print("ENUM COMPARISON VIOLATIONS")
        print("=" * 70)
        print()
        print("❌ Weak enum comparisons detected!")
        print("   Use strong comparisons: enum_type.label or 'value'::enum_type")
        print()

        # Group by violation type
        by_type: dict[str, list[Violation]] = defaultdict(list)
        for v in all_violations:
            by_type[v.violation_type].append(v)

        # Group by directory
        grouped = group_by_directory(all_violations)

        for dir_name in sorted(grouped.keys()):
            violations_in_dir = grouped[dir_name]
            print(
                f"📁 {dir_name}/ ({len(violations_in_dir)} violation{'s' if len(violations_in_dir) != 1 else ''})"
            )
            for violation in sorted(violations_in_dir, key=lambda x: x.line_no):
                rel_path = violation.file_path.relative_to(workspace_root)
                print(f"   Line {violation.line_no}: {rel_path}")
                print(f"      Type: {violation.violation_type}")
                print(f"      Column: {violation.column} ({violation.enum_type})")
                if violation.value:
                    print(f"      Value: '{violation.value}'")
                print(f"      Context: {violation.context[:80]}...")
                print(f"      Suggestion: {violation.suggestion}")
                print()
            print()

        return 1  # Exit with error code if violations found
    else:
        print("✅ No weak enum comparisons found!")
        return 0


if __name__ == "__main__":
    sys.exit(main())


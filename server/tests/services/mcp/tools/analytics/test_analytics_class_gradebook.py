# test_class_gradebook.py

import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import SQLAlchemyError
from app.models import Classes, Profiles, Simulations, SimulationAttempts, SimulationChats, SimulationChatGrades
from app.services.mcp.tools.analytics.class_gradebook import class_gradebook

CLASS_ID = uuid.uuid4()
STUDENT_1_ID = uuid.uuid4()
STUDENT_2_ID = uuid.uuid4()
SIM_1_ID = uuid.uuid4()
SIM_2_ID = uuid.uuid4()

@pytest.fixture(autouse=True)
def patch_db_session(mocker, test_session):
    """Ensure the function under test uses the test_session."""
    mocker.patch('app.services.mcp.tools.analytics.class_gradebook.get_session', return_value=iter([test_session]))

class TestClassGradebook:
    """Tests for class_gradebook function."""

    def test_success_with_data(self, test_session):
        """Test successful execution with a full gradebook."""
        # Arrange
        class_obj = Classes(id=CLASS_ID, name="Test Class")
        student1 = Profiles(id=STUDENT_1_ID, first_name="John", last_name="Doe", class_ids=[CLASS_ID])
        student2 = Profiles(id=STUDENT_2_ID, alias="Testy", class_ids=[CLASS_ID]) # Student with alias
        sim1 = Simulations(id=SIM_1_ID, title="Sim Alpha")
        sim2 = Simulations(id=SIM_2_ID, title="Sim Beta")
        
        # Student 1 attempts (gets a better score on the second try for Sim 1)
        attempt1_s1 = SimulationAttempts(profile_id=STUDENT_1_ID, simulation_id=SIM_1_ID)
        chat1_s1 = SimulationChats(attempt_id=attempt1_s1.id)
        grade1_s1 = SimulationChatGrades(simulation_chat_id=chat1_s1.id, score=80, passed=True)
        
        attempt2_s1 = SimulationAttempts(profile_id=STUDENT_1_ID, simulation_id=SIM_1_ID)
        chat2_s1 = SimulationChats(attempt_id=attempt2_s1.id)
        grade2_s1 = SimulationChatGrades(simulation_chat_id=chat2_s1.id, score=95, passed=True) # Best score

        # Student 2 attempt
        attempt1_s2 = SimulationAttempts(profile_id=STUDENT_2_ID, simulation_id=SIM_2_ID)
        chat1_s2 = SimulationChats(attempt_id=attempt1_s2.id)
        grade1_s2 = SimulationChatGrades(simulation_chat_id=chat1_s2.id, score=70, passed=False)

        test_session.add_all([
            class_obj, student1, student2, sim1, sim2,
            attempt1_s1, chat1_s1, grade1_s1,
            attempt2_s1, chat2_s1, grade2_s1,
            attempt1_s2, chat1_s2, grade1_s2
        ])
        test_session.commit()

        # Act
        result = class_gradebook(str(CLASS_ID))

        # Assert
        assert "error" not in result
        assert result["class"]["id"] == str(CLASS_ID)
        assert result["student_count"] == 2
        assert result["simulation_count"] == 2
        
        student1_grades = next(s for s in result["students"] if s["id"] == str(STUDENT_1_ID))
        student2_grades = next(s for s in result["students"] if s["id"] == str(STUDENT_2_ID))

        assert student1_grades["name"] == "John Doe"
        assert student1_grades["grades"][str(SIM_1_ID)]["score"] == 95 # Check best score was taken
        assert str(SIM_2_ID) not in student1_grades["grades"]

        assert student2_grades["name"] == "Testy"
        assert student2_grades["grades"][str(SIM_2_ID)]["score"] == 70
        assert student2_grades["grades"][str(SIM_2_ID)]["passed"] is False

    def test_class_not_found(self, test_session):
        """Test case where the class_id does not exist."""
        non_existent_id = str(uuid.uuid4())
        result = class_gradebook(non_existent_id)
        assert result == {"error": f"Class not found: {non_existent_id}"}

    def test_class_with_no_students(self, test_session):
        """Test case where a class exists but has no students."""
        class_obj = Classes(id=CLASS_ID, name="Empty Class")
        test_session.add(class_obj)
        test_session.commit()

        result = class_gradebook(str(CLASS_ID))
        assert "error" not in result
        assert result["student_count"] == 0
        assert result["students"] == []
        assert result["simulation_count"] == 0

    def test_student_with_no_attempts(self, test_session):
        """Test case where a student in the class has made no attempts."""
        class_obj = Classes(id=CLASS_ID, name="Test Class")
        student = Profiles(id=STUDENT_1_ID, first_name="New", last_name="Student", class_ids=[CLASS_ID])
        test_session.add_all([class_obj, student])
        test_session.commit()

        result = class_gradebook(str(CLASS_ID))
        assert "error" not in result
        assert result["student_count"] == 1
        student_grades = result["students"][0]
        assert student_grades["name"] == "New Student"
        assert student_grades["grades"] == {} # No grades
        
    def test_database_error(self, mocker):
        """Test handling of a SQLAlchemyError."""
        mock_session = MagicMock()
        mock_session.get.side_effect = SQLAlchemyError("Connection failed")
        mocker.patch('app.services.mcp.tools.analytics.class_gradebook.get_session', return_value=iter([mock_session]))

        result = class_gradebook(str(CLASS_ID))
        assert "error" in result
        assert "Database error" in result["error"]

import pytest

@pytest.mark.skip(reason="TODO: implement tests for `class_gradebook`")
class TestClass_Gradebook:
    """Tests for class_gradebook function."""

    def test_class_gradebook_success(self):
        """Test successful class_gradebook execution."""
        # TODO: Implement test for class_gradebook
        assert False, "IMPLEMENT: Test for class_gradebook"

    def test_class_gradebook_error(self):
        """Test class_gradebook error handling."""
        # TODO: Implement error test for class_gradebook
        assert False, "IMPLEMENT: Error test for class_gradebook"


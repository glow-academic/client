"""
Tests for app.utils.schema
"""

import pytest
from app.utils.schema import (
    AnalyticsFilters,
    DataPoint,
    DepartmentMappingItem,
    MappingItem,
    Method,
    PersonaMappingItem,
    ScenarioMappingItem,
    SimulationFilter,
    StandardGroupMappingItem,
    StandardMappingItem,
    TrendData,
)


class TestMapping_Item:
    """Tests for MappingItem class."""

    def test_mapping_item_creation(self) -> None:
        """Test creating a MappingItem."""
        item = MappingItem(name="Test", description="Test description")
        assert item.name == "Test"
        assert item.description == "Test description"


class TestDepartment_Mapping_Item:
    """Tests for DepartmentMappingItem class."""

    def test_department_mapping_item_creation(self) -> None:
        """Test creating a DepartmentMappingItem."""
        item = DepartmentMappingItem(name="Test", description="Test description")
        assert item.name == "Test"
        assert item.description == "Test description"
        assert item.scenario_ids is None


class TestPersona_Mapping_Item:
    """Tests for PersonaMappingItem class."""

    def test_persona_mapping_item_creation(self) -> None:
        """Test creating a PersonaMappingItem."""
        item = PersonaMappingItem(
            name="Test", description="Test description", color="#000000", icon="icon"
        )
        assert item.name == "Test"
        assert item.color == "#000000"
        assert item.icon == "icon"


class TestScenario_Mapping_Item:
    """Tests for ScenarioMappingItem class."""

    def test_scenario_mapping_item_creation(self) -> None:
        """Test creating a ScenarioMappingItem."""
        item = ScenarioMappingItem(
            name="Test",
            description="Test description",
            persona_ids=[],
            persona_mapping={},
            document_mapping={},
            parameter_item_mapping={},
            parameter_item_ids=[],
            document_ids=[],
        )
        assert item.name == "Test"
        assert item.description == "Test description"
        assert item.persona_ids == []


class TestStandard_Group_Mapping_Item:
    """Tests for StandardGroupMappingItem class."""

    def test_standard_group_mapping_item_creation(self) -> None:
        """Test creating a StandardGroupMappingItem."""
        item = StandardGroupMappingItem(
            name="Test", description="Test description", points=10, passPoints=5
        )
        assert item.name == "Test"
        assert item.points == 10
        assert item.passPoints == 5


class TestStandard_Mapping_Item:
    """Tests for StandardMappingItem class."""

    def test_standard_mapping_item_creation(self) -> None:
        """Test creating a StandardMappingItem."""
        item = StandardMappingItem(name="Test", description="Test description", points=5)
        assert item.name == "Test"
        assert item.points == 5


class TestMethod_Enum:
    """Tests for Method enum."""

    def test_method_enum_values(self) -> None:
        """Test Method enum has expected values."""
        assert Method.AVG == "avg"
        assert Method.MAX == "max"
        assert Method.SUM == "sum"
        assert Method.RATE == "rate"


class TestSimulation_Filter_Enum:
    """Tests for SimulationFilter enum."""

    def test_simulation_filter_enum_values(self) -> None:
        """Test SimulationFilter enum has expected values."""
        assert SimulationFilter.GENERAL == "general"
        assert SimulationFilter.PRACTICE == "practice"
        assert SimulationFilter.ARCHIVED == "archived"


class TestAnalytics_Filters:
    """Tests for AnalyticsFilters class."""

    def test_analytics_filters_creation(self) -> None:
        """Test creating an AnalyticsFilters."""
        filters = AnalyticsFilters(startDate="2024-01-01", endDate="2024-12-31")
        assert filters.startDate == "2024-01-01"
        assert filters.endDate == "2024-12-31"
        assert filters.cohortIds is None


class TestTrend_Data:
    """Tests for TrendData class."""

    def test_trend_data_creation(self) -> None:
        """Test creating a TrendData."""
        data = TrendData(date="2024-01-01", value=10.5, count=5)
        assert data.date == "2024-01-01"
        assert data.value == 10.5
        assert data.count == 5


class TestData_Point:
    """Tests for DataPoint class."""

    def test_data_point_creation(self) -> None:
        """Test creating a DataPoint."""
        point = DataPoint(profileId="123", value=10.5)
        assert point.profileId == "123"
        assert point.value == 10.5
        assert point.date is None


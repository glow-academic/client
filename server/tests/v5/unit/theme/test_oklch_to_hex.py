"""Tests for utils.theme.oklch_to_hex."""

import pytest

from app.v5.utils.theme.oklch_to_hex import hex_to_oklch, oklch_to_hex, parse_oklch


class TestParseOklch:
    """Tests for parse_oklch function."""

    def test_parse_oklch_basic(self) -> None:
        """Test parsing basic oklch color."""
        # Arrange
        oklch_str = "oklch(0.5 0.1 120)"

        # Act
        result = parse_oklch(oklch_str)

        # Assert
        assert result == (0.5, 0.1, 120.0)

    def test_parse_oklch_with_alpha(self) -> None:
        """Test parsing oklch color with alpha (ignored)."""
        # Arrange
        oklch_str = "oklch(0.5 0.1 120 / 0.8)"

        # Act
        result = parse_oklch(oklch_str)

        # Assert
        assert result == (0.5, 0.1, 120.0)

    def test_parse_oklch_invalid_format(self) -> None:
        """Test parsing invalid oklch format raises error."""
        # Arrange
        oklch_str = "invalid"

        # Act & Assert
        with pytest.raises(ValueError, match="Invalid oklch format"):
            parse_oklch(oklch_str)


class TestOklchToHex:
    """Tests for oklch_to_hex function."""

    def test_oklch_to_hex_white(self) -> None:
        """Test converting white oklch to hex."""
        # Arrange
        oklch_str = "oklch(1.0 0.0 0.0)"

        # Act
        result = oklch_to_hex(oklch_str)

        # Assert
        assert result == "#ffffff"

    def test_oklch_to_hex_black(self) -> None:
        """Test converting black oklch to hex."""
        # Arrange
        oklch_str = "oklch(0.0 0.0 0.0)"

        # Act
        result = oklch_to_hex(oklch_str)

        # Assert
        assert result == "#000000"

    def test_oklch_to_hex_red(self) -> None:
        """Test converting red oklch to hex."""
        # Arrange
        oklch_str = "oklch(0.627 0.258 29.234)"

        # Act
        result = oklch_to_hex(oklch_str)

        # Assert
        assert result.startswith("#")
        assert len(result) == 7
        # Should be a valid hex color (roughly red)
        assert int(result[1:3], 16) > 200  # High red component

    def test_oklch_to_hex_roundtrip(self) -> None:
        """Test roundtrip conversion maintains approximate color."""
        # Arrange
        original_hex = "#ff0000"

        # Act
        oklch = hex_to_oklch(original_hex)
        result_hex = oklch_to_hex(oklch)

        # Assert
        assert result_hex.startswith("#")
        assert len(result_hex) == 7
        # Should be close to original (allowing for conversion precision)
        original_r = int(original_hex[1:3], 16)
        result_r = int(result_hex[1:3], 16)
        assert abs(original_r - result_r) < 50  # Allow some variance


class TestHexToOklch:
    """Tests for hex_to_oklch function."""

    def test_hex_to_oklch_white(self) -> None:
        """Test converting white hex to oklch."""
        # Arrange
        hex_str = "#ffffff"

        # Act
        result = hex_to_oklch(hex_str)

        # Assert
        assert result.startswith("oklch(")
        l, c, h = parse_oklch(result)
        assert l > 0.9  # Should be very light

    def test_hex_to_oklch_black(self) -> None:
        """Test converting black hex to oklch."""
        # Arrange
        hex_str = "#000000"

        # Act
        result = hex_to_oklch(hex_str)

        # Assert
        assert result.startswith("oklch(")
        l, c, h = parse_oklch(result)
        assert l < 0.1  # Should be very dark

    def test_hex_to_oklch_without_hash(self) -> None:
        """Test converting hex without hash prefix."""
        # Arrange
        hex_str = "ff0000"

        # Act
        result = hex_to_oklch(hex_str)

        # Assert
        assert result.startswith("oklch(")

    def test_hex_to_oklch_red(self) -> None:
        """Test converting red hex to oklch."""
        # Arrange
        hex_str = "#ff0000"

        # Act
        result = hex_to_oklch(hex_str)

        # Assert
        assert result.startswith("oklch(")
        l, c, h = parse_oklch(result)
        assert c > 0.1  # Should have chroma (color)
        assert 0 <= h <= 360  # Valid hue range

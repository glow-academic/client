"""Tests for utils.theme.color_utils."""

import pytest

from app.v5.utils.theme.color_utils import (
    ensure_contrast,
    format_oklch,
    parse_oklch,
    shade,
    tint,
)


class TestParseOklch:
    """Tests for parse_oklch function."""

    def test_parse_oklch_basic(self) -> None:
        """Test parsing basic oklch color."""
        # Arrange
        oklch_str = "oklch(0.5 0.1 120)"

        # Act
        result = parse_oklch(oklch_str)

        # Assert
        assert result == (0.5, 0.1, 120.0, None)

    def test_parse_oklch_with_alpha(self) -> None:
        """Test parsing oklch color with alpha."""
        # Arrange
        oklch_str = "oklch(0.5 0.1 120 / 0.8)"

        # Act
        result = parse_oklch(oklch_str)

        # Assert
        assert result == (0.5, 0.1, 120.0, 0.8)

    def test_parse_oklch_with_alpha_percent(self) -> None:
        """Test parsing oklch color with alpha as percent."""
        # Arrange
        oklch_str = "oklch(0.5 0.1 120 / 80%)"

        # Act
        result = parse_oklch(oklch_str)

        # Assert
        assert result == (0.5, 0.1, 120.0, 0.8)

    def test_parse_oklch_invalid_format(self) -> None:
        """Test parsing invalid oklch format raises error."""
        # Arrange
        oklch_str = "invalid"

        # Act & Assert
        with pytest.raises(ValueError, match="Invalid oklch format"):
            parse_oklch(oklch_str)


class TestFormatOklch:
    """Tests for format_oklch function."""

    def test_format_oklch_basic(self) -> None:
        """Test formatting basic oklch color."""
        # Arrange
        lightness, chroma, hue = 0.5, 0.1, 120.0

        # Act
        result = format_oklch(lightness, chroma, hue)

        # Assert
        assert result == "oklch(0.5 0.1 120.0)"

    def test_format_oklch_with_alpha(self) -> None:
        """Test formatting oklch color with alpha."""
        # Arrange
        lightness, chroma, hue, alpha = 0.5, 0.1, 120.0, 0.8

        # Act
        result = format_oklch(lightness, chroma, hue, alpha)

        # Assert
        assert result == "oklch(0.5 0.1 120.0 / 0.8)"


class TestTint:
    """Tests for tint function."""

    def test_tint_no_change(self) -> None:
        """Test tint with amount 0.0 returns original color."""
        # Arrange
        color = "oklch(0.5 0.1 120)"

        # Act
        result = tint(color, 0.0)

        # Assert
        l, c, h, alpha = parse_oklch(result)
        assert abs(l - 0.5) < 0.01
        assert abs(c - 0.1) < 0.01
        assert abs(h - 120.0) < 0.01

    def test_tint_lightens(self) -> None:
        """Test tint increases lightness."""
        # Arrange
        color = "oklch(0.5 0.1 120)"

        # Act
        result = tint(color, 0.5)

        # Assert
        l, _, _, _ = parse_oklch(result)
        assert l > 0.5

    def test_tint_reduces_chroma(self) -> None:
        """Test tint reduces chroma."""
        # Arrange
        color = "oklch(0.5 0.1 120)"

        # Act
        result = tint(color, 0.5)

        # Assert
        _, c, _, _ = parse_oklch(result)
        assert c < 0.1


class TestShade:
    """Tests for shade function."""

    def test_shade_no_change(self) -> None:
        """Test shade with amount 0.0 returns original color."""
        # Arrange
        color = "oklch(0.5 0.1 120)"

        # Act
        result = shade(color, 0.0)

        # Assert
        l, c, h, alpha = parse_oklch(result)
        assert abs(l - 0.5) < 0.01
        assert abs(c - 0.1) < 0.01
        assert abs(h - 120.0) < 0.01

    def test_shade_darkens(self) -> None:
        """Test shade decreases lightness."""
        # Arrange
        color = "oklch(0.5 0.1 120)"

        # Act
        result = shade(color, 0.5)

        # Assert
        l, _, _, _ = parse_oklch(result)
        assert l < 0.5


class TestEnsureContrast:
    """Tests for ensure_contrast function."""

    def test_ensure_contrast_light_background(self) -> None:
        """Test ensure_contrast with light background uses dark text."""
        # Arrange
        background = "oklch(0.8 0.1 120)"  # Light background
        candidate = "oklch(0.5 0.1 120)"  # Medium text

        # Act
        result = ensure_contrast(background, candidate)

        # Assert
        l, c, h, _ = parse_oklch(result)
        assert l < 0.3  # Should be dark
        assert c == 0  # No chroma for pure dark
        assert h == 0  # No hue for pure dark

    def test_ensure_contrast_dark_background(self) -> None:
        """Test ensure_contrast with dark background uses light text."""
        # Arrange
        background = "oklch(0.3 0.1 120)"  # Dark background
        candidate = "oklch(0.5 0.1 120)"  # Medium text

        # Act
        result = ensure_contrast(background, candidate)

        # Assert
        l, c, h, _ = parse_oklch(result)
        assert l > 0.7  # Should be light
        assert c == 0  # No chroma for pure light
        assert h == 0  # No hue for pure light

    def test_ensure_contrast_already_contrasting(self) -> None:
        """Test ensure_contrast doesn't change already contrasting colors."""
        # Arrange
        background = "oklch(0.8 0.1 120)"  # Light background
        candidate = "oklch(0.2 0.1 120)"  # Already dark text

        # Act
        result = ensure_contrast(background, candidate)

        # Assert
        l, c, h, _ = parse_oklch(result)
        assert l < 0.3  # Should remain dark

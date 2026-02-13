"""Unit tests for app.infra.v4.templates.jinja_renderer."""

from app.infra.v4.templates.jinja_renderer import (
    inject_theme_css_variables,
    render_template,
)


class TestInjectThemeCssVariables:
    """Tests for inject_theme_css_variables function."""

    def test_inject_theme_css_variables_with_head(self) -> None:
        """Test injecting CSS variables into HTML with head tag."""
        # Arrange
        html = "<html><head><title>Test</title></head><body>Content</body></html>"
        from app.utils.settings.theme import ThemeTokens

        theme_tokens = ThemeTokens(
            primary="#000000",
            primaryForeground="#ffffff",
            background="#ffffff",
            foreground="#000000",
        )

        # Act
        result = inject_theme_css_variables(html, theme_tokens)

        # Assert
        assert isinstance(result, str)
        assert ":root" in result
        assert "--primary:" in result

    def test_inject_theme_css_variables_no_head(self) -> None:
        """Test injecting CSS variables into HTML without head tag."""
        # Arrange
        html = "<html><body>Content</body></html>"
        from app.utils.settings.theme import ThemeTokens

        theme_tokens = ThemeTokens(
            primary="#000000",
            primaryForeground="#ffffff",
            background="#ffffff",
            foreground="#000000",
        )

        # Act
        result = inject_theme_css_variables(html, theme_tokens)

        # Assert
        assert isinstance(result, str)
        assert "<head>" in result
        assert ":root" in result


class TestRenderTemplate:
    """Tests for render_template function."""

    def test_render_template_success(self) -> None:
        """Test successful template rendering."""
        from app.utils.settings.theme import ThemeTokens

        # Arrange
        template = "Hello {{ name }}!"
        context = {"name": "World"}
        theme_tokens = ThemeTokens(
            primary="#000000",
            primaryForeground="#ffffff",
            background="#ffffff",
            foreground="#000000",
        )

        # Act
        result = render_template(template, context, theme_tokens)

        # Assert
        assert "Hello World!" in result

    def test_render_template_with_theme(self) -> None:
        """Test template rendering with theme injection."""
        from app.utils.settings.theme import ThemeTokens

        # Arrange
        template = "<html><head></head><body>Content</body></html>"
        context = {}
        theme_tokens = ThemeTokens(
            primary="#000000",
            primaryForeground="#ffffff",
            background="#ffffff",
            foreground="#000000",
        )

        # Act
        result = render_template(template, context, theme_tokens=theme_tokens)

        # Assert
        assert isinstance(result, str)
        assert ":root" in result

    def test_render_template_with_variables(self) -> None:
        """Test template rendering with variables."""
        from app.utils.settings.theme import ThemeTokens

        # Arrange
        template = "{{ greeting }}, {{ name }}!"
        context = {"greeting": "Hello", "name": "World"}
        theme_tokens = ThemeTokens(
            primary="#000000",
            primaryForeground="#ffffff",
            background="#ffffff",
            foreground="#000000",
        )

        # Act
        result = render_template(template, context, theme_tokens)

        # Assert
        assert "Hello, World!" in result

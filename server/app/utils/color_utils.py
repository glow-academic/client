"""Color and icon filtering utilities for persona forms."""


def get_color_name(hex_color: str) -> str:
    """Map hex color to human-readable name."""
    color_map: dict[str, str] = {
        # Standard colors
        "#000000": "Black",
        "#FFFFFF": "White",
        "#FF0000": "Red",
        "#00FF00": "Green",
        "#0000FF": "Blue",
        "#FFFF00": "Yellow",
        "#FF00FF": "Magenta",
        "#00FFFF": "Cyan",
        "#FFA500": "Orange",
        "#800080": "Purple",
        "#FFC0CB": "Pink",
        "#A52A2A": "Brown",
        "#808080": "Gray",
        "#FFD700": "Gold",
        "#C0C0C0": "Silver",
        "#008000": "Dark Green",
        "#000080": "Navy",
        "#800000": "Maroon",
        "#FF6347": "Tomato",
        "#40E0D0": "Turquoise",
        "#EE82EE": "Violet",
        "#F0E68C": "Khaki",
        "#90EE90": "Light Green",
        "#87CEEB": "Sky Blue",
        "#DDA0DD": "Plum",
        "#F5DEB3": "Wheat",
        "#FF7F50": "Coral",
        "#6495ED": "Cornflower Blue",
        "#DC143C": "Crimson",
        "#00CED1": "Dark Turquoise",
        "#FF1493": "Deep Pink",
        "#1E90FF": "Dodger Blue",
        "#B22222": "Fire Brick",
        "#228B22": "Forest Green",
        "#DAA520": "Goldenrod",
        "#ADFF2F": "Green Yellow",
        "#FF69B4": "Hot Pink",
        "#CD5C5C": "Indian Red",
        "#4B0082": "Indigo",
        "#FFFFF0": "Ivory",
        "#E6E6FA": "Lavender",
        "#FFF0F5": "Lavender Blush",
        "#7CFC00": "Lawn Green",
        "#FFFACD": "Lemon Chiffon",
        "#ADD8E6": "Light Blue",
        "#F08080": "Light Coral",
        "#E0FFFF": "Light Cyan",
        "#FAFAD2": "Light Goldenrod Yellow",
        "#D3D3D3": "Light Gray",
        "#FFB6C1": "Light Pink",
        "#FFA07A": "Light Salmon",
        "#20B2AA": "Light Sea Green",
        "#87CEFA": "Light Sky Blue",
        "#778899": "Light Slate Gray",
        "#B0C4DE": "Light Steel Blue",
        "#FFFFE0": "Light Yellow",
        "#32CD32": "Lime Green",
        "#FAF0E6": "Linen",
        "#66CDAA": "Medium Aquamarine",
        "#0000CD": "Medium Blue",
        "#BA55D3": "Medium Orchid",
        "#9370DB": "Medium Purple",
        "#3CB371": "Medium Sea Green",
        "#7B68EE": "Medium Slate Blue",
        "#00FA9A": "Medium Spring Green",
        "#48D1CC": "Medium Turquoise",
        "#C71585": "Medium Violet Red",
        "#191970": "Midnight Blue",
        "#F5FFFA": "Mint Cream",
        "#FFE4E1": "Misty Rose",
        "#FFE4B5": "Moccasin",
        "#FFDEAD": "Navajo White",
        "#FDF5E6": "Old Lace",
        "#808000": "Olive",
        "#6B8E23": "Olive Drab",
        "#FF4500": "Orange Red",
        "#DA70D6": "Orchid",
        "#EEE8AA": "Pale Goldenrod",
        "#98FB98": "Pale Green",
        "#AFEEEE": "Pale Turquoise",
        "#DB7093": "Pale Violet Red",
        "#FFEFD5": "Papaya Whip",
        "#FFDAB9": "Peach Puff",
        "#CD853F": "Peru",
        "#B0E0E6": "Powder Blue",
        "#BC8F8F": "Rosy Brown",
        "#4169E1": "Royal Blue",
        "#8B4513": "Saddle Brown",
        "#FA8072": "Salmon",
        "#F4A460": "Sandy Brown",
        "#2E8B57": "Sea Green",
        "#FFF5EE": "Sea Shell",
        "#A0522D": "Sienna",
        "#6A5ACD": "Slate Blue",
        "#708090": "Slate Gray",
        "#FFFAFA": "Snow",
        "#00FF7F": "Spring Green",
        "#4682B4": "Steel Blue",
        "#D2B48C": "Tan",
        "#008080": "Teal",
        "#D8BFD8": "Thistle",
        "#F5F5F5": "White Smoke",
        "#9ACD32": "Yellow Green",
        # Tailwind preset colors (from server)
        "#EF4444": "Red",
        "#F97316": "Orange",
        "#F59E0B": "Amber",
        "#EAB308": "Yellow",
        "#84CC16": "Lime",
        "#22C55E": "Green",
        "#10B981": "Emerald",
        "#14B8A6": "Teal",
        "#06B6D4": "Cyan",
        "#0EA5E9": "Sky",
        "#3B82F6": "Blue",
        "#6366F1": "Indigo",
        "#8B5CF6": "Violet",
        "#A855F7": "Purple",
        "#D946EF": "Fuchsia",
        "#EC4899": "Pink",
        "#F43F5E": "Rose",
    }

    # Normalize hex color (uppercase, ensure # prefix)
    normalized_hex = hex_color.upper()
    if not normalized_hex.startswith("#"):
        normalized_hex = f"#{normalized_hex}"

    return color_map.get(normalized_hex, normalized_hex)


def filter_colors(
    colors: list[str],
    search_term: str | None = None,
) -> list[dict[str, str]]:
    """Filter colors by search term, return with names."""
    if not search_term or not search_term.strip():
        return [{"hex": c, "name": get_color_name(c)} for c in colors]

    search_lower = search_term.lower().strip()
    filtered = []
    for color_hex in colors:
        color_name = get_color_name(color_hex).lower()
        if search_lower in color_name or search_lower in color_hex.lower():
            filtered.append({"hex": color_hex, "name": get_color_name(color_hex)})
    return filtered


def filter_icons(
    icons: list[str],
    search_term: str | None = None,
) -> list[str]:
    """Filter icons by search term."""
    if not search_term or not search_term.strip():
        return icons

    search_lower = search_term.lower().strip()
    return [icon for icon in icons if search_lower in icon.lower()]


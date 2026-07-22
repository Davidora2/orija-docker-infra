"""Prompt builders for product-accurate lifestyle photography."""

from __future__ import annotations

from typing import Any


FIDELITY_RULES = """
CRITICAL PRODUCT FIDELITY RULES (non-negotiable):
- The product must be an exact visual match to the provided reference images.
- Preserve every logo, label, typography, color, material, texture, seam, stitch, hardware, and silhouette.
- Do not invent, omit, stylize, or reinterpret product features.
- Keep real-world proportions: scale relative to hands, body, furniture, and environment must be believable.
- The product is the hero — lighting should reveal accurate detail and material character.
""".strip()


def _layout_block(layout: dict[str, Any] | None) -> str:
    if not layout:
        return ""
    product = layout.get("product") or {}
    model = layout.get("model") or {}
    lines = ["COMPOSITION LOCK (follow precisely):"]
    if product:
        lines.append(
            f"- Product anchor: {product.get('x', 50):.0f}% from left, "
            f"{product.get('y', 55):.0f}% from top, "
            f"relative scale {product.get('scale', 1.0):.2f}×."
        )
    if model.get("enabled"):
        lines.append(
            f"- Human model anchor: {model.get('x', 35):.0f}% from left, "
            f"{model.get('y', 50):.0f}% from top, "
            f"relative scale {model.get('scale', 1.0):.2f}×."
        )
        if model.get("pose"):
            lines.append(f"- Model pose / interaction: {model['pose']}.")
    return "\n".join(lines)


def build_draft_prompt(brief: dict[str, Any]) -> str:
    scene = brief.get("scene") or "a lived-in, natural lifestyle environment"
    lighting = brief.get("lighting") or "soft natural window light with gentle fill"
    camera = brief.get("camera") or "editorial lifestyle photograph, shallow depth of field"
    notes = brief.get("notes") or ""
    include_model = bool(brief.get("include_model"))
    model_desc = brief.get("model_description") or (
        "a realistic adult model whose age, style, and wardrobe fit the product and setting"
    )
    product_name = brief.get("product_name") or "the product shown in the reference images"
    product_notes = brief.get("product_notes") or ""

    parts = [
        "Create a photorealistic lifestyle product photograph.",
        f"Product: {product_name}.",
        FIDELITY_RULES,
        "Use the attached product reference image(s) as the sole source of truth for product appearance.",
    ]
    if product_notes:
        parts.append(f"Additional product notes: {product_notes}")
    parts.append(f"Scene / setting: {scene}.")
    parts.append(f"Lighting: {lighting}.")
    parts.append(f"Camera / look: {camera}.")
    if include_model:
        parts.append(
            f"Include a realistic human model: {model_desc}. "
            "The model should naturally interact with or present the product "
            "(holding, wearing, or using it as appropriate). "
            "Keep anatomy, hands, and product contact physically correct."
        )
        if brief.get("model_reference"):
            parts.append(
                "Match the character identity / appearance from the attached model reference image(s)."
            )
    else:
        parts.append("No human model. Focus on the product in context.")
    if brief.get("style_reference"):
        parts.append(
            "Use the attached style / mood reference for atmosphere and color grade only — "
            "never change the product design."
        )
    layout = _layout_block(brief.get("layout"))
    if layout:
        parts.append(layout)
    if notes:
        parts.append(f"Creative notes: {notes}")
    parts.append(
        "Output a single cohesive photograph. No collage, no borders, no text overlays, no watermarks."
    )
    return "\n\n".join(parts)


def build_reposition_prompt(brief: dict[str, Any], layout: dict[str, Any]) -> str:
    """Edit an existing draft so placement matches the draft-studio layout."""
    product = layout.get("product") or {}
    model = layout.get("model") or {}
    parts = [
        "Edit this lifestyle photograph. Keep the same scene, lighting, camera, materials, and product identity.",
        FIDELITY_RULES,
        "Only adjust composition / placement / scale as specified. Do not redesign the product.",
        _layout_block(layout),
        (
            f"Move the product so its visual center sits near "
            f"({product.get('x', 50):.0f}% horizontal, {product.get('y', 55):.0f}% vertical) "
            f"and resize it to about {product.get('scale', 1.0):.2f}× its current perceived size "
            "relative to the frame, while keeping real-world proportions believable."
        ),
    ]
    if model.get("enabled"):
        parts.append(
            f"Reposition the human model so their visual center sits near "
            f"({model.get('x', 35):.0f}% horizontal, {model.get('y', 50):.0f}% vertical), "
            f"scale ~{model.get('scale', 1.0):.2f}×. "
            "Preserve a natural interaction with the product; fix any awkward proportions."
        )
        if model.get("pose"):
            parts.append(f"Adjust pose if needed: {model['pose']}.")
    if brief.get("notes"):
        parts.append(f"Also consider: {brief['notes']}")
    parts.append("Return one photorealistic edited image only.")
    return "\n\n".join(parts)


def build_bake_prompt(brief: dict[str, Any], layout: dict[str, Any] | None) -> str:
    parts = [
        "Bake a final high-resolution commercial lifestyle photograph from the approved draft.",
        "Match the approved draft composition exactly — same framing, placement, pose, and mood.",
        FIDELITY_RULES,
        "Use the product reference image(s) to restore any fine detail (labels, edges, textures) at high resolution.",
        "Increase clarity, micro-contrast, and material fidelity suitable for ecommerce / ad use.",
        "No redesign, no new props that change the story, no text overlays.",
    ]
    layout_block = _layout_block(layout)
    if layout_block:
        parts.append(layout_block)
    if brief.get("product_name"):
        parts.append(f"Product: {brief['product_name']}.")
    if brief.get("notes"):
        parts.append(f"Notes: {brief['notes']}")
    return "\n\n".join(parts)

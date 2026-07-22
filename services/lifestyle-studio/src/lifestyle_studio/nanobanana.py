"""Nano Banana (Gemini image) client with draft / edit / bake helpers."""

from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import Settings

logger = logging.getLogger(__name__)


class NanoBananaError(RuntimeError):
    pass


class NanoBananaClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client = None
        if settings.has_api_key:
            try:
                from google import genai

                self._client = genai.Client(api_key=settings.gemini_api_key)
            except Exception as exc:  # pragma: no cover
                logger.exception("Failed to init google-genai client")
                raise NanoBananaError(f"Failed to initialize Gemini client: {exc}") from exc

    @property
    def available(self) -> bool:
        return self._client is not None

    def _read_b64(self, path: Path) -> tuple[str, str]:
        data = path.read_bytes()
        suffix = path.suffix.lower()
        mime = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }.get(suffix, "image/png")
        return base64.b64encode(data).decode("utf-8"), mime

    def _build_input(
        self,
        prompt: str,
        reference_paths: list[Path],
        labels: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        parts: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        labels = labels or []
        for idx, path in enumerate(reference_paths):
            if not path.exists():
                continue
            label = labels[idx] if idx < len(labels) else f"Reference {idx + 1}"
            b64, mime = self._read_b64(path)
            parts.append({"type": "text", "text": f"[{label}]"})
            parts.append({"type": "image", "data": b64, "mime_type": mime})
        return parts

    @retry(wait=wait_exponential(multiplier=1, min=2, max=20), stop=stop_after_attempt(3), reraise=True)
    def generate(
        self,
        *,
        prompt: str,
        reference_paths: list[Path],
        labels: list[str] | None = None,
        model: str,
        image_size: str,
        aspect_ratio: str = "3:4",
    ) -> bytes:
        if not self.available:
            return self._mock_image(prompt, reference_paths, aspect_ratio, image_size)

        assert self._client is not None
        payload = self._build_input(prompt, reference_paths, labels)
        try:
            interaction = self._client.interactions.create(
                model=model,
                input=payload,
                response_format={
                    "type": "image",
                    "aspect_ratio": aspect_ratio,
                    "image_size": image_size,
                },
            )
        except Exception as exc:
            logger.exception("Nano Banana generation failed")
            raise NanoBananaError(str(exc)) from exc

        image_bytes = self._extract_image(interaction)
        if not image_bytes:
            raise NanoBananaError("Nano Banana returned no image data")
        return image_bytes

    def _extract_image(self, interaction: Any) -> bytes | None:
        # Convenience property on newer SDKs
        output_image = getattr(interaction, "output_image", None)
        if output_image is not None:
            data = getattr(output_image, "data", None)
            if data:
                return base64.b64decode(data)

        steps = getattr(interaction, "steps", None) or []
        for step in steps:
            if getattr(step, "type", None) != "model_output":
                continue
            for block in getattr(step, "content", None) or []:
                if getattr(block, "type", None) == "image" and getattr(block, "data", None):
                    return base64.b64decode(block.data)
        return None

    def _mock_image(
        self,
        prompt: str,
        reference_paths: list[Path],
        aspect_ratio: str,
        image_size: str,
    ) -> bytes:
        """Deterministic placeholder so the UI can be exercised without an API key."""
        w, h = _size_for(aspect_ratio, image_size)
        img = Image.new("RGB", (w, h), (28, 36, 32))
        draw = ImageDraw.Draw(img)

        # Soft vignette-ish bands
        for i in range(8):
            shade = 28 + i * 6
            draw.rectangle(
                [i * 12, i * 12, w - i * 12, h - i * 12],
                outline=(shade, shade + 8, shade - 4),
            )

        # Paste first product ref if present
        if reference_paths:
            try:
                ref = Image.open(reference_paths[0]).convert("RGBA")
                max_side = int(min(w, h) * 0.42)
                ref.thumbnail((max_side, max_side))
                px = int(w * 0.5 - ref.width / 2)
                py = int(h * 0.55 - ref.height / 2)
                img.paste(ref, (px, py), ref)
            except Exception:
                pass

        title = "DRAFT · MOCK MODE"
        subtitle = "Set GEMINI_API_KEY for Nano Banana"
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None
        draw.text((32, 32), title, fill=(232, 214, 170), font=font)
        draw.text((32, 56), subtitle, fill=(180, 190, 176), font=font)
        # Truncate prompt for footer
        snippet = " ".join(prompt.split())[:160]
        draw.text((32, h - 48), snippet, fill=(140, 150, 138), font=font)

        from io import BytesIO

        buf = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


def _size_for(aspect_ratio: str, image_size: str) -> tuple[int, int]:
    # Approximate pixel sizes for mock mode only
    base = {"0.5K": 512, "1K": 1024, "2K": 2048, "4K": 4096}.get(image_size.upper(), 1024)
    ratios = {
        "1:1": (1, 1),
        "3:4": (3, 4),
        "4:3": (4, 3),
        "9:16": (9, 16),
        "16:9": (16, 9),
        "2:3": (2, 3),
        "3:2": (3, 2),
        "4:5": (4, 5),
        "5:4": (5, 4),
    }
    rw, rh = ratios.get(aspect_ratio, (3, 4))
    if rw >= rh:
        return base, int(base * rh / rw)
    return int(base * rw / rh), base

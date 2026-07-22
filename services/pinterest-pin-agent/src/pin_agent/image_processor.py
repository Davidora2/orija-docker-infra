from __future__ import annotations

import io
import logging
from dataclasses import dataclass

import httpx
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


@dataclass
class PreparedImage:
    jpeg_bytes: bytes
    width: int
    height: int
    content_type: str = "image/jpeg"


def download_image(url: str, timeout: float = 60.0) -> bytes:
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.content


def prepare_pin_image(
    image_bytes: bytes,
    *,
    target_width: int = 1000,
    target_height: int = 1500,
) -> PreparedImage:
    """
    Convert any product image into Pinterest's preferred 2:3 vertical canvas.
    Center-crops then resizes; outputs JPEG for API base64 uploads.
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode in ("RGBA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            rgba = img.convert("RGBA")
            background.paste(rgba, mask=rgba.split()[-1])
            img = background
        else:
            img = img.convert("RGB")

        fitted = ImageOps.fit(
            img,
            (target_width, target_height),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        out = io.BytesIO()
        fitted.save(out, format="JPEG", quality=90, optimize=True)
        return PreparedImage(
            jpeg_bytes=out.getvalue(),
            width=target_width,
            height=target_height,
        )

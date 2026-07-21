from __future__ import annotations

import io

from pin_agent.image_processor import prepare_pin_image
from pin_agent.pin_composer import compose_with_template
from pin_agent.shopify_client import Product, ProductImage
from pin_agent.trends import ScoredProduct, rank_products
from PIL import Image


def _product(**kwargs) -> Product:
    defaults = dict(
        id="1",
        title="Linen Throw Pillow",
        handle="linen-throw-pillow",
        body_html="<p>Soft pillow for cozy home decor nights.</p>",
        product_type="Home Decor",
        vendor="Orija",
        tags=["home decor", "pillow"],
        status="active",
        online_store_url="/products/linen-throw-pillow",
        images=[ProductImage(id="img1", src="https://example.com/a.jpg")],
    )
    defaults.update(kwargs)
    return Product(**defaults)


def test_keyword_scoring_prefers_matches():
    config = {
        "keywords": [{"phrase": "home decor", "weight": 1.0}, {"phrase": "gift ideas", "weight": 0.9}],
        "seasonal": [],
        "search_terms": [],
        "board_routing": {},
    }
    a = _product()
    b = _product(id="2", title="USB Cable", body_html="", tags=["electronics"], product_type="Cables")
    ranked = rank_products([b, a], config)
    assert ranked[0].product.id == "1"
    assert "home decor" in ranked[0].matched_keywords


def test_compose_includes_keywords():
    scored = ScoredProduct(
        product=_product(),
        score=1.0,
        matched_keywords=["home decor"],
    )
    draft = compose_with_template(
        scored,
        brand_name="Orija",
        brand_config={"cta_phrases": ["Shop now"], "title_max_chars": 100, "description_max_chars": 500},
        search_terms=["gift guide"],
        brand_voice="warm",
    )
    assert "home decor" in draft.title.lower() or "home decor" in draft.description.lower()
    assert draft.image_id == "img1"


def test_prepare_pin_image_is_2x3():
    img = Image.new("RGB", (800, 600), color=(20, 80, 120))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    prepared = prepare_pin_image(buf.getvalue(), target_width=1000, target_height=1500)
    assert prepared.width == 1000
    assert prepared.height == 1500
    assert prepared.jpeg_bytes[:2] == b"\xff\xd8"

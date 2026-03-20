"""
Moira API - Ad Generation Flow
================================
Runs the full end-to-end ad generation workflow:
  1. Create a product (with branding)
  2. Generate concept plans
  3. Render ads from concepts (auto-creates Stimulus records)

Usage:
    python ad_generation_flow.py

Set MOIRA_API_KEY and MOIRA_BASE_URL as environment variables before running.
"""

import os
import json
import requests

API_KEY = os.environ.get("MOIRA_API_KEY", "moira_user_...")
BASE_URL = os.environ.get("MOIRA_BASE_URL", "https://<your-host>")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


def api_post(path: str, body: dict) -> dict:
    resp = requests.post(f"{BASE_URL}{path}", headers=HEADERS, json=body)
    resp.raise_for_status()
    return resp.json()["data"]


def api_get(path: str) -> dict:
    resp = requests.get(f"{BASE_URL}{path}", headers=HEADERS)
    resp.raise_for_status()
    return resp.json()["data"]


# ─────────────────────────────────────────────
# STEP 1: Create a Product
# ─────────────────────────────────────────────
def create_product(
    name: str,
    description: str,
    category: str = "ecommerce",
    website_url: str = None,
    branding: dict = None,
) -> dict:
    """
    category options: ecommerce | food | travel | other
    branding fields:
      logo:              { url, objectName? }
      colorPalette:      ["#RRGGBB", ...]
      fontFamilies:      ["Inter", ...]
      referenceImages:   [{ url, objectName? }, ...]
      typographyReference: { url, objectName? }
      notes:             str
    """
    body = {
        "name": name,
        "description": description,
        "category": category,
    }
    if website_url:
        body["websiteUrl"] = website_url
    if branding:
        body["branding"] = branding

    product = api_post("/api/products", body)
    print(f"[1] Product created: {product['id']} — {product['name']}")
    return product


# ─────────────────────────────────────────────
# STEP 2: Generate Concept Plans
# ─────────────────────────────────────────────
def generate_concept_plans(
    product_id: str,
    use_brand_kit: bool = True,
    num_options: int = 3,
    custom_prompt: str = "",
    stimulus_ids: list = None,
) -> list:
    """
    Returns a list of concept plan dicts, each with:
      name, headline, primaryText, reasoning { strategy, visualDirection }
    """
    body = {
        "productId": product_id,
        "useBrandKit": use_brand_kit,
        "numOptions": num_options,
    }
    if custom_prompt:
        body["customPrompt"] = custom_prompt
    if stimulus_ids:
        body["stimulusIds"] = stimulus_ids

    result = api_post("/api/generate/ads/plan", body)
    concepts = result.get("conceptPlans", [])
    print(f"[2] Generated {len(concepts)} concept plans")
    return concepts


# ─────────────────────────────────────────────
# STEP 3: Render Ads (creates Stimulus records automatically)
# ─────────────────────────────────────────────
def render_ads(
    product_id: str,
    concepts: list,
    use_brand_kit: bool = True,
    aspect_ratios: list = None,
    custom_prompt: str = "",
    stimulus_ids: list = None,
) -> list:
    """
    aspect_ratios options: "1:1" | "9:16" | "4:5" | "16:9" | "1.91:1"
    Returns a list of Stimulus objects (already saved in Moira).
    Each stimulus has an `id` that can be used directly in a study.
    """
    body = {
        "productId": product_id,
        "concepts": concepts,
        "useBrandKit": use_brand_kit,
    }
    if aspect_ratios:
        body["aspectRatios"] = aspect_ratios
    else:
        body["aspectRatio"] = "1:1"
    if custom_prompt:
        body["customPrompt"] = custom_prompt
    if stimulus_ids:
        body["stimulusIds"] = stimulus_ids

    result = api_post("/api/generate/ads/render", body)
    stimuli = result.get("stimuli", [])
    failed = result.get("failedConcepts", [])

    print(f"[3] Rendered {len(stimuli)} ads ({len(failed)} failed)")
    if failed:
        for f in failed:
            print(f"    ⚠ Failed concept: {f.get('name')} — {f.get('message')}")

    return stimuli


# ─────────────────────────────────────────────
# Main: run the full flow
# ─────────────────────────────────────────────
if __name__ == "__main__":
    # 1. Create product
    product = create_product(
        name="SuperWidget Pro",
        description="The most durable widget on the market.",
        category="ecommerce",
        website_url="https://example.com",
        branding={
            "colorPalette": ["#FF0000", "#000000"],
            "fontFamilies": ["Inter"],
        },
    )

    # 2. Generate concepts
    concepts = generate_concept_plans(
        product_id=product["id"],
        use_brand_kit=True,
        num_options=3,
        custom_prompt="Focus on durability and long-term value.",
    )

    # 3. Render ads (stimuli are created automatically)
    stimuli = render_ads(
        product_id=product["id"],
        concepts=concepts,
        use_brand_kit=True,
        aspect_ratios=["1:1"],
    )

    print("\n✅ Ad generation complete. Stimulus IDs ready for study:")
    for s in stimuli:
        print(f"   {s['id']}  ({s.get('name', 'unnamed')})")

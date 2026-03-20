"""
Moira API - Study Testing Flow
================================
Runs the full end-to-end study testing workflow:
  1. Create stimuli (or accept existing stimulus IDs)
  2. Create a study
  3. Get sampling confirmation
  4. Start sampling
  5. Poll for completion
  6. Fetch and print results

Usage:
    python study_testing_flow.py

Set MOIRA_API_KEY and MOIRA_BASE_URL as environment variables before running.
"""

import os
import time
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
# STEP 1: Create Stimuli (skip if you already have IDs from ad generation)
# ─────────────────────────────────────────────
def create_stimulus(
    name: str,
    stimulus_type: str,
    media_url: str = None,
    primary_text: str = None,
    headline: str = None,
    product_id: str = None,
) -> dict:
    """
    stimulus_type options:
      image_ad | static_image | video_ad | tiktok_hook | text_hook |
      feature_concept | product_copy | email | social_post

    Pipeline type is inferred from stimulus type:
      image_ad / static_image  → ctrProxy
      video_ad                 → videoCtrProxy
      tiktok_hook / text_hook  → textHook

    NOTE: Do NOT mix image, video, and text hook stimuli in the same study.
    """
    body = {"name": name, "type": stimulus_type}
    if media_url:
        body["mediaUrl"] = media_url
    if primary_text:
        body["primaryText"] = primary_text
    if headline:
        body["headline"] = headline
    if product_id:
        body["productId"] = product_id

    stimulus = api_post("/api/stimuli", body)
    print(f"[1] Stimulus created: {stimulus['id']} — {stimulus['name']}")
    return stimulus


# ─────────────────────────────────────────────
# STEP 2: Create a Study
# ─────────────────────────────────────────────
def create_study(
    product_id: str,
    stimulus_ids: list,
    name: str = None,
    objective: str = "ad_interest",
    runs_per_persona: int = 5,
    persona_sample_size: int = 300,
    callback_url: str = None,
    callback_secret: str = None,
    non_us_market: str = None,
) -> dict:
    """
    objective options: ad_interest | purchase_intent | concept_fit | ad_evaluation
    non_us_market options: "India" or omit for US behavior
    """
    body = {
        "productId": product_id,
        "stimulusIds": stimulus_ids,
        "objective": objective,
        "runsPerPersonaPerStimulus": runs_per_persona,
        "personaSample": {"enabled": True, "size": persona_sample_size},
    }
    if name:
        body["name"] = name
    if callback_url:
        body["callbackUrl"] = callback_url
    if callback_secret:
        body["callbackSecret"] = callback_secret
    if non_us_market:
        body["nonUsMarket"] = non_us_market

    study = api_post("/api/studies", body)
    print(f"[2] Study created: {study['id']} — {study.get('name', 'unnamed')}")
    return study


# ─────────────────────────────────────────────
# STEP 3: Get Sampling Confirmation
# ─────────────────────────────────────────────
def get_sampling_confirmation(study_id: str) -> dict:
    confirmation = api_get(f"/api/studies/{study_id}/sampling/confirm")
    print(
        f"[3] Confirmation: {confirmation['personaCount']} personas × "
        f"{confirmation['stimulusCount']} stimuli = "
        f"{confirmation['totalRequests']} total requests"
    )
    return confirmation


# ─────────────────────────────────────────────
# STEP 4: Start Sampling
# ─────────────────────────────────────────────
def start_sampling(study_id: str, confirmation: dict) -> dict:
    result = api_post(
        f"/api/studies/{study_id}/sampling/start",
        {"confirm": confirmation},
    )
    print(f"[4] Sampling started for study {study_id}")
    return result


# ─────────────────────────────────────────────
# STEP 5: Poll for Completion
# ─────────────────────────────────────────────
def poll_until_complete(study_id: str, poll_interval: int = 10) -> dict:
    """
    Polls the sampling status every `poll_interval` seconds until the study
    reaches 'completed' or 'failed'.

    Status payload fields:
      status:                    draft | running | completed | failed
      currentStep:               sampling | clustering | segmentation | archetypes
      progressPercent:           0–100
      elapsedSeconds:            total pipeline runtime
      currentStepElapsedSeconds: runtime for the active stage
    """
    print(f"[5] Polling status every {poll_interval}s...")
    while True:
        status = api_get(f"/api/studies/{study_id}/sampling/status")
        pct = status.get("progressPercent", 0)
        step = status.get("currentStep", "—")
        elapsed = status.get("elapsedSeconds", 0)
        print(f"    {status['status'].upper():12} | {pct:3}% | step: {step} | {elapsed:.0f}s elapsed")

        if status["status"] == "completed":
            print("    ✅ Study completed.")
            return status
        elif status["status"] == "failed":
            failure = status.get("failure", {})
            raise RuntimeError(
                f"Study failed at step '{failure.get('step')}': {failure.get('error')}"
            )

        time.sleep(poll_interval)


# ─────────────────────────────────────────────
# STEP 6: Fetch Results
# ─────────────────────────────────────────────
def fetch_results(study_id: str) -> dict:
    """
    Results are step-gated:
      ranking  → available after sampling
      themes   → available after clustering
      demos    → available after clustering
      segments → available after segmentation

    Use ?refresh=true to bypass cache and recompute.
    """
    ranking = api_get(f"/api/studies/{study_id}/results/ranking")
    print(f"\n[6] Ranking results ({len(ranking.get('items', []))} stimuli):")
    for item in ranking.get("items", []):
        ctr = item.get("ctrProxyMean") or item.get("meanRating") or "n/a"
        print(f"    {item['stimulusName']:40} CTR proxy: {ctr}")
    return ranking


# ─────────────────────────────────────────────
# Main: run the full flow
# ─────────────────────────────────────────────
if __name__ == "__main__":
    PRODUCT_ID = "product_123"  # Replace with a real product ID

    # Option A: Use stimulus IDs already created by the ad generation flow
    EXISTING_STIMULUS_IDS = []  # e.g. ["stimulus_abc", "stimulus_def"]

    # Option B: Create stimuli from hosted URLs
    if not EXISTING_STIMULUS_IDS:
        s1 = create_stimulus(
            name="Ad Variant A",
            stimulus_type="image_ad",
            media_url="https://cdn.example.com/ads/ad-a.png",
            primary_text="Built to last.",
            product_id=PRODUCT_ID,
        )
        s2 = create_stimulus(
            name="Ad Variant B",
            stimulus_type="image_ad",
            media_url="https://cdn.example.com/ads/ad-b.png",
            primary_text="Never buy another widget again.",
            product_id=PRODUCT_ID,
        )
        EXISTING_STIMULUS_IDS = [s1["id"], s2["id"]]

    # Create study
    study = create_study(
        product_id=PRODUCT_ID,
        stimulus_ids=EXISTING_STIMULUS_IDS,
        name="Q1 Ad Campaign Test",
        objective="ad_interest",
        runs_per_persona=5,
        persona_sample_size=300,
    )

    # Confirm and start sampling
    confirmation = get_sampling_confirmation(study["id"])
    start_sampling(study["id"], confirmation)

    # Poll until done
    poll_until_complete(study["id"], poll_interval=10)

    # Fetch results
    fetch_results(study["id"])

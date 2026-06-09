"""
Nelos API - Managed Batch Flow
==============================
Runs the recommended external partner workflow:
  1. Create or reference a product
  2. Submit a managed batch for static and/or video assets
  3. Poll until generated assets are available

Usage:
    python scripts/managed_batch_flow.py

Set NELOS_API_KEY and NELOS_API_BASE_URL before running.
"""

import os
import time
import uuid
import requests

API_KEY = os.environ.get("NELOS_API_KEY", "nelos_user_xxx")
BASE_URL = os.environ.get("NELOS_API_BASE_URL", "https://<nelos-api-host>")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


def api_post(path: str, body: dict, extra_headers: dict = None) -> dict:
    headers = {**HEADERS, **(extra_headers or {})}
    resp = requests.post(f"{BASE_URL}{path}", headers=headers, json=body)
    resp.raise_for_status()
    return resp.json()["data"]


def api_get(path: str) -> dict:
    resp = requests.get(f"{BASE_URL}{path}", headers=HEADERS)
    resp.raise_for_status()
    return resp.json()["data"]


def create_product(
    name: str,
    description: str,
    website_url: str = None,
    features: list = None,
    branding: dict = None,
) -> dict:
    """
    Creates an org-scoped Nelos product.

    Managed batches can also use an existing productId, inline product data,
    or productUrl if you do not want to create the product first.
    """
    body = {
        "name": name,
        "description": description,
    }
    if website_url:
        body["websiteUrl"] = website_url
    if features:
        body["features"] = features
    if branding:
        body["branding"] = branding

    product = api_post("/api/products", body)
    print(f"[1] Product ready: {product['id']} - {product['name']}")
    return product


def create_managed_batch(
    product_id: str = None,
    product_url: str = None,
    product: dict = None,
    static_count: int = 4,
    video_count: int = 1,
    static_quality: str = "standard",
    video_mode: str = "ugc",
    aspect_ratios: list = None,
    video_duration_seconds: int = 15,
    run_study: bool = False,
    external_customer_id: str = None,
    external_workspace_id: str = None,
    external_campaign_id: str = None,
    metadata: dict = None,
    idempotency_key: str = None,
) -> dict:
    """
    Creates a durable managed batch.

    Provide one of product_id, product_url, or product. Always send an
    Idempotency-Key so retries do not create duplicate batches.
    """
    requested_assets = {
        "staticCount": static_count,
        "videoCount": video_count,
        "staticQuality": static_quality,
        "videoMode": video_mode,
        "aspectRatios": aspect_ratios or ["1:1", "9:16"],
        "videoDurationSeconds": video_duration_seconds,
    }
    body = {
        "requestedAssets": requested_assets,
        "runStudy": run_study,
    }
    if product_id:
        body["productId"] = product_id
    if product_url:
        body["productUrl"] = product_url
    if product:
        body["product"] = product
    if external_customer_id:
        body["externalCustomerId"] = external_customer_id
    if external_workspace_id:
        body["externalWorkspaceId"] = external_workspace_id
    if external_campaign_id:
        body["externalCampaignId"] = external_campaign_id
    if metadata:
        body["metadata"] = metadata

    key = idempotency_key or str(uuid.uuid4())
    batch = api_post(
        "/api/v1/managed-batches",
        body,
        {"Idempotency-Key": key},
    )
    print(f"[2] Managed batch submitted: {batch['batchId']} ({batch['status']})")
    print(f"    Idempotency-Key: {key}")
    print(f"    Estimated credits: {batch.get('estimatedCredits', {}).get('total', 'n/a')}")
    return batch


def poll_managed_batch(batch_id: str, poll_interval: int = 10) -> dict:
    print(f"[3] Polling managed batch every {poll_interval}s...")
    while True:
        batch = api_get(f"/api/v1/managed-batches/{batch_id}")
        progress = batch.get("progress", {})
        print(
            f"    {batch['status'].upper():12} | "
            f"{progress.get('completedCount', 0)} complete | "
            f"{progress.get('failedCount', 0)} failed | "
            f"{progress.get('remainingCount', 0)} remaining"
        )

        if batch["status"] == "completed":
            print("    Managed batch completed.")
            return batch
        if batch["status"] in {"failed", "canceled"}:
            error = batch.get("error") or {}
            raise RuntimeError(f"Managed batch {batch['status']}: {error.get('message', batch_id)}")

        time.sleep(poll_interval)


if __name__ == "__main__":
    product = create_product(
        name="Acme Analytics",
        description="Analytics software for revenue teams.",
        website_url="https://example.com",
        features=["Pipeline reporting", "CRM sync", "Forecast alerts"],
    )

    batch = create_managed_batch(
        product_id=product["id"],
        static_count=6,
        video_count=2,
        static_quality="premium",
        video_mode="ugc",
        aspect_ratios=["1:1", "9:16"],
        video_duration_seconds=15,
        # Set run_study=True only when the batch should also create a study.
        run_study=False,
        external_customer_id="customer_123",
        external_campaign_id="campaign_789",
        metadata={"source": "partner-dashboard"},
        idempotency_key="acme-campaign-001",
    )

    completed = poll_managed_batch(batch["batchId"], poll_interval=10)

    print("\nGenerated assets:")
    for asset in completed.get("assets", []):
        print(f"   {asset['stimulusId']} | {asset['type']} | {asset['mediaUrl']}")

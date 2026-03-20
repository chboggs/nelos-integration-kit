---
name: moira-api-integration
description: Complete guide to integrating with the Moira backend API. Use this skill when a user wants to build a client application, automate study creation, run ad generation, upload stimuli, poll for sampling results, or implement any programmatic interaction with Moira's core features.
---

# Moira API Integration Guide

## Purpose

This skill provides comprehensive instructions for integrating client applications or external scripts with the Moira backend API. It covers authentication, multi-step workflows (Ad Generation and Study Testing), core entity management, sampling execution, and results retrieval.

Use this skill when:
- A user asks how to integrate Moira into their own app via API
- You need to build a script that automates Moira study creation or ad generation
- You need to understand the required sequence of API calls for complex flows
- You are implementing the API-key authentication flow

## Bundled Resources

| Resource | Description |
|---|---|
| `scripts/ad_generation_flow.py` | Runnable Python script for the full ad generation workflow (product → concepts → rendered ads) |
| `scripts/study_testing_flow.py` | Runnable Python script for the full study testing workflow (stimuli → study → sampling → results) |
| `templates/moira-client.ts` | Drop-in TypeScript client class covering all major API surfaces |
| `references/api_reference.md` | Full endpoint reference with request/response schemas for every route |

When a user needs a working integration, start with the TypeScript template or Python scripts. Load `references/api_reference.md` when you need exact field names, enums, or schema details.

## Core Concepts & Constraints

**Can a customer put "basically the entire app" into their own client via API?**
**Yes.** The Moira backend exposes almost all of its functionality via REST API.

**Important Constraints — these will break integrations if missed:**

- **Org Membership**: Users must belong to an Organization (`orgId`) to use most authenticated routes. Ensure the user is set up with an org before any other API calls.
- **Pipeline Types**: Studies must use a `pipelineType` that matches the stimuli they test.
  - `ctrProxy` → images (`image_ad`, `static_image`)
  - `videoCtrProxy` → videos (`video_ad`)
  - `textHook` → text (`tiktok_hook`, `text_hook`)
  - The backend will infer this from stimuli if omitted, but will reject mismatches.
- **Mixed Media**: You **cannot** mix image, video, and text hook stimuli in the same study.
- **Video Readiness Gate**: Video studies cannot start sampling until all video stimuli have `stimulusReadiness.videoCtrProxy.status = "ready"` (async processing after upload).
- **Billing Enforcement**: Starting a study without sufficient credits returns `402 Payment Required` with `code: "INSUFFICIENT_CREDITS"` or `code: "SUBSCRIPTION_BLOCKED"`.
- **Render auto-creates Stimuli**: `POST /api/generate/ads/render` creates Stimulus records automatically. Do not call `POST /api/stimuli` again for the same images.

## Authentication

Two methods are supported:

1. **Supabase JWT** (primary): `Authorization: Bearer <supabase_access_token>`
2. **API Key** (for external integrations): `Authorization: Bearer moira_user_...`

For external customers, treat API access as a UI prerequisite:

1. Make sure the user is in an org.
2. Have them sign in to the Moira UI.
3. Open `Settings`.
4. Generate an API key.
5. Store it securely, because the plaintext value is only shown once.

After that, the integration flow in this skill starts from authenticated API usage, not org/bootstrap setup.

## Workflow 1: Ad Generation Flow

This is the primary creation workflow. It produces rendered ad images that are automatically saved as Stimuli.

```
Create Product  →  Generate Concept Plans  →  Render Ads  →  [Stimuli created automatically]
```

**Step 1: Create a Product** — `POST /api/products`

Required: `name`, `category`, `description`. Include `branding` (logo, colorPalette, fontFamilies) for best AI generation quality.

**Step 2: Generate Concept Plans** — `POST /api/generate/ads/plan`

Required: `productId` (or `stimulusIds`). Set `useBrandKit: true` to use the product's branding assets. Returns an array of `conceptPlans` with `name`, `headline`, `primaryText`, and `reasoning`.

**Step 3: Render Ads** — `POST /api/generate/ads/render`

Pass the `concepts` array from Step 2. Set `aspectRatios` (e.g. `["1:1"]`). Returns `stimuli` — an array of fully created Stimulus records with `id` values ready to use in a study. Also returns `failedConcepts` — always check this array.

See `scripts/ad_generation_flow.py` for a complete runnable example.

## Workflow 2: Study Testing Flow

Takes existing stimuli (from Workflow 1 or manually created) and runs them through AI persona sampling.

```
Stimuli  →  Create Study  →  Confirm  →  Start Sampling  →  Poll Status  →  Fetch Results
```

**Step 1: Ensure Stimuli Exist**

Either use IDs from Workflow 1, or create stimuli manually via `POST /api/stimuli` with a hosted `mediaUrl`.

**Step 2: Create a Study** — `POST /api/studies`

Required: `productId`, `stimulusIds`. Optional but recommended: `personaSample: { enabled: true, size: 300 }`, `runsPerPersonaPerStimulus: 5`. Add `callbackUrl` for a webhook on completion.

**Step 3: Get Confirmation** — `GET /api/studies/:id/sampling/confirm`

Returns `{ personaCount, stimulusCount, totalRequests }`. This is the cost preview.

**Step 4: Start Sampling** — `POST /api/studies/:id/sampling/start`

Pass the exact confirmation object back in `{ confirm: { personaCount, stimulusCount, totalRequests } }`.

**Step 5: Poll Status** — `GET /api/studies/:id/sampling/status`

Poll every 10 seconds. Check `status` (`running` / `completed` / `failed`) and `progressPercent`. For live updates, connect to the SSE endpoint at `GET /api/studies/:id/sampling/events`.

**Step 6: Fetch Results** — Results are step-gated:

| Endpoint | Available After |
|---|---|
| `/results/ranking` | sampling |
| `/results/geo` | sampling |
| `/results/themes` | clustering |
| `/results/demos` | clustering |
| `/results/segments` | segmentation |

See `scripts/study_testing_flow.py` for a complete runnable example.

## File Uploads

If you need to upload files rather than provide hosted URLs:
1. `POST /api/uploads/sign` with `{ fileName, contentType }` → get `uploadUrl` and `publicUrl`
2. `PUT` the file binary directly to `uploadUrl`
3. Use `publicUrl` as `mediaUrl` when creating a Stimulus or product branding asset

The TypeScript template (`templates/moira-client.ts`) includes a `uploads.uploadFile()` helper that handles both steps.

## Webhooks

Add `callbackUrl` and `callbackSecret` to a study on creation. Moira will POST to that URL when the study completes:
```json
{
  "event": "study.completed",
  "occurredAt": "2026-...",
  "data": { "studyId": "study_xxx", "orgId": "org_xxx", "status": "completed" }
}
```

## Full Endpoint List

For complete schemas, enums, and field-level validation rules, load `references/api_reference.md`.

Quick summary of available route groups:
- `/api/products` — CRUD + brand imports
- `/api/generate` — Ad concepts, renders, product branding
- `/api/stimuli` — CRUD
- `/api/studies` — CRUD, sampling, results, chat
- `/api/personas` — CRUD
- `/api/persona-groups` — CRUD, sampling, from-study
- `/api/uploads` — Signed URL uploads
- `/api/billing` — Subscription, transactions, Stripe checkout/portal
- `/api/users/me` — Profile, API keys
- `/api/orgs` — CRUD, members
- `/health` — Health check (no auth)

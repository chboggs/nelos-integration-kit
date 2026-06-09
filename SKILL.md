---
name: nelos-api-integration
description: Complete guide to integrating with the Nelos External API. Use this skill when a user wants to build a partner integration, create managed asset batches, poll generated ads, run optional study testing, upload stimuli, inspect billing, or implement API-key authentication.
---

# Nelos API Integration Guide

## Purpose

This skill provides instructions for integrating partner applications or external scripts with the Nelos External API. It covers API-key authentication, product setup, managed asset batches, optional direct static/video generation, study testing, uploads, webhooks, and billing visibility.

Use this skill when:

- A user asks how to integrate Nelos into their own app via API
- You need to automate static or video ad generation through managed batches
- You need to run study testing against generated or uploaded assets
- You are implementing the Nelos API-key authentication flow
- You need exact external endpoint names, schemas, or status semantics

## Bundled Resources

| Resource | Description |
|---|---|
| `templates/nelos-client.ts` | Drop-in TypeScript client class covering the partner API surface |
| `scripts/managed_batch_flow.py` | Runnable Python script for product-backed managed batch generation and polling |
| `scripts/study_testing_flow.py` | Runnable Python script for stimuli, studies, sampling, and results |
| `references/api_reference.md` | Full external API reference with request/response schemas |

When a user needs a working integration, start with the TypeScript template or Python scripts. Load `references/api_reference.md` when you need exact field names, enums, or schema details.

## Core Concepts & Constraints

**Recommended external path:** use managed batches.

```
Create or reference Product -> Submit Managed Batch -> Poll Batch -> Store returned assets
```

Important constraints:

- **Org membership:** API keys are tied to a Nelos user in an org. Most authenticated routes require org membership.
- **Partner customer mapping:** Nelos billing is org-wise. Keep downstream customers, permissions, and end-customer billing in the partner app.
- **External reconciliation:** Pass stable `externalCustomerId`, `externalWorkspaceId`, and `externalCampaignId` values when creating managed batches.
- **Idempotency:** Send `Idempotency-Key` on managed batch creates. Retrying the same key for the same org returns the existing batch.
- **Early-access managed batches:** Polling is the supported status path. Callback delivery for managed batches may be coordinated operationally during early access.
- **Managed-service rate:** Managed batch credit estimates include the current 20% managed-service markup.
- **Pipeline types:** Use `ctrProxy` for static/image ads, `videoCtrProxy` for video ads, `ama` for open-ended AMA feedback, and `textHook` for text hooks.
- **Mixed media:** Do not mix image, video, AMA, and text-hook stimuli in the same study.
- **Billing enforcement:** Insufficient credits or blocked subscription status returns `402`.

## Authentication

External requests use a Nelos API key:

```http
Authorization: Bearer nelos_user_xxx
Content-Type: application/json
```

Recommended environment variables:

```bash
export NELOS_API_BASE_URL="<Nelos API base URL>"
export NELOS_API_KEY="nelos_user_xxx"
```

Generate API keys in the authenticated web app with:

```http
POST /api/users/me/api-key
Authorization: Bearer <supabase_access_token>
```

The full API key is only returned once. Store it securely.

## Workflow 1: Managed Batch Generation

Create or reuse a product, then submit a managed batch:

```http
POST /api/v1/managed-batches
Idempotency-Key: partner-job-123
```

Minimum request:

```json
{
  "productId": "product_abc123",
  "requestedAssets": {
    "staticCount": 4,
    "videoCount": 1,
    "aspectRatios": ["1:1", "9:16"]
  },
  "externalCustomerId": "customer_123"
}
```

Poll:

```http
GET /api/v1/managed-batches/:batchId
```

Completed batches return generated assets with `stimulusId`, `type`, `mediaUrl`, copy, and generation metadata.

See `scripts/managed_batch_flow.py` for a runnable example.

## Workflow 2: Study Testing

Use generated batch assets or uploaded/hosted assets as stimuli:

```
Stimuli -> Create Study -> Confirm -> Start Sampling -> Poll Status -> Fetch Results
```

Key routes:

- `POST /api/stimuli`
- `POST /api/studies`
- `GET /api/studies/:id/sampling/confirm`
- `POST /api/studies/:id/sampling/start`
- `GET /api/studies/:id/sampling/status`
- `GET /api/studies/:id/results/ranking`

See `scripts/study_testing_flow.py` for a complete runnable example.

## Direct Generation

Most partners should use managed batches. Trusted integrations that need lower-level control can use:

- `POST /api/generations/static` to create a static planning run
- `POST /api/generations/static/:id/render` to render selected static concepts
- `POST /api/generations/video` for direct video runs
- `POST /api/generations/video/plans` and related plan routes for plan-based video generation

Use `references/api_reference.md` for exact request and response schemas.

## Endpoint Quick Reference

| Area | Method | Endpoint | Purpose |
|---|---:|---|---|
| Auth | `POST` | `/api/users/me/api-key` | Generate a user API key from an authenticated web session |
| Products | `GET` | `/api/products` | List org products |
| Products | `POST` | `/api/products` | Create a product |
| Products | `GET` | `/api/products/:id` | Fetch a product |
| Products | `PUT` | `/api/products/:id` | Update a product |
| Products | `DELETE` | `/api/products/:id` | Delete a product |
| Products | `POST` | `/api/products/extract-basics` | Extract product suggestions from a URL |
| Products | `POST` | `/api/products/:id/brand-imports` | Start a brand import |
| Products | `GET` | `/api/products/:id/brand-imports/:importId` | Poll a brand import |
| Products | `POST` | `/api/products/:id/brand-imports/:importId/apply` | Apply brand import suggestions |
| Managed batches | `POST` | `/api/v1/managed-batches` | Create an idempotent managed batch |
| Managed batches | `GET` | `/api/v1/managed-batches/:batchId` | Poll managed batch status |
| Managed batches | `GET` | `/api/v1/managed-batches` | List managed batches |
| Static generation | `GET` | `/api/generations/static` | List static runs |
| Static generation | `POST` | `/api/generations/static` | Create a static planning run |
| Static generation | `GET` | `/api/generations/static/:id` | Fetch a static run |
| Static generation | `GET` | `/api/generations/static/:id/events` | Stream static run progress |
| Static generation | `PATCH` | `/api/generations/static/:id/concepts/:conceptId` | Edit a concept |
| Static generation | `POST` | `/api/generations/static/:id/render` | Render selected static concepts |
| Video generation | `GET` | `/api/generations/video/options` | Get supported video options |
| Video generation | `GET` | `/api/generations/video` | List video runs |
| Video generation | `POST` | `/api/generations/video` | Create a video run |
| Video generation | `GET` | `/api/generations/video/:id` | Fetch a video run |
| Video generation | `DELETE` | `/api/generations/video/:id` | Cancel or delete a video run |
| Video generation | `GET` | `/api/generations/video/:id/events` | Stream video run progress |
| Video generation | `POST` | `/api/generations/video/:id/export` | Export final video and create a stimulus |
| Video plans | `GET` | `/api/generations/video/plans` | List video content plans |
| Video plans | `POST` | `/api/generations/video/plans` | Create a video content plan |
| Video plans | `GET` | `/api/generations/video/plans/:planId` | Fetch a video content plan |
| Video plans | `PATCH` | `/api/generations/video/plans/:planId` | Update a video content plan |
| Video plans | `POST` | `/api/generations/video/plans/:planId/runs` | Create a run from a plan |
| Stimuli | `GET` | `/api/stimuli` | List stimuli |
| Stimuli | `POST` | `/api/stimuli` | Create a stimulus from a hosted asset |
| Stimuli | `GET` | `/api/stimuli/:id` | Fetch a stimulus |
| Stimuli | `PUT` | `/api/stimuli/:id` | Update a stimulus |
| Stimuli | `DELETE` | `/api/stimuli/:id` | Delete a stimulus |
| Studies | `GET` | `/api/studies` | List studies |
| Studies | `POST` | `/api/studies` | Create a study |
| Studies | `GET` | `/api/studies/:id` | Fetch a study |
| Studies | `PUT` | `/api/studies/:id` | Update a study |
| Studies | `DELETE` | `/api/studies/:id` | Delete a study |
| Studies | `POST` | `/api/studies/:id/stimuli` | Add stimuli to a study |
| Studies | `DELETE` | `/api/studies/:id/stimuli/:stimulusId` | Remove a stimulus from a study |
| Studies | `GET` | `/api/studies/:id/sampling/confirm` | Get sampling cost confirmation |
| Studies | `POST` | `/api/studies/:id/sampling/start` | Start sampling |
| Studies | `GET` | `/api/studies/:id/sampling/status` | Poll sampling status |
| Studies | `GET` | `/api/studies/:id/sampling/events` | Stream sampling progress |
| Studies | `GET` | `/api/studies/:id/results/ranking` | Get ranked stimuli |
| Studies | `GET` | `/api/studies/:id/results/themes` | Get reason themes |
| Studies | `GET` | `/api/studies/:id/results/demos` | Get demographic insights |
| Studies | `GET` | `/api/studies/:id/results/geo` | Get geographic insights |
| Studies | `GET` | `/api/studies/:id/results/segments` | Get behavioral segments |
| Uploads | `POST` | `/api/uploads/sign` | Create a signed upload URL |
| Billing | `GET` | `/api/billing/subscription` | Get current subscription and credits |
| Billing | `GET` | `/api/billing/transactions` | List credit transactions |
| Billing | `POST` | `/api/billing/checkout` | Create a Stripe checkout session |
| Billing | `POST` | `/api/billing/addon` | Buy add-on credits |
| Billing | `POST` | `/api/billing/portal` | Open the Stripe billing portal |
| Health | `GET` | `/health` | Health check |

## Uploads

If you need to upload files rather than provide hosted URLs:

1. `POST /api/uploads/sign` with `{ "fileName": "...", "contentType": "..." }`
2. Upload the file binary to the returned `uploadUrl`
3. Use `publicUrl` as `mediaUrl` when creating a stimulus or product branding asset

The TypeScript template includes an `uploads.uploadFile()` helper.

## Webhooks

Study completion webhooks are supported for studies created with `callbackUrl` and `callbackSecret`. Nelos signs payloads with `X-Nelos-Signature`.

Managed batches accept callback fields, but polling `GET /api/v1/managed-batches/:batchId` is the supported completion path during early access.

## Full Endpoint Reference

For complete schemas, enums, and field-level validation rules, load `references/api_reference.md`.

# Nelos Integration Kit

Client templates, example scripts, and integration docs for trusted partners building on the Nelos External API.

Nelos helps partners generate static and video ad assets, optionally run AI-powered study testing, and retrieve structured results through a single API. This repo is the post-onboarding integration layer: it assumes you already have access to a Nelos org and API key.

## Who This Is For

- Partners integrating Nelos asset generation into their own products
- Internal developers wiring Nelos into workflows or automations
- Teams that need runnable examples for products, managed batches, studies, uploads, and billing visibility

## Prerequisites

Before using anything in this repo:

1. Sign in to the Nelos web app.
2. Make sure your user belongs to the partner org.
3. Open `Settings`.
4. Generate an API key.
5. Store the key securely. The plaintext value is only shown once.

Use that key as:

```http
Authorization: Bearer nelos_user_xxx
```

Recommended local environment:

```bash
export NELOS_API_BASE_URL="<Nelos API base URL>"
export NELOS_API_KEY="nelos_user_xxx"
```

## What This Repo Covers

- Product creation and brand import
- Managed batch creation, idempotency, polling, and returned assets
- Optional study creation, sampling, polling, and result retrieval
- Hosted asset stimuli and signed uploads
- Direct static and video generation routes for trusted integrations that need lower-level control
- Billing visibility routes

## Expected Workflow

### 1. Managed asset generation

```text
Create or reference Product -> Submit Managed Batch -> Poll Batch -> Store returned assets
```

Key endpoints:

- `POST /api/products`
- `POST /api/v1/managed-batches`
- `GET /api/v1/managed-batches/:batchId`
- `GET /api/v1/managed-batches?productId=product_abc123&limit=25`

Always send an `Idempotency-Key` when creating managed batches. If the same job is retried for the same org, Nelos returns the existing batch instead of creating a duplicate.

### 2. Optional study testing

```text
Stimuli -> Create Study -> Confirm -> Start Sampling -> Poll Status -> Fetch Results
```

Key endpoints:

- `POST /api/stimuli`
- `POST /api/studies`
- `GET /api/studies/:id/sampling/confirm`
- `POST /api/studies/:id/sampling/start`
- `GET /api/studies/:id/sampling/status`
- `GET /api/studies/:id/results/ranking`

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

## Repo Structure

- `templates/nelos-client.ts` Drop-in TypeScript client for the external API surface
- `scripts/managed_batch_flow.py` Runnable managed-batch generation example
- `scripts/study_testing_flow.py` Runnable study testing example
- `references/api_reference.md` External API reference copied from the Nelos partner guide

## Notes

- Most authenticated routes require org membership.
- Partners should keep downstream customer hierarchy, permissions, and end-customer billing in their own system.
- Use `externalCustomerId`, `externalWorkspaceId`, and `externalCampaignId` on managed batches for reconciliation.
- Managed batches are the recommended external API for generating ads.
- Managed batch credit estimates include the current 20% managed-service markup.
- Direct static/video generation routes are available when trusted integrations need concept-level workflow control.
- Do not mix image, video, AMA, and text-hook stimuli in the same study.
- Study runs debit credits at sampling start. Static/video generation debits requested assets and refunds failed generations where supported.

## Support

Use your Nelos onboarding contact for access, provisioning, and product questions.

# Nelos Integration Kit

Client templates, example scripts, and integration docs for trusted partners building on the Nelos External API.

Nelos helps partners generate static and video ad assets, optionally run AI-powered study testing, and retrieve structured results through a single API. This repo is the post-onboarding integration layer: it assumes you already have access to a Nelos org and API key.

Partners should keep their own customer hierarchy, permissions, and end-customer commercial logic in their own system. Nelos commercial terms, credits, and account setup are handled outside this external API.

## Who This Is For

- Partners integrating Nelos asset generation into their own products
- Internal developers wiring Nelos into workflows or automations
- Teams that need runnable examples for products, managed batches, studies, uploads, and direct generation

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
- Webhook and status handling

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

## Workflow Examples

### Create a product

Products are the creative source records used by managed batches, direct generation, and studies. Include a clear description and short feature bullets; these become generation context.

```bash
curl -X POST "$NELOS_API_BASE_URL/api/products" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Analytics",
    "description": "Revenue intelligence software for pipeline inspection and forecast risk.",
    "websiteUrl": "https://example.com",
    "features": ["Pipeline inspection", "CRM sync", "Forecast risk alerts"],
    "branding": {
      "colorPalette": ["#111827", "#2563eb", "#f9fafb"],
      "fontFamilies": ["Inter"],
      "notes": "Clean B2B SaaS look. High contrast. Avoid cartoon styling."
    }
  }'
```

Use the returned `product.id` in later calls.

### Start from a URL and import brand assets

If the partner only has a product URL, first ask Nelos for suggested basics:

```bash
curl -X POST "$NELOS_API_BASE_URL/api/products/extract-basics" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "sourceUrl": "https://example.com/product" }'
```

After creating a product, start a brand import:

```bash
curl -X POST "$NELOS_API_BASE_URL/api/products/product_abc123/brand-imports" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "sourceUrl": "https://example.com" }'
```

Poll until the import is `completed`, then apply selected suggestions:

```bash
curl "$NELOS_API_BASE_URL/api/products/product_abc123/brand-imports/brand_import_abc123" \
  -H "Authorization: Bearer $NELOS_API_KEY"

curl -X POST "$NELOS_API_BASE_URL/api/products/product_abc123/brand-imports/brand_import_abc123/apply" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applyFieldSuggestions": true,
    "logoUrl": "https://example.com/logo.png",
    "colorPalette": ["#111827", "#2563eb", "#f9fafb"],
    "fontFamilies": ["Inter"],
    "referenceImageUrls": ["https://example.com/og-image.png"],
    "brandingNotes": "Use product UI screenshots as proof, not abstract backgrounds."
  }'
```

### Generate assets with a managed batch

Managed batches are the default external integration path. They let partners request static ads, video ads, or both through one asynchronous job.

```bash
curl -X POST "$NELOS_API_BASE_URL/api/v1/managed-batches" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: acme-campaign-001" \
  -d '{
    "productId": "product_abc123",
    "requestedAssets": {
      "staticCount": 6,
      "videoCount": 2,
      "staticQuality": "premium",
      "videoMode": "ugc",
      "aspectRatios": ["1:1", "9:16"],
      "videoDurationSeconds": 15
    },
    "externalCustomerId": "customer_123",
    "externalWorkspaceId": "workspace_456",
    "externalCampaignId": "campaign_789",
    "metadata": {
      "source": "partner-dashboard"
    }
  }'
```

Poll the returned `batchId` until it reaches `completed`, then store the returned `assets[].stimulusId` and `assets[].mediaUrl` values:

```bash
curl "$NELOS_API_BASE_URL/api/v1/managed-batches/managed_batch_abc123" \
  -H "Authorization: Bearer $NELOS_API_KEY"
```

### Upload an existing ad and create a stimulus

Use uploads when the asset is not already hosted at a public URL.

```bash
curl -X POST "$NELOS_API_BASE_URL/api/uploads/sign" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "ad-a.png",
    "contentType": "image/png"
  }'
```

Upload the file bytes to the returned `uploadUrl`, then create a stimulus using the returned `publicUrl`:

```bash
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/png" \
  --data-binary "@ad-a.png"

curl -X POST "$NELOS_API_BASE_URL/api/stimuli" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product_abc123",
    "name": "Partner Static Ad A",
    "type": "image_ad",
    "mediaUrl": "<publicUrl returned by /api/uploads/sign>",
    "headline": "Forecast with confidence",
    "primaryText": "Spot pipeline risk before it hits the board deck."
  }'
```

### Run a study on generated or uploaded stimuli

Create a study with stimulus IDs from a managed batch or uploaded assets:

```bash
curl -X POST "$NELOS_API_BASE_URL/api/studies" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product_abc123",
    "name": "Campaign Test",
    "pipelineType": "ctrProxy",
    "stimulusIds": ["stimulus_abc123", "stimulus_def456"],
    "runsPerPersonaPerStimulus": 3,
    "callbackUrl": "https://partner.example.com/nelos/study-webhook",
    "callbackSecret": "shared-secret"
  }'
```

Confirm the run, start sampling, and poll status:

```bash
curl "$NELOS_API_BASE_URL/api/studies/study_abc123/sampling/confirm" \
  -H "Authorization: Bearer $NELOS_API_KEY"

curl -X POST "$NELOS_API_BASE_URL/api/studies/study_abc123/sampling/start" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "confirm": {
      "stimulusCount": 2,
      "runsPerPair": 3
    }
  }'

curl "$NELOS_API_BASE_URL/api/studies/study_abc123/sampling/status" \
  -H "Authorization: Bearer $NELOS_API_KEY"
```

When the study is ready, fetch results:

```bash
curl "$NELOS_API_BASE_URL/api/studies/study_abc123/results/ranking" \
  -H "Authorization: Bearer $NELOS_API_KEY"
```

### Direct static generation

Use this path when you need concept-level control instead of a managed batch.

```bash
curl -X POST "$NELOS_API_BASE_URL/api/generations/static" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product_abc123",
    "useBrandKit": true,
    "numOptions": 6,
    "copyVerbosity": "medium"
  }'
```

Poll until the run is `awaiting_selection`, then render selected concepts:

```bash
curl "$NELOS_API_BASE_URL/api/generations/static/static_gen_run_abc123" \
  -H "Authorization: Bearer $NELOS_API_KEY"

curl -X POST "$NELOS_API_BASE_URL/api/generations/static/static_gen_run_abc123/render" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "conceptIds": ["concept_1", "concept_2"],
    "aspectRatios": ["1:1", "9:16"],
    "quality": "standard",
    "visualExecutionsPerCombo": 1
  }'
```

### Direct video generation

Use this path when you need direct control over script, storyboard, assets, or export.

```bash
curl -X POST "$NELOS_API_BASE_URL/api/generations/video" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product_abc123",
    "aspectRatio": "9:16",
    "durationSeconds": 15,
    "videoMode": "ugc",
    "creativeBrief": "Show a revenue leader discovering pipeline risk before a forecast call.",
    "queuePlanning": true
  }'
```

Most direct video integrations can poll the run, queue remaining assets, and export:

```bash
curl "$NELOS_API_BASE_URL/api/generations/video/video_gen_run_abc123" \
  -H "Authorization: Bearer $NELOS_API_KEY"

curl -X POST "$NELOS_API_BASE_URL/api/generations/video/video_gen_run_abc123/assets" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

curl -X POST "$NELOS_API_BASE_URL/api/generations/video/video_gen_run_abc123/export" \
  -H "Authorization: Bearer $NELOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

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
| Video generation | `POST` | `/api/generations/video/:id/plan` | Queue planning |
| Video generation | `PATCH` | `/api/generations/video/:id/planning` | Update planning |
| Video generation | `POST` | `/api/generations/video/:id/script/generate` | Generate script |
| Video generation | `PATCH` | `/api/generations/video/:id/script` | Update script |
| Video generation | `POST` | `/api/generations/video/:id/script/critique` | Critique script |
| Video generation | `POST` | `/api/generations/video/:id/script/revise` | Revise script |
| Video generation | `POST` | `/api/generations/video/:id/storyboard/generate` | Generate storyboard |
| Video generation | `PATCH` | `/api/generations/video/:id/storyboard` | Edit storyboard |
| Video generation | `POST` | `/api/generations/video/:id/visual-bible/generate` | Generate visual bible |
| Video generation | `POST` | `/api/generations/video/:id/voiceover/suggest` | Suggest voiceover settings |
| Video generation | `PATCH` | `/api/generations/video/:id/voiceover/settings` | Update voiceover settings |
| Video generation | `POST` | `/api/generations/video/:id/voiceover/generate` | Generate voiceover |
| Video generation | `POST` | `/api/generations/video/:id/frame-plans` | Add a frame plan |
| Video generation | `PATCH` | `/api/generations/video/:id/frame-plans/:frameId` | Update a frame plan |
| Video generation | `POST` | `/api/generations/video/:id/frame-plans/:frameId/assets/frame` | Generate a frame |
| Video generation | `POST` | `/api/generations/video/:id/clip-plans` | Add a clip plan |
| Video generation | `PATCH` | `/api/generations/video/:id/clip-plans/:clipId` | Update a clip plan |
| Video generation | `POST` | `/api/generations/video/:id/clip-plans/:clipId/assets/clip` | Generate a clip |
| Video generation | `POST` | `/api/generations/video/:id/assets` | Queue remaining assets |
| Video generation | `POST` | `/api/generations/video/:id/assets/frames` | Queue all frame assets |
| Video generation | `POST` | `/api/generations/video/:id/assets/:assetType` | Queue one asset type |
| Video generation | `POST` | `/api/generations/video/:id/export` | Export final video and create a stimulus |
| Video plans | `GET` | `/api/generations/video/plans` | List video content plans |
| Video plans | `POST` | `/api/generations/video/plans` | Create a video content plan |
| Video plans | `GET` | `/api/generations/video/plans/:planId` | Fetch a video content plan |
| Video plans | `PATCH` | `/api/generations/video/plans/:planId` | Update a video content plan |
| Video plans | `PATCH` | `/api/generations/video/plans/:planId/concepts/:conceptId` | Update a plan concept |
| Video plans | `POST` | `/api/generations/video/plans/:planId/concepts/generate` | Generate more plan concepts |
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
| Studies | `POST` | `/api/studies/:id/generated-stimuli` | Add generated stimuli to a study |
| Studies | `DELETE` | `/api/studies/:id/generated-stimuli/:stimulusId` | Remove generated stimulus from a study |
| Studies | `GET` | `/api/studies/:id/sampling/confirm` | Get sampling cost confirmation |
| Studies | `POST` | `/api/studies/:id/sampling/start` | Start sampling |
| Studies | `POST` | `/api/studies/:id/sampling/targeted` | Run targeted sampling |
| Studies | `GET` | `/api/studies/:id/sampling/status` | Poll sampling status |
| Studies | `GET` | `/api/studies/:id/sampling/events` | Stream sampling progress |
| Studies | `GET` | `/api/studies/:id/results/ranking` | Get ranked stimuli |
| Studies | `GET` | `/api/studies/:id/results/themes` | Get reason themes |
| Studies | `GET` | `/api/studies/:id/results/demos` | Get demographic insights |
| Studies | `GET` | `/api/studies/:id/results/geo` | Get geographic insights |
| Studies | `GET` | `/api/studies/:id/results/segments` | Get behavioral segments |
| Studies | `GET` | `/api/studies/:id/samples` | List study samples |
| Uploads | `POST` | `/api/uploads/sign` | Create a signed upload URL |
| Uploads | `DELETE` | `/api/uploads/object` | Delete an uploaded object owned by the org |
| Health | `GET` | `/health` | Health check |

## Repo Structure

- `templates/nelos-client.ts` Drop-in TypeScript client for the external API surface
- `scripts/managed_batch_flow.py` Runnable managed-batch generation example
- `scripts/study_testing_flow.py` Runnable study testing example
- `references/api_reference.md` External API reference copied from the Nelos partner guide

## Notes

- Most authenticated routes require org membership.
- Partners should keep downstream customer hierarchy, permissions, and end-customer commercial logic in their own system.
- Use `externalCustomerId`, `externalWorkspaceId`, and `externalCampaignId` on managed batches for reconciliation.
- Managed batches are the recommended external API for generating ads.
- Managed batch credit estimates include the current 20% managed-service markup.
- Direct static/video generation routes are available when trusted integrations need concept-level workflow control.
- Do not mix image, video, AMA, and text-hook stimuli in the same study.
- Internal account-management and commercial-operations endpoints are intentionally omitted from the external API.

## Support

Use your Nelos onboarding contact for access, provisioning, and product questions.

# Moira Integration Kit

Client templates, example scripts, and integration docs for building on the Moira API.

Moira helps teams generate ad creative, run AI-powered study testing, and retrieve structured results through a single API. This repo is the post-setup integration layer: it assumes you already have access to a Moira org and an API key.

Website: [trymoira.com](https://trymoira.com)

## Who This Is For

- Teams building directly on top of the Moira API
- Internal developers wiring Moira into products, workflows, or automations
- Customers who already have Moira access and want working examples

## Prerequisites

Before using anything in this repo:

1. Sign in to the Moira UI.
2. Make sure your user belongs to an org.
3. Open `Settings`.
4. Generate an API key.
5. Store the key securely. The plaintext value is only shown once.

Use that key as:

```http
Authorization: Bearer moira_user_...
```

## What This Repo Covers

- Product creation and brand-kit setup
- Ad concept generation
- Static ad rendering
- Stimulus creation and management
- Study creation and sampling
- Polling study status
- Fetching ranking, theme, demo, segment, and geo results

## Expected Workflow

### 1. Ad generation

```text
Create Product -> Generate Concept Plans -> Render Ads -> Stimuli created automatically
```

Key endpoints:

- `POST /api/products`
- `POST /api/generate/ads/plan`
- `POST /api/generate/ads/render`
- `POST /api/generate/static-ad/copy-plan`
- `POST /api/generate/product-branding`

### 2. Study testing

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

## Repo Structure

- `templates/` Drop-in client code for common integrations
- `scripts/` Runnable example flows for ad generation and study testing
- `references/` Endpoint reference and request/response details

## Notes

- Most authenticated routes require org membership.
- Do not mix image, video, and text-hook stimuli in the same study.
- Video studies require readiness before sampling can start.
- Rendering generated ads creates Stimulus records automatically.

## Support

If you need access, provisioning help, or product questions, start at [trymoira.com](https://trymoira.com).

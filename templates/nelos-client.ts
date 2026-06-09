/**
 * Nelos API Client - TypeScript Template
 * ======================================
 * Drop-in client for integrating with the Nelos External API.
 *
 * Usage:
 *   const nelos = new NelosClient({
 *     apiKey: process.env.NELOS_API_KEY!,
 *     baseUrl: process.env.NELOS_API_BASE_URL!,
 *   });
 *
 *   const batch = await nelos.managedBatches.create({
 *     productUrl: "https://example.com",
 *     requestedAssets: { staticCount: 4, videoCount: 1, aspectRatios: ["1:1", "9:16"] },
 *     externalCustomerId: "customer_123",
 *   }, "customer_123-campaign_456");
 *
 *   const completed = await nelos.managedBatches.pollUntilComplete(batch.batchId);
 *   console.log(completed.assets.map((asset) => asset.mediaUrl));
 */

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9" | "1.91:1";
export type ManagedBatchStatusValue =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "canceled"
  | string;
export type StaticQuality = "standard" | "premium";
export type VideoMode = "animated" | "ugc";
export type PipelineType = "ctrProxy" | "videoCtrProxy" | "ama" | "textHook";
export type StudyObjective = "ad_interest" | "purchase_intent" | "concept_fit" | "ad_evaluation";
export type StudyStatus = "draft" | "running" | "completed" | "failed";
export type StimulusType =
  | "image_ad"
  | "static_image"
  | "video_ad"
  | "video_ad_script"
  | "tiktok_hook"
  | "text_hook"
  | "feature_concept"
  | "product_copy"
  | "email"
  | "social_post";

export interface ProductAsset {
  url?: string;
  objectName?: string;
  contentType?: string;
}

export interface ProductBranding {
  logo?: ProductAsset;
  favicon?: ProductAsset;
  ogImage?: ProductAsset;
  fontFamilies?: string[];
  colorPalette?: string[];
  notes?: string;
  referenceImages?: ProductAsset[];
}

export interface Product {
  id: string;
  orgId?: string;
  name: string;
  description: string;
  websiteUrl?: string;
  isPinned?: boolean;
  features?: string[];
  branding?: ProductBranding;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name?: string;
  description?: string;
  websiteUrl?: string;
  features?: string[];
  branding?: ProductBranding | Record<string, unknown>;
}

export interface ManagedBatchRequest {
  productId?: string;
  productUrl?: string;
  product?: ProductInput;
  requestedAssets: {
    staticCount?: number;
    videoCount?: number;
    staticQuality?: StaticQuality;
    videoMode?: VideoMode;
    aspectRatios?: AspectRatio[];
    videoDurationSeconds?: number;
  };
  runStudy?: boolean;
  study?: {
    pipelineType?: PipelineType;
    targetingPresetId?: string;
    targetingGroups?: unknown[];
    callbackUrl?: string;
    callbackSecret?: string;
  };
  externalCustomerId?: string;
  externalWorkspaceId?: string;
  externalCampaignId?: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
  callbackSecret?: string;
}

export interface ManagedBatchAsset {
  stimulusId: string;
  type: "image_ad" | "static_image" | "video_ad" | string;
  mediaUrl: string;
  headline?: string;
  primaryText?: string;
  metadata?: Record<string, unknown>;
  generation?: Record<string, unknown>;
  createdAt?: string;
}

export interface ManagedBatchStatus {
  batchId: string;
  status: ManagedBatchStatusValue;
  productId: string;
  estimatedCredits: {
    base: number;
    markupPercent: number;
    markup: number;
    total: number;
    breakdown: Record<string, unknown>;
  };
  requestedAssets: ManagedBatchRequest["requestedAssets"] & {
    staticCount: number;
    videoCount: number;
  };
  externalCustomerId?: string | null;
  externalWorkspaceId?: string | null;
  externalCampaignId?: string | null;
  staticGenerationRunIds: string[];
  videoGenerationRunIds: string[];
  studyIds: string[];
  assets: ManagedBatchAsset[];
  progress: {
    requestedCount: number;
    completedCount: number;
    failedCount: number;
    remainingCount: number;
  };
  error?: {
    message: string;
    code?: string;
    at?: string;
  };
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Stimulus {
  id: string;
  orgId?: string;
  productId?: string;
  name: string;
  type: StimulusType;
  mediaUrl?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  script?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Study {
  id: string;
  name: string;
  objective?: StudyObjective;
  pipelineType?: PipelineType;
  productId: string;
  stimulusIds: string[];
  status: StudyStatus;
  runsPerPersonaPerStimulus?: number;
  personaSample?: { enabled: boolean; size: number };
  createdAt: string;
  updatedAt: string;
}

export interface SamplingStatus {
  studyId: string;
  status: StudyStatus;
  currentStep: string | null;
  progressPercent: number;
  elapsedSeconds: number;
  currentStepElapsedSeconds: number | null;
  failure?: { step: string; error: string | null; failedAt: string | null };
}

export interface SignedUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  objectName: string;
  expiresAt: string;
}

export interface NelosClientOptions {
  apiKey: string;
  baseUrl: string;
}

type QueryValue = string | number | boolean | undefined | null;
type RequestHeaders = Record<string, string>;

export class NelosClient {
  private headers: RequestHeaders;
  private baseUrl: string;

  constructor({ apiKey, baseUrl }: NelosClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: RequestHeaders
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { ...this.headers, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message || `HTTP ${res.status}`;
      throw new Error(`[Nelos API] ${method} ${path}: ${msg}`);
    }
    return json.data as T;
  }

  private query(params?: Record<string, QueryValue>): string {
    if (!params) return "";
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        qs.set(key, String(value));
      }
    }
    const value = qs.toString();
    return value ? `?${value}` : "";
  }

  private get = <T>(path: string) => this.request<T>("GET", path);
  private post = <T>(path: string, body: unknown, headers?: RequestHeaders) =>
    this.request<T>("POST", path, body, headers);
  private patch = <T>(path: string, body: unknown) => this.request<T>("PATCH", path, body);
  private put = <T>(path: string, body: unknown) => this.request<T>("PUT", path, body);
  private del = <T>(path: string) => this.request<T>("DELETE", path);

  products = {
    list: () => this.get<{ count: number; products: Product[] }>("/api/products"),
    get: (id: string) => this.get<Product>(`/api/products/${id}`),
    create: (data: ProductInput & { name: string; description: string }) =>
      this.post<Product>("/api/products", data),
    update: (id: string, data: Partial<ProductInput>) =>
      this.put<Product>(`/api/products/${id}`, data),
    delete: (id: string) => this.del<{ id: string }>(`/api/products/${id}`),
    extractBasics: (sourceUrl: string) =>
      this.post<unknown>("/api/products/extract-basics", { sourceUrl }),
    startBrandImport: (id: string, sourceUrl: string) =>
      this.post<{ importId: string; status: string }>(
        `/api/products/${id}/brand-imports`,
        { sourceUrl }
      ),
    getBrandImport: (id: string, importId: string) =>
      this.get<unknown>(`/api/products/${id}/brand-imports/${importId}`),
    applyBrandImport: (id: string, importId: string, fields: Record<string, boolean>) =>
      this.post<Product>(`/api/products/${id}/brand-imports/${importId}/apply`, { fields }),
  };

  managedBatches = {
    create: (data: ManagedBatchRequest, idempotencyKey?: string) =>
      this.post<ManagedBatchStatus>(
        "/api/v1/managed-batches",
        data,
        idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
      ),

    get: (batchId: string) =>
      this.get<ManagedBatchStatus>(`/api/v1/managed-batches/${batchId}`),

    list: (params?: { productId?: string; limit?: number }) =>
      this.get<{ count: number; batches: ManagedBatchStatus[] }>(
        `/api/v1/managed-batches${this.query(params)}`
      ),

    pollUntilComplete: async (
      batchId: string,
      options?: { intervalMs?: number; onProgress?: (status: ManagedBatchStatus) => void }
    ): Promise<ManagedBatchStatus> => {
      const interval = options?.intervalMs ?? 10_000;
      while (true) {
        const status = await this.managedBatches.get(batchId);
        options?.onProgress?.(status);
        if (status.status === "completed") return status;
        if (status.status === "failed" || status.status === "canceled") {
          throw new Error(`Managed batch ${status.status}: ${status.error?.message || batchId}`);
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    },
  };

  staticGenerations = {
    list: () => this.get<unknown>("/api/generations/static"),
    create: (data: {
      productId?: string;
      stimulusIds?: string[];
      useBrandKit?: boolean;
      numOptions?: number;
      copyVerbosity?: "short" | "medium" | "long" | string;
    }) => this.post<unknown>("/api/generations/static", data),
    get: (id: string) => this.get<unknown>(`/api/generations/static/${id}`),
    eventsUrl: (id: string) => `${this.baseUrl}/api/generations/static/${id}/events`,
    updateConcept: (id: string, conceptId: string, data: Record<string, unknown>) =>
      this.patch<unknown>(`/api/generations/static/${id}/concepts/${conceptId}`, data),
    render: (
      id: string,
      data: {
        conceptIds: string[];
        aspectRatios?: AspectRatio[];
        quality?: StaticQuality;
        visualExecutionsPerCombo?: number;
      }
    ) => this.post<unknown>(`/api/generations/static/${id}/render`, data),
  };

  videoGenerations = {
    options: () => this.get<unknown>("/api/generations/video/options"),
    list: () => this.get<unknown>("/api/generations/video"),
    create: (data: {
      productId: string;
      aspectRatio?: AspectRatio;
      durationSeconds?: number;
      videoMode?: VideoMode;
      creativeBrief?: string;
      queuePlanning?: boolean;
    }) => this.post<unknown>("/api/generations/video", data),
    get: (id: string) => this.get<unknown>(`/api/generations/video/${id}`),
    delete: (id: string) => this.del<unknown>(`/api/generations/video/${id}`),
    eventsUrl: (id: string) => `${this.baseUrl}/api/generations/video/${id}/events`,
    updatePlanning: (id: string, data: Record<string, unknown>) =>
      this.patch<unknown>(`/api/generations/video/${id}/planning`, data),
    generateScript: (id: string, data?: Record<string, unknown>) =>
      this.post<unknown>(`/api/generations/video/${id}/script/generate`, data ?? {}),
    updateScript: (id: string, data: Record<string, unknown>) =>
      this.patch<unknown>(`/api/generations/video/${id}/script`, data),
    generateStoryboard: (id: string, data?: Record<string, unknown>) =>
      this.post<unknown>(`/api/generations/video/${id}/storyboard/generate`, data ?? {}),
    generateVoiceover: (id: string, data?: Record<string, unknown>) =>
      this.post<unknown>(`/api/generations/video/${id}/voiceover/generate`, data ?? {}),
    queueAssets: (id: string, data?: Record<string, unknown>) =>
      this.post<unknown>(`/api/generations/video/${id}/assets`, data ?? {}),
    export: (id: string, data?: Record<string, unknown>) =>
      this.post<unknown>(`/api/generations/video/${id}/export`, data ?? {}),
    plans: {
      list: () => this.get<unknown>("/api/generations/video/plans"),
      create: (data: Record<string, unknown>) =>
        this.post<unknown>("/api/generations/video/plans", data),
      get: (planId: string) => this.get<unknown>(`/api/generations/video/plans/${planId}`),
      update: (planId: string, data: Record<string, unknown>) =>
        this.patch<unknown>(`/api/generations/video/plans/${planId}`, data),
      createRun: (planId: string, data: Record<string, unknown>) =>
        this.post<unknown>(`/api/generations/video/plans/${planId}/runs`, data),
    },
  };

  stimuli = {
    list: (params?: { studyId?: string; type?: StimulusType }) =>
      this.get<{ count: number; stimuli: Stimulus[] }>(`/api/stimuli${this.query(params)}`),
    get: (id: string) => this.get<Stimulus>(`/api/stimuli/${id}`),
    create: (data: {
      name: string;
      type: StimulusType;
      mediaUrl?: string;
      primaryText?: string;
      headline?: string;
      description?: string;
      script?: string;
      productId?: string;
      metadata?: Record<string, unknown>;
    }) => this.post<Stimulus>("/api/stimuli", data),
    update: (id: string, data: Omit<Partial<Stimulus>, "type" | "id">) =>
      this.put<Stimulus>(`/api/stimuli/${id}`, data),
    delete: (id: string) => this.del<{ id: string }>(`/api/stimuli/${id}`),
  };

  studies = {
    list: (params?: { status?: StudyStatus; objective?: StudyObjective; type?: string }) =>
      this.get<{ count: number; studies: Study[] }>(`/api/studies${this.query(params)}`),
    get: (id: string) => this.get<Study>(`/api/studies/${id}`),
    create: (data: {
      productId: string;
      stimulusIds?: string[];
      name?: string;
      objective?: StudyObjective;
      pipelineType?: PipelineType;
      runsPerPersonaPerStimulus?: number;
      personaSample?: { enabled: boolean; size: number };
      targetingPresetId?: string;
      targetingGroups?: unknown[];
      callbackUrl?: string;
      callbackSecret?: string;
      nonUsMarket?: string;
      eligibilityNotes?: string[];
    }) => this.post<Study>("/api/studies", data),
    update: (id: string, data: Partial<Study>) => this.put<Study>(`/api/studies/${id}`, data),
    delete: (id: string) => this.del<{ id: string }>(`/api/studies/${id}`),
    addStimuli: (id: string, stimulusIds: string[]) =>
      this.post<{ study: Study; attachedStimuli: Stimulus[] }>(
        `/api/studies/${id}/stimuli`,
        { stimulusIds }
      ),
    removeStimulus: (id: string, stimulusId: string) =>
      this.del<{ message: string }>(`/api/studies/${id}/stimuli/${stimulusId}`),
    getSamplingConfirmation: (id: string) =>
      this.get<Record<string, unknown>>(`/api/studies/${id}/sampling/confirm`),
    startSampling: (id: string, confirmation: Record<string, unknown>) =>
      this.post(`/api/studies/${id}/sampling/start`, { confirm: confirmation }),
    getSamplingStatus: (id: string) =>
      this.get<SamplingStatus>(`/api/studies/${id}/sampling/status`),
    eventsUrl: (id: string) => `${this.baseUrl}/api/studies/${id}/sampling/events`,
    pollUntilComplete: async (
      id: string,
      options?: { intervalMs?: number; onProgress?: (status: SamplingStatus) => void }
    ): Promise<SamplingStatus> => {
      const interval = options?.intervalMs ?? 10_000;
      while (true) {
        const status = await this.studies.getSamplingStatus(id);
        options?.onProgress?.(status);
        if (status.status === "completed") return status;
        if (status.status === "failed") {
          throw new Error(`Study failed at step '${status.failure?.step}': ${status.failure?.error}`);
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    },
    getRankingResults: (id: string) => this.get<unknown>(`/api/studies/${id}/results/ranking`),
    getThemeResults: (id: string) => this.get<unknown>(`/api/studies/${id}/results/themes`),
    getDemoResults: (id: string) => this.get<unknown>(`/api/studies/${id}/results/demos`),
    getSegmentResults: (id: string) => this.get<unknown>(`/api/studies/${id}/results/segments`),
    getGeoResults: (id: string) => this.get<unknown>(`/api/studies/${id}/results/geo`),
  };

  uploads = {
    sign: (fileName: string, contentType: string) =>
      this.post<SignedUploadResponse>("/api/uploads/sign", { fileName, contentType }),
    uploadFile: async (file: Blob, fileName: string, contentType: string): Promise<string> => {
      const { uploadUrl, publicUrl } = await this.uploads.sign(fileName, contentType);
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      return publicUrl;
    },
  };

  billing = {
    subscription: () => this.get<unknown>("/api/billing/subscription"),
    transactions: (params?: { page?: number; limit?: number }) =>
      this.get<unknown>(`/api/billing/transactions${this.query(params)}`),
    checkout: (plan: "starter" | "pro") => this.post<unknown>("/api/billing/checkout", { plan }),
    addon: (data: Record<string, unknown>) => this.post<unknown>("/api/billing/addon", data),
    portal: () => this.post<unknown>("/api/billing/portal", {}),
  };

  health = () => this.get<{ status: string; timestamp: string; uptime: number }>("/health");
}

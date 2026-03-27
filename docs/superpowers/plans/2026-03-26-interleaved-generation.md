# Interleaved Generation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the generation processor to generate, process, and save each image to DB before starting the next, so partial failures preserve already-generated images.

**Architecture:** Replace `generateImages()` (bulk, returns `Buffer[]`) with `generateSingleImage()` (returns one `Buffer`). The generation processor merges its two separate loops (generate-all, then upload-all) into one interleaved loop. The inpaint processor already interleaves and needs no changes.

**Tech Stack:** TypeScript, Gemini REST API, Sharp, Prisma, BullMQ

---

### Task 1: Replace `generateImages` with `generateSingleImage` in gemini.service.ts

**Files:**
- Modify: `worker/src/services/gemini.service.ts:62-152`

- [ ] **Step 1: Replace the interface and function**

Remove `GeminiGenerateParams` and `generateImages()`. Replace with:

```typescript
export interface GenerateSingleImageParams {
  prompt: string;
  referenceImage?: Buffer;
  modelId: string;
  config?: GeminiImageConfig;
}

export async function generateSingleImage({
  prompt,
  referenceImage,
  modelId,
  config,
}: GenerateSingleImageParams): Promise<Buffer> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

  const parts: Array<Record<string, unknown>> = [];

  if (referenceImage) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: referenceImage.toString("base64"),
      },
    });
  }

  parts.push({ text: prompt });

  const generationConfig: Record<string, unknown> = {
    responseModalities: ["IMAGE", "TEXT"],
  };

  if (config?.aspectRatio || config?.imageSize) {
    const imageConfig: Record<string, string> = {};
    if (config.aspectRatio) imageConfig.aspectRatio = config.aspectRatio;
    if (config.imageSize) imageConfig.imageSize = config.imageSize;
    generationConfig.imageConfig = imageConfig;
  }

  if (config?.thinkingLevel) {
    generationConfig.thinkingConfig = { thinkingLevel: config.thinkingLevel };
  }

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig,
  };

  let res: Response;
  try {
    res = await fetch(`${geminiEndpoint(modelId)}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[gemini] fetch failed for model ${modelId}:`, err);
    throw new Error(
      "Could not reach the image generation service. Please try again.",
      { cause: err },
    );
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error(`[gemini] HTTP ${res.status} for model ${modelId}:`, errBody);
    throw new GeminiApiError(res.status);
  }

  const data = (await res.json()) as GeminiResponse;
  const buffers = extractImageBuffers(data);
  if (buffers.length === 0) {
    throw new Error(NO_IMAGES_MESSAGE);
  }
  return buffers[0];
}
```

- [ ] **Step 2: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: FAIL — `generation.processor.ts` still imports `generateImages`

- [ ] **Step 3: Commit**

```bash
git add worker/src/services/gemini.service.ts
git commit -m "refactor: replace generateImages with generateSingleImage"
```

---

### Task 2: Interleave generation + upload in generation.processor.ts

**Files:**
- Modify: `worker/src/processors/generation.processor.ts:1-170`

- [ ] **Step 1: Update import**

Change line 5 from:
```typescript
import { generateImages as geminiGenerate } from "../services/gemini.service.js";
```
to:
```typescript
import { generateSingleImage } from "../services/gemini.service.js";
```

- [ ] **Step 2: Remove `dispatchGenerate` function**

Delete the `dispatchGenerate` function (lines 15-25):
```typescript
async function dispatchGenerate(
  model: string,
  prompt: string,
  count: number,
  referenceImage?: Buffer
): Promise<Buffer[]> {
  const geminiModelId = GEMINI_MODEL_IDS[model];
  if (!geminiModelId) throw new Error(`Unknown model: ${model}`);
  const config = GEMINI_MODEL_CONFIG[model];
  return geminiGenerate({ prompt, count, referenceImage, modelId: geminiModelId, config });
}
```

- [ ] **Step 3: Update totalSteps calculation**

Change `stepsPerImage` to include the generate step:
```typescript
  // Quick: generate + upload = 2. Others: generate + upscale + crop + upload = 4
  const hasRef = !!referenceImageKey;
  const stepsPerImage = model === "quick" ? 2 : 4;
  const totalSteps = (hasRef ? 1 : 0) + imageCount * stepsPerImage;
  let step = 0;
```

- [ ] **Step 4: Replace the generate-all + upload-all with interleaved loop**

Replace everything from the reference image download through the end of the upload loop (roughly lines 94-166) with:

```typescript
    const geminiModelId = GEMINI_MODEL_IDS[model];
    if (!geminiModelId) throw new Error(`Unknown model: ${model}`);
    const geminiConfig = GEMINI_MODEL_CONFIG[model];
    const isQuick = model === "quick";

    let refBuffer: Buffer | undefined;
    if (referenceImageKey) {
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: "Downloading reference image...", step, totalSteps });
      refBuffer = job.data.flattenedImageDataUrl
        ? Buffer.from(job.data.flattenedImageDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64")
        : await downloadImage(referenceImageKey);
    }

    if (!job.data.isExtension) {
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          prompt: systemPrompt,
          userPrompt,
          descriptionSnapshot: descriptions ? JSON.parse(JSON.stringify(descriptions)) : undefined,
          aiModelId: geminiModelId,
        },
      });
    }

    for (let i = 0; i < imageCount; i++) {
      // Generate
      step++;
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.PROGRESS,
        message: `Generating image ${i + 1}/${imageCount}...`,
        step,
        totalSteps,
      });
      const rawImage = await generateSingleImage({
        prompt: fullPrompt,
        referenceImage: refBuffer,
        modelId: geminiModelId,
        config: geminiConfig,
      });

      // Process
      let finalImage: Buffer;
      let imageWidth: number;
      let imageHeight: number;

      if (isQuick) {
        finalImage = rawImage;
        const metadata = await sharp(finalImage).metadata();
        imageWidth = metadata.width ?? 0;
        imageHeight = metadata.height ?? 0;
      } else {
        step++;
        await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Upscaling image ${i + 1}/${imageCount}...`, step, totalSteps });
        const upscaled = await upscaleImage(rawImage);

        step++;
        await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Cropping image ${i + 1} to KDP dimensions...`, step, totalSteps });
        finalImage = await cropToKDP(upscaled);
        imageWidth = KDP.width;
        imageHeight = KDP.height;
      }

      // Upload + save
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Uploading image ${i + 1}/${imageCount}...`, step, totalSteps });
      const storageKey = await uploadImage(finalImage, `projects/${projectId}`);

      await prisma.generatedImage.create({
        data: {
          generationId,
          storageKey,
          width: imageWidth,
          height: imageHeight,
          selected: false,
        },
      });
    }
```

Note: The success path after this loop (prisma update to COMPLETED + publishProgress COMPLETED) stays unchanged.

- [ ] **Step 5: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add worker/src/processors/generation.processor.ts
git commit -m "refactor: interleave generation + upload per image for partial failure support"
```

---

### Task 3: CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Generation Pipeline section**

Find any remaining references to batch generation or `generateImages()`. Update to reflect:
- `generateSingleImage()` replaces `generateImages()` in `worker/src/services/gemini.service.ts`
- Generation processor interleaves: generate → process → upload → save per image
- Inpaint processor already interleaved (no change)
- If any image fails mid-sequence, previously saved images trigger Path 2 (partial success with COMPLETED status + errorMessage)

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for interleaved generation pipeline"
```

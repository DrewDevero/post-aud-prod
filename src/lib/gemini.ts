import { GoogleGenAI, createUserContent } from "@google/genai";
import { fal } from "@fal-ai/client";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
fal.config({ credentials: process.env.FAL_KEY! });

const PREFIX = "[gemini]";

function log(...args: unknown[]) {
  console.log(PREFIX, ...args);
}

function logError(...args: unknown[]) {
  console.error(PREFIX, ...args);
}

async function fileToInlinePart(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  log(`fileToInlinePart: name=${file.name} type=${file.type} size=${buffer.byteLength} bytes`);
  return {
    inlineData: {
      mimeType: file.type || "image/png",
      data: buffer.toString("base64"),
    },
  };
}

async function urlToInlinePart(url: string) {
  log(`urlToInlinePart: fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    logError(`urlToInlinePart: fetch failed status=${res.status} statusText=${res.statusText} url=${url}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/png";
  log(`urlToInlinePart: status=${res.status} contentType=${contentType} size=${buffer.byteLength} bytes`);
  return {
    inlineData: {
      mimeType: contentType,
      data: buffer.toString("base64"),
    },
  };
}

/**
 * Generate an image using Gemini given character files/URLs, outfit files/URLs,
 * a scene image URL, and a prompt. Returns a fal.storage URL of the result.
 */
export async function generateImageFromFiles(opts: {
  characterFiles: File[];
  outfitFiles: File[];
  sceneImageUrl: string;
  prompt: string;
}): Promise<string> {
  log("generateImageFromFiles:", {
    characterFiles: opts.characterFiles.length,
    outfitFiles: opts.outfitFiles.length,
    sceneImageUrl: opts.sceneImageUrl,
    prompt: opts.prompt,
  });

  const characterParts = await Promise.all(
    opts.characterFiles.map(fileToInlinePart),
  );
  const outfitParts = await Promise.all(
    opts.outfitFiles.map(fileToInlinePart),
  );
  const scenePart = await urlToInlinePart(opts.sceneImageUrl);

  const totalParts = characterParts.length + outfitParts.length + 1;
  log(`generateImageFromFiles: prepared ${totalParts} image parts`);

  return callGeminiAndUpload(
    [...characterParts, ...outfitParts, scenePart],
    opts.prompt,
  );
}

export async function generateImageFromUrls(opts: {
  characterUrls: string[];
  outfitUrls: string[];
  sceneImageUrl: string;
  prompt: string;
}): Promise<string> {
  log("generateImageFromUrls:", {
    characterUrls: opts.characterUrls,
    outfitUrls: opts.outfitUrls,
    sceneImageUrl: opts.sceneImageUrl,
    prompt: opts.prompt,
  });

  const allUrls = [
    ...opts.characterUrls,
    ...opts.outfitUrls,
    opts.sceneImageUrl,
  ];
  const parts = await Promise.all(allUrls.map(urlToInlinePart));

  log(`generateImageFromUrls: prepared ${parts.length} image parts`);

  return callGeminiAndUpload(parts, opts.prompt);
}

interface InlinePart {
  inlineData: { mimeType: string; data: string };
}

async function callGeminiAndUpload(
  imageParts: InlinePart[],
  prompt: string,
): Promise<string> {
  const model = "gemini-3.1-flash-image-preview";
  const fullPrompt = `${prompt}. Output a single 16:9 aspect ratio image.`;

  log("callGeminiAndUpload: sending request", {
    model,
    prompt: fullPrompt,
    imagePartsCount: imageParts.length,
    imagePartSizes: imageParts.map((p) => ({
      mimeType: p.inlineData.mimeType,
      dataLength: p.inlineData.data.length,
    })),
  });

  const t0 = Date.now();
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: createUserContent([fullPrompt, ...imageParts]),
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });
  } catch (err) {
    logError("callGeminiAndUpload: Gemini API threw", err);
    throw err;
  }
  const geminiMs = Date.now() - t0;

  const candidate = response.candidates?.[0];
  log("callGeminiAndUpload: response received", {
    durationMs: geminiMs,
    candidatesCount: response.candidates?.length ?? 0,
    finishReason: candidate?.finishReason,
    partsCount: candidate?.content?.parts?.length ?? 0,
    partTypes: candidate?.content?.parts?.map((p) => {
      if (p.text) return `text(${p.text.length} chars)`;
      if (p.inlineData) return `inlineData(${p.inlineData.mimeType}, ${p.inlineData.data?.length ?? 0} chars b64)`;
      return `unknown(${Object.keys(p).join(",")})`;
    }),
  });

  const textParts = candidate?.content?.parts?.filter((p) => p.text) ?? [];
  if (textParts.length > 0) {
    log("callGeminiAndUpload: text parts from Gemini:", textParts.map((p) => p.text));
  }

  if (!candidate) {
    logError("callGeminiAndUpload: no candidates in response", JSON.stringify(response, null, 2));
    throw new Error("Gemini returned no candidates");
  }

  const parts = candidate.content?.parts ?? [];
  const imagePart = parts.find(
    (p) => p.inlineData?.mimeType?.startsWith("image/"),
  );

  if (!imagePart?.inlineData?.data) {
    logError("callGeminiAndUpload: no image part found", {
      finishReason: candidate.finishReason,
      partsCount: parts.length,
      partSummaries: parts.map((p) => {
        if (p.text) return { type: "text", preview: p.text.slice(0, 200) };
        if (p.inlineData) return { type: "inlineData", mimeType: p.inlineData.mimeType, hasData: !!p.inlineData.data };
        return { type: "other", keys: Object.keys(p) };
      }),
      rawResponse: JSON.stringify(response, null, 2).slice(0, 2000),
    });
    throw new Error(
      `No image was generated by Gemini (finishReason=${candidate.finishReason}, parts=${parts.length})`,
    );
  }

  const { data, mimeType } = imagePart.inlineData as {
    data: string;
    mimeType: string;
  };
  const imageBuffer = Buffer.from(data, "base64");
  log(`callGeminiAndUpload: got image ${mimeType}, ${imageBuffer.byteLength} bytes, uploading to fal`);

  const t1 = Date.now();
  const file = new File([imageBuffer], "generated.png", {
    type: mimeType,
  });
  const url = await fal.storage.upload(file);
  const uploadMs = Date.now() - t1;

  log(`callGeminiAndUpload: uploaded to fal in ${uploadMs}ms → ${url}`);
  return url;
}

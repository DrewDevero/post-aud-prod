import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Initialize the official Gemini SDK
const ai = new GoogleGenAI({});

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        // In a real implementation with valid file blobs:
        // const subjectFile = formData.get("subject") as File;
        // const apparelFile = formData.get("apparel") as File;

        console.log("Orchestrator: Received generation request.");

        if (!process.env.GEMINI_API_KEY) {
            throw new Error("Missing GEMINI_API_KEY in environment variables.");
        }

        // Step 1: Gemini "Brain" analyzes the input intent to construct the pipeline parameters.
        // Here we use Gemini 2.5 Pro as the Orchestrator with Structured Outputs
        const prompt = `
      You are the Orchestrator for a generative AI video pipeline.
      Analyze the physical elements to build a full-body video generation plan.
      Construct a detailed JSON configuration representing the "Memory State" and the highly-detailed 
      positive/negative prompts needed for the Stable Diffusion / Flux visual compositing nodes.
    `;

        console.log("Orchestrator: Consulting Gemini 2.5 Flash...");
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        pipeline_type: { type: "STRING", enum: ["talking_head", "full_body"] },
                        compositing_prompt: { type: "STRING" },
                        compositing_negative_prompt: { type: "STRING" },
                        lighting_context: { type: "STRING" },
                        memory_state: {
                            type: "OBJECT",
                            properties: {
                                emotional_arc: { type: "STRING" },
                                environment_description: { type: "STRING" }
                            }
                        }
                    },
                    required: ["pipeline_type", "compositing_prompt", "compositing_negative_prompt", "lighting_context", "memory_state"]
                }
            }
        });

        const aiPlan = JSON.parse(response.text || "{}");
        console.log("Orchestrator: Gemini generated pipeline plan:", aiPlan);

        // Step 2: Google Vertex AI Generation Pipeline
        // In a full production app, you would use Vertex AI to call Imagen 3 and Veo 2.0
        console.log(`Orchestrator: Dispatching plan to Google Vertex AI`);

        let dispatchStatus = "vertex_generation_started";
        let finalVideoUrl: string | null = null;

        try {
            // ---------------------------------------------------------
            // ACTUAL VERTEX AI IMPLEMENTATION LOGIC
            // ---------------------------------------------------------

            // 1. Authenticate with Google Cloud Vertex AI
            const vertexAi = new GoogleGenAI({
                vertexai: true,
                project: process.env.GOOGLE_CLOUD_PROJECT,
                location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
            });

            // 2. Imagen 3: Generate the Composite Scene
            console.log("Vertex: Generating Scene with Imagen 3...");
            const imageRes = await vertexAi.models.generateImages({
                model: 'imagen-3.0-generate-001',
                prompt: aiPlan.compositing_prompt,
                // Note: Incorporating the subject/apparel images would require uploading to GCS
                // or passing base64. For this hackathon, we'll generate the initial environment
                // based purely on Gemini's highly-detailed compositing descriptions.
                config: {
                    negativePrompt: aiPlan.compositing_negative_prompt,
                    numberOfImages: 1,
                    aspectRatio: "16:9"
                }
            });

            // Extract the generated image as a base64 string and its mimeType to feed to Veo
            const generatedSceneImageBase64 = imageRes.generatedImages?.[0]?.image?.imageBytes;
            const generatedSceneImageMimeType = imageRes.generatedImages?.[0]?.image?.mimeType;

            if (generatedSceneImageBase64) {
                // 3. Veo 2.0: Animate the Scene
                console.log("Vertex: Dispatching Video Generation to Veo 2.0...");

                // Veo 2.0 takes the first frame, and generates video. 
                // Note: generateVideos is a long-running operation in Vertex.
                const videoOperation = await vertexAi.models.generateVideos({
                    model: 'veo-2.0-generate-001',
                    prompt: aiPlan.memory_state.emotional_arc || "A smooth cinematic pan showing the character responding.",
                    image: {
                        imageBytes: generatedSceneImageBase64,
                        mimeType: generatedSceneImageMimeType || "image/jpeg"
                    },
                    config: {
                        fps: 24,
                        durationSeconds: 5,
                        aspectRatio: "16:9"
                    }
                });

                console.log("Vertex AI Video Operation Started:", videoOperation.name);

                // Poll the operation until complete
                let isDone = false;
                let finalVideoOperation = videoOperation;

                while (!isDone) {
                    console.log("Polling Veo 2.0 Status...");
                    // sleep for 5 seconds to avoid rate limits on polling
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    finalVideoOperation = await vertexAi.operations.getVideosOperation({
                        operation: finalVideoOperation
                    });

                    if (finalVideoOperation.done) {
                        isDone = true;
                    }
                }

                if (finalVideoOperation.error) {
                    console.error("Veo 2.0 Generation Error:", finalVideoOperation.error);
                    dispatchStatus = `vertex_error_fallback: ${JSON.stringify(finalVideoOperation.error)}`;
                    finalVideoUrl = null;
                } else {
                    console.log("Veo 2.0 Generation Complete!");
                    // Debugging: Log full response structure to terminal
                    console.dir(finalVideoOperation.response, { depth: null });

                    const videoObj = finalVideoOperation.response?.generatedVideos?.[0]?.video;
                    const gcsUri = videoObj?.uri;
                    const videoBytes = videoObj?.videoBytes;
                    const mimeType = videoObj?.mimeType || "video/mp4";

                    if (videoBytes) {
                        // If model returned raw bytes, use data URI
                        finalVideoUrl = `data:${mimeType};base64,${videoBytes}`;
                        console.log("Using base64 video data from Veo response.");
                    } else if (gcsUri && gcsUri.startsWith("gs://")) {
                        // Convert gs:// bucket/object to public https link
                        const parts = gcsUri.replace("gs://", "").split("/");
                        const bucket = parts[0];
                        const object = parts.slice(1).join("/");
                        finalVideoUrl = `https://storage.googleapis.com/${bucket}/${object}`;
                        console.log("Converted GCS URI to playable URL:", finalVideoUrl);
                    } else {
                        finalVideoUrl = gcsUri || null;
                    }
                    dispatchStatus = "vertex_generation_complete";
                }

            } else {
                console.warn("Imagen 3 generation failed to return an image blob.");
                dispatchStatus = "vertex_error_fallback: no_image_returned";
                finalVideoUrl = null;
            }

        } catch (vertexError: any) {
            console.warn("Vertex AI generation failed:", vertexError);
            dispatchStatus = `vertex_error_fallback: ${vertexError.message || vertexError}`;
            finalVideoUrl = null;
        }

        return NextResponse.json({
            success: true,
            jobId: `PROJ_${Math.floor(Math.random() * 10000)}`,
            status: dispatchStatus,
            plan: aiPlan,
            videoUrl: finalVideoUrl,
            message: "Gemini orchestrated the pipeline via Vertex AI.",
        });

    } catch (error: any) {
        console.error("Orchestration error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to initialize pipeline" },
            { status: 500 }
        );
    }
}

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

        // Step 2: Dispatch to Local ComfyUI
        const comfyUrl = process.env.COMFYUI_SERVER_URL || "http://127.0.0.1:8188";
        console.log(`Orchestrator: Dispatching plan to ComfyUI at ${comfyUrl}`);

        // This is a stubbed payload representing a standard ComfyUI API prompt graph.
        // In reality, this JSON is exported from the ComfyUI UI (Save (API format)).
        // We dynamically inject Gemini's structured output into the graph's nodes.
        const comfyUIGraphPayload = {
            "prompt": {
                "3": {
                    "inputs": {
                        "seed": Math.floor(Math.random() * 10000000),
                        "steps": 20,
                        "cfg": 8,
                        "sampler_name": "euler",
                        "scheduler": "normal",
                        "denoise": 1,
                        // Inject Gemini's positive prompt
                        "positive": aiPlan.compositing_prompt,
                        // Inject Gemini's negative prompt
                        "negative": aiPlan.compositing_negative_prompt
                    },
                    "class_type": "KSampler",
                    "_meta": {
                        "title": "KSampler"
                    }
                },
                // ... (Truncated graph for demonstration purposes)
            }
        };

        let dispatchStatus = "simulated_dispatch";

        try {
            // Attempt to hit local ComfyUI. If it fails (e.g., node isn't running), catch and simulate.
            const comfyRes = await fetch(`${comfyUrl}/prompt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(comfyUIGraphPayload)
            });
            const comfyData = await comfyRes.json();
            console.log("ComfyUI Dispatch Success:", comfyData);
            dispatchStatus = "dispatched_to_node";
        } catch (comfyError) {
            console.warn("ComfyUI node not reachable at", comfyUrl, "- Simulating dispatch for MVP. Ensure ComfyUI is running locally.");
        }

        return NextResponse.json({
            success: true,
            jobId: `PROJ_${Math.floor(Math.random() * 10000)}`,
            status: dispatchStatus,
            plan: aiPlan,
            message: "Gemini successfully orchestrated the pipeline.",
        });

    } catch (error: any) {
        console.error("Orchestration error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to initialize pipeline" },
            { status: 500 }
        );
    }
}

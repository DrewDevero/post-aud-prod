# System Architecture & Memory Systems
*Post-Production App for Audio-Driven Video Generation*

## 1. Suggested Model Pipeline

To achieve the goal of generating an audio-driven video featuring a specific person in specific clothing within a specific environment, a multi-stage pipeline is required. Generative AI models excel at specific tasks, so combining them yields the best results.

### Phase 1: Virtual Try-On (VTON) & Asset Prep
*Goal: Combine the static person and the static clothing.*
*   **IDM-VTON** (Improving Diffusion Models for Authentic Virtual Try-on) or **OOTDiffusion**: These are currently state-of-the-art for taking a person's image and a garment image and seamlessly dressing the person in the garment while maintaining posture and body shape.
*   **Segment Anything Model 2 (SAM 2)**: Used to cleanly extract the person (now in the new clothing) from their original background.

### Phase 2: Scene Generation & Compositing
*Goal: Place the subject into the environment realistically.*
*   **Stable Diffusion XL (SDXL) or Flux.1**: Use these models for image-to-image inpainting or outpainting to place the VTON output into the static scene.
*   **ControlNet / IP-Adapter**: Used in tandem with the diffusion model to match lighting, shadows, and perspective between the subject and the new background. 

### Phase 3: Audio-Driven Video Animation (Full-Body Focus)
*Goal: Animate the static composition using the audio file, focusing on full-body movement and lip-sync.*
*   **Primary Motion**: Image-to-video models (like MimicMotion or customized AnimateDiff workflows in ComfyUI) to animate the full body and scene.
*   **Secondary Pass (Lip-Sync)**: Since full-body models often struggle with precise audio-driven lip-sync, a secondary specialized model (like Wav2Lip or SyncTraj) will be layered specifically on the facial region generated in the first pass.

### Phase 4: Orchestration & "Brain"
*Goal: Manage state, memory, and model interactions.*
*   **Google Gemini 2.5 Pro**: Due to its massive context window (2M+ tokens) and powerful multimodal capabilities, Gemini acts as the central control system. It can analyze the intermediate images to ensure continuity, generate the complex prompts required by the diffusion models, and maintain a JSON-based "Memory State" of the entire narrative/scene.

---

## 2. Deployment & Infrastructure

*   **Frontend & API Gateway**: **Next.js** (App Router) serving the web interface to upload inputs, trigger the pipeline, and view generations.
*   **AI Engine**: **Local ComfyUI Node**. The pipeline will be constructed as a ComfyUI workflow (or series of workflows) and executed via the Next.js backend communicating with the local ComfyUI API endpoint. This avoids high recurring API costs and allows maximum workflow customization for the full-body pipeline.

---

## 3. Scene Generation Strategy

Scene generation isn't just about rendering backgrounds; it's about semantic understanding of the environment and the subject's place within it.

*   **Prompt Engineering via LLM**: The user inputs raw materials (images) and high-level intent. The Orhcestrator (Gemini) vision-analyzes the input environment, identifies light sources, focal points, and mood, and constructs highly detailed technical prompts for Flux/SDXL compositing.
*   **Depth and Spatial Mapping**: By extracting depth maps (via DepthAnything) from the static scene, the pipeline can accurately anchor the person in the 3D space of the 2D image, preventing the "floating" effect.

## 3. Maintaining Continuity

Continuity is the biggest challenge in generative video. We mitigate hallucination and flickering through several techniques:

*   **Seed Locking & IP-Adapters**: When generating variations or moving between frames, utilizing IP-Adapters ensures the character's facial features and clothing textures remain strictly consistent with the reference inputs.
*   **Reference Anchoring**: Every generation step must reference the original VTON output and the original scene image, rather than referencing the *previous* generated frame (which causes degradation over time).
*   **Post-Processing Smoothing**: Use of models like Real-ESRGAN for consistent upscaling and deflickering algorithms on the final video output.

## 4. Context-Aware Memory Systems

To synthesize cohesive videos across multiple scenes or long audio files, the application requires a persistent "Memory" system.

### Memory Architecture
The Orchestrator maintains a structured JSON state document that is continuously fed back into the LLM's context window.

```json
{
  "session_id": "proj_123",
  "character_state": {
    "base_identity_ref": "assets/person_1.jpg",
    "current_clothing_ref": "assets/clothing_2.png",
    "emotional_state": "calm, transitioning to excited based on audio segment 2"
  },
  "environment_state": {
    "current_scene_ref": "assets/scene_cafe.jpg",
    "lighting_condition": "warm, afternoon sun from the left",
    "camera_angle": "medium shot, eye level"
  },
  "timeline": [
    {
      "timestamp_range": "00:00-00:05",
      "audio_segment": "assets/audio_part1.wav",
      "action": "speaking directly to camera",
      "status": "completed"
    }
  ]
}
```

### Feedback Loop
1.  **Analyze**: Before generation, the Orchestrator reviews the Memory State.
2.  **Generate**: It constructs the pipeline arguments (model weights, prompts, audio slices).
3.  **Evaluate**: The Orchestrator visually reviews the output (optional self-correction layer).
4.  **Update**: The Memory State time block is marked complete, and any changes in environment or emotion are logged for the next generation sequence.

"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, Image as ImageIcon, Music, Shirt, Film, Wand2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const AssetCard = ({ title, icon: Icon, description, accept, file, onFileSelect }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        type="file"
        accept={accept}
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => onFileSelect && e.target.files && onFileSelect(e.target.files[0])}
      />
      <motion.div
        onClick={() => fileInputRef.current?.click()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-colors cursor-pointer group overflow-hidden",
          file ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900/80 hover:border-zinc-700"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className={cn(
          "h-16 w-16 rounded-full flex items-center justify-center mb-4 transition-transform",
          file ? "bg-indigo-500/20" : "bg-zinc-900 group-hover:scale-110"
        )}>
          <Icon className={cn("w-8 h-8", file ? "text-indigo-400" : "text-zinc-400 group-hover:text-indigo-400")} />
        </div>
        <h3 className="text-xl font-semibold text-zinc-100 mb-2">{title}</h3>
        <p className={cn("text-sm text-center max-w-[200px] z-10 truncate w-full", file ? "text-indigo-300 font-medium" : "text-zinc-500")}>
          {file ? file.name : description}
        </p>

        {!file && (
          <div className="mt-6 flex items-center text-xs font-medium text-indigo-400 opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
            <Upload className="w-3 h-3 mr-2" />
            Click or drag to upload
          </div>
        )}
      </motion.div>
    </>
  );
}

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [logProgress, setLogProgress] = useState(0);
  const [assets, setAssets] = useState<any>({
    subject: null,
    apparel: null,
    environment: null,
    audio: null,
  });

  const handleFileSelect = (key: string, file: File) => {
    setAssets((prev: any) => ({ ...prev, [key]: file }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setLogProgress(1); // Start progressive log Reveal

    // Simulate progressive log updates driven by the API logic
    setTimeout(() => setLogProgress(2), 1500);
    setTimeout(() => setLogProgress(3), 3500);

    try {
      const formData = new FormData();
      if (assets.subject) formData.append("subject", assets.subject);
      if (assets.apparel) formData.append("apparel", assets.apparel);
      if (assets.environment) formData.append("environment", assets.environment);
      if (assets.audio) formData.append("audio", assets.audio);

      const res = await fetch("/api/orchestrate", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      console.log("Orchestration initialized:", data);

      setTimeout(() => {
        setIsGenerating(false);
        setLogProgress(0);
        alert(`Next.js API route reached sucessfully! Check console.\nJob ID: ${data.jobId}`);
      }, 5500);

    } catch (err) {
      console.error(err);
      setIsGenerating(false);
      setLogProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Background ambient glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />

      <main className="relative max-w-7xl mx-auto px-6 py-20 flex flex-col items-center min-h-screen">

        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20 pt-10"
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-xs font-medium text-zinc-400 mb-8">
            <SparklesIcon className="w-3 h-3 mr-2 text-indigo-400" />
            Gemini 2.5 Pro Orchestration
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-500">
            Synthesize Reality.
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-light leading-relaxed">
            Upload your assets to craft full-body, audio-driven video. Managed by Gemini, rendered in ComfyUI.
          </p>
        </motion.div>

        {/* Asset Upload Grid */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <AssetCard title="Subject" icon={ImageIcon} description="Base image of the person" accept="image/*" file={assets.subject} onFileSelect={(f: File) => handleFileSelect('subject', f)} />
          <AssetCard title="Apparel" icon={Shirt} description="Target clothing (VTON)" accept="image/*" file={assets.apparel} onFileSelect={(f: File) => handleFileSelect('apparel', f)} />
          <AssetCard title="Environment" icon={Film} description="Background scene image" accept="image/*" file={assets.environment} onFileSelect={(f: File) => handleFileSelect('environment', f)} />
          <AssetCard title="Audio Track" icon={Music} description="Voice or ambient sound (.wav)" accept="audio/*,video/*" file={assets.audio} onFileSelect={(f: File) => handleFileSelect('audio', f)} />
        </div>

        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isGenerating}
          onClick={handleGenerate}
          className={cn(
            "group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white rounded-full overflow-hidden transition-all duration-300 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] hover:shadow-[0_0_60px_-15px_rgba(99,102,241,0.7)]",
            isGenerating ? "bg-zinc-800 cursor-wait shadow-none hover:shadow-none" : "bg-zinc-100 text-zinc-900"
          )}
        >
          {!isGenerating && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-20 transition-opacity" />}

          <span className="relative flex items-center">
            {isGenerating ? (
              <>
                <Wand2 className="w-5 h-5 mr-3 animate-spin text-zinc-400" />
                <span className="text-zinc-300">Initializing Pipeline...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 mr-3 text-indigo-600" />
                Generate Sequence
                <ArrowRight className="w-5 h-5 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-indigo-600" />
              </>
            )}
          </span>
        </motion.button>

        {/* Pseudo-timeline / Status */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            className="w-full max-w-3xl mt-20 p-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800">
              <h3 className="text-lg font-medium text-white flex items-center">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse mr-3 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                Orchestration Log
              </h3>
              <span className="text-xs text-zinc-500 font-mono tracking-wider">ID: PROJ_992X</span>
            </div>

            <div className="space-y-5 font-mono text-sm">
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="flex text-zinc-400 items-start"
              >
                <span className="w-24 text-zinc-600 pt-0.5">[00:00:01]</span>
                <span className="text-indigo-400 mr-3 pt-0.5">SYS</span>
                <span>Reading asset blobs and initializing pipeline graph...</span>
              </motion.div>

              {logProgress >= 2 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className="flex text-zinc-400 items-start"
                >
                  <span className="w-24 text-zinc-600 pt-0.5">[00:00:02]</span>
                  <span className="text-pink-400 mr-3 pt-0.5">GEMINI</span>
                  <span>Vision model analyzing Subject and Apparel. Extracting Scene depth maps and semantic lighting context...</span>
                </motion.div>
              )}

              {logProgress >= 3 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className="flex text-zinc-400 items-start"
                >
                  <span className="w-24 text-zinc-600 pt-0.5">[00:00:04]</span>
                  <span className="text-purple-400 mr-3 pt-0.5">NODE</span>
                  <span className="flex items-center">
                    Dispatching VTON task to local ComfyUI worker
                    <span className="ml-2 flex space-x-1">
                      <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

      </main>
    </div>
  );
}

function SparklesIcon(props: any) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

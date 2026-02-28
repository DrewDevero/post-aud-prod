# Scene Placer

A real-time collaborative app for creating AI-generated video sequences. Users upload character photos and outfit images, select scene templates (genres), and generate videos that place their characters into chosen environments—all while working together in shared rooms.

---

## High-Level Workflow

```
Login → Create or Join Sequence → Add Characters & Wardrobe → Select Genre → Render → Download
```

1. **Authenticate** — Choose a test user at `/login`
2. **Start a sequence** — Create a new room or join via sequence ID
3. **Prepare assets** — Add characters (Cast & Crew) and outfits (Wardrobe) to your library
4. **Build the scene** — In the room, add characters and optional outfits to the sequence
5. **Pick a genre** — Select a target scene style (e.g. Noir)
6. **Render** — Run the pipeline: AI composites characters into scene frames, animates them, and merges into a video
7. **Collaborate** — Invite friends, chat in real time, share sequence IDs

---

## Features

### Sequence Rooms
- **Create** — Start a new shared sequence with a unique ID
- **Join** — Enter an existing sequence via ID
- **Live sync** — Server-Sent Events (SSE) broadcast room state to all participants (members, characters, outfits, generation status, chat)

### Asset Management
- **Cast & Crew** (`/crew`) — Upload character images, name them, add them to sequences
- **Wardrobe** (`/wardrobe`) — Upload outfit images, name them, dress characters in scenes
- Assets are stored per user in IndexedDB

### Generation Pipeline
1. **Image generation** — Gemini places characters (and outfits) into scene backgrounds
2. **Video generation** — fal.ai Veo turns each frame into a short video clip
3. **Merge** — fal.ai FFmpeg combines clips into a single video
4. **Genre selection** — Choose target scenes (e.g. Noir); each genre defines background images for compositing

### Collaboration
- **Friends** — Add friends, send room invites
- **Notifications** — Real-time invites; join sequences directly from notification
- **Chat** — In-room messaging during sequence construction
- **Invite** — Invite friends into the current sequence from the room header

### Real-Time
- Room updates via SSE (`/api/rooms/[roomId]/events`)
- Friends list and notifications via SSE
- No polling; all updates pushed from server

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js App Router                           │
├─────────────────────────────────────────────────────────────────────┤
│  Pages                                                                │
│  /           Create or join sequence                                 │
│  /login      Test user selection                                     │
│  /room/[id]  Sequence collaboration, assets, render, chat           │
│  /crew       Character upload & management                           │
│  /wardrobe   Outfit upload & management                             │
├─────────────────────────────────────────────────────────────────────┤
│  Data & State                                                         │
│  room-store      In-memory rooms (members, characters, outfits,      │
│                  generation, messages)                               │
│  character-store IndexedDB (browser) per-user character images        │
│  outfit-store    IndexedDB (browser) per-user outfit images           │
│  friends-store   In-memory friendship graph                          │
│  notification-store In-memory invites                                │
├─────────────────────────────────────────────────────────────────────┤
│  External Services                                                    │
│  Google Gemini  Image generation (character + scene compositing)      │
│  fal.ai        Storage, Veo image-to-video, FFmpeg merge             │
└─────────────────────────────────────────────────────────────────────┘
```

### Auth
- Cookie-based test users (`sp-user`)
- No external identity provider; `TEST_USERS` in `src/lib/auth.ts`

### API Routes
- `POST/GET /api/rooms` — Create room / check existence
- `GET /api/rooms/[roomId]` — Room state
- `GET /api/rooms/[roomId]/events` — SSE stream
- `POST /api/rooms/[roomId]/characters` — Add/remove characters
- `POST /api/rooms/[roomId]/outfits` — Add/remove outfits
- `POST /api/rooms/[roomId]/generate` — Start render pipeline
- `POST /api/rooms/[roomId]/chat` — Send chat message
- `POST /api/rooms/[roomId]/invite` — Invite friend to room
- `GET/POST /api/friends` — Friends list, send request
- `GET /api/friends/events` — SSE friends updates
- `GET /api/notifications/events` — SSE notifications
- `POST /api/notifications/[notifId]` — Accept/decline invite

---

## Setup

```bash
npm install
```

Create `.env`:

```
FAL_KEY=your_fal_api_key
GOOGLE_API_KEY=your_google_gemini_key
```

```bash
npm run dev
```

---

## Tech Stack

- **Framework** — Next.js 16 (App Router)
- **Styling** — Tailwind CSS v4
- **AI** — Google Gemini (image generation), fal.ai (video, merge, storage)
- **State** — In-memory + IndexedDB; SSE for real-time updates

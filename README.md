# Realtime Expression → Video Reaction App

This project demonstrates how to combine OpenAI's Realtime Audio API with a web frontend to detect the current mood of a speaker and respond by playing a corresponding segment of a video. It consists of a small Node.js backend and a static front‑end built with HTML and JavaScript.

## Features

* Streams microphone audio from the browser to OpenAI's Realtime API using WebRTC.
* Classifies the current conversation into one of several expressions: `Funny`, `Interested`, `Agree`, `Disagree`, `Neutral`, `Confused` or `Bored`.
* Plays a preconfigured segment of a video whenever a particular expression is detected.
* Keeps only the last 20 seconds of transcript when requesting classifications to focus on recent context.

## Prerequisites

* **Node.js** (v18 or higher recommended)
* An **OpenAI API key** with access to the Realtime Audio API. You can request access from [OpenAI](https://platform.openai.com/).

## Installation

1. Clone or extract this repository.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root of the project based on the provided `.env.example` and set your OpenAI API key:

   ```env
   OPENAI_API_KEY=sk-your-openai-api-key
   # Optional: override the default port (3001)
   # PORT=3001
   ```

4. Place your reaction video file somewhere in the `public` directory and set the `<source src="…">` in `public/index.html` accordingly. Update the `EXPRESSION_SEGMENTS` mapping in `public/realtime-client.js` to match the timestamps of your video.

## Running the application

Start the backend server:

```bash
npm start
```

By default the backend runs on `http://localhost:3001`. It serves the static front‑end from the `public` folder at the root path. Open your browser to `http://localhost:3001` to load the interface.

## How it works

1. The front‑end requests a short‑lived client secret from the backend by calling `/api/realtime-session`.
2. It establishes a WebRTC connection to the OpenAI Realtime API using that secret and streams microphone audio to the model.
3. Transcription events are displayed in the transcript box and stored in memory for up to 20 seconds.
4. When you click **Classify Now**, the last 20 seconds of transcript are sent to the model in a prompt asking it to return JSON describing the current expression.
5. Once the JSON is parsed, the UI updates to show the label, confidence and reason and then seeks the video to the corresponding segment.

## Customization

* **Reaction video** – Replace the `<source src="">` in `public/index.html` with your own video file. Ensure the file is accessible via the `public` folder.
* **Timestamp mapping** – Edit the `EXPRESSION_SEGMENTS` object in `public/realtime-client.js` to specify which parts of the video correspond to each expression. Values are in seconds.
* **Classification window** – Change the `TRANSCRIPT_WINDOW_SECONDS` constant in `public/realtime-client.js` to control how much recent context to include when asking the model to classify the mood.
* **Auto‑classification** – Currently classification happens only when you click the **Classify Now** button. You could call `classifyNow()` on a timer to automatically classify at regular intervals.

## Deployment to Railway

This app includes a `Dockerfile` that installs FFmpeg for video merging. To deploy to Railway:

1. **Connect your repository** to Railway
2. **Set environment variables** in Railway dashboard:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `FAL_KEY` - Your fal.ai API key (for avatar generation)
   - `PORT` - Optional, defaults to 3001
   - Firebase configuration (if using Firebase features)
3. **Railway will automatically detect the Dockerfile** and build the container with FFmpeg pre-installed
4. The app will be available at your Railway-provided URL

**Note**: FFmpeg is automatically installed via the Dockerfile, so no additional configuration is needed. The server will verify FFmpeg is available on startup.

## Caveats

* Access to the OpenAI Realtime API may require an allowlist or special permissions.
* Playing video automatically might be blocked by browsers unless the user has interacted with the page. A manual classification button and play controls help satisfy autoplay policies.
* The provided mapping of expressions to video segments is just an example. You should adjust it to suit your own video content.
* Video merging uses server-side FFmpeg, which requires sufficient memory and CPU resources on your Railway instance.

Enjoy building and experimenting with Realtime audio and expressive responses!

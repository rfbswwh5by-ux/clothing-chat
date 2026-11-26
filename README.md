# FORME — Personal Fashion Stylist

A zero-configuration Next.js fashion stylist starter. It runs without API keys or environment variables and can be deployed to Vercel as a normal Next.js project.

## What works without setup
- Personal styling chat using a built-in wardrobe-aware outfit suggestion engine.
- Weather lookup through Open-Meteo (no API key); the browser asks for location permission.
- Local date, time, and season awareness.
- Digital closet with photo uploads, editing, filtering, and browser-local persistence.
- Responsive desktop and mobile interface.
- Manual item entry and photo-assisted closet entry.

## Run locally
Install Node.js 20.9 or newer, then run:

```bash
npm install
npm run dev
```

Open http://localhost:3000. No `.env.local` file is required.

## Deploy to Vercel
1. Put this project in a GitHub repository (or upload it through a supported Vercel import flow).
2. Import the project at https://vercel.com/new.
3. Vercel detects Next.js automatically. Click Deploy.
4. No environment variables are required for the built-in mode.

## Optional AI upgrade
If an OpenAI API key is added later as a server-side `OPENAI_API_KEY` environment variable, chat and image/tag recognition use the OpenAI API. Without it, chat uses the built-in outfit suggestion engine and uploaded photos can be saved with details entered/confirmed manually. The no-key mode is functional but is not a generative AI model and cannot automatically read garment tags or identify image contents.

## Important limitations
- Closet records and photos are stored in the current browser only. They do not sync across devices or users. A production multi-user product needs authentication, a database, and image storage.
- Weather location is requested through the browser. If permission is denied, weather may be unavailable.
- Open-Meteo's public forecast endpoint is used for weather; review its current terms and attribution requirements before commercial use.

# HolaAI LiveKit Voice Agent

A Python-based voice agent for the HolaAI Spanish learning app, powered by LiveKit and Google Gemini 2.0 Flash.

## Features

- Real-time voice conversations with AI Spanish tutor
- Automatic speech-to-text transcription
- Natural conversational Spanish practice
- Beginner-friendly (A1-A2 level)

## Prerequisites

- Python 3.10+
- LiveKit Cloud account (or self-hosted LiveKit server)
- Google Gemini API key

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -e .
   ```

3. Copy the environment template and fill in your credentials:
   ```bash
   cp .env.local.example .env.local
   ```

4. Edit `.env.local` with your LiveKit and Gemini credentials.

## Running Locally

```bash
python main.py dev
```

## Deployment

### Option 1: LiveKit Cloud (Recommended)

Install the LiveKit CLI and deploy:

```bash
# Install livekit-cli
brew install livekit-cli  # or see docs for other platforms

# Login to LiveKit Cloud
lk cloud auth

# Deploy the agent
lk app deploy
```

### Option 2: Docker

Build and run the Docker container:

```bash
docker build -t holaai-agent .
docker run --env-file .env.local holaai-agent
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `GOOGLE_API_KEY` | Google Gemini API key |

## How It Works

1. User starts a voice session in the mobile app
2. App connects to a LiveKit room
3. This agent is dispatched to join the room
4. Agent greets the user and begins conversation
5. All speech is transcribed in real-time
6. Gemini 2.0 Flash processes and responds
7. Transcripts are saved to Convex for history

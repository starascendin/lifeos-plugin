import asyncio
from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.plugins import google
from google.genai import types

load_dotenv(dotenv_path=".env.local")


class SpanishTutor(Agent):
    """AI Spanish language tutor for voice conversations."""

    def __init__(self) -> None:
        super().__init__(
            instructions="""You are Bella, a friendly and patient Spanish language tutor.
You help users practice speaking Spanish through natural conversation.

Guidelines:
- Keep responses concise and conversational (2-3 sentences max)
- Speak clearly and at a moderate pace for language learners
- If the user speaks Spanish, respond in Spanish and gently correct any mistakes
- If the user speaks English, respond in Spanish with a brief English translation
- Be encouraging and supportive of their learning journey
- Introduce new vocabulary naturally in conversation
- Use simple grammar appropriate for beginners (A1-A2 level)
- If asked, explain grammar rules simply

Start by greeting the user warmly in Spanish and asking how you can help them practice today."""
        )


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the LiveKit agent."""
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    session = AgentSession(
        llm=google.realtime.RealtimeModel(
            model="gemini-live-2.5-flash-preview-native-audio-dialog",
            voice="Puck",
            temperature=0.8,
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        ),
    )

    await session.start(room=ctx.room, agent=SpanishTutor())

    # Generate initial greeting
    await session.generate_reply(
        instructions="Greet the user warmly in Spanish. Say something like '¡Hola! Soy Bella, tu tutora de español. ¿Cómo puedo ayudarte hoy?' Keep it brief and friendly."
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="holaai-spanish-tutor"))

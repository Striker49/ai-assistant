# 🤖 AI Voice Assistant

**A local AI assistant with:**

🎤 Speech-to-text (Whisper)

🧠 Memory system

🔊 Text-to-speech (TTS)

💬 Conversational AI (OpenRouter)

# 🚀 Setup Instructions

**1. Install Node.js**

Download and install:
👉 https://nodejs.org

(Recommended: Node 18+)

**2. Install dependencies**

In the project folder:

npm install

**3. Setup environment variables**

Create a .env file:

OPENROUTER_API_KEY=your_api_key_here

Get your key from:
👉 https://openrouter.ai

**🎤 Voice Setup**

**4. Install FFmpeg**

Download:
👉 https://ffmpeg.org/download.html

Verify installation:

ffmpeg -version
ffplay -version

**5. Setup Whisper (speech-to-text)**

Clone and build:

git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make

Download a model:

./models/download-ggml-model.sh base.en

Update your config file with:

WHISPER_EXE

WHISPER_MODEL

**6. Configure your microphone (Windows)**

List available devices:

ffmpeg -list_devices true -f dshow -i dummy

Update your config with your microphone name:

MIC_NAME = "audio=Your Microphone Name"

**🔊 Text-to-Speech (TTS)**

You must run a local TTS server before starting the assistant.

Option 1:
tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC

Option 2:
py -3 .\XTTS_server.py

The server should run on:

http://localhost:5002/api/tts

**▶️ Run the Assistant**

Start the assistant:

node assistant.js

**💡 Usage**

Type normally to chat

Use /voice to speak

Type exit to quit

Use remember ... to store memory

**⚠️ Notes**

Make sure the TTS server is running before starting the assistant

Ensure ffmpeg and ffplay are available in your system PATH

The assistant will create /audio and /memory folders automatically

**🛠️ Troubleshooting**

**❌ “ffmpeg not found”**

→ Add FFmpeg to your system PATH

**❌ No audio playback**

→ Check ffplay is installed

**❌ TTS not working**

→ Make sure the server is running on port 5002

**❌ No speech detected**

→ Verify your microphone name in config
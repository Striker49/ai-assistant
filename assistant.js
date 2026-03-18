import OpenAI from "openai";
import readlineSync from "readline-sync";
import fs from "fs";
import dotenv from "dotenv";
import { exec, execFileSync, spawn } from "child_process";

dotenv.config();

const MEMORY_FILE = "memory.json";
const MAX_TURNS = 10;

const WHISPER_EXE = "C:\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe";
const WHISPER_MODEL = "C:\\whisper.cpp\\models\\ggml-base.en.bin";
const AUDIO_FILE = "input.wav";
const MIC_NAME = 'audio=Microphone (HyperX Cloud III Wireless)';

let memory = loadJsonArray(MEMORY_FILE);
let conversationHistory = [];
let busy = false;

function loadJsonArray(path) {
  if (!fs.existsSync(path)) return [];
  try {
    const raw = fs.readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Failed to load ${path}:`, err.message);
    return [];
  }
}

function saveJsonArray(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

function addMemory(note) {
  const entry = {
    note,
    createdAt: new Date().toISOString(),
  };
  memory.push(entry);
  saveJsonArray(MEMORY_FILE, memory);
}

function getRelevantMemories(memories, message) {
  if (!Array.isArray(memories) || memories.length === 0) return [];

  const msgLower = message.toLowerCase();

  return memories.filter((mem) => {
    const memStr = JSON.stringify(mem).toLowerCase();
    return memStr
      .split(/\W+/)
      .some((word) => word.length > 3 && msgLower.includes(word));
  });
}

async function textToAudio(message) {
  const safeMessage = encodeURIComponent(message);
  const response = await fetch(`http://localhost:5002/api/tts?text=${safeMessage}`);

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status} ${response.statusText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  fs.writeFileSync("output.wav", Buffer.from(audioBuffer));
  execFileSync("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", "output.wav"]);
}

async function askAI(message) {
  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "<YOUR_SITE_URL>",
      "X-Title": "<YOUR_SITE_NAME>",
    },
  });

  conversationHistory.push({ role: "user", content: message });

  const relevantMemories = getRelevantMemories(memory, message);

  const systemPrompt = `You are Sébastien's personal AI assistant.
    Maintain context across the conversation — follow-ups continue from the previous exchange.
    ${
      relevantMemories.length > 0
        ? `Relevant memory: ${JSON.stringify(relevantMemories)}`
        : ""
    }`;

    const trimmedHistory = conversationHistory.slice(-MAX_TURNS);

    const completion = await openai.chat.completions.create({
      model: "openrouter/hunter-alpha",
      messages: [
        { role: "system", content: systemPrompt },
        ...trimmedHistory,
      ],
    });

    const reply = completion.choices?.[0]?.message?.content ?? "I couldn't generate a reply.";
    conversationHistory.push({ role: "assistant", content: reply });

    return reply;
  }

function recordAudio(durationMs = 5000) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(AUDIO_FILE)) {
      fs.unlinkSync(AUDIO_FILE);
    }

    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-f", "dshow",
      "-i", MIC_NAME,
      "-ac", "1",
      "-ar", "16000",
      "-t", String(durationMs / 1000),
      "-acodec", "pcm_s16le",
      AUDIO_FILE,
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("error", reject);

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(AUDIO_FILE);
      else reject(new Error(`ffmpeg failed with code ${code}\n${stderr}`));
    });
  });
}

function transcribeAudio(filePath) {
  return new Promise((resolve, reject) => {
    const whisper = spawn(WHISPER_EXE, [
      "-m",
      WHISPER_MODEL,
      "-f",
      filePath,
      "-nt",
    ]);

    let stdout = "";
    let stderr = "";

    whisper.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    whisper.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    whisper.on("error", reject);

    whisper.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Whisper failed with code ${code}`));
      }
    });
  });
}

function cleanReplyForSpeech(reply) {
  return reply.replace(/\*/g, "").trim();
}

async function handleUserInput(userInput) {
  const trimmed = userInput.trim();

  if (!trimmed) return;
  if (trimmed.toLowerCase() === "exit") {
    process.exit(0);
  }

  if (/^remember /i.test(trimmed)) {
    const data = trimmed.replace(/^remember /i, "").trim();
    addMemory(data);
    console.log("🧠 Memory saved.");
    return;
  }

  if (trimmed.toLowerCase() === "open vscode") {
    exec("code");
    console.log("Opening VSCode...");
    return;
  }

  const reply = await askAI(trimmed);
  console.log("\x1b[32mAI:", reply, "\x1b[0m\n");

  await textToAudio(cleanReplyForSpeech(reply));
}

async function listenOnce() {
  console.log("🎤 Speak now...");
  const filePath = await recordAudio(5000);
  console.log("🧠 Transcribing...");

  const transcript = await transcribeAudio(filePath);

  if (!transcript) {
    console.log("No speech detected.");
    return;
  }

  console.log("You said:", transcript);
  await handleUserInput(transcript);
}

async function main() {
  console.log("🤖 AI Assistant started.");
  console.log("Type normally, or use /voice to speak, or 'exit' to quit.");

  while (true) {
    if (busy) continue;

    const userInput = readlineSync.question("> ");

    busy = true;
    try {
      if (userInput.trim() === "/voice") {
        await listenOnce();
      } else {
        await handleUserInput(userInput);
      }
    } catch (err) {
      console.error("Error:", err.message);
    } finally {
      busy = false;
    }
  }
}

main();
import OpenAI from "openai";
import readlineSync from "readline-sync";
import fs, { mkdirSync } from "fs";
import dotenv from "dotenv";
import { exec, execFileSync, spawn } from "child_process";
import { MEMORY_FILE, MAX_TURNS} from "./config.js";
import { loadJsonArray, addMemory, getRelevantMemories } from "./memory.js";
import { recordAudio, transcribeAudio, textToAudio, stopAudio } from "./voice.js";

dotenv.config();

let memory = loadJsonArray(MEMORY_FILE);
let conversationHistory = [];

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "<YOUR_SITE_URL>",
    "X-Title": "<YOUR_SITE_NAME>",
  },
});

async function askAI(message) {

  conversationHistory.push({ role: "user", content: message });
  conversationHistory = conversationHistory.slice(-MAX_TURNS * 2);

  const relevantMemories = getRelevantMemories(memory, message);

  const systemPrompt = `You are Catherine, Sebastien's personal AI assistant.
    Be helpful, natural, and concise.
    Keep responses suitable for speaking out loud.
    Avoid unnecessary formatting.
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
    conversationHistory = conversationHistory.slice(-MAX_TURNS * 2);

    return reply;
  }


function cleanReplyForSpeech(reply) {
  return reply.replace(/\*/g, "").trim();
}


function tryHandlingCommand(userInput) {
  const trimmed = userInput.replace(/\.+$/g, "");
  if (trimmed.toLowerCase() === "exit") {
    process.exit(0);
  }

  if (/^remember\s+/i.test(trimmed.toLowerCase())) {
    const data = trimmed.replace(/^remember\W /i, "").trim();
    addMemory(data);
    console.log("🧠 Memory saved.");
  }

  if (trimmed.toLowerCase() === "open vs code" || trimmed.toLowerCase() === "open vscode") {
    exec("code");
    console.log("Opening VSCode...");
    return true;
  }

}

async function handleUserInput(userInput) {
  const trimmed = userInput.trim();

  if (!trimmed) return;

  stopAudio();

  if (tryHandlingCommand(trimmed)) return;

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

function createfolders() {
  if (!fs.existsSync('audio'))
    fs.mkdirSync('audio');
  if (!fs.existsSync('memory'))
    fs.mkdirSync('memory');
}

async function main() {
  createfolders();
  console.log("🤖 AI Assistant started.");
  console.log("Type normally, or use /voice to speak, or 'exit' to quit.");

  while (true) {
    const userInput = readlineSync.question("> ");

    try {
      if (userInput.trim() === "/voice") {
        await listenOnce();
      } else {
        await handleUserInput(userInput);
      }
    } catch (err) {
      console.error("Error:", err.message);
    }
  }
}

main();
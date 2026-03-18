import OpenAI from "openai";
import readlineSync from "readline-sync";
import fs from "fs";
import dotenv from "dotenv";
import { MEMORY_FILE, MAX_TURNS } from "./config.js";
import { loadJsonArray, addMemory, getRelevantMemories } from "./memory.js";
import { recordAudio, transcribeAudio, textToAudio, stopAudio } from "./voice.js";
import { tools, toolPermissions } from "./tools.js";

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

function buildSystemPrompt(latestUserMessage = "") {
  const relevantMemories = getRelevantMemories(memory, latestUserMessage);

  return `You are Catherine, Sebastien's personal AI assistant.
Be helpful, natural, and concise.
Keep responses suitable for speaking out loud.
Maintain context across the conversation.

You can either:
- answer normally
- or request a tool call when an action is needed

IMPORTANT RULES:
- Never pretend you performed an action if no tool was used.
- When you want to use a tool, reply ONLY with valid JSON.
- Do not wrap the JSON in markdown.
- The JSON format must be exactly:
{"tool":"tool_name","args":{"key":"value"}}
- If no tool is needed, answer normally.
- Prefer using tools when the user asks you to do something on the computer.
- After receiving a tool result, either use another tool or give the final answer.

Available tools:
- open_vscode: Open Visual Studio Code. Args: {}
- open_browser: Open a website in the browser. Args: { "url": "string" }
- open_folder: Open a folder in the file explorer. Args: { "path": "string" }
- read_file: Read a text file from disk. Args: { "path": "string" }
- write_file: Write a text file. Args: { "path": "string", "content": "string" }
- append_file: Append text to a file. Args: { "path": "string", "content": "string" }
- list_files: List files in a directory. Args: { "path": "string" }
- search_files: Search for text inside files in a directory. Args: { "path": "string", "query": "string" }

${
  relevantMemories.length > 0
    ? `Relevant memory: ${JSON.stringify(relevantMemories)}`
    : ""
}`;
}

async function askAIFromHistory(latestUserMessage = "") {
  const systemPrompt = buildSystemPrompt(latestUserMessage);

  const trimmedHistory = conversationHistory.slice(-MAX_TURNS * 2);

  const completion = await openai.chat.completions.create({
    model: "openrouter/hunter-alpha",
    messages: [
      { role: "system", content: systemPrompt },
      ...trimmedHistory,
    ],
  });

  return completion.choices?.[0]?.message?.content ?? "I couldn't generate a reply.";
}

function tryParseToolCall(reply) {
  try {
    const cleaned = reply.trim().replace(/^```json\s*|```$/g, "");
    const parsed = JSON.parse(cleaned);

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.tool === "string" &&
      parsed.args !== undefined
    ) {
      return parsed;
    }
  } catch (e) {}

  return null;
}

function askToolConfirmation(toolName, args) {
  console.log(`⚠️  Tool "${toolName}" wants to run with:`);
  console.log(JSON.stringify(args, null, 2));
  const answer = readlineSync.question("Allow? (y/n): ").trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

async function executeTool(toolName, args) {
  const tool = tools[toolName];
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const permission = toolPermissions[toolName] || "confirm";

  if (permission === "confirm") {
    const allowed = askToolConfirmation(toolName, args);
    if (!allowed) {
      return `User denied permission for tool: ${toolName}`;
    }
  }

  return await tool.execute(args || {});
}

async function handleAgenticTurn(userInput) {
  conversationHistory.push({ role: "user", content: userInput });
  conversationHistory = conversationHistory.slice(-MAX_TURNS * 2);

  for (let i = 0; i < 5; i++) {
    const reply = await askAIFromHistory(userInput);
    const toolCall = tryParseToolCall(reply);

    if (!toolCall) {
      conversationHistory.push({ role: "assistant", content: reply });
      conversationHistory = conversationHistory.slice(-MAX_TURNS * 2);
      return reply;
    }

    try {
      const result = await executeTool(toolCall.tool, toolCall.args);

      conversationHistory.push({
        role: "assistant",
        content: JSON.stringify(toolCall),
      });

      conversationHistory.push({
        role: "system",
        content: `Tool result for ${toolCall.tool}: ${
          typeof result === "string" ? result : JSON.stringify(result)
        }`,
      });

      conversationHistory = conversationHistory.slice(-MAX_TURNS * 2);
    } catch (err) {
      conversationHistory.push({
        role: "system",
        content: `Tool ${toolCall.tool} failed: ${err.message}`,
      });
    }
  }

  const fallback = "I couldn't finish the task.";
  conversationHistory.push({ role: "assistant", content: fallback });
  return fallback;
}

function cleanReplyForSpeech(reply) {
  return reply.replace(/\*/g, "").trim();
}

function tryHandlingCommand(userInput) {
  const trimmed = userInput.replace(/\.+$/g, "").trim();

  if (trimmed.toLowerCase() === "exit") {
    process.exit(0);
  }

  if (/^remember\s+/i.test(trimmed)) {
    const data = trimmed.replace(/^remember\s+/i, "").trim();
    addMemory(data);
    memory = loadJsonArray(MEMORY_FILE);
    console.log("🧠 Memory saved.");
    return true;
  }

  return false;
}

async function handleUserInput(userInput) {
  const trimmed = userInput.trim();
  if (!trimmed) return;

  stopAudio();

  if (tryHandlingCommand(trimmed)) return;

  const finalReply = await handleAgenticTurn(trimmed);
  console.log("\x1b[32mAI:", finalReply, "\x1b[0m\n");
  await textToAudio(cleanReplyForSpeech(finalReply));
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

function createFolders() {
  if (!fs.existsSync("audio")) fs.mkdirSync("audio");
  if (!fs.existsSync("memory")) fs.mkdirSync("memory");
}

async function main() {
  createFolders();
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
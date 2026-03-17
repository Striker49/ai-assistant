import OpenAI from "openai";
import readlineSync from "readline-sync";
import fs, { writeFileSync } from "fs";
import dotenv from "dotenv";
import { exec, execSync } from "child_process";
//import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';

dotenv.config();



// const elevenlabs = new ElevenLabsClient({
//     apiKey: process.env.ELEVENLABS_API_KEY, // Defaults to process.env.ELEVENLABS_API_KEY
// });

// async function textToAudio(message) {
//     const audio = await elevenlabs.textToSpeech.convert(
//         'JBFqnCBsd6RMkjVDRZzb', // voice_id
//         {
//             text: message,
//             modelId: 'eleven_multilingual_v2',
//             outputFormat: 'mp3_44100_128', // output_format
//         }
//     );
//     await play(audio);
// }

async function textToAudio(message) {
    const response = await fetch(`http://localhost:5002/api/tts?text=${message}`);
    const audioBuffer = await response.arrayBuffer();
    writeFileSync("output.wav", Buffer.from(audioBuffer));
    execSync("ffplay -nodisp -autoexit -loglevel quiet output.wav");
}



const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MEMORY_FILE = "memory.json";
const CONVERSATION_FILE = "conversation.json";

// Load memory
function loadMemory() {
    if (!fs.existsSync(MEMORY_FILE)) return {};
    const raw = fs.readFileSync(MEMORY_FILE);
    const memories = JSON.parse(raw);
    return Array.isArray(memories) ? memories : [memories];
}

function loadConversation() {
    if (!fs.existsSync(CONVERSATION_FILE)) return {};
    const raw = fs.readFileSync(CONVERSATION_FILE);
    const conversation = JSON.parse(raw);
    return Array.isArray(conversation) ? conversation : [conversation];
}

// Save memory
function saveMemory(memory) {
    let oldMemory = [];

    if (fs.existsSync(MEMORY_FILE)) {
        const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
        oldMemory = JSON.parse(raw);
        console.log(oldMemory);
        console.log(memory);
        console.log(JSON.stringify(oldMemory, null, 2));
    }
    oldMemory.push(memory);
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(oldMemory, null, 2));
    //fs.appendFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

let memory = loadMemory();
let conversationHistory = [];

// Filter memories by relevance to the current message
function getRelevantMemories(memories, message) {
    if (!memories.length) return [];
    const msgLower = message.toLowerCase();
    return memories.filter(mem => {
        const memStr = JSON.stringify(mem).toLowerCase();
        // Keep a memory if any of its words appear in the message
        return memStr.split(/\W+/).some(word => word.length > 3 && msgLower.includes(word));
    });
}

async function askAI(message) {
  //console.log('prompt', prompt);
  //console.log('AI_API_KEY: ', process.env.OPENROUTER_API_KEY);
  let completion;
  try {
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "<YOUR_SITE_URL>", // Optional. Site URL for rankings on openrouter.ai.
        "X-Title": "<YOUR_SITE_NAME>", // Optional. Site title for rankings on openrouter.ai.
      }
    });

    conversationHistory.push({ role: "user", content: message });
    console.log("conversation history: ", conversationHistory);

    const relevantMemories = getRelevantMemories(memory, message);

    const systemPrompt = `You are Sébastien's personal AI assistant.
      Maintain context across the conversation — follow-ups continue from the previous exchange.${
              relevantMemories.length > 0 ? `\nRelevant memory: ${JSON.stringify(relevantMemories)}` : ""
          }`;

      const MAX_TURNS = 10
      const trimmedHistory = conversationHistory.slice(-MAX_TURNS);
      
      completion = await openai.chat.completions.create({
        model: "openrouter/hunter-alpha",
        messages: [
            {"role": "system", content: systemPrompt},
              ...trimmedHistory
        ],
        
      });
    } catch(e) {
      console.log('Failed to get an answer from the LLM: ', e);
    }
    const reply = completion.choices[0].message.content;
    //console.log('Completion: ', completion.choices[0].message.content);
    conversationHistory.push({ role: "assistant", content: reply});
    return (reply);
}

async function main() {
  console.log("🤖 AI Assistant started. Type 'exit' to quit.");

  while (true) {
    const userInput = readlineSync.question("> ");

    if (userInput === "exit") break;

    if (/^remember /i.test(userInput)) {
        const data = userInput.replace(/^remember /i, "");
        memory.note = data;
        saveMemory(memory);
        console.log("🧠 Memory saved.");
        continue;
    }

    
    if (userInput === "open vscode") {
        exec("code");
        console.log("Opening VSCode...");
        continue;
      }
      
    const reply = await askAI(userInput);

    console.log("\x1b[32mAI:", reply, "\x1b[0m\n");

    const cleanReply = reply.replace(/\*/g, "");
    
    await textToAudio(cleanReply);
  }
}

main();
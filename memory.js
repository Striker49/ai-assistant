import fs from "fs";
import { MEMORY_FILE } from "./config.js";

export function loadJsonArray(path = MEMORY_FILE) {
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

export function saveJsonArray(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

export function addMemory(note) {
const oldMemories = loadJsonArray(MEMORY_FILE);
  const entry = {
    note,
    createdAt: new Date().toISOString(),
  };
  oldMemories.push(entry);
  saveJsonArray(MEMORY_FILE, oldMemories);
}

export function getRelevantMemories(memories, message) {
  if (!Array.isArray(memories) || memories.length === 0) return [];

  const msgLower = message.toLowerCase();

  return memories.filter((mem) => {
    const memStr = JSON.stringify(mem).toLowerCase();
    return memStr
      .split(/\W+/)
      .some((word) => word.length > 3 && msgLower.includes(word));
  });
}
import fs from "fs";
import { AUDIO_FILE, MIC_NAME, WHISPER_EXE, WHISPER_MODEL } from "./config.js";
import { spawn } from "child_process";

let currentAudioPlayer = null;
const OUTPUT_FILE = "audio/output.wav";

export function stopAudio() {
  if (currentAudioPlayer && !currentAudioPlayer.killed) {
    currentAudioPlayer.kill();
    currentAudioPlayer = null;
  }
}

export async function textToAudio(message) {
  const safeMessage = encodeURIComponent(message);
  const response = await fetch(`http://localhost:5002/api/tts?text=${safeMessage}`);

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status} ${response.statusText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  fs.writeFileSync(OUTPUT_FILE, Buffer.from(audioBuffer));

  stopAudio();

  currentAudioPlayer = spawn(
    "ffplay",
    ["-nodisp", "-autoexit", "-loglevel", "quiet", OUTPUT_FILE],
    { stdio: "ignore" }
  );

  currentAudioPlayer.on("close", () => {
    currentAudioPlayer = null;
  });

  currentAudioPlayer.on("error", (err) => {
    console.error("Audio playback error:", err.message);
    currentAudioPlayer = null;
  });
}

export function recordAudio(durationMs = 5000) {
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

export function transcribeAudio(filePath) {
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
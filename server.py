# server.py
from TTS.api import TTS
from flask import Flask, request, send_file
import io

app = Flask(__name__)
tts = TTS("tts_models/en/vctk/vits").to("cuda")
#tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda") #XTTS

@app.route("/api/tts")
def synthesize():
    text = request.args.get("text", "")
    buf = io.BytesIO()
    tts.tts_to_file(
        text=text,
        speaker="p270",
        #speaker="Ana Florence",  # XTTS
        #language="en",
        file_path="output.wav"
    )
    return send_file("output.wav", mimetype="audio/wav")

app.run(port=5002)
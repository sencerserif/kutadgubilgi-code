import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const execAsync = promisify(exec);

interface VoiceBody {
  action: "transcribe";
  audio?: string; // base64
  apiKey?: string;
  provider?: "openai" | "local";
  language?: string;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    // FormData upload (browser recording)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File | null;
      const apiKey = formData.get("apiKey") as string | null;
      const useOpenAI = formData.get("provider") === "openai" && apiKey;
      const language = (formData.get("language") as string) ?? "tr-TR";

      if (!audioFile) {
        return NextResponse.json({ error: "Audio dosyası gerekli" }, { status: 400 });
      }

      const buffer = Buffer.from(await audioFile.arrayBuffer());

      // OpenAI Whisper API (en iyi kalite)
      if (useOpenAI) {
        try {
          const whisperResult = await transcribeWithOpenAI(buffer, apiKey!, language, audioFile.name);
          return NextResponse.json({
            text: whisperResult.text,
            provider: "openai",
            language: whisperResult.language,
            supported: true,
          });
        } catch (err) {
          return NextResponse.json({
            text: "",
            warning: `OpenAI Whisper hatası: ${err instanceof Error ? err.message : "hata"}. Local fallback deneniyor...`,
            supported: false,
          });
        }
      }

      // Local fallback
      return await transcribeLocal(buffer, language);
    }

    // JSON body (base64)
    const body: VoiceBody = await req.json();
    if (body.action === "transcribe" && body.audio) {
      const buffer = Buffer.from(body.audio, "base64");
      if (body.provider === "openai" && body.apiKey) {
        try {
          const result = await transcribeWithOpenAI(buffer, body.apiKey, body.language ?? "tr-TR", "audio.webm");
          return NextResponse.json({ text: result.text, provider: "openai", supported: true });
        } catch (err) {
          return NextResponse.json({
            text: "",
            warning: `Whisper hatası: ${err instanceof Error ? err.message : "hata"}`,
            supported: false,
          });
        }
      }
      return await transcribeLocal(buffer, body.language ?? "tr-TR");
    }

    return NextResponse.json({ error: "Bilinmeyen action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// OpenAI Whisper API (whisper-1 modeli - Türkçe destekli)
async function transcribeWithOpenAI(
  audioBuffer: Buffer,
  apiKey: string,
  language: string,
  filename: string
): Promise<{ text: string; language: string }> {
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: "audio/webm" });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-1");
  formData.append("language", language.split("-")[0]); // tr-TR → tr
  formData.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    text: data.text ?? "",
    language: data.language ?? language,
  };
}

// Local transcription (Python speech_recognition veya system whisper)
async function transcribeLocal(
  audioBuffer: Buffer,
  language: string
): Promise<{ text: string; supported: boolean; warning?: string }> {
  const tmpDir = "/tmp/voice";
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `audio-${Date.now()}.webm`);
  await fs.writeFile(tmpPath, audioBuffer);

  // ffmpeg ile wav'a çevir
  const wavPath = tmpPath.replace(".webm", ".wav");
  try {
    await execAsync(`ffmpeg -y -i ${tmpPath} -ar 16000 -ac 1 ${wavPath} 2>&1`);
  } catch {
    // ffmpeg yoksa devam et
  }

  const audioInputPath = (await fs.stat(wavPath).catch(() => null)) ? wavPath : tmpPath;

  // Python speech_recognition dene
  const script = `
import sys
try:
    import speech_recognition as sr
    r = sr.Recognizer()
    with sr.AudioFile("${audioInputPath}") as source:
        audio = r.record(source)
    try:
        text = r.recognize_google(audio, language="${language}")
        print(text)
    except sr.UnknownValueError:
        print("NO_SPEECH")
    except Exception as e:
        print(f"ERROR:{e}", file=sys.stderr)
except ImportError:
    print("NO_MODULE", file=sys.stderr)
    sys.exit(1)
`;

  const scriptPath = path.join(tmpDir, "transcribe.py");
  await fs.writeFile(scriptPath, script);

  try {
    // Python3 var mı?
    await execAsync("which python3");
    const result = await execAsync(`python3 ${scriptPath}`, { timeout: 20000 });

    if (result.stderr.includes("NO_MODULE")) {
      return {
        text: "",
        supported: false,
        warning: "Python speech_recognition kurulu değil. pip install SpeechRecognition pydub kurun, veya OpenAI API key ekleyip Whisper kullanın.",
      };
    }

    const text = result.stdout.trim();
    if (text === "NO_SPEECH") {
      return { text: "", supported: true, warning: "Konuşma algılanamadı" };
    }

    return { text, supported: true };
  } catch (err) {
    const e = err as { stderr?: string };
    return {
      text: "",
      supported: false,
      warning: `Ses tanıma başarısız. Python3 veya ffmpeg kurulu olmayabilir. OpenAI API key ekleyip Whisper kullanın. Hata: ${e.stderr ?? "bilinmeyen"}`,
    };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
    await fs.unlink(wavPath).catch(() => {});
    await fs.unlink(scriptPath).catch(() => {});
  }
}

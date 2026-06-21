"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Volume2, VolumeX, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";

export function VoiceButton({
  onTranscript,
  speakText,
}: {
  onTranscript?: (text: string) => void;
  speakText?: string;
}) {
  const {
    isListening,
    setListening,
    isSpeaking,
    setSpeaking,
    voiceSettings,
    settings,
  } = useStore();

  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (speakText && settings.autoSpeak) {
      speak(speakText);
    }
  }, [speakText, settings.autoSpeak]);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Tarayıcı TTS desteklemiyor");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceSettings.sttLanguage;
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    utterance.volume = voiceSettings.volume;
    if (voiceSettings.voiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.voiceURI === voiceSettings.voiceURI);
      if (voice) utterance.voice = voice;
    }
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        await transcribe(audioBlob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setListening(true);
      toast.success("Dinleniyor... (Tekrar tıkla durdur)");
    } catch {
      toast.error("Mikrofon erişimi reddedildi");
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setListening(false);
    setTranscribing(true);
  };

  const transcribe = async (audio: Blob) => {
    const formData = new FormData();
    formData.append("audio", audio, "recording.webm");

    // OpenAI key varsa Whisper kullan
    if (settings.apiKeys.openai) {
      formData.append("provider", "openai");
      formData.append("apiKey", settings.apiKeys.openai);
      formData.append("language", voiceSettings.sttLanguage);
    } else {
      formData.append("language", voiceSettings.sttLanguage);
    }

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.text) {
        onTranscript?.(data.text);
        const providerLabel = data.provider === "openai" ? " (Whisper)" : " (local)";
        toast.success(`Ses tanındı${providerLabel}`);
      } else if (data.warning) {
        toast.warning(data.warning, {
          description: "Ayarlar'dan OpenAI API key ekleyip Whisper kullanabilirsiniz",
        });
      } else {
        toast.error("Ses tanınamadı");
      }
    } catch {
      toast.error("Ses tanıma hatası");
    } finally {
      setTranscribing(false);
    }
  };

  if (!settings.voiceEnabled) return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={isListening || transcribing ? stopListening : startListening}
        title={
          isListening
            ? "Dinlemeyi durdur"
            : transcribing
            ? "Tanınıyor..."
            : "Sesli komut"
        }
      >
        {isListening ? (
          <Square className="h-3.5 w-3.5 text-red-500 animate-pulse" />
        ) : transcribing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
      </Button>

      {settings.apiKeys.openai && (
        <Sparkles
          className="h-3 w-3 text-amber-500"
          title="OpenAI Whisper aktif"
        />
      )}

      {isSpeaking ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={stopSpeaking}
          title="Konuşmayı durdur"
        >
          <VolumeX className="h-3.5 w-3.5 text-primary" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            const text = window.prompt("Söylenecek metni girin:");
            if (text) speak(text);
          }}
          title="Metni seslendir"
        >
          <Volume2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

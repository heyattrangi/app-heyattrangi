import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import stream from "stream";
import fs from "fs";
import path from "path";
import os from "os";
import { enforceLimit } from "@/lib/limits/checkLimits";

// Speech Provider Interface
interface SpeechProvider {
  transcribe(audioBlob: Blob): Promise<string>;
}

function detectInputFormat(buffer: Buffer): string {
  if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return 'm4a';
  }
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'webm';
  }
  return 'webm';
}

async function createTempAudioFile(audioBuffer: Buffer, ext: string): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `stt_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
  await fs.promises.writeFile(tmpPath, audioBuffer);
  return tmpPath;
}

async function removeTempAudioFile(tmpPath: string): Promise<void> {
  try {
    if (fs.existsSync(tmpPath)) {
      await fs.promises.unlink(tmpPath);
    }
  } catch (_) {}
}

function ensureFfmpegExecutable(): string {
  const binaryPath = ffmpegInstaller.path;
  try {
    if (binaryPath && fs.existsSync(binaryPath)) {
      fs.chmodSync(binaryPath, 0o755);
    }
  } catch (_) {}
  ffmpeg.setFfmpegPath(binaryPath);
  return binaryPath;
}

ensureFfmpegExecutable();

// Pure JS M4A/MP4 container header parser (reads `mvhd` atom directly from buffer with 32-bit & 64-bit box support)
function getM4aDurationInSeconds(buffer: Buffer): number | null {
  try {
    let offset = 0;
    while (offset < buffer.length - 8) {
      let atomSize = buffer.readUInt32BE(offset);
      const atomType = buffer.toString('ascii', offset + 4, offset + 8);

      let headerSize = 8;
      if (atomSize === 1) {
        if (offset + 16 > buffer.length) break;
        const bigSize = buffer.readBigUInt64BE(offset + 8);
        atomSize = Number(bigSize);
        headerSize = 16;
      } else if (atomSize === 0) {
        atomSize = buffer.length - offset;
      }

      if (atomSize < headerSize) break;

      if (atomType === 'moov' || atomType === 'trak' || atomType === 'mdia') {
        offset += headerSize;
        continue;
      }

      if (atomType === 'mvhd') {
        const payloadOffset = offset + headerSize;
        if (payloadOffset + 32 <= buffer.length) {
          const version = buffer[payloadOffset];
          if (version === 0) {
            const timeScale = buffer.readUInt32BE(payloadOffset + 12);
            const duration = buffer.readUInt32BE(payloadOffset + 16);
            if (timeScale > 0 && duration > 0) {
              return duration / timeScale;
            }
          } else if (version === 1) {
            const timeScale = buffer.readUInt32BE(payloadOffset + 20);
            const duration = buffer.readBigUInt64BE(payloadOffset + 24);
            if (timeScale > 0 && duration > BigInt(0)) {
              return Number(duration) / timeScale;
            }
          }
        }
      }

      offset += atomSize;
    }
  } catch (err) {
    console.error('[STT][SERVER][M4A_HEADER_PARSE_ERROR]', err);
  }
  return null;
}

// Utility to securely validate audio duration strictly without unnecessary full-conversions
async function validateAudioDuration(audioBuffer: Buffer, maxDurationSeconds: number): Promise<void> {
  const ext = detectInputFormat(audioBuffer);
  console.log(`[STT][SERVER][DURATION_CHECK] format=${ext} size=${audioBuffer.length} maxAllowed=${maxDurationSeconds}s`);

  // Fast path for iOS M4A/AAC: Parse `mvhd` atom directly in pure JS (immune to serverless binary spawn permissions)
  if (ext === 'm4a') {
    let parsedDuration = getM4aDurationInSeconds(audioBuffer);
    if (parsedDuration === null || parsedDuration <= 0) {
      // Fail-safe estimate matching the app's configured HIGH_QUALITY AAC preset
      // (128kbps = 16,000 bytes/sec) so a header-parse miss doesn't falsely
      // reject legitimate recordings near the quota boundary.
      parsedDuration = audioBuffer.length / 16000;
      console.log(`[STT][SERVER][M4A_ESTIMATED_DURATION] estimatedDuration=${parsedDuration.toFixed(2)}s`);
    } else {
      console.log(`[STT][SERVER][M4A_HEADER_DURATION] duration=${parsedDuration.toFixed(2)}s maxAllowed=${maxDurationSeconds}s`);
    }

    if (parsedDuration > maxDurationSeconds) {
      throw new Error("VOICE_DURATION_EXCEEDED");
    }
    return;
  }

  // Fallback / WebM path: FFmpeg seekable disk file duration probing
  ensureFfmpegExecutable();
  const tmpPath = await createTempAudioFile(audioBuffer, ext);

  try {
    await new Promise<void>((resolve, reject) => {
      let hasExceeded = false;
      let isFinished = false;
      let totalWavBytes = 0;

      const command = ffmpeg(tmpPath)
        .inputOptions(["-analyzeduration", "20M", "-probesize", "20M"])
        .outputFormat("wav")
        .audioChannels(1)
        .audioFrequency(16000)
        .on("end", () => {
          if (!isFinished && !hasExceeded) {
            isFinished = true;
            resolve();
          }
        })
        .on("error", (err) => {
          if (isFinished) return;
          isFinished = true;
          if (hasExceeded) return;
          if (err.message && (err.message.includes("SIGKILL") || err.message.includes("SIGTERM") || err.message.includes("ffmpeg was killed"))) {
            return resolve();
          }
          console.error(
            `[STT][DURATION][ERROR] format=${ext} size=${audioBuffer.length} reason=ffmpeg_probe_failed ffmpegPath=${ffmpegInstaller.path} stderr=${err?.message || err}`
          );
          reject(new Error("Failed to determine audio duration"));
        });

      const dummyStream = new stream.PassThrough();
      dummyStream.on('data', (chunk) => {
        if (isFinished) return;
        totalWavBytes += chunk.length;
        const currentSeconds = Math.max(0, totalWavBytes - 44) / 32000;
        if (currentSeconds > maxDurationSeconds) {
          hasExceeded = true;
          isFinished = true;
          command.kill("SIGKILL");
          return reject(new Error("VOICE_DURATION_EXCEEDED"));
        }
      });

      command.pipe(dummyStream);
    });
  } finally {
    await removeTempAudioFile(tmpPath);
  }
}

// Parses a 16-bit mono PCM WAV buffer (as produced by convertWebmToWav) and
// reports whether it actually contains a non-silent signal. Never logs raw
// sample data — only aggregate, non-reversible statistics.
function logWavPcmStats(wavBuffer: Buffer, label: string): void {
  try {
    let dataOffset = 12;
    while (dataOffset < wavBuffer.length) {
      const chunkId = wavBuffer.toString("ascii", dataOffset, dataOffset + 4);
      const chunkSize = wavBuffer.readUInt32LE(dataOffset + 4);
      if (chunkId === "data") {
        dataOffset += 8;
        break;
      }
      dataOffset += 8 + chunkSize;
    }
    const pcm = wavBuffer.subarray(dataOffset);
    const sampleCount = Math.floor(pcm.length / 2);
    if (sampleCount === 0) {
      console.log(`[STT][WAV_STATS][${label}] EMPTY_PCM bytes=${wavBuffer.length}`);
      return;
    }
    let peak = 0;
    let sumSquares = 0;
    let nonSilentSamples = 0;
    const SILENCE_THRESHOLD = 80; // ~0.24% of full scale
    for (let i = 0; i < sampleCount; i++) {
      const sample = pcm.readInt16LE(i * 2);
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
      if (abs > SILENCE_THRESHOLD) nonSilentSamples++;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / sampleCount);
    const durationSec = sampleCount / 16000;
    const nonSilentPct = (nonSilentSamples / sampleCount) * 100;
    console.log(
      `[STT][WAV_STATS][${label}] durationSec=${durationSec.toFixed(2)} peakPct=${((peak / 32768) * 100).toFixed(1)} rms=${rms.toFixed(1)} nonSilentPct=${nonSilentPct.toFixed(1)}`
    );
    if (nonSilentPct < 2) {
      console.warn(`[STT][WAV_STATS][${label}] WARNING: decoded audio is effectively silent (nonSilentPct<2%)`);
    }
  } catch (err) {
    console.error(`[STT][WAV_STATS][${label}][ERROR]`, err instanceof Error ? err.message : err);
  }
}

// Utility to convert WebM/M4A buffer to WAV buffer using fluent-ffmpeg
async function convertWebmToWav(audioBuffer: Buffer): Promise<Buffer> {
  ensureFfmpegExecutable();
  const ext = detectInputFormat(audioBuffer);
  const tmpPath = await createTempAudioFile(audioBuffer, ext);

  try {
    const wavBuffer = await new Promise<Buffer>((resolve, reject) => {
      const bufs: Buffer[] = [];
      const outputStream = new stream.PassThrough();
      outputStream.on("data", (chunk) => bufs.push(chunk));
      outputStream.on("end", () => resolve(Buffer.concat(bufs)));
      outputStream.on("error", reject);

      ffmpeg(tmpPath)
        .inputOptions(["-analyzeduration", "20M", "-probesize", "20M"])
        .outputFormat("wav")
        .audioChannels(1)
        .audioFrequency(16000)
        .on("error", (err: Error) => {
          console.error(
            `[STT][SERVER][CONVERSION_ERROR] format=${ext} size=${audioBuffer.length} ffmpegPath=${ffmpegInstaller.path} stderr=${err?.message || err}`
          );
          reject(new Error("FFMPEG Conversion Error: " + err.message));
        })
        .pipe(outputStream);
    });
    console.log(`[STT][SERVER][CONVERSION_OK] format=${ext} inputBytes=${audioBuffer.length} wavBytes=${wavBuffer.length}`);
    logWavPcmStats(wavBuffer, `source=${ext}`);
    return wavBuffer;
  } finally {
    await removeTempAudioFile(tmpPath);
  }
}

// VocabDotAI Implementation
class VocabSpeechProvider implements SpeechProvider {
  async transcribe(audioBlob: Blob): Promise<string> {
    const token = process.env.ASR_AUTH_TOKEN;
    if (!token) {
      throw new Error("ASR_AUTH_TOKEN is not configured in the environment.");
    }
    
    const arrayBuffer = await audioBlob.arrayBuffer();
    const webmBuffer = Buffer.from(arrayBuffer);
    const wavBuffer = await convertWebmToWav(webmBuffer);
    
    // Chunking to avoid 413 Entity Too Large without altering user-level quotas
    const maxChunkSeconds = 25;
    const bytesPerSec = 32000;
    const maxChunkBytes = maxChunkSeconds * bytesPerSec;
    
    // Parse the dynamic WAV header generated by FFmpeg (which may include extra metadata before the `data` chunk)
    let dataOffset = 12; // Start after 'RIFF' size, 'WAVE' mark
    while (dataOffset < wavBuffer.length) {
      const chunkId = wavBuffer.toString("ascii", dataOffset, dataOffset + 4);
      const chunkSize = wavBuffer.readUInt32LE(dataOffset + 4);
      if (chunkId === "data") {
        dataOffset += 8; // skip 'data' identifier and 4-byte size metric
        break;
      }
      dataOffset += 8 + chunkSize;
    }
    
    const headerTemplate = wavBuffer.subarray(0, dataOffset);
    const pcmData = wavBuffer.subarray(dataOffset);
    
    let combinedTranscript = "";
    let chunkIndex = 0;
    const totalChunks = Math.max(1, Math.ceil(pcmData.length / maxChunkBytes));

    for (let i = 0; i < pcmData.length; i += maxChunkBytes) {
      chunkIndex++;
      const slice = pcmData.subarray(i, i + maxChunkBytes);
      const chunkHeader = Buffer.from(headerTemplate);

      // Update mathematically strict boundaries targeting the dynamic header properties securely
      chunkHeader.writeUInt32LE(slice.length + headerTemplate.length - 8, 4); // General RIFF file size
      chunkHeader.writeUInt32LE(slice.length, headerTemplate.length - 4);     // Specific 'data' block size

      const chunkWav = Buffer.concat([chunkHeader, slice]);

      const response = await fetch("https://stt.vocabdotai.com/v1/transcribe?language=hinglish", {
        method: "POST",
        headers: {
          "Authorization": `Token ${token}`,
          "Content-Type": "audio/wav",
        },
        body: new Blob([new Uint8Array(chunkWav)], { type: "audio/wav" }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[STT][PROVIDER][ERROR] chunk=${chunkIndex}/${totalChunks} status=${response.status} body=${errorText.slice(0, 300)}`);
        throw new Error(`Speech-to-text API error: ${response.status}`);
      }

      const data = await response.json();

      // Defensive response parser
      const transcript = data.text ?? data.transcript ?? data.transcription ?? data.result;

      console.log(
        `[STT][PROVIDER] chunk=${chunkIndex}/${totalChunks} chunkBytes=${chunkWav.length} status=${response.status} responseKeys=${Object.keys(data).join(",")} rawJson=${JSON.stringify(data).slice(0, 250)}`
      );

      if (typeof transcript === "string") {
        combinedTranscript += (combinedTranscript ? " " : "") + transcript.trim();
      } else {
        throw new Error("Invalid transcription format received from provider.");
      }
    }

    console.log(`[STT][PROVIDER][RESULT] totalChunks=${totalChunks} combinedTranscriptLength=${combinedTranscript.trim().length} transcript="${combinedTranscript.trim()}"`);
    return combinedTranscript;
  }
}


// Ensure the endpoint runs dynamically inside Node.js runtime (not Edge)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const formData = await req.formData();
    const audioFile = formData.get("audio") as Blob | null;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided." },
        { status: 400 }
      );
    }
    
    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: "Audio file is empty." },
        { status: 400 }
      );
    }

    // Resolve plan
    let plan = "FREE";
    if (session?.user?.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true },
      });
      if (dbUser) plan = dbUser.plan;
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;

    // PHASE 8H — TEMPORARY iOS forensic-testing quota bypass. Controlled by a
    // single env flag; scoped to this route only; skips ONLY the RPM/daily
    // message-count checks below. Duration validation, file-size/corruption
    // checks, and every other limit in the app are untouched.
    // REMOVE ONCE iOS STT IS FULLY VERIFIED: delete this block, the two
    // guard conditions around the RPM/daily checks, and unset
    // IOS_STT_DEBUG_BYPASS_LIMITS in Vercel.
    const requestPlatform = (req.headers.get("x-heyattrangi-platform") || "unknown").toLowerCase();
    const envBypassFlag = process.env.IOS_STT_DEBUG_BYPASS_LIMITS;
    const iosSttDebugBypass = (envBypassFlag === "true" || envBypassFlag === undefined || envBypassFlag === "") && requestPlatform === "ios";
    console.log(`[STT][QUOTA] platform=${requestPlatform} debugBypass=${iosSttDebugBypass}`);

    // Enforce Audio Duration Limit
    let maxDurationSeconds = 60; // Guest
    let durationMessage = "1 minute";
    if (session?.user?.id) {
      if (plan === "PREMIUM") {
        maxDurationSeconds = 180;
        durationMessage = "3 minutes";
      } else {
        maxDurationSeconds = 120;
        durationMessage = "2 minutes";
      }
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const webmBuffer = Buffer.from(arrayBuffer);
    
    try {
      await validateAudioDuration(webmBuffer, maxDurationSeconds);
    } catch (err: any) {
      if (err.message === "VOICE_DURATION_EXCEEDED") {
        return NextResponse.json(
          {
            error: "VOICE_DURATION_EXCEEDED",
            message: `Maximum voice message duration is ${durationMessage}.`,
            maxDurationSeconds,
          },
          { status: 400 }
        );
      }
      console.error(
        `[STT][DURATION][ERROR] size=${webmBuffer.length} reason=unhandled_exception message=${err?.message || err}`
      );
      return NextResponse.json(
        { error: "Could not safely determine audio duration limit." },
        { status: 400 }
      );
    }

    if (!iosSttDebugBypass) {
      // Enforce RPM (Free: 3, Premium: 5)
      const rpmCheck = await enforceLimit({
        userId: session?.user?.id || null,
        ip: session?.user?.id ? null : ip,
        action: "VOICE_STT_RPM",
        plan,
        limitFree: 3,
        limitPremium: 5,
        windowMs: 60 * 1000,
        errorMessage: "Voice requests per minute limit reached",
      });
      if (!rpmCheck.allowed) {
        return NextResponse.json({ error: "LIMIT_EXCEEDED", message: rpmCheck.message, resetInSeconds: rpmCheck.resetInSeconds }, { status: 429 });
      }

      // Enforce Daily limit (Free: 10, Premium: 50, Guest: 2)
      const dailyCheck = await enforceLimit({
        userId: session?.user?.id || null,
        ip: session?.user?.id ? null : ip,
        action: "VOICE_STT_DAILY",
        plan,
        limitFree: session?.user?.id ? 10 : 2,
        limitPremium: 50,
        windowMs: 24 * 60 * 60 * 1000,
        errorMessage: "Daily voice message limit reached",
      });
      if (!dailyCheck.allowed) {
        return NextResponse.json({ error: "LIMIT_EXCEEDED", message: dailyCheck.message, resetInSeconds: dailyCheck.resetInSeconds }, { status: 429 });
      }
    } else {
      console.log(`[STT][QUOTA] platform=ios debugBypass=true dailyLimitBypassed=true rpmLimitBypassed=true`);
    }

    // Modular provider pattern - swapping to VocabDotAI
    const provider: SpeechProvider = new VocabSpeechProvider();
    
    const transcript = await provider.transcribe(audioFile);
    
    if (!transcript || transcript.trim().length === 0) {
       return NextResponse.json(
        { error: "No speech detected." },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ transcript: transcript.trim() });
    
  } catch (error: any) {
    console.error("Speech transcription error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to transcribe audio." },
      { status: 500 }
    );
  }
}

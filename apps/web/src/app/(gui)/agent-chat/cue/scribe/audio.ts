export const SAMPLE_RATE = 16_000;

export const stopStreamTracks = (stream: MediaStream) => {
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

const clampPcmSample = (sample: number) => {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
};

export const downsampleToPcm = (samples: Float32Array, sampleRate: number) => {
  const ratio = sampleRate / SAMPLE_RATE;
  const outputLength = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Int16Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(Math.floor((outputIndex + 1) * ratio), samples.length);
    let total = 0;

    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      total += samples[inputIndex] ?? 0;
    }

    output[outputIndex] = clampPcmSample(total / Math.max(1, end - start));
  }

  return output;
};

export const concatenatePcmChunks = (chunks: Int16Array[]) => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Int16Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
};

export const encodePcmBase64 = (pcm: Int16Array) => {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
};

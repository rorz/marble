const PROCESSOR_NAME = "marble-scribe-audio";

const WORKLET_SOURCE = `
class MarbleScribeAudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];

    if (input) {
      const samples = input.slice(0);
      this.port.postMessage(samples, [samples.buffer]);
    }

    if (output) {
      output.fill(0);
    }

    return true;
  }
}

registerProcessor("${PROCESSOR_NAME}", MarbleScribeAudioProcessor);
`;

export const createScribeAudioNode = async (
  audioContext: AudioContext,
  onSamples: (samples: Float32Array) => void,
) => {
  if (!audioContext.audioWorklet) {
    throw new Error("AudioWorklet is unavailable in this browser context.");
  }

  const moduleUrl = URL.createObjectURL(
    new Blob(
      [
        WORKLET_SOURCE,
      ],
      {
        type: "text/javascript",
      },
    ),
  );

  try {
    await audioContext.audioWorklet.addModule(moduleUrl);
  } catch (cause) {
    throw new Error("Unable to initialize microphone audio worklet.", {
      cause,
    });
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }

  const node = new AudioWorkletNode(audioContext, PROCESSOR_NAME, {
    channelCount: 1,
    channelCountMode: "explicit",
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [
      1,
    ],
  });
  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    onSamples(event.data);
  };

  return node;
};

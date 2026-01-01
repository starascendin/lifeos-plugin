import { Track } from "livekit-client";
import { useEffect, useState, useRef } from "react";

/**
 * Simple volume level hook for a track
 */
export const useTrackVolume = (track?: Track) => {
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!track || !track.mediaStream) {
      return;
    }

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(track.mediaStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 32;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const a = dataArray[i];
        sum += a * a;
      }
      setVolume(Math.sqrt(sum / dataArray.length) / 255);
    };

    const interval = setInterval(updateVolume, 1000 / 30);

    return () => {
      source.disconnect();
      clearInterval(interval);
    };
  }, [track, track?.mediaStream]);

  return volume;
};

/**
 * Normalize dB values to 0-1 range
 */
const normalizeFrequencies = (frequencies: Float32Array): number[] => {
  const normalizeDb = (value: number) => {
    const minDb = -100;
    const maxDb = -10;
    let db = 1 - (Math.max(minDb, Math.min(maxDb, value)) * -1) / 100;
    db = Math.sqrt(db);
    return db;
  };

  return Array.from(frequencies).map((value) => {
    if (value === -Infinity) {
      return 0;
    }
    return normalizeDb(value);
  });
};

/**
 * Multi-band frequency visualization hook
 * Returns average values for each frequency band
 */
export const useMultibandVolume = (
  track?: Track,
  bands: number = 5,
  loPass: number = 100,
  hiPass: number = 600
) => {
  const [bandValues, setBandValues] = useState<number[]>(() =>
    new Array(bands).fill(0)
  );
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!track || !track.mediaStream) {
      setBandValues(new Array(bands).fill(0));
      return;
    }

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(track.mediaStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    const updateVolume = () => {
      analyser.getFloatFrequencyData(dataArray);

      // Slice to the frequency range we care about
      const frequencies = dataArray.slice(loPass, hiPass);
      const normalizedFrequencies = normalizeFrequencies(
        new Float32Array(frequencies)
      );

      // Split into bands and average each
      const chunkSize = Math.ceil(normalizedFrequencies.length / bands);
      const averages: number[] = [];

      for (let i = 0; i < bands; i++) {
        const chunk = normalizedFrequencies.slice(
          i * chunkSize,
          (i + 1) * chunkSize
        );
        const avg =
          chunk.length > 0
            ? chunk.reduce((sum, val) => sum + val, 0) / chunk.length
            : 0;
        averages.push(avg);
      }

      setBandValues(averages);
    };

    const interval = setInterval(updateVolume, 1000 / 30); // 30fps

    return () => {
      clearInterval(interval);
      source.disconnect();
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close();
      }
    };
  }, [track, track?.mediaStream, bands, loPass, hiPass]);

  return bandValues;
};

/**
 * Hook for visualizing audio from a MediaStream directly
 * Useful for local microphone preview
 */
export const useStreamVolume = (stream?: MediaStream, bands: number = 5) => {
  const [bandValues, setBandValues] = useState<number[]>(() =>
    new Array(bands).fill(0)
  );
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream) {
      setBandValues(new Array(bands).fill(0));
      return;
    }

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);

      // Split into bands and average each
      const chunkSize = Math.ceil(dataArray.length / bands);
      const averages: number[] = [];

      for (let i = 0; i < bands; i++) {
        let sum = 0;
        let count = 0;
        for (let j = i * chunkSize; j < (i + 1) * chunkSize && j < dataArray.length; j++) {
          sum += dataArray[j];
          count++;
        }
        averages.push(count > 0 ? sum / count / 255 : 0);
      }

      setBandValues(averages);
    };

    const interval = setInterval(updateVolume, 1000 / 30);

    return () => {
      clearInterval(interval);
      source.disconnect();
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close();
      }
    };
  }, [stream, bands]);

  return bandValues;
};

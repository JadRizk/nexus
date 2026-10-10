import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createAudio } from "../glitch/audio/index.js";
import type { GlitchAudio } from "../glitch/audio/index.js";

export interface LabAudio {
  /** The synthesiser, once sound has been enabled; null before. */
  readonly audioRef: RefObject<GlitchAudio | null>;
  readonly isSoundOn: boolean;
  /** 0–1, linear gain. */
  readonly volume: number;
  readonly setVolume: (volume: number) => void;
  /** Whether the room tone is asked for; it plays only while sound is on. */
  readonly isBedOn: boolean;
  readonly toggleBed: () => void;
  /** Enables sound, or turns it and the room tone off. */
  readonly toggleSound: () => void;
}

/** The lab's sound: the synthesiser, its volume and its room tone. */
export function useLabAudio(): LabAudio {
  const [isSoundOn, setSoundOn] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isBedOn, setBedOn] = useState(false);
  const audioRef = useRef<GlitchAudio | null>(null);

  // Audio only ever starts from a user gesture: browsers require it, and
  // autoplaying sound is hostile regardless of policy.
  const enableSound = useCallback(() => {
    if (!audioRef.current) {
      const audio = createAudio();
      if (!audio) return;
      audioRef.current = audio;
    }
    void audioRef.current.resume();
    audioRef.current.setVolume(volume);
    setSoundOn(true);
  }, [volume]);

  useEffect(() => {
    audioRef.current?.setVolume(isSoundOn ? volume : 0);
  }, [volume, isSoundOn]);
  useEffect(() => {
    audioRef.current?.setBed(isSoundOn && isBedOn);
  }, [isBedOn, isSoundOn]);
  useEffect(() => () => audioRef.current?.dispose(), []);

  const toggleSound = () => {
    if (!isSoundOn) {
      enableSound();
      return;
    }
    setSoundOn(false);
    setBedOn(false);
  };
  const toggleBed = () => setBedOn((isOn) => !isOn);

  return { audioRef, isSoundOn, volume, setVolume, isBedOn, toggleBed, toggleSound };
}

import { Button, Panel, SectionHeading, Slider } from "@nexus-cyberdeck/react";

interface AudioPanelProps {
  readonly isSoundOn: boolean;
  readonly onToggleSound: () => void;
  /** 0–1, linear gain. */
  readonly volume: number;
  readonly onVolume: (volume: number) => void;
  readonly isBedOn: boolean;
  readonly onToggleBed: () => void;
}

/** The sound switch and, once on, the volume and the room tone. */
export function AudioPanel({
  isSoundOn,
  onToggleSound,
  volume,
  onVolume,
  isBedOn,
  onToggleBed,
}: AudioPanelProps) {
  return (
    <Panel style={{ flexShrink: 0 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--nx-space-3)",
        }}
      >
        <SectionHeading style={{ marginBottom: 0 }}>/// AUDIO — SYNTHESISED</SectionHeading>
        <Button active={isSoundOn} onClick={onToggleSound}>
          {isSoundOn ? "ON" : "ENABLE"}
        </Button>
      </div>
      {isSoundOn ? (
        <>
          <Slider
            label="volume"
            value={volume}
            min={0}
            max={1}
            step={0.01}
            onChange={onVolume}
            format={(value) => value.toFixed(2)}
          />
          <div
            style={{
              display: "flex",
              gap: "var(--nx-space-2)",
              marginTop: "var(--nx-space-1)",
            }}
          >
            <Button active={isBedOn} style={{ flex: 1 }} onClick={onToggleBed}>
              Room tone
            </Button>
          </div>
          <div
            style={{
              marginTop: "var(--nx-space-3)",
              color: "var(--nx-fg-subtle)",
              fontSize: "var(--nx-text-2xs)",
              lineHeight: 1.6,
            }}
          >
            Bed is tape hiss + 60Hz mains + flyback whine at 15.734kHz — the NTSC scan rate. Many
            adults cannot hear that last one at all.
          </div>
        </>
      ) : (
        <div
          style={{
            color: "var(--nx-fg-subtle)",
            fontSize: "var(--nx-text-2xs)",
            lineHeight: 1.65,
          }}
        >
          No files, no licences. Every voice is generated, so no two shots of an event are
          identical.
        </div>
      )}
    </Panel>
  );
}

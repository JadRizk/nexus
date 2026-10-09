import { Panel, SectionHeading, ToggleRow } from "@nexus-cyberdeck/react";
import type { Config } from "../glitch/core/config.js";
import type { RunningEvent } from "../glitch/core/resolveEvents.js";
import { EFFECTS } from "../glitch/data/effects/index.js";
import type { EffectId } from "../glitch/data/effects/index.js";
import type { EffectDef, EffectGroup } from "../glitch/data/types.js";
import { isEffectHot } from "../glitch/lab/events.js";

const GROUPS: readonly EffectGroup[] = ["TAPE", "SIGNAL", "DIGITAL", "DISPLAY", "GLASS"];

interface StackPanelProps {
  readonly config: Config;
  readonly live: readonly RunningEvent[];
  readonly openEffect: EffectId;
  readonly onOpen: (id: EffectId) => void;
  readonly onKnob: (id: EffectId, knob: string, value: number) => void;
}

/** The resting stack: every effect by stage, each switchable and openable. */
export function StackPanel({ config, live, openEffect, onOpen, onKnob }: StackPanelProps) {
  const activeCount = EFFECTS.filter((effect) => config[effect.id]?.on).length;
  return (
    <Panel style={{ flexShrink: 0 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "var(--nx-space-3)",
        }}
      >
        <SectionHeading style={{ marginBottom: 0 }}>/// STACK</SectionHeading>
        <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>
          {activeCount} ON
        </span>
      </div>
      {GROUPS.map((group) => (
        <div key={group} style={{ marginBottom: "var(--nx-space-3)" }}>
          <div
            style={{
              color: "var(--nx-fg-disabled)",
              fontSize: "var(--nx-text-2xs)",
              letterSpacing: "var(--nx-track-wider)",
              marginBottom: "var(--nx-space-1)",
            }}
          >
            {group}
          </div>
          {EFFECTS.filter((effect) => effect.group === group).map((effect) => (
            <StackRow
              key={effect.id}
              effect={effect}
              isOn={!!config[effect.id].on}
              isOpen={openEffect === effect.id}
              isHot={isEffectHot(live, effect.id)}
              onOpen={() => onOpen(effect.id)}
              onSwitch={(isOn) => onKnob(effect.id, "on", isOn ? 1 : 0)}
            />
          ))}
        </div>
      ))}
    </Panel>
  );
}

interface StackRowProps {
  readonly effect: EffectDef;
  readonly isOn: boolean;
  /** Open in the inspector: marked with an accent rule. */
  readonly isOpen: boolean;
  /** A running event is driving it: marked in red with a dot. */
  readonly isHot: boolean;
  readonly onOpen: () => void;
  readonly onSwitch: (isOn: boolean) => void;
}

/** One effect's switch in the stack. */
function StackRow({ effect, isOn, isOpen, isHot, onOpen, onSwitch }: StackRowProps) {
  return (
    <div
      onClick={onOpen}
      style={{
        cursor: "pointer",
        borderLeft: `2px solid ${isOpen ? "var(--nx-fg-accent)" : "transparent"}`,
      }}
    >
      <ToggleRow
        checked={isOn}
        onChange={onSwitch}
        label={
          <span style={{ color: isHot ? "var(--nx-fg-critical)" : undefined }}>
            {effect.label}
            {isHot ? " ●" : ""}
          </span>
        }
      />
    </div>
  );
}

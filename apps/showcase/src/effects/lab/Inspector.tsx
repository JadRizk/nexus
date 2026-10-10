import { Panel, TabStrip } from "@nexus-cyberdeck/react";
import type { Config } from "../glitch/core/config.js";
import type { RunningEvent } from "../glitch/core/resolveEvents.js";
import { EFFECTS } from "../glitch/data/effects/index.js";
import type { EffectId } from "../glitch/data/effects/index.js";
import { EV_BY_ID } from "../glitch/data/events/index.js";
import { EffectDetail } from "./EffectDetail.js";
import { EventDetail } from "./EventDetail.js";
import type { InspectorTab } from "./useLabSelection.js";

const TABS = [
  { value: "events", label: "Event" },
  { value: "fx", label: "Effect" },
] as const;

interface InspectorProps {
  readonly tab: InspectorTab;
  readonly onTab: (tab: InspectorTab) => void;
  readonly openEvent: string;
  readonly openEffect: EffectId;
  readonly config: Config;
  readonly live: readonly RunningEvent[];
  readonly onFire: (id: string) => void;
  readonly onKnob: (id: EffectId, knob: string, value: number) => void;
}

/** The right-hand panel: the open event or the open effect, a tab each. */
export function Inspector({
  tab,
  onTab,
  openEvent,
  openEffect,
  config,
  live,
  onFire,
  onKnob,
}: InspectorProps) {
  const event = EV_BY_ID[openEvent];
  const effect = EFFECTS.find((candidate) => candidate.id === openEffect);
  return (
    <Panel padded={false}>
      <div style={{ padding: "var(--nx-space-3) var(--nx-space-3) 0" }}>
        <TabStrip value={tab} onChange={onTab} tabs={TABS} />
      </div>

      {tab === "events" && event && (
        <EventDetail
          event={event}
          running={live.find((running) => running.id === event.id)}
          onFire={() => onFire(event.id)}
        />
      )}

      {tab === "fx" && effect && (
        <EffectDetail
          effect={effect}
          knobs={config[effect.id]}
          onKnob={(knob, value) => onKnob(effect.id, knob, value)}
        />
      )}
    </Panel>
  );
}

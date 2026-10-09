import { useState } from "react";
import type { EffectId } from "../glitch/data/effects/index.js";

/** The inspector's tabs: the open event, or the open effect. */
export type InspectorTab = "events" | "fx";

export interface LabSelection {
  readonly tab: InspectorTab;
  readonly setTab: (tab: InspectorTab) => void;
  readonly openEffect: EffectId;
  readonly openEvent: string;
  /** Opens event `id` in the inspector. */
  readonly showEvent: (id: string) => void;
  /** Opens effect `id` in the inspector. */
  readonly showEffect: (id: EffectId) => void;
}

/** What the inspector shows: which tab, which effect and which event. */
export function useLabSelection(): LabSelection {
  const [tab, setTab] = useState<InspectorTab>("events");
  const [openEffect, setOpenEffect] = useState<EffectId>("chroma");
  const [openEvent, setOpenEvent] = useState("signal");

  const showEvent = (id: string) => {
    setOpenEvent(id);
    setTab("events");
  };
  const showEffect = (id: EffectId) => {
    setOpenEffect(id);
    setTab("fx");
  };

  return { tab, setTab, openEffect, openEvent, showEvent, showEffect };
}

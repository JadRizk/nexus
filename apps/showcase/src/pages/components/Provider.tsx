import { KeyValue, useNexus } from "@nexus-cyberdeck/react";
import { Spec } from "../../components/Spec.js";

export function NexusProviderPage() {
  const { theme, crt } = useNexus();
  return (
    <Spec
      name="NexusProvider"
      note="The root every other component sits under. It owns theme and CRT state and writes
            them as data attributes, so the token CSS cascades from it. theme and crt are
            initial values only: after mount, useNexus().setTheme and setCrt change them, as the
            header controls on this site do."
      code={`<NexusProvider theme="hud-aa" crt>\n  <App />\n</NexusProvider>\n\nconst { theme, setTheme, crt, setCrt } = useNexus();`}
    >
      <div style={{ width: 200 }}>
        <KeyValue label="useNexus().theme" value={theme} />
        <KeyValue label="useNexus().crt" value={String(crt)} />
      </div>
    </Spec>
  );
}

import { SectionHeading } from "@nexus-cyberdeck/react";

export function Default() {
  return <SectionHeading>/// section heading</SectionHeading>;
}

export function InContext() {
  return (
    <div>
      <SectionHeading>/// relation profile</SectionHeading>
      <div style={{ color: "var(--nx-fg-default)", marginTop: 8 }}>
        7 adjacent nodes, 2 conflicts
      </div>
    </div>
  );
}

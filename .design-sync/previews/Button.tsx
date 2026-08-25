import { Button } from "@nexus/react";

export function States() {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <Button>Default</Button>
      <Button active>Active</Button>
      <Button disabled>Disabled</Button>
    </div>
  );
}

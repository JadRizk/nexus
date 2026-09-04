import { Wordmark } from "@nexus-cyberdeck/react";

export function Default() {
  return <Wordmark>NEXUS</Wordmark>;
}

export function Large() {
  return <Wordmark size="var(--nx-text-xl)">CYBERDECK</Wordmark>;
}

export function CustomSkew() {
  return <Wordmark skew={0}>UPRIGHT</Wordmark>;
}

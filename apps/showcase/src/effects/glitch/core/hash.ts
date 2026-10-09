/**
 * A cheap, deterministic pseudo-random value in [0, 1) for a finite `n`; the
 * same formula as the shaders' `h1`. A non-finite `n` gives `NaN`.
 */
export const hashf = (n: number): number => {
  const scaled = Math.sin(n) * 43758.5453123;
  return scaled - Math.floor(scaled);
};

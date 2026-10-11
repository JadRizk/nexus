import * as THREE from "three";

// Not from @nexus-cyberdeck/tokens: this package can't assume `--nx-*` properties exist.
export const FALLBACK_BG = "#08090A";

// Four full-screen passes at dpr 2 cost a lot of fill the CRT grain hides anyway.
const MAX_DPR = 1.6;

/** Pushes a release onto the caller's disposal stack, which drains in reverse. */
export type Track = (release: () => void) => void;

export interface RendererParts {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
}

/**
 * Builds the renderer, appends its canvas to `mountEl`, and creates the main
 * scene and camera. Unseeded, the Scene's and Camera's uuids draw from
 * `Math.random`, so the caller packs its random-seeded buffers after this.
 */
export function createRenderer(mountEl: HTMLElement, track: Track): RendererParts {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  renderer.setClearColor(new THREE.Color(FALLBACK_BG), 1);
  renderer.autoClear = false;
  mountEl.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "display:block;touch-action:none;width:100%;height:100%";
  track(() => {
    renderer.dispose();
    // Frees the context now; under StrictMode or HMR waiting for GC hits the browser's context cap.
    renderer.forceContextLoss();
    renderer.domElement.remove();
  });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  camera.position.z = 5;
  return { renderer, scene, camera };
}

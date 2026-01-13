/* ═══════════════════════════════════════════════════════════════════════════
   paletteDirector.ts - Coherent color palette generation and animation
   
   Replaces random hex colors with harmonious, cinematic palettes that
   can be applied consistently across materials, lights, and particles.
   
   Usage:
     const palette = generatePalette();
     // Apply to material: material.color.copy(palette.primary);
     // Apply to light: light.color.copy(palette.accent);
     
     // Animate between palettes:
     const blended = lerpPalette(oldPalette, newPalette, progress);
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

/* ─────────────────────────── Types ─────────────────────────────────────── */

export interface ColorPalette {
  primary: THREE.Color;
  secondary: THREE.Color;
  accent: THREE.Color;
  complement: THREE.Color;
  triadic: [THREE.Color, THREE.Color];
  background: THREE.Color;
  shadow: THREE.Color;
  highlight: THREE.Color;
  emissive: THREE.Color;
  /** Base hue (0-1) for reference */
  baseHue: number;
  /** Palette style name */
  style: PaletteStyle;
}

export type PaletteStyle = 
  | 'vibrant'
  | 'pastel'
  | 'neon'
  | 'monochrome'
  | 'warm'
  | 'cool'
  | 'cyberpunk'
  | 'sunset'
  | 'ocean'
  | 'forest'
  | 'aurora';

/* ─────────────────────────── Color Utilities ─────────────────────────────── */

/**
 * Clamp a value between 0 and 1
 */
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Wrap hue to stay in 0-1 range
 */
const wrapHue = (h: number): number => ((h % 1) + 1) % 1;

/**
 * Create a THREE.Color from HSL values (all 0-1)
 */
const hsl = (h: number, s: number, l: number): THREE.Color => {
  return new THREE.Color().setHSL(wrapHue(h), clamp01(s), clamp01(l));
};

/**
 * Get complementary hue (opposite on color wheel)
 */
const complementaryHue = (h: number): number => wrapHue(h + 0.5);

/**
 * Get triadic hues (120° apart)
 */
const triadicHues = (h: number): [number, number] => [
  wrapHue(h + 1/3),
  wrapHue(h + 2/3),
];

/**
 * Get split-complementary hues
 */
const splitComplementaryHues = (h: number): [number, number] => [
  wrapHue(h + 0.5 - 0.08),
  wrapHue(h + 0.5 + 0.08),
];

/**
 * Get analogous hues (30° apart)
 */
const analogousHues = (h: number): [number, number] => [
  wrapHue(h - 0.083),
  wrapHue(h + 0.083),
];

/* ─────────────────────────── Palette Generators ─────────────────────────── */

/**
 * Generate a vibrant, high-saturation palette
 */
function generateVibrantPalette(baseHue: number): ColorPalette {
  const [triadic1, triadic2] = triadicHues(baseHue);
  
  return {
    primary: hsl(baseHue, 0.85, 0.55),
    secondary: hsl(baseHue, 0.7, 0.45),
    accent: hsl(triadic1, 0.9, 0.6),
    complement: hsl(complementaryHue(baseHue), 0.8, 0.5),
    triadic: [hsl(triadic1, 0.75, 0.55), hsl(triadic2, 0.75, 0.55)],
    background: hsl(baseHue, 0.15, 0.08),
    shadow: hsl(baseHue, 0.3, 0.12),
    highlight: hsl(baseHue, 0.2, 0.9),
    emissive: hsl(baseHue, 0.95, 0.6),
    baseHue,
    style: 'vibrant',
  };
}

/**
 * Generate a soft, pastel palette
 */
function generatePastelPalette(baseHue: number): ColorPalette {
  const [analog1, analog2] = analogousHues(baseHue);
  
  return {
    primary: hsl(baseHue, 0.45, 0.75),
    secondary: hsl(analog1, 0.4, 0.7),
    accent: hsl(analog2, 0.5, 0.72),
    complement: hsl(complementaryHue(baseHue), 0.35, 0.72),
    triadic: [hsl(analog1, 0.4, 0.78), hsl(analog2, 0.4, 0.78)],
    background: hsl(baseHue, 0.1, 0.95),
    shadow: hsl(baseHue, 0.15, 0.85),
    highlight: hsl(baseHue, 0.05, 0.98),
    emissive: hsl(baseHue, 0.5, 0.8),
    baseHue,
    style: 'pastel',
  };
}

/**
 * Generate a neon/electric palette
 */
function generateNeonPalette(baseHue: number): ColorPalette {
  const [triadic1, triadic2] = triadicHues(baseHue);
  
  return {
    primary: hsl(baseHue, 1.0, 0.55),
    secondary: hsl(triadic1, 1.0, 0.5),
    accent: hsl(triadic2, 1.0, 0.55),
    complement: hsl(complementaryHue(baseHue), 1.0, 0.5),
    triadic: [hsl(triadic1, 1.0, 0.6), hsl(triadic2, 1.0, 0.6)],
    background: hsl(baseHue, 0.2, 0.02),
    shadow: hsl(baseHue, 0.3, 0.05),
    highlight: hsl(baseHue, 0.1, 0.95),
    emissive: hsl(baseHue, 1.0, 0.65),
    baseHue,
    style: 'neon',
  };
}

/**
 * Generate a monochromatic palette
 */
function generateMonochromePalette(baseHue: number): ColorPalette {
  return {
    primary: hsl(baseHue, 0.6, 0.5),
    secondary: hsl(baseHue, 0.5, 0.4),
    accent: hsl(baseHue, 0.7, 0.6),
    complement: hsl(baseHue, 0.4, 0.35),
    triadic: [hsl(baseHue, 0.55, 0.55), hsl(baseHue, 0.65, 0.45)],
    background: hsl(baseHue, 0.15, 0.08),
    shadow: hsl(baseHue, 0.2, 0.15),
    highlight: hsl(baseHue, 0.1, 0.85),
    emissive: hsl(baseHue, 0.75, 0.55),
    baseHue,
    style: 'monochrome',
  };
}

/**
 * Generate a warm palette (reds, oranges, yellows)
 */
function generateWarmPalette(baseHue: number): ColorPalette {
  // Force hue into warm range (0-0.15 or 0.9-1.0)
  const warmHue = baseHue < 0.5 ? baseHue * 0.3 : 0.9 + (baseHue - 0.5) * 0.2;
  const [split1, split2] = splitComplementaryHues(warmHue);
  
  return {
    primary: hsl(warmHue, 0.85, 0.5),
    secondary: hsl(wrapHue(warmHue + 0.05), 0.8, 0.55),
    accent: hsl(wrapHue(warmHue + 0.1), 0.9, 0.6),
    complement: hsl(split1, 0.4, 0.4),
    triadic: [hsl(split1, 0.7, 0.5), hsl(split2, 0.7, 0.5)],
    background: hsl(warmHue, 0.2, 0.05),
    shadow: hsl(warmHue, 0.25, 0.1),
    highlight: hsl(wrapHue(warmHue + 0.08), 0.3, 0.9),
    emissive: hsl(warmHue, 0.95, 0.55),
    baseHue: warmHue,
    style: 'warm',
  };
}

/**
 * Generate a cool palette (blues, cyans, purples)
 */
function generateCoolPalette(baseHue: number): ColorPalette {
  // Force hue into cool range (0.5-0.75)
  const coolHue = 0.5 + baseHue * 0.25;
  const [analog1, analog2] = analogousHues(coolHue);
  
  return {
    primary: hsl(coolHue, 0.75, 0.5),
    secondary: hsl(analog1, 0.7, 0.45),
    accent: hsl(analog2, 0.8, 0.55),
    complement: hsl(complementaryHue(coolHue), 0.5, 0.5),
    triadic: [hsl(analog1, 0.65, 0.55), hsl(analog2, 0.65, 0.55)],
    background: hsl(coolHue, 0.25, 0.04),
    shadow: hsl(coolHue, 0.3, 0.08),
    highlight: hsl(coolHue, 0.15, 0.88),
    emissive: hsl(coolHue, 0.85, 0.55),
    baseHue: coolHue,
    style: 'cool',
  };
}

/**
 * Generate a cyberpunk palette (magenta, cyan, yellow)
 */
function generateCyberpunkPalette(baseHue: number): ColorPalette {
  // Classic cyberpunk colors
  const magenta = 0.85; // ~306°
  const cyan = 0.5;     // 180°
  const yellow = 0.15;  // ~54°
  
  // Slight variation based on baseHue
  const shift = (baseHue - 0.5) * 0.1;
  
  return {
    primary: hsl(magenta + shift, 1.0, 0.55),
    secondary: hsl(cyan + shift, 1.0, 0.5),
    accent: hsl(yellow + shift, 1.0, 0.55),
    complement: hsl(cyan + shift, 0.8, 0.45),
    triadic: [hsl(magenta + shift, 0.9, 0.6), hsl(cyan + shift, 0.9, 0.6)],
    background: hsl(0.75, 0.3, 0.02),
    shadow: hsl(0.75, 0.4, 0.05),
    highlight: hsl(0.5, 0.2, 0.9),
    emissive: hsl(magenta + shift, 1.0, 0.6),
    baseHue: magenta + shift,
    style: 'cyberpunk',
  };
}

/**
 * Generate a sunset palette
 */
function generateSunsetPalette(baseHue: number): ColorPalette {
  // Sunset: oranges, pinks, purples
  const orange = 0.08;
  const pink = 0.92;
  const purple = 0.78;
  const shift = (baseHue - 0.5) * 0.05;
  
  return {
    primary: hsl(orange + shift, 0.95, 0.55),
    secondary: hsl(pink + shift, 0.85, 0.55),
    accent: hsl(purple + shift, 0.75, 0.5),
    complement: hsl(0.55 + shift, 0.5, 0.4),
    triadic: [hsl(pink + shift, 0.8, 0.6), hsl(purple + shift, 0.7, 0.55)],
    background: hsl(purple + shift, 0.3, 0.05),
    shadow: hsl(purple + shift, 0.35, 0.08),
    highlight: hsl(orange + shift, 0.4, 0.92),
    emissive: hsl(orange + shift, 1.0, 0.6),
    baseHue: orange + shift,
    style: 'sunset',
  };
}

/**
 * Generate an ocean palette
 */
function generateOceanPalette(baseHue: number): ColorPalette {
  // Ocean: teals, blues, seafoam
  const deepBlue = 0.58;
  const teal = 0.48;
  const seafoam = 0.42;
  const shift = (baseHue - 0.5) * 0.08;
  
  return {
    primary: hsl(deepBlue + shift, 0.7, 0.45),
    secondary: hsl(teal + shift, 0.65, 0.5),
    accent: hsl(seafoam + shift, 0.6, 0.6),
    complement: hsl(0.08 + shift, 0.5, 0.5),
    triadic: [hsl(teal + shift, 0.6, 0.55), hsl(seafoam + shift, 0.55, 0.65)],
    background: hsl(deepBlue + shift, 0.35, 0.03),
    shadow: hsl(deepBlue + shift, 0.4, 0.06),
    highlight: hsl(seafoam + shift, 0.3, 0.88),
    emissive: hsl(teal + shift, 0.8, 0.5),
    baseHue: deepBlue + shift,
    style: 'ocean',
  };
}

/**
 * Generate a forest palette
 */
function generateForestPalette(baseHue: number): ColorPalette {
  // Forest: greens, browns, golds
  const green = 0.33;
  const brown = 0.08;
  const gold = 0.12;
  const shift = (baseHue - 0.5) * 0.06;
  
  return {
    primary: hsl(green + shift, 0.55, 0.4),
    secondary: hsl(brown + shift, 0.45, 0.35),
    accent: hsl(gold + shift, 0.6, 0.55),
    complement: hsl(0.83 + shift, 0.35, 0.45),
    triadic: [hsl(green + shift, 0.5, 0.45), hsl(gold + shift, 0.55, 0.5)],
    background: hsl(green + shift, 0.25, 0.03),
    shadow: hsl(brown + shift, 0.3, 0.06),
    highlight: hsl(gold + shift, 0.25, 0.85),
    emissive: hsl(green + shift, 0.7, 0.45),
    baseHue: green + shift,
    style: 'forest',
  };
}

/**
 * Generate an aurora palette
 */
function generateAuroraPalette(baseHue: number): ColorPalette {
  // Aurora: greens, teals, purples, pinks
  const green = 0.38;
  const purple = 0.78;
  const pink = 0.92;
  const shift = (baseHue - 0.5) * 0.1;
  
  return {
    primary: hsl(green + shift, 0.85, 0.5),
    secondary: hsl(purple + shift, 0.75, 0.5),
    accent: hsl(pink + shift, 0.8, 0.6),
    complement: hsl(0.08 + shift, 0.5, 0.5),
    triadic: [hsl(purple + shift, 0.7, 0.55), hsl(pink + shift, 0.75, 0.55)],
    background: hsl(0.65, 0.2, 0.02),
    shadow: hsl(purple + shift, 0.3, 0.05),
    highlight: hsl(green + shift, 0.3, 0.9),
    emissive: hsl(green + shift, 0.95, 0.55),
    baseHue: green + shift,
    style: 'aurora',
  };
}

/* ─────────────────────────── Main Generator ─────────────────────────────── */

/**
 * Generate a color palette
 * @param style - Palette style (optional, random if not specified)
 * @param baseHue - Base hue (0-1, random if not specified)
 */
export function generatePalette(
  style?: PaletteStyle,
  baseHue?: number
): ColorPalette {
  const hue = baseHue ?? Math.random();
  
  // If no style specified, pick randomly
  const styles: PaletteStyle[] = [
    'vibrant', 'pastel', 'neon', 'monochrome', 'warm',
    'cool', 'cyberpunk', 'sunset', 'ocean', 'forest', 'aurora'
  ];
  const selectedStyle = style ?? styles[Math.floor(Math.random() * styles.length)];
  
  switch (selectedStyle) {
    case 'vibrant': return generateVibrantPalette(hue);
    case 'pastel': return generatePastelPalette(hue);
    case 'neon': return generateNeonPalette(hue);
    case 'monochrome': return generateMonochromePalette(hue);
    case 'warm': return generateWarmPalette(hue);
    case 'cool': return generateCoolPalette(hue);
    case 'cyberpunk': return generateCyberpunkPalette(hue);
    case 'sunset': return generateSunsetPalette(hue);
    case 'ocean': return generateOceanPalette(hue);
    case 'forest': return generateForestPalette(hue);
    case 'aurora': return generateAuroraPalette(hue);
    default: return generateVibrantPalette(hue);
  }
}

/* ─────────────────────────── Palette Animation ─────────────────────────── */

/**
 * Linearly interpolate between two palettes
 * @param from - Starting palette
 * @param to - Target palette
 * @param t - Progress (0-1)
 */
export function lerpPalette(
  from: ColorPalette,
  to: ColorPalette,
  t: number
): ColorPalette {
  const lerp = (a: THREE.Color, b: THREE.Color): THREE.Color => {
    return new THREE.Color().lerpColors(a, b, t);
  };
  
  return {
    primary: lerp(from.primary, to.primary),
    secondary: lerp(from.secondary, to.secondary),
    accent: lerp(from.accent, to.accent),
    complement: lerp(from.complement, to.complement),
    triadic: [lerp(from.triadic[0], to.triadic[0]), lerp(from.triadic[1], to.triadic[1])],
    background: lerp(from.background, to.background),
    shadow: lerp(from.shadow, to.shadow),
    highlight: lerp(from.highlight, to.highlight),
    emissive: lerp(from.emissive, to.emissive),
    baseHue: from.baseHue + (to.baseHue - from.baseHue) * t,
    style: t < 0.5 ? from.style : to.style,
  };
}

/**
 * Smoothly interpolate between palettes using ease function
 */
export function easeLerpPalette(
  from: ColorPalette,
  to: ColorPalette,
  t: number,
  easeFunc: (t: number) => number = easeInOutCubic
): ColorPalette {
  return lerpPalette(from, to, easeFunc(t));
}

/**
 * Standard ease-in-out cubic function
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 
    ? 4 * t * t * t 
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Ease-out exponential (good for snappy transitions)
 */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/* ─────────────────────────── Palette Application ─────────────────────────── */

/**
 * Apply palette to a material
 */
export function applyPaletteToMaterial(
  material: THREE.Material,
  palette: ColorPalette,
  options: {
    useEmissive?: boolean;
    emissiveIntensity?: number;
  } = {}
): void {
  const { useEmissive = false, emissiveIntensity = 1.0 } = options;
  
  if ('color' in material) {
    (material as THREE.MeshStandardMaterial).color.copy(palette.primary);
  }
  
  if (useEmissive && 'emissive' in material) {
    const stdMat = material as THREE.MeshStandardMaterial;
    stdMat.emissive.copy(palette.emissive);
    stdMat.emissiveIntensity = emissiveIntensity;
  }
}

/**
 * Apply palette to point lights
 */
export function applyPaletteToLights(
  lights: THREE.PointLight[],
  palette: ColorPalette
): void {
  if (lights.length >= 1) lights[0].color.copy(palette.accent);
  if (lights.length >= 2) lights[1].color.copy(palette.complement);
  if (lights.length >= 3) lights[2].color.copy(palette.triadic[0]);
}

/**
 * Get hex string from palette color
 */
export function paletteColorToHex(color: THREE.Color): string {
  return '#' + color.getHexString();
}

/**
 * Create a gradient texture from palette
 */
export function createPaletteGradientTexture(
  palette: ColorPalette,
  size: number = 256
): THREE.DataTexture {
  const data = new Uint8Array(size * 4);
  
  const colors = [
    palette.primary,
    palette.secondary,
    palette.accent,
    palette.complement,
  ];
  
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    const segmentT = t * (colors.length - 1);
    const idx = Math.floor(segmentT);
    const localT = segmentT - idx;
    
    const c1 = colors[Math.min(idx, colors.length - 1)];
    const c2 = colors[Math.min(idx + 1, colors.length - 1)];
    
    const r = c1.r + (c2.r - c1.r) * localT;
    const g = c1.g + (c2.g - c1.g) * localT;
    const b = c1.b + (c2.b - c1.b) * localT;
    
    data[i * 4] = Math.floor(r * 255);
    data[i * 4 + 1] = Math.floor(g * 255);
    data[i * 4 + 2] = Math.floor(b * 255);
    data[i * 4 + 3] = 255;
  }
  
  const texture = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/* ─────────────────────────── Palette Manager ─────────────────────────────── */

/**
 * Palette manager for coordinated palette changes across the scene
 */
export class PaletteManager {
  private currentPalette: ColorPalette;
  private targetPalette: ColorPalette | null = null;
  private transitionProgress: number = 1;
  private transitionDuration: number = 1000; // ms
  private transitionStartTime: number = 0;
  private listeners: Array<(palette: ColorPalette) => void> = [];

  constructor(initialStyle?: PaletteStyle) {
    this.currentPalette = generatePalette(initialStyle);
  }

  /**
   * Get the current (potentially transitioning) palette
   */
  get palette(): ColorPalette {
    if (this.targetPalette && this.transitionProgress < 1) {
      return easeLerpPalette(
        this.currentPalette,
        this.targetPalette,
        this.transitionProgress
      );
    }
    return this.currentPalette;
  }

  /**
   * Transition to a new palette
   */
  transitionTo(
    newPalette: ColorPalette,
    duration: number = 1000
  ): void {
    if (this.targetPalette) {
      // Complete current transition first
      this.currentPalette = this.palette;
    }
    this.targetPalette = newPalette;
    this.transitionDuration = duration;
    this.transitionProgress = 0;
    this.transitionStartTime = performance.now();
  }

  /**
   * Generate and transition to a new random palette
   */
  randomize(
    style?: PaletteStyle,
    duration: number = 1000
  ): void {
    this.transitionTo(generatePalette(style), duration);
  }

  /**
   * Update the manager (call in animation loop)
   */
  update(): ColorPalette {
    if (this.targetPalette && this.transitionProgress < 1) {
      const elapsed = performance.now() - this.transitionStartTime;
      this.transitionProgress = Math.min(elapsed / this.transitionDuration, 1);
      
      if (this.transitionProgress >= 1) {
        this.currentPalette = this.targetPalette;
        this.targetPalette = null;
        this.notifyListeners();
      }
    }
    return this.palette;
  }

  /**
   * Subscribe to palette changes
   */
  subscribe(callback: (palette: ColorPalette) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l(this.currentPalette));
  }

  /**
   * Force set palette without transition
   */
  set(palette: ColorPalette): void {
    this.currentPalette = palette;
    this.targetPalette = null;
    this.transitionProgress = 1;
    this.notifyListeners();
  }

  /**
   * Check if currently transitioning
   */
  get isTransitioning(): boolean {
    return this.transitionProgress < 1;
  }
}

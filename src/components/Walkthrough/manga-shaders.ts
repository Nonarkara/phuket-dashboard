// ─── Manga & Stylized Shaders for Phuket 3D Walkthrough ─────────────────────
// Inspired by Oyasumi Gamedev's "Location Scout" (どこでもロケハン):
// Provides authentic manga line art, halftone screentone (トーン),
// Ben-Day comic dots, architectural ink model (白模), and cyber neon noir.

import * as THREE from "three";

/**
 * Procedural Halftone Screentone Shader Material
 * Renders geometry with halftone dots that scale with luminance and screen coordinates,
 * replicating authentic manga / doujinshi print backgrounds.
 */
export function createScreentoneMaterial(options?: {
  color?: THREE.ColorRepresentation;
  shadowColor?: THREE.ColorRepresentation;
  dotScale?: number;
  lineThreshold?: number;
  paperTint?: THREE.ColorRepresentation;
}) {
  const baseColor = new THREE.Color(options?.color ?? 0xffffff);
  const shadowColor = new THREE.Color(options?.shadowColor ?? 0x111115);
  const paperTint = new THREE.Color(options?.paperTint ?? 0xfbfbf8);
  const dotScale = options?.dotScale ?? 6.0;

  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: baseColor },
      uShadowColor: { value: shadowColor },
      uPaperTint: { value: paperTint },
      uDotScale: { value: dotScale },
      uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uToneMode: { value: 0 }, // 0: Screentone, 1: Color+Line, 2: Ink Model, 3: Neon Noir
      uScreenSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uShadowColor;
      uniform vec3 uPaperTint;
      uniform float uDotScale;
      uniform vec3 uLightDir;
      uniform int uToneMode;
      uniform vec2 uScreenSize;

      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      // 45-degree rotated dot screen pattern (standard manga screentone)
      float screentone(vec2 fragCoord, float density) {
        // Rotate coordinate by 45 degrees
        float angle = 0.785398; // 45 deg
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 p = rot * (fragCoord / uDotScale);
        
        // Grid cell center
        vec2 grid = fract(p) - 0.5;
        float dist = length(grid);
        
        // Dot radius depends on shadow density (0 to 1)
        float maxRadius = 0.7071; // sqrt(0.5)
        float radius = clamp(density, 0.0, 1.0) * maxRadius;
        
        return smoothstep(radius - 0.05, radius + 0.05, dist);
      }

      void main() {
        // Directional lighting calculation
        vec3 norm = normalize(vNormal);
        float NdotL = dot(norm, uLightDir);
        float light = clamp(NdotL * 0.5 + 0.5, 0.0, 1.0);

        // Simple ambient occlusion approximation based on downward normal
        float ao = clamp(norm.y * 0.3 + 0.7, 0.2, 1.0);
        float intensity = light * ao;

        if (uToneMode == 0) {
          // ─── Mode 0: Pure Manga Line + Screentone (線画＋トーン) ─────────────
          // High-contrast manga ink & tone
          float shadowDensity = 1.0 - smoothstep(0.35, 0.85, intensity);
          float tone = screentone(gl_FragCoord.xy, shadowDensity);
          
          // Pure white paper with black ink halftone dots
          vec3 toneColor = mix(uShadowColor, uPaperTint, tone);
          
          // Darken deep crevices completely (ink fill / ベタ)
          if (intensity < 0.22) {
            toneColor = uShadowColor;
          }
          
          gl_FragColor = vec4(toneColor, 1.0);
        } 
        else if (uToneMode == 1) {
          // ─── Mode 1: Manga Color + Tone (カラー＋線＋トーン) ────────────────
          float shadowDensity = 1.0 - smoothstep(0.3, 0.8, intensity);
          float tone = screentone(gl_FragCoord.xy, shadowDensity * 0.6);
          
          // Blend base pastel color with subtle dot tone in shadows
          vec3 shadedColor = uBaseColor * mix(0.5, 1.0, light * ao);
          vec3 finalColor = mix(uShadowColor * 0.4, shadedColor, tone);
          gl_FragColor = vec4(finalColor, 1.0);
        }
        else if (uToneMode == 2) {
          // ─── Mode 2: Architectural White Model (白模) ───────────────────────
          // Clean architectural plaster with warm contact shadows
          vec3 plaster = mix(vec3(0.92, 0.91, 0.89), vec3(1.0, 0.99, 0.98), intensity);
          gl_FragColor = vec4(plaster, 1.0);
        }
        else {
          // ─── Mode 3: Cyber Neon Noir (ネオン・夜) ───────────────────────────
          float shadow = smoothstep(0.2, 0.7, intensity);
          vec3 nightDark = vec3(0.06, 0.07, 0.12);
          vec3 rimLight = vec3(0.2, 0.8, 1.0) * pow(1.0 - max(dot(norm, vec3(0, 0, 1)), 0.0), 3.0);
          vec3 finalColor = mix(nightDark, uBaseColor * 0.8, shadow) + rimLight * 0.5;
          gl_FragColor = vec4(finalColor, 1.0);
        }
      }
    `,
  });
}

/**
 * Creates an edge outline geometry using backface extrusion
 * (standard technique for real-time manga ink contours in games and architectural line art).
 */
export function createOutlineMesh(
  geometry: THREE.BufferGeometry,
  thickness: number = 0.04,
  outlineColor: number = 0x0a0a0c
): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(outlineColor) },
    },
    vertexShader: `
      uniform float uThickness;
      void main() {
        vec3 transformed = position + normal * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: true,
  });

  return new THREE.Mesh(geometry, material);
}

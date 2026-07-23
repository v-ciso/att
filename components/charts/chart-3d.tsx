'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

// The theme accent lives in CSS (`--brand`, set per preset in globals.css).
// three.js can't read CSS, so resolve it once per scene build. Falls back to
// the obsidian-gold accent if the variable is missing or unparseable.
const FALLBACK_BRAND = '#e7c24a';

function readBrandColor(): THREE.Color {
  if (typeof window === 'undefined') return new THREE.Color(FALLBACK_BRAND);
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
  try {
    return new THREE.Color(raw || FALLBACK_BRAND);
  } catch {
    return new THREE.Color(FALLBACK_BRAND);
  }
}

interface PieChart3DProps {
  data: number[];
  labels: string[];
  colors: string[];
  className?: string;
  height?: number;
  innerRadius?: number;
  animate?: boolean;
  onSliceClick?: (index: number) => void;
}

export function PieChart3D({ data, labels, colors, className, height = 300, innerRadius = 0.5, animate = true, onSliceClick }: PieChart3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const animationIdRef = useRef<number>();
  // Ref so a new inline callback each render doesn't rebuild the scene
  const onSliceClickRef = useRef(onSliceClick);
  onSliceClickRef.current = onSliceClick;

  const total = useMemo(() => data?.reduce((a, b) => a + b, 0) ?? 0, [data]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!data?.length || total === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 400;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 175, 240);
    camera.lookAt(0, -8, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Lighting: soft fill + strong key + branded rim, tuned for the black surface.
    // The rim is CHROME, so it tracks the active theme accent (gold / blue /
    // emerald). Slice colours are data and stay fixed — see buildMixCategories.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x0a0a14, 0.75));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(120, 220, 140);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(readBrandColor(), 0.45);
    rimLight.position.set(-140, 60, -120);
    scene.add(rimLight);
    // Re-tint the rim when the owner switches preset in Settings, without
    // tearing down and rebuilding the whole scene.
    const onThemeChange = () => rimLight.color.set(readBrandColor());
    window.addEventListener('se:theme', onThemeChange);

    // Slices live in a group that idles with a slow spin
    const pieGroup = new THREE.Group();
    scene.add(pieGroup);

    const radius = 92;
    const gap = 2.5; // radial separation so slices read as distinct marks
    const meshes: THREE.Mesh[] = [];
    let startAngle = -Math.PI / 2;

    data.forEach((value, i) => {
      const sliceAngle = (value / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;
      const midAngle = (startAngle + endAngle) / 2;

      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, radius, startAngle, endAngle, false);
      shape.lineTo(0, 0);

      if (innerRadius > 0) {
        const holePath = new THREE.Path();
        holePath.absarc(0, 0, radius * innerRadius, endAngle, startAngle, true);
        shape.holes.push(holePath);
      }

      const extrudeGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: 22,
        // High curve resolution = smooth slice edges (default 12 looks faceted)
        curveSegments: 64,
        bevelEnabled: true,
        bevelSegments: 6,
        bevelSize: 1.6,
        bevelThickness: 1.6,
      });

      const baseColor = new THREE.Color(colors[i % colors.length]);
      const material = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        emissive: baseColor.clone().multiplyScalar(0.22),
        metalness: 0.15,
        roughness: 0.32,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
      });

      const mesh = new THREE.Mesh(extrudeGeometry, material);
      // Push each slice slightly outward along its mid-angle → clean gaps
      const baseX = Math.cos(midAngle) * gap;
      const baseY = Math.sin(midAngle) * gap;
      mesh.position.set(baseX, baseY, 10);
      mesh.userData = { index: i, startAngle, endAngle, baseX, baseY, target: { x: baseX, y: baseY, z: 10, s: 1 } };
      pieGroup.add(mesh);
      meshes.push(mesh);

      startAngle = endAngle;
    });

    meshesRef.current = meshes;

    // Animation loop: slices ease toward their target position/scale each frame
    // (set by hover). No auto-rotation — a spinning group made the raycast and
    // the outward-pull direction disagree, which is what caused the jitter.
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      meshes.forEach(mesh => {
        const t = mesh.userData.target as { x: number; y: number; z: number; s: number } | undefined;
        if (t) {
          mesh.position.x += (t.x - mesh.position.x) * 0.2;
          mesh.position.y += (t.y - mesh.position.y) * 0.2;
          mesh.position.z += (t.z - mesh.position.z) * 0.2;
          const s = mesh.scale.x + (t.s - mesh.scale.x) * 0.2;
          mesh.scale.setScalar(s);
        }
      });
      renderer.render(scene, camera);
    };
    animate();

    // Interaction
    const raycastAt = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      return raycaster.intersectObjects(meshes);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const intersects = raycastAt(event);
      const hovered = intersects[0]?.object as THREE.Mesh | undefined;
      renderer.domElement.style.cursor = hovered && onSliceClickRef.current ? 'pointer' : 'default';
      meshes.forEach((mesh) => {
        const { baseX, baseY } = mesh.userData as { baseX: number; baseY: number };
        // Only the single top-most hovered slice pulls out — the animate loop
        // eases toward these targets, so there's no snapping/jitter.
        if (mesh === hovered) {
          mesh.userData.target = { x: baseX * 4, y: baseY * 4, z: 26, s: 1.06 };
        } else {
          mesh.userData.target = { x: baseX, y: baseY, z: 10, s: 1 };
        }
      });
    };
    renderer.domElement.addEventListener('mouseleave', () => {
      meshes.forEach(mesh => {
        const { baseX, baseY } = mesh.userData as { baseX: number; baseY: number };
        mesh.userData.target = { x: baseX, y: baseY, z: 10, s: 1 };
      });
    });

    const handleClick = (event: MouseEvent) => {
      if (!onSliceClickRef.current) return;
      const intersects = raycastAt(event);
      if (intersects.length > 0) {
        const index = (intersects[0].object as THREE.Mesh).userData.index as number;
        onSliceClickRef.current(index);
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const newWidth = container.clientWidth || 400;
      cameraRef.current.aspect = newWidth / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationIdRef.current!);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('se:theme', onThemeChange);
      renderer.dispose();
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      container.removeChild(renderer.domElement);
    };
  }, [data, labels, colors, height, innerRadius, animate, total]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      style={{ height, width: '100%' }}
    />
  );
}

interface BarChart3DProps {
  data: number[];
  labels: string[];
  colors: string[];
  className?: string;
  height?: number;
  maxValue?: number;
  animate?: boolean;
}

export function BarChart3D({ data, labels, colors, className, height = 300, maxValue, animate = true }: BarChart3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const animationIdRef = useRef<number>();

  const max = useMemo(() => maxValue || (data?.length ? Math.max(...data) * 1.2 : 100), [data, maxValue]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!data?.length) return;

    const container = containerRef.current;
    const width = container.clientWidth || 400;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 150, 300);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    const barWidth = 60;
    const barDepth = 40;
    const spacing = 80;
    const totalWidth = (data.length - 1) * spacing;
    const startX = -totalWidth / 2;

    const meshes: THREE.Mesh[] = [];

    data.forEach((value, i) => {
      const barHeight = (value / max) * 200;
      const geometry = new THREE.BoxGeometry(barWidth, barHeight, barDepth);
      geometry.translate(0, barHeight / 2, 0);

      const material = new THREE.MeshPhysicalMaterial({
        color: colors[i % colors.length],
        metalness: 0.1,
        roughness: 0.3,
        clearcoat: 0.3,
        clearcoatRoughness: 0.2,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.x = startX + i * spacing;
      mesh.userData = { index: i, targetHeight: barHeight, originalY: 0 };
      scene.add(mesh);
      meshes.push(mesh);
    });

    meshesRef.current = meshes;

    let frame = 0;
    const animateFn = () => {
      animationIdRef.current = requestAnimationFrame(animateFn);

      if (animate) {
        frame += 0.02;
        meshes.forEach((mesh, i) => {
          mesh.rotation.y = Math.sin(frame + i) * 0.02;
        });
      }

      renderer.render(scene, camera);
    };
    animateFn();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const newWidth = container.clientWidth || 400;
      cameraRef.current.aspect = newWidth / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationIdRef.current!);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      container.removeChild(renderer.domElement);
    };
  }, [data, labels, colors, height, max, animate]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      style={{ height, width: '100%' }}
    />
  );
}

interface FunnelChart3DProps {
  stages: Array<{ label: string; value: number; color: string }>;
  className?: string;
  height?: number;
  animate?: boolean;
}

export function FunnelChart3D({ stages, className, height = 300, animate = true }: FunnelChart3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const animationIdRef = useRef<number>();

  const maxValue = useMemo(() => stages?.length ? Math.max(...stages.map((s) => s.value)) : 1, [stages]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 400;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 100, 300);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    const meshes: THREE.Mesh[] = [];
    const layerHeight = 50;
    const gap = 10;
    const maxWidth = 200;
    const minWidth = 40;

    stages.forEach((stage, i) => {
      const topWidth = maxWidth - (i * (maxWidth - minWidth) / (stages.length - 1));
      const bottomWidth = maxWidth - ((i + 1) * (maxWidth - minWidth) / (stages.length - 1));

      const geometry = new THREE.CylinderGeometry(
        topWidth / 2,
        bottomWidth / 2,
        layerHeight,
        32
      );
      geometry.translate(0, layerHeight / 2 + i * (layerHeight + gap), 0);

      const material = new THREE.MeshPhysicalMaterial({
        color: stage.color,
        metalness: 0.1,
        roughness: 0.3,
        clearcoat: 0.3,
        clearcoatRoughness: 0.2,
        transparent: true,
        opacity: 0.9,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { index: i };
      scene.add(mesh);
      meshes.push(mesh);
    });

    meshesRef.current = meshes;

    let frame = 0;
    const animateFn = () => {
      animationIdRef.current = requestAnimationFrame(animateFn);

      if (animate) {
        frame += 0.01;
        meshes.forEach((mesh, i) => {
          mesh.rotation.y = Math.sin(frame + i * 0.5) * 0.03;
        });
      }

      renderer.render(scene, camera);
    };
    animateFn();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const newWidth = container.clientWidth || 400;
      cameraRef.current.aspect = newWidth / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationIdRef.current!);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      container.removeChild(renderer.domElement);
    };
  }, [stages, height, animate, maxValue]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      style={{ height, width: '100%' }}
    />
  );
}
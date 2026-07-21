'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

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

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 150, 300);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 0.3);
    dirLight2.position.set(-100, 100, -100);
    scene.add(dirLight2);

    // Create pie slices
    const radius = 80;
    const meshes: THREE.Mesh[] = [];
    let startAngle = -Math.PI / 2;

    data.forEach((value, i) => {
      const sliceAngle = (value / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, radius, startAngle, endAngle, false);
      shape.lineTo(0, 0);

      if (innerRadius > 0) {
        const holePath = new THREE.Path();
        holePath.absarc(0, 0, radius * innerRadius, endAngle, startAngle, true);
        shape.holes.push(holePath);
      }

      const geometry = new THREE.ShapeGeometry(shape);
      geometry.translate(0, 0, -10);

      const extrudeGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: 20,
        // High curve resolution = smooth slice edges (default 12 looks faceted)
        curveSegments: 64,
        bevelEnabled: true,
        bevelSegments: 6,
        bevelSize: 2,
        bevelThickness: 2,
      });

      const material = new THREE.MeshPhysicalMaterial({
        color: colors[i % colors.length],
        metalness: 0.1,
        roughness: 0.3,
        clearcoat: 0.3,
        clearcoatRoughness: 0.2,
        transparent: false,
      });

      const mesh = new THREE.Mesh(extrudeGeometry, material);
      mesh.position.z = 10;
      mesh.userData = { index: i, startAngle, endAngle, originalZ: 10 };
      scene.add(mesh);
      meshes.push(mesh);

      startAngle = endAngle;
    });

    meshesRef.current = meshes;

    // Center piece
    const centerGeometry = new THREE.CircleGeometry(radius * innerRadius, 64);
    const centerMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.8,
    });
    const centerMesh = new THREE.Mesh(centerGeometry, centerMaterial);
    centerMesh.position.z = 12;
    scene.add(centerMesh);

    // Animation loop
    let frame = 0;
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      frame += 0.005;
      meshes.forEach((mesh, i) => {
        const delay = i * 0.5;
        mesh.rotation.z = Math.sin(frame + delay) * 0.02;
        mesh.position.y = Math.sin(frame * 2 + delay) * 1;
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
      renderer.domElement.style.cursor = intersects.length > 0 && onSliceClickRef.current ? 'pointer' : 'default';
      meshes.forEach((mesh) => {
        const isHovered = intersects.some((intersect) => intersect.object === mesh);
        if (isHovered) {
          mesh.position.z = 30;
          mesh.scale.setScalar(1.05);
        } else {
          mesh.position.z = 10;
          mesh.scale.setScalar(1);
        }
      });
    };

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
      renderer.dispose();
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      centerMesh.geometry.dispose();
      centerMaterial.dispose();
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
'use client';

import { useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { cn } from '@/lib/utils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

interface ChartWrapperProps {
  data: any;
  options?: any;
  className?: string;
  type?: 'line' | 'doughnut' | 'bar' | 'area';
  height?: number;
}

export function LineChart({ data, options, className, height = 180 }: ChartWrapperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const chart = new ChartJS(ctx, {
      type: 'line',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17,24,39,0.95)',
            titleColor: '#fff',
            bodyColor: '#9CA3AF',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
          },
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { size: 9 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { size: 9 }, callback: (v) => '$' + v } },
        },
        ...options,
      },
    });

    return () => chart.destroy();
  }, [data, options]);

  return <canvas ref={canvasRef} className={cn(className)} style={{ height }} />;
}

export function DoughnutChart({ data, options, className, height = 180 }: ChartWrapperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const chart = new ChartJS(ctx, {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#999', padding: 8, boxWidth: 10, font: { size: 9 } } },
          tooltip: {
            backgroundColor: 'rgba(17,24,39,0.95)',
            titleColor: '#fff',
            bodyColor: '#9CA3AF',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
          },
        },
        ...options,
      },
    });

    return () => chart.destroy();
  }, [data, options]);

  return <canvas ref={canvasRef} className={cn(className)} style={{ height }} />;
}

export function BarChart({ data, options, className, height = 180 }: ChartWrapperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const chart = new ChartJS(ctx, {
      type: 'bar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17,24,39,0.95)',
            titleColor: '#fff',
            bodyColor: '#9CA3AF',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
          },
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { size: 9 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { size: 9 } } },
        },
        ...options,
      },
    });

    return () => chart.destroy();
  }, [data, options]);

  return <canvas ref={canvasRef} className={cn(className)} style={{ height }} />;
}

export function AreaChart({ data, options, className, height = 180 }: ChartWrapperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const chart = new ChartJS(ctx, {
      type: 'line',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17,24,39,0.95)',
            titleColor: '#fff',
            bodyColor: '#9CA3AF',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
          },
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { size: 9 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { size: 9 } } },
        },
        elements: {
          line: { tension: 0.3, borderWidth: 2 },
          point: { radius: 0, hitRadius: 10, hoverRadius: 4 },
        },
        ...options,
      },
    });

    return () => chart.destroy();
  }, [data, options]);

  return <canvas ref={canvasRef} className={cn(className)} style={{ height }} />;
}
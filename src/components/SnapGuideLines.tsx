import { useStore, useReactFlow } from '@xyflow/react';

interface GuideLine {
  type: 'horizontal' | 'vertical';
  pos: number;
}

export default function SnapGuideLines({ guides }: { guides: GuideLine[] }) {
  const transform = useStore((s) => s.transform);
  const [tx, ty, scale] = transform;

  if (guides.length === 0) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none z-50" style={{ width: '100%', height: '100%' }}>
      {guides.map((guide, i) => {
        if (guide.type === 'vertical') {
          const x = guide.pos * scale + tx;
          return (
            <line
              key={`v-${i}`}
              x1={x}
              y1={0}
              x2={x}
              y2="100%"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          );
        } else {
          const y = guide.pos * scale + ty;
          return (
            <line
              key={`h-${i}`}
              x1={0}
              y1={y}
              x2="100%"
              y2={y}
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          );
        }
      })}
    </svg>
  );
}

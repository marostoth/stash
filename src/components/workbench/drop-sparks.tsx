import { AnimatePresence, motion } from 'motion/react';

interface DropSparksProps {
  active: boolean;
}

interface SparkVector {
  id: string;
  dx: number;
  dy: number;
  size: number;
  delay: number;
}

const SPARK_VECTORS: readonly SparkVector[] = [
  { id: 's0', dx: -44, dy: -26, size: 5, delay: 0 },
  { id: 's1', dx: 0, dy: -36, size: 4, delay: 0.015 },
  { id: 's2', dx: 44, dy: -24, size: 5, delay: 0.01 },
  { id: 's3', dx: 54, dy: 4, size: 4, delay: 0.02 },
  { id: 's4', dx: 40, dy: 28, size: 5, delay: 0.005 },
  { id: 's5', dx: 0, dy: 34, size: 4, delay: 0.025 },
  { id: 's6', dx: -42, dy: 26, size: 5, delay: 0.012 },
  { id: 's7', dx: -52, dy: -2, size: 4, delay: 0.018 },
] as const;

export function DropSparks({ active }: DropSparksProps) {
  return (
    <AnimatePresence>
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 overflow-visible"
        >
          {/* Crisp expanding accent impact ring */}
          <motion.div
            initial={{ opacity: 0.8, scale: 0.94 }}
            animate={{ opacity: 0, scale: 1.09 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.34, ease: 'easeOut' }}
            style={{
              borderColor: 'var(--stash-accent)',
              boxShadow:
                '0 0 18px -2px color-mix(in srgb, var(--stash-accent) 55%, transparent)',
            }}
            className="absolute inset-0 rounded-card border-2 will-change-transform"
          />

          {/* 8 theme-accent micro-sparks radiating outward */}
          {SPARK_VECTORS.map((spark) => (
            <motion.span
              key={spark.id}
              initial={{
                x: 0,
                y: 0,
                scale: 1,
                opacity: 0.95,
              }}
              animate={{
                x: spark.dx,
                y: spark.dy,
                scale: 0,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.34,
                delay: spark.delay,
                ease: 'easeOut',
              }}
              style={{
                width: spark.size,
                height: spark.size,
                backgroundColor: 'var(--stash-accent)',
                boxShadow:
                  '0 0 8px color-mix(in srgb, var(--stash-accent) 75%, transparent)',
              }}
              className="absolute left-1/2 top-1/2 -ml-0.5 -mt-0.5 rounded-full will-change-transform"
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

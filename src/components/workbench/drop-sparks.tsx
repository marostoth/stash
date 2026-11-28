import { AnimatePresence, motion } from 'motion/react';

interface DropSparksProps {
  active: boolean;
  /** Enables the 1-frame white-hot Arcade contact flash (canvas handles sparks/ash) */
  arcade?: boolean;
  /** Compact variant kept for DetailsRow API compatibility */
  compact?: boolean;
  /** Monotonic sequence key so rapid consecutive drops on the same card always replay */
  burstKey?: number;
}

/**
 * Dual-tier clipped contact flash (zero DOM particles — Arcade sparks, shockwave,
 * and ash dust render on the fixed 2D `<VfxCanvas />`):
 * - `Tactile`: crisp 1px inset accent rim-light flash clipped to card radius.
 * - `Arcade`: 1-frame pure-white 1px inset rim + subtle white surface flash
 *   (`opacity: 0.4 -> 0` over 90ms), strictly `overflow-hidden` inside the card.
 */
export function DropSparks({
  active,
  arcade = false,
  burstKey = 0,
}: DropSparksProps) {
  return (
    <AnimatePresence>
      {active &&
        (arcade ? (
          <motion.div
            key={`arcade-flash-${burstKey}`}
            aria-hidden="true"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.09, ease: 'easeOut' }}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              boxShadow: 'inset 0 0 0 1px #FFFFFF',
            }}
            className="pointer-events-none absolute inset-0 z-[15] overflow-hidden rounded-card"
          />
        ) : (
          <motion.div
            key={`tactile-rim-${burstKey}`}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.95, 0] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.2,
              times: [0, 0.18, 1],
              ease: 'easeOut',
            }}
            style={{
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--stash-accent) 78%, var(--stash-text) 22%)',
            }}
            className="pointer-events-none absolute inset-0 z-[15] overflow-hidden rounded-card"
          />
        ))}
    </AnimatePresence>
  );
}

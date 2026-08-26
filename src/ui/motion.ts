import type { Variants } from 'motion/react'

/**
 * Direction-aware transitions.
 *
 * Motion animates `x`, not logical properties — so in Arabic every slide-in
 * would travel the wrong way unless the offset is multiplied by the direction.
 * Pass `dir` from useLocale().
 */
export function slideVariants(dir: 1 | -1): Variants {
  return {
    enter: { x: 40 * dir, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40 * dir, opacity: 0 },
  }
}

export const springy = { type: 'spring', stiffness: 320, damping: 30 } as const

/** Direction-neutral — safe to use anywhere. */
export const popIn: Variants = {
  enter: { scale: 0.94, opacity: 0 },
  center: { scale: 1, opacity: 1 },
  exit: { scale: 0.98, opacity: 0 },
}

/** Every variant set must define all three labels — a missing label can leave
 *  AnimatePresence waiting forever on a child that never animates. */
export const listStagger: Variants = {
  enter: {},
  center: { transition: { staggerChildren: 0.05 } },
  exit: {},
}

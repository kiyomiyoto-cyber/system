import type { Variants, Transition } from 'framer-motion'

export const ease: Transition['ease'] = [0.22, 1, 0.36, 1]

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease } },
}

export const slideInFromStart: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease } },
}

export const staggerContainer = (stagger = 0.06, delayChildren = 0.04): Variants => ({
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: stagger, delayChildren },
  },
})

export const hoverLift = {
  whileHover: { y: -2, transition: { duration: 0.18, ease } },
  whileTap: { scale: 0.985 },
} as const

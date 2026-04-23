'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'

type HoverCardProps = HTMLMotionProps<'div'> & {
  lift?: number
}

/**
 * Wraps a card in a motion.div that lifts slightly on hover.
 * Use inside server components as a client-side hover layer.
 */
export const HoverCard = forwardRef<HTMLDivElement, HoverCardProps>(function HoverCard(
  { children, lift = 2, className, ...rest },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={className}
      whileHover={{ y: -lift }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  )
})

'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { fadeInUp } from './variants'

type FadeInProps = HTMLMotionProps<'div'> & {
  delay?: number
  as?: 'div' | 'section' | 'article' | 'header' | 'aside'
}

export function FadeIn({ children, delay = 0, as = 'div', ...rest }: FadeInProps) {
  const MotionTag = motion[as]
  return (
    <MotionTag
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </MotionTag>
  )
}

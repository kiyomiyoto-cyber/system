'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { fadeInUp, staggerContainer } from './variants'

type StaggerProps = HTMLMotionProps<'div'> & {
  stagger?: number
  delayChildren?: number
}

export function Stagger({ children, stagger = 0.06, delayChildren = 0.04, ...rest }: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(stagger, delayChildren)}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={fadeInUp} {...rest}>
      {children}
    </motion.div>
  )
}

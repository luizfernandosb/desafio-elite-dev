import styles from './Skeleton.module.css'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: 'sm' | 'md' | 'full'
  className?: string
}

export function Skeleton({ width = '100%', height = '1rem', radius = 'sm', className }: SkeletonProps) {
  return (
    <span
      className={[styles.skeleton, styles[radius], className].filter(Boolean).join(' ')}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

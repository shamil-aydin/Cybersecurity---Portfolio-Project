import { motion } from 'framer-motion'

const defaultLines = [
  'sentrivue v1.0 // field terminal',
  'loading severity model [0..20]',
  'handshake wazuh-manager',
  'pulling alerts, agents, timeline',
]

export default function BootLoader({ lines = defaultLines }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4" role="status" aria-live="polite">
      <div className="space-y-2 text-sm text-muted">
        {lines.map((l, i) => (
          <motion.p
            key={l}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.28, duration: 0.25 }}
          >
            <span className="text-accent">&gt;</span> {l}
            {i < lines.length - 1 && (
              <motion.span
                className="ml-2 text-ink"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.28 + 0.2 }}
              >
                OK
              </motion.span>
            )}
          </motion.p>
        ))}
        <p className="caret text-ink">
          <span className="sr-only-live">Loading</span>
        </p>
      </div>
      <div className="mt-6 h-[3px] w-full overflow-hidden bg-line">
        <motion.div
          className="h-full bg-accent"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.3, ease: 'easeInOut' }}
        />
      </div>
    </div>
  )
}

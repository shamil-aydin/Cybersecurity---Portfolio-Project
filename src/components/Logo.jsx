// PLACEHOLDER LOGO. Replace the contents of this file with the real
// Sentrivue logo when the team delivers it. Every place in the app
// imports the logo from here, so nothing else needs to change.

export default function Logo({ size = 20, showMark = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Sentrivue">
      {showMark && (
        <span
          aria-hidden="true"
          className="inline-block border border-accent"
          style={{ width: size, height: size }}
        />
      )}
      <span
        className="font-display font-bold uppercase tracking-[0.18em] text-ink"
        style={{ fontSize: size * 0.75 }}
      >
        Sentrivue
      </span>
    </span>
  )
}

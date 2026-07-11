import { STEPS, STATUS_META } from '../lib/constants'

// The visitor-facing 4-step tracker:
// Appointment confirmed → Repairer assigned → Repair in progress → Repair completed
export default function ProgressSteps({ status }) {
  const reached = STATUS_META[status]?.step ?? 0
  const cancelled = status === 'cancelled'

  return (
    <div className={`steps ${cancelled ? 'steps-off' : ''}`}>
      {STEPS.map((step, i) => {
        const stepNo = i + 1
        const done = reached >= stepNo
        const current = reached === stepNo && status !== 'completed'
        return (
          <div key={step.key} className={`step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
            <div className="s-dot">{done ? '✓' : stepNo}</div>
            <div className="s-label">{step.label}</div>
          </div>
        )
      })}
    </div>
  )
}

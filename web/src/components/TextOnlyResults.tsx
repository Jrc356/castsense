import type { CastSenseAnalysisResult } from '../types/contracts'

interface TextOnlyResultsProps {
  result: CastSenseAnalysisResult
  unavailableReason?: string
}

export function TextOnlyResults({ result, unavailableReason }: TextOnlyResultsProps): React.JSX.Element {
  return (
    <section className="panel" aria-label="Text-only analysis">
      <h3>Text Summary</h3>
      {unavailableReason ? <p>{unavailableReason}</p> : null}
      {result.plan_summary?.map((line, index) => (
        <p key={`plan-${index}`}>{line}</p>
      ))}
      {result.conditions_summary?.map((line, index) => (
        <p key={`condition-${index}`}>{line}</p>
      ))}
    </section>
  )
}

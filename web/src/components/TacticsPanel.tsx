import type { Tactic, Zone } from '../types/contracts'

interface TacticsPanelProps {
  tactics: Tactic[]
  zones: Zone[]
  selectedZoneId: string | null
}

export function TacticsPanel({ tactics, zones, selectedZoneId }: TacticsPanelProps): React.JSX.Element | null {
  if (!selectedZoneId) {
    return null
  }

  const zone = zones.find((item) => item.zone_id === selectedZoneId)
  const tactic = tactics.find((item) => item.zone_id === selectedZoneId)

  if (!zone || !tactic) {
    return null
  }

  return (
    <section className="panel" aria-label="Selected zone tactics">
      <h3>{zone.label} Tactical Plan</h3>
      <p><strong>Target species:</strong> {zone.target_species}</p>
      <p><strong>Rig:</strong> {tactic.recommended_rig}</p>
      <p><strong>Depth:</strong> {tactic.target_depth}</p>
      <p><strong>Retrieve:</strong> {tactic.retrieve_style}</p>
      {tactic.cadence ? <p><strong>Cadence:</strong> {tactic.cadence}</p> : null}
      {tactic.why_this_zone_works?.length ? (
        <ul>
          {tactic.why_this_zone_works.map((reason, index) => (
            <li key={`${zone.zone_id}-why-${index}`}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

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
    <section className="panel tactics-panel" aria-label="Selected zone tactics">
      <h3>{zone.label} Tactical Plan</h3>
      <dl className="tactics-facts">
        <div>
          <dt>Target species</dt>
          <dd>{zone.target_species}</dd>
        </div>
        <div>
          <dt>Rig</dt>
          <dd>{tactic.recommended_rig}</dd>
        </div>
        <div>
          <dt>Depth</dt>
          <dd>{tactic.target_depth}</dd>
        </div>
        <div>
          <dt>Retrieve</dt>
          <dd>{tactic.retrieve_style}</dd>
        </div>
        {tactic.cadence ? (
          <div>
            <dt>Cadence</dt>
            <dd>{tactic.cadence}</dd>
          </div>
        ) : null}
      </dl>
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

import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'

export function ErrorScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const { state, retry, reset } = useApp()
  const error = state.error

  if (!error) {
    return (
      <main className="screen">
        <section className="panel">
          <h2>No error context available.</h2>
          <button type="button" onClick={() => navigate('/')}>Back Home</button>
        </section>
      </main>
    )
  }

  return (
    <main className="screen">
      <section className="panel hero-panel error">
        <h2>Analysis Error</h2>
        <p>{error.code}</p>
      </section>

      <section className="panel">
        <p>{error.message}</p>
        <p>Retryable: {error.retryable ? 'Yes' : 'No'}</p>
      </section>

      <section className="action-row">
        <button
          className="secondary"
          type="button"
          onClick={() => {
            if (error.retryable) {
              retry()
            }
            navigate('/')
          }}
        >
          Retry
        </button>
        <button
          type="button"
          onClick={() => {
            reset()
            navigate('/')
          }}
        >
          Start Over
        </button>
      </section>
    </main>
  )
}

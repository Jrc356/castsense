import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('App', () => {
  it('renders the home context heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', {
        name: /set your fishing context/i,
      }),
    ).toBeInTheDocument()
  })
})

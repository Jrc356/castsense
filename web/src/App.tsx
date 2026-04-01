import './App.css'
import { AppProvider } from './state/AppContext'
import { AppRouter } from './navigation/AppRouter'

function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  )
}

export default App

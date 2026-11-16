import { useTheme } from './hooks/useTheme'
import { ConsoleView } from './components/console/ConsoleView'

export default function App() {
  const { theme, toggle } = useTheme()
  return <ConsoleView theme={theme} onToggleTheme={toggle} />
}

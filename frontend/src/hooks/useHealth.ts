import { api } from '../lib/api'
import { usePolling } from './usePolling'

export function useHealth() {
  const { data, error } = usePolling(api.health, 'health', 10000)
  return { online: !!data && !error, mockMode: !!data?.mockMode, checked: !!data || !!error }
}

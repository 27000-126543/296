import { create } from 'zustand'
import type { StorageStation } from '../types'
import { generateStorageStations } from '../utils/mockData'

interface StorageState {
  stations: StorageStation[]
  setMode: (id: string, mode: StorageStation['mode']) => void
  setStrategy: (id: string, strategy: StorageStation['strategy']) => void
  refresh: () => void
}

export const useStorageStore = create<StorageState>((set) => ({
  stations: generateStorageStations(),
  setMode: (id, mode) => {
    set((state) => ({
      stations: state.stations.map((s) => {
        if (s.id !== id) return s
        const chargeRate = mode === 'charging' ? Math.round((5 + Math.random() * 25) * 10) / 10 : 0
        const dischargeRate = mode === 'discharging' ? Math.round((5 + Math.random() * 25) * 10) / 10 : 0
        return { ...s, mode, chargeRate, dischargeRate }
      }),
    }))
  },
  setStrategy: (id, strategy) => {
    set((state) => ({
      stations: state.stations.map((s) => (s.id === id ? { ...s, strategy } : s)),
    }))
  },
  refresh: () => {
    set({ stations: generateStorageStations() })
  },
}))

import { create } from 'zustand'
import type { PowerSource, LoadData } from '../types'
import { generatePowerSources, generateLoadData } from '../utils/mockData'

interface PowerState {
  sources: PowerSource[]
  loadData: LoadData[]
  totalGeneration: number
  totalLoad: number
  refresh: () => void
  updateOutput: (id: string, output: number) => void
}

export const usePowerStore = create<PowerState>((set, get) => ({
  sources: generatePowerSources(),
  loadData: generateLoadData(),
  get totalGeneration() {
    return get().sources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
  },
  get totalLoad() {
    return get().loadData.reduce((sum, l) => sum + l.total, 0)
  },
  refresh: () => {
    set((state) => ({
      sources: state.sources.map((s) => ({
        ...s,
        currentOutput: s.status === 'online' ? Math.round(s.capacity * (0.4 + Math.random() * 0.55) * 10) / 10 : 0,
      })),
      loadData: generateLoadData(),
    }))
  },
  updateOutput: (id, output) => {
    set((state) => ({
      sources: state.sources.map((s) => (s.id === id ? { ...s, currentOutput: output } : s)),
    }))
  },
}))

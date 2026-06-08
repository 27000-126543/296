import { create } from 'zustand'
import type { StorageStation } from '../types'
import { generateStorageStations, generateChargeDischargePlan } from '../utils/mockData'

interface StorageState {
  stations: StorageStation[]
  setMode: (id: string, mode: StorageStation['mode']) => void
  setStrategy: (id: string, strategy: StorageStation['strategy']) => void
  applyAutoPlan: (id: string) => void
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
        return { ...s, mode, chargeRate, dischargeRate, strategy: 'manual', manualOverride: s.strategy === 'auto' }
      }),
    }))
  },
  setStrategy: (id, strategy) => {
    set((state) => ({
      stations: state.stations.map((s) => (s.id === id ? { ...s, strategy, manualOverride: false } : s)),
    }))
    if (strategy === 'auto') {
      const station = useStorageStore.getState().stations.find((s) => s.id === id)
      if (station) {
        const plan = station.dailyPlan
        const currentHour = new Date().getHours()
        const planNow = plan[currentHour]
        if (planNow) {
          const mode = planNow.action === 'charge' ? 'charging' as const : planNow.action === 'discharge' ? 'discharging' as const : 'standby' as const
          set((state) => ({
            stations: state.stations.map((s) =>
              s.id === id ? {
                ...s,
                mode,
                chargeRate: mode === 'charging' ? planNow.rate : 0,
                dischargeRate: mode === 'discharging' ? planNow.rate : 0,
              } : s
            ),
          }))
        }
      }
    }
  },
  applyAutoPlan: (id) => {
    const station = useStorageStore.getState().stations.find((s) => s.id === id)
    if (!station) return
    const dailyPlan = generateChargeDischargePlan(station.capacity)
    const estimatedRevenue = Math.round(dailyPlan.reduce((sum, p) => sum + p.revenue, 0) * 100) / 100
    const totalRevenue = Math.abs(estimatedRevenue)
    const currentHour = new Date().getHours()
    const planNow = dailyPlan[currentHour]
    const mode = planNow ? (planNow.action === 'charge' ? 'charging' as const : planNow.action === 'discharge' ? 'discharging' as const : 'standby' as const) : station.mode

    set((state) => ({
      stations: state.stations.map((s) => {
        if (s.id !== id) return s
        const participants = s.participants.map((p) => ({
          ...p,
          revenue: Math.round((totalRevenue * p.share / s.participants.reduce((sum, pp) => sum + pp.share, 0)) * 100) / 100,
        }))
        return {
          ...s,
          dailyPlan,
          estimatedRevenue,
          revenue: totalRevenue,
          participants,
          strategy: 'auto',
          manualOverride: false,
          mode,
          chargeRate: mode === 'charging' ? (planNow?.rate || 0) : 0,
          dischargeRate: mode === 'discharging' ? (planNow?.rate || 0) : 0,
        }
      }),
    }))
  },
  refresh: () => {
    set({ stations: generateStorageStations() })
  },
}))

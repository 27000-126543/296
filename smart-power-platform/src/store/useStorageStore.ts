import { create } from 'zustand'
import type { StorageStation } from '../types'
import { generateStorageStations, generateChargeDischargePlan } from '../utils/mockData'
import dayjs from 'dayjs'

interface StorageState {
  stations: StorageStation[]
  setMode: (id: string, mode: StorageStation['mode'], reason?: string) => void
  setStrategy: (id: string, strategy: StorageStation['strategy']) => void
  applyAutoPlan: (id: string) => void
  recoverAuto: (id: string) => void
  refresh: () => void
}

export const useStorageStore = create<StorageState>((set) => ({
  stations: generateStorageStations(),
  setMode: (id, mode, reason) => {
    set((state) => ({
      stations: state.stations.map((s) => {
        if (s.id !== id) return s
        const chargeRate = mode === 'charging' ? Math.round((5 + Math.random() * 25) * 10) / 10 : 0
        const dischargeRate = mode === 'discharging' ? Math.round((5 + Math.random() * 25) * 10) / 10 : 0
        const isOverride = s.strategy === 'auto'
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
        const recoverAt = dayjs().add(2, 'hour').format('YYYY-MM-DD HH:mm:ss')
        const currentHour = new Date().getHours()
        const planNow = s.dailyPlan[currentHour]
        const plannedAction = planNow ? (planNow.action === 'charge' ? 'charging' as const : planNow.action === 'discharge' ? 'discharging' as const : 'standby' as const) : undefined
        return {
          ...s,
          mode,
          chargeRate,
          dischargeRate,
          strategy: isOverride ? 'auto' : 'manual',
          manualOverride: isOverride,
          overrideReason: isOverride ? (reason || '调度员临时覆盖') : undefined,
          overrideStartAt: isOverride ? now : undefined,
          overrideRecoverAt: isOverride ? recoverAt : undefined,
          plannedAction: isOverride ? (plannedAction || s.mode) : undefined,
        }
      }),
    }))
  },
  setStrategy: (id, strategy) => {
    set((state) => ({
      stations: state.stations.map((s) => (s.id === id ? { ...s, strategy, manualOverride: false, overrideReason: undefined, overrideStartAt: undefined, overrideRecoverAt: undefined, plannedAction: undefined } : s)),
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
          overrideReason: undefined,
          overrideStartAt: undefined,
          overrideRecoverAt: undefined,
          plannedAction: undefined,
          mode,
          chargeRate: mode === 'charging' ? (planNow?.rate || 0) : 0,
          dischargeRate: mode === 'discharging' ? (planNow?.rate || 0) : 0,
        }
      }),
    }))
  },
  recoverAuto: (id) => {
    const station = useStorageStore.getState().stations.find((s) => s.id === id)
    if (!station || !station.manualOverride) return
    const plan = station.dailyPlan
    const currentHour = new Date().getHours()
    const planNow = plan[currentHour]
    const mode = planNow ? (planNow.action === 'charge' ? 'charging' as const : planNow.action === 'discharge' ? 'discharging' as const : 'standby' as const) : 'standby' as const
    set((state) => ({
      stations: state.stations.map((s) =>
        s.id === id ? {
          ...s,
          mode,
          chargeRate: mode === 'charging' ? (planNow?.rate || 0) : 0,
          dischargeRate: mode === 'discharging' ? (planNow?.rate || 0) : 0,
          manualOverride: false,
          overrideReason: undefined,
          overrideStartAt: undefined,
          overrideRecoverAt: undefined,
          plannedAction: undefined,
        } : s
      ),
    }))
  },
  refresh: () => {
    set({ stations: generateStorageStations() })
  },
}))

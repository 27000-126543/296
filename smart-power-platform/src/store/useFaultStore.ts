import { create } from 'zustand'
import type { FaultRecord } from '../types'
import { generateFaultRecords } from '../utils/mockData'
import dayjs from 'dayjs'

interface FaultState {
  records: FaultRecord[]
  assignTeam: (id: string, team: string) => void
  resolveFault: (id: string) => void
  escalateFault: (id: string) => void
  checkTimeout: () => void
  refresh: () => void
}

export const useFaultStore = create<FaultState>((set) => ({
  records: generateFaultRecords(),
  assignTeam: (id, team) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, status: 'assigned' as const, assignedTeam: team, assignedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : r
      ),
    }))
  },
  resolveFault: (id) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, status: 'resolved' as const, resolvedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : r
      ),
    }))
  },
  escalateFault: (id) => {
    set((state) => ({
      records: state.records.map((r) => (r.id === id ? { ...r, escalated: true } : r)),
    }))
  },
  checkTimeout: () => {
    const now = dayjs()
    set((state) => ({
      records: state.records.map((r) => {
        if (r.status === 'pending' && r.assignedAt) {
          const elapsed = now.diff(dayjs(r.assignedAt), 'minute')
          if (elapsed > 30) return { ...r, escalated: true }
        }
        if (r.status === 'pending' || r.status === 'assigned') {
          const elapsed = now.diff(dayjs(r.createdAt), 'minute')
          if (elapsed > 30 && !r.escalated) return { ...r, escalated: true }
        }
        return r
      }),
    }))
  },
  refresh: () => {
    set({ records: generateFaultRecords() })
  },
}))

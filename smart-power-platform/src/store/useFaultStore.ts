import { create } from 'zustand'
import type { FaultRecord } from '../types'
import { generateFaultRecords } from '../utils/mockData'
import dayjs from 'dayjs'
import { useNotificationStore } from './useNotificationStore'

interface FaultState {
  records: FaultRecord[]
  assignTeam: (id: string, team: string) => void
  acceptOrder: (id: string) => void
  startRepair: (id: string) => void
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
  acceptOrder: (id) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, status: 'accepted' as const, acceptedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : r
      ),
    }))
  },
  startRepair: (id) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, status: 'repairing' as const, repairingAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : r
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
    const record = useFaultStore.getState().records.find((r) => r.id === id)
    if (record) {
      useNotificationStore.getState().addNotification({
        title: '故障升级通知',
        content: `${record.id} 超30分钟未接单，已升级至区域主管`,
        type: 'fault',
      })
    }
  },
  checkTimeout: () => {
    const now = dayjs()
    set((state) => ({
      records: state.records.map((r) => {
        if (r.escalated || r.status === 'resolved') return r
        if (r.status === 'pending') {
          const elapsed = now.diff(dayjs(r.createdAt), 'minute')
          if (elapsed > 30) return { ...r, escalated: true }
        }
        if (r.status === 'assigned' && r.assignedAt) {
          const elapsed = now.diff(dayjs(r.assignedAt), 'minute')
          if (elapsed > 30) return { ...r, escalated: true }
        }
        return r
      }),
    }))
  },
  refresh: () => {
    set({ records: generateFaultRecords() })
  },
}))

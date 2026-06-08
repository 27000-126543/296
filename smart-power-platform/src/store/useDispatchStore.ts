import { create } from 'zustand'
import type { DispatchOrder } from '../types'
import { generateDispatchOrdersFromBalance, generateSeedDispatchOrders } from '../utils/mockData'
import { usePowerStore } from './usePowerStore'
import { useNotificationStore } from './useNotificationStore'

interface DispatchState {
  orders: DispatchOrder[]
  confirmOrder: (id: string) => void
  rejectOrder: (id: string) => void
  completeOrder: (id: string) => void
  autoGenerate: () => void
  refresh: () => void
}

export const useDispatchStore = create<DispatchState>((set) => ({
  orders: generateSeedDispatchOrders(
    usePowerStore.getState().sources,
    usePowerStore.getState().loadData
  ),
  confirmOrder: (id) => {
    set((state) => {
      const order = state.orders.find((o) => o.id === id)
      if (!order) return state
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        orders: state.orders.map((o) =>
          o.id === id ? {
            ...o,
            status: 'executing' as const,
            confirmedAt: now,
            operator: '调度员张伟',
            beforeOutput: o.currentOutput,
          } : o
        ),
      }
    })
    const order = useDispatchStore.getState().orders.find((o) => o.id === id)
    if (order) {
      usePowerStore.getState().updateOutput(order.sourceId, order.targetOutput)
      const updatedSources = usePowerStore.getState().sources
      const updatedLoad = usePowerStore.getState().loadData
      const newTotalGen = updatedSources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
      const newTotalLoad = updatedLoad.reduce((sum, l) => sum + l.total, 0)
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === id ? { ...o, balanceAfter: Math.round((newTotalGen - newTotalLoad) * 10) / 10 } : o
        ),
      }))
    }
  },
  rejectOrder: (id) => {
    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, status: 'rejected' as const } : o)),
    }))
  },
  completeOrder: (id) => {
    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, status: 'completed' as const, completedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) } : o)),
    }))
  },
  autoGenerate: () => {
    const { sources, loadData } = usePowerStore.getState()
    const totalGen = sources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
    const totalLoad = loadData.reduce((sum, l) => sum + l.total, 0)
    const balance = totalGen - totalLoad
    const rate = (balance / totalLoad) * 100
    if (Math.abs(rate) > 2) {
      const newOrders = generateDispatchOrdersFromBalance(sources, loadData)
      const pending = newOrders.filter((o) => o.status === 'pending')
      if (pending.length > 0) {
        set((state) => ({
          orders: [...pending, ...state.orders.filter((o) => o.status !== 'pending')],
        }))
        useNotificationStore.getState().addNotification({
          title: '调度指令建议',
          content: `供需偏差${Math.abs(balance).toFixed(0)}MW，已生成${pending.length}条调度建议`,
          type: 'dispatch',
        })
      }
    } else {
      useNotificationStore.getState().addNotification({
        title: '调度检测',
        content: `当前供需偏差${Math.abs(balance).toFixed(0)}MW（偏差率${Math.abs(rate).toFixed(1)}%），在正常范围内，无需生成调度指令`,
        type: 'dispatch',
      })
    }
  },
  refresh: () => {
    set({ orders: generateSeedDispatchOrders(usePowerStore.getState().sources, usePowerStore.getState().loadData) })
  },
}))

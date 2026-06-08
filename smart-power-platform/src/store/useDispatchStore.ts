import { create } from 'zustand'
import type { DispatchOrder } from '../types'
import { generateDispatchOrders } from '../utils/mockData'
import { usePowerStore } from './usePowerStore'

interface DispatchState {
  orders: DispatchOrder[]
  confirmOrder: (id: string) => void
  rejectOrder: (id: string) => void
  completeOrder: (id: string) => void
  refresh: () => void
}

export const useDispatchStore = create<DispatchState>((set) => ({
  orders: generateDispatchOrders(usePowerStore.getState().sources),
  confirmOrder: (id) => {
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === id ? { ...o, status: 'executing' as const, confirmedAt: new Date().toISOString(), operator: '调度员张伟' } : o
      ),
    }))
    const order = useDispatchStore.getState().orders.find((o) => o.id === id)
    if (order) {
      usePowerStore.getState().updateOutput(order.sourceId, order.targetOutput)
    }
  },
  rejectOrder: (id) => {
    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, status: 'rejected' as const } : o)),
    }))
  },
  completeOrder: (id) => {
    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, status: 'completed' as const, completedAt: new Date().toISOString() } : o)),
    }))
  },
  refresh: () => {
    set({ orders: generateDispatchOrders(usePowerStore.getState().sources) })
  },
}))

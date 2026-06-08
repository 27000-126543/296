import { create } from 'zustand'
import type { DispatchOrder, DispatchAuditLog } from '../types'
import { generateDispatchOrdersFromBalance, generateSeedDispatchOrders } from '../utils/mockData'
import { usePowerStore } from './usePowerStore'
import { useNotificationStore } from './useNotificationStore'
import dayjs from 'dayjs'

interface DispatchState {
  orders: DispatchOrder[]
  auditLogs: DispatchAuditLog[]
  confirmOrder: (id: string) => void
  rejectOrder: (id: string) => void
  completeOrder: (id: string) => void
  autoGenerate: () => void
  refresh: () => void
}

const addAuditLog = (logs: DispatchAuditLog[], log: Omit<DispatchAuditLog, 'id'>): DispatchAuditLog[] => {
  return [{ ...log, id: `AL${String(logs.length + 1).padStart(4, '0')}` }, ...logs]
}

export const useDispatchStore = create<DispatchState>((set) => ({
  orders: generateSeedDispatchOrders(
    usePowerStore.getState().sources,
    usePowerStore.getState().loadData
  ),
  auditLogs: [],
  confirmOrder: (id) => {
    set((state) => {
      const order = state.orders.find((o) => o.id === id)
      if (!order) return state
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
      const totalGen = usePowerStore.getState().sources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
      const totalLoad = usePowerStore.getState().loadData.reduce((sum, l) => sum + l.total, 0)
      return {
        orders: state.orders.map((o) =>
          o.id === id ? {
            ...o,
            status: 'executing' as const,
            confirmedAt: now,
            operator: '调度员张伟',
            beforeOutput: o.currentOutput,
            balanceBefore: Math.round((totalGen - totalLoad) * 10) / 10,
          } : o
        ),
        auditLogs: addAuditLog(state.auditLogs, {
          orderId: id,
          action: 'confirm',
          operator: '调度员张伟',
          timestamp: now,
          detail: `确认执行调度指令：${order.sourceName}出力从${order.currentOutput.toFixed(1)}MW调整为${order.targetOutput.toFixed(1)}MW`,
          balanceBefore: Math.round((totalGen - totalLoad) * 10) / 10,
          outputBefore: order.currentOutput,
          outputAfter: order.targetOutput,
        }),
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
        auditLogs: state.auditLogs.map((log, i) =>
          i === 0 ? { ...log, balanceAfter: Math.round((newTotalGen - newTotalLoad) * 10) / 10 } : log
        ),
      }))
    }
  },
  rejectOrder: (id) => {
    set((state) => {
      const order = state.orders.find((o) => o.id === id)
      if (!order) return state
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
      const totalGen = usePowerStore.getState().sources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
      const totalLoad = usePowerStore.getState().loadData.reduce((sum, l) => sum + l.total, 0)
      return {
        orders: state.orders.map((o) => (o.id === id ? { ...o, status: 'rejected' as const } : o)),
        auditLogs: addAuditLog(state.auditLogs, {
          orderId: id,
          action: 'reject',
          operator: '调度员张伟',
          timestamp: now,
          detail: `拒绝调度指令：${order.sourceName}出力调整为${order.targetOutput.toFixed(1)}MW`,
          balanceBefore: Math.round((totalGen - totalLoad) * 10) / 10,
          outputBefore: order.currentOutput,
        }),
      }
    })
  },
  completeOrder: (id) => {
    set((state) => {
      const order = state.orders.find((o) => o.id === id)
      if (!order) return state
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
      const totalGen = usePowerStore.getState().sources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
      const totalLoad = usePowerStore.getState().loadData.reduce((sum, l) => sum + l.total, 0)
      return {
        orders: state.orders.map((o) => (o.id === id ? { ...o, status: 'completed' as const, completedAt: now } : o)),
        auditLogs: addAuditLog(state.auditLogs, {
          orderId: id,
          action: 'complete',
          operator: '调度员张伟',
          timestamp: now,
          detail: `完成调度指令：${order.sourceName}出力已调整至${order.targetOutput.toFixed(1)}MW`,
          balanceBefore: Math.round((totalGen - totalLoad) * 10) / 10,
          outputBefore: order.beforeOutput,
          outputAfter: order.targetOutput,
        }),
      }
    })
  },
  autoGenerate: () => {
    const { sources, loadData } = usePowerStore.getState()
    const totalGen = sources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
    const totalLoad = loadData.reduce((sum, l) => sum + l.total, 0)
    const balance = totalGen - totalLoad
    const rate = (balance / totalLoad) * 100
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    if (Math.abs(rate) > 2) {
      const newOrders = generateDispatchOrdersFromBalance(sources, loadData)
      const pending = newOrders.filter((o) => o.status === 'pending')
      if (pending.length > 0) {
        set((state) => ({
          orders: [...pending, ...state.orders.filter((o) => o.status !== 'pending')],
          auditLogs: addAuditLog(state.auditLogs, {
            orderId: 'SYSTEM',
            action: 'auto_generate',
            operator: '系统自动',
            timestamp: now,
            detail: `供需偏差${Math.abs(balance).toFixed(0)}MW（偏差率${Math.abs(rate).toFixed(1)}%），自动生成${pending.length}条调度建议`,
            balanceBefore: Math.round(balance * 10) / 10,
          }),
        }))
        useNotificationStore.getState().addNotification({
          title: '调度指令建议',
          content: `供需偏差${Math.abs(balance).toFixed(0)}MW，已生成${pending.length}条调度建议`,
          type: 'dispatch',
        })
      }
    } else {
      set((state) => ({
        auditLogs: addAuditLog(state.auditLogs, {
          orderId: 'SYSTEM',
          action: 'auto_generate',
          operator: '系统自动',
          timestamp: now,
          detail: `供需偏差${Math.abs(balance).toFixed(0)}MW（偏差率${Math.abs(rate).toFixed(1)}%），在正常范围内，无需生成调度指令`,
          balanceBefore: Math.round(balance * 10) / 10,
        }),
      }))
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

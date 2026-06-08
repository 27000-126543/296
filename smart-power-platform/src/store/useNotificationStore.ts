import { create } from 'zustand'

interface Notification {
  id: string
  title: string
  content: string
  type: 'dispatch' | 'fault' | 'carbon' | 'price' | 'grid'
  time: string
  read: boolean
}

interface NotificationState {
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id' | 'time' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  unreadCount: () => number
}

let notifCounter = 0

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [
    { id: 'N001', title: '调度指令待确认', content: '华东火电1号需增加出力至850MW', type: 'dispatch', time: '2026-06-08 09:15:00', read: false },
    { id: 'N002', title: '故障告警', content: '华北区域3号变电站线路故障', type: 'fault', time: '2026-06-08 09:10:00', read: false },
    { id: 'N003', title: '碳排放预警', content: '华东区域碳排放已超出配额12%', type: 'carbon', time: '2026-06-08 09:05:00', read: false },
    { id: 'N004', title: '电价变动提醒', content: '今日10:00-11:00为高峰电价时段', type: 'price', time: '2026-06-08 08:30:00', read: true },
  ],
  addNotification: (n) => {
    notifCounter++
    set((state) => ({
      notifications: [
        { ...n, id: `N${String(notifCounter + 4).padStart(3, '0')}`, time: new Date().toISOString().replace('T', ' ').slice(0, 19), read: false },
        ...state.notifications,
      ],
    }))
  },
  markRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }))
  },
  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }))
  },
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}))

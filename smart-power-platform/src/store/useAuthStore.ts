import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
  user: User | null
  login: (user: User) => void
  logout: () => void
  switchRole: (level: 0 | 1 | 2 | 3 | 4) => void
}

const DEMO_USERS: Record<number, User> = {
  0: { id: 'U001', username: '普通用户', role: 0, area: '华东' },
  1: { id: 'U002', username: '华电电厂管理员', role: 1, area: '华东', plantId: 'PS001' },
  2: { id: 'U003', username: '国电售电公司', role: 2, companyId: 'SEC001' },
  3: { id: 'U004', username: '调度员张伟', role: 3 },
  4: { id: 'U005', username: '系统管理员', role: 4 },
}

export const useAuthStore = create<AuthState>((set) => ({
  user: DEMO_USERS[4],
  login: (user) => set({ user }),
  logout: () => set({ user: DEMO_USERS[0] }),
  switchRole: (level) => set({ user: DEMO_USERS[level] }),
}))

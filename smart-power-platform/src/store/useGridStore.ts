import { create } from 'zustand'
import type { GridApplication } from '../types'
import { generateGridApplications, checkCapacity } from '../utils/mockData'
import dayjs from 'dayjs'

interface GridState {
  applications: GridApplication[]
  approveDept: (id: string) => void
  approveVice: (id: string) => void
  approveGm: (id: string) => void
  reject: (id: string) => void
  submitApplication: (app: Partial<GridApplication>) => void
  refresh: () => void
}

export const useGridStore = create<GridState>((set) => ({
  applications: generateGridApplications(),
  approveDept: (id) => {
    set((state) => ({
      applications: state.applications.map((a) =>
        a.id === id ? { ...a, status: 'dept_approved' as const, currentApprovalLevel: 1 as const, deptApprovedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : a
      ),
    }))
  },
  approveVice: (id) => {
    set((state) => ({
      applications: state.applications.map((a) =>
        a.id === id ? { ...a, status: 'vice_approved' as const, currentApprovalLevel: 2 as const, viceApprovedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : a
      ),
    }))
  },
  approveGm: (id) => {
    set((state) => ({
      applications: state.applications.map((a) =>
        a.id === id ? { ...a, status: 'gm_approved' as const, currentApprovalLevel: 3 as const, gmApprovedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : a
      ),
    }))
  },
  reject: (id) => {
    set((state) => ({
      applications: state.applications.map((a) => (a.id === id ? { ...a, status: 'rejected' as const, rejectedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : a)),
    }))
  },
  submitApplication: (app) => {
    const plannedOutput = app.plannedOutput || Array.from({ length: 24 }, () => 50)
    const recommendedPoint = app.recommendedPoint || '110kV东郊变'
    const capacity = app.capacity || 100
    const checkResult = checkCapacity(capacity, plannedOutput, recommendedPoint)
    set((state) => ({
      applications: [
        {
          id: `GA${String(state.applications.length + 1).padStart(4, '0')}`,
          applicant: app.applicant || '新申请人',
          sourceType: app.sourceType || 'wind',
          capacity,
          plannedOutput,
          recommendedPoint: checkResult.suggestedPoint && !checkResult.passed ? checkResult.suggestedPoint : recommendedPoint,
          status: 'submitted' as const,
          currentApprovalLevel: 0 as const,
          submittedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          capacityVerified: checkResult.passed,
          capacityCheckResult: checkResult,
        },
        ...state.applications,
      ],
    }))
  },
  refresh: () => {
    set({ applications: generateGridApplications() })
  },
}))

export interface PowerSource {
  id: string
  name: string
  type: 'thermal' | 'hydro' | 'wind' | 'solar'
  capacity: number
  currentOutput: number
  status: 'online' | 'offline' | 'maintenance'
  area: string
}

export interface LoadData {
  id: string
  area: string
  industrial: number
  commercial: number
  residential: number
  total: number
  timestamp: string
}

export interface DispatchOrder {
  id: string
  type: 'increase' | 'decrease' | 'shutdown' | 'startup'
  sourceId: string
  sourceName: string
  targetOutput: number
  currentOutput: number
  beforeOutput: number
  reason: string
  status: 'pending' | 'confirmed' | 'executing' | 'completed' | 'rejected'
  createdAt: string
  confirmedAt?: string
  completedAt?: string
  operator?: string
  balanceBefore?: number
  balanceAfter?: number
  area?: string
  deviation?: number
}

export interface FaultRecord {
  id: string
  area: string
  location: string
  type: string
  level: 'critical' | 'major' | 'minor'
  description: string
  status: 'pending' | 'assigned' | 'accepted' | 'repairing' | 'resolved'
  createdAt: string
  assignedTeam?: string
  assignedAt?: string
  acceptedAt?: string
  repairingAt?: string
  resolvedAt?: string
  escalated: boolean
}

export interface CapacityCheckResult {
  passed: boolean
  reason: string
  peakPlan: number
  capacityOver: boolean
  peakOver: boolean
  pointRemaining: number
  capacityValue: number
  suggestedPoint?: string
  suggestedPointRemaining?: number
}

export interface GridApplication {
  id: string
  applicant: string
  sourceType: 'wind' | 'solar'
  capacity: number
  plannedOutput: number[]
  recommendedPoint: string
  status: 'submitted' | 'dept_approved' | 'vice_approved' | 'gm_approved' | 'rejected'
  currentApprovalLevel: 0 | 1 | 2 | 3
  submittedAt: string
  deptApprovedAt?: string
  viceApprovedAt?: string
  gmApprovedAt?: string
  rejectedAt?: string
  capacityVerified: boolean
  capacityCheckResult?: CapacityCheckResult
}

export interface ChargeDischargePlan {
  hour: number
  action: 'charge' | 'discharge' | 'standby'
  rate: number
  price: number
  revenue: number
}

export interface StorageStation {
  id: string
  name: string
  capacity: number
  currentEnergy: number
  mode: 'charging' | 'discharging' | 'standby'
  strategy: 'auto' | 'manual'
  chargeRate: number
  dischargeRate: number
  revenue: number
  participants: { name: string; share: number; revenue: number }[]
  dailyPlan: ChargeDischargePlan[]
  estimatedRevenue: number
  manualOverride: boolean
  overrideReason?: string
  overrideStartAt?: string
  overrideRecoverAt?: string
  plannedAction?: 'charging' | 'discharging' | 'standby'
}

export interface DispatchAuditLog {
  id: string
  orderId: string
  action: 'confirm' | 'reject' | 'complete' | 'auto_generate'
  operator: string
  timestamp: string
  detail: string
  balanceBefore?: number
  balanceAfter?: number
  outputBefore?: number
  outputAfter?: number
}

export interface CarbonData {
  id: string
  area: string
  emission: number
  intensity: number
  quota: number
  used: number
  timestamp: string
  warning: boolean
}

export interface PriceData {
  timestamp: string
  price: number
  type: 'peak' | 'flat' | 'valley'
}

export interface UserRole {
  level: 0 | 1 | 2 | 3 | 4
  label: string
  description: string
}

export interface User {
  id: string
  username: string
  role: 0 | 1 | 2 | 3 | 4
  area?: string
  plantId?: string
  companyId?: string
  proxyAreas?: string[]
  plantName?: string
}

export const USER_ROLES: Record<number, UserRole> = {
  0: { level: 0, label: '普通用户', description: '查看电价信息' },
  1: { level: 1, label: '发电厂', description: '查看本厂数据' },
  2: { level: 2, label: '售电公司', description: '查看代理数据' },
  3: { level: 3, label: '调度员', description: '操作调度方案' },
  4: { level: 4, label: '管理员', description: '全局管理' },
}

export type AreaType = '华东' | '华南' | '华北' | '华中' | '西北' | '西南'
export const AREAS: AreaType[] = ['华东', '华南', '华北', '华中', '西北', '西南']
export const SOURCE_TYPES = [
  { value: 'thermal', label: '火电' },
  { value: 'hydro', label: '水电' },
  { value: 'wind', label: '风电' },
  { value: 'solar', label: '光伏' },
]

export const CONNECTION_POINTS = [
  { name: '110kV东郊变', maxCapacity: 500, usedCapacity: 320 },
  { name: '220kV西城变', maxCapacity: 800, usedCapacity: 450 },
  { name: '110kV南湖变', maxCapacity: 500, usedCapacity: 380 },
  { name: '220kV北山变', maxCapacity: 800, usedCapacity: 200 },
  { name: '110kV中心变', maxCapacity: 500, usedCapacity: 410 },
]

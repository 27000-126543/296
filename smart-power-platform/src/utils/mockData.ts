import dayjs from 'dayjs'
import type {
  PowerSource,
  LoadData,
  DispatchOrder,
  FaultRecord,
  GridApplication,
  StorageStation,
  CarbonData,
  PriceData,
  ChargeDischargePlan,
} from '../types'
import { CONNECTION_POINTS } from '../types'

const rand = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 10) / 10

export function generatePowerSources(): PowerSource[] {
  const sources: PowerSource[] = []
  const areas = ['华东', '华南', '华北', '华中', '西北', '西南']
  const types: Array<{ type: PowerSource['type']; prefix: string; capRange: [number, number] }> = [
    { type: 'thermal', prefix: '火电', capRange: [600, 1200] },
    { type: 'hydro', prefix: '水电', capRange: [300, 800] },
    { type: 'wind', prefix: '风电', capRange: [100, 500] },
    { type: 'solar', prefix: '光伏', capRange: [50, 300] },
  ]
  let idx = 0
  areas.forEach((area) => {
    types.forEach(({ type, prefix, capRange }) => {
      const count = type === 'thermal' ? 2 : type === 'hydro' ? 1 : 2
      for (let i = 0; i < count; i++) {
        const capacity = rand(capRange[0], capRange[1])
        sources.push({
          id: `PS${String(idx + 1).padStart(3, '0')}`,
          name: `${area}${prefix}${i + 1}号`,
          type,
          capacity,
          currentOutput: Math.round(capacity * rand(0.4, 0.95) * 10) / 10,
          status: Math.random() > 0.1 ? 'online' : Math.random() > 0.5 ? 'maintenance' : 'offline',
          area,
        })
        idx++
      }
    })
  })
  return sources
}

export function generateLoadData(): LoadData[] {
  const areas = ['华东', '华南', '华北', '华中', '西北', '西南']
  const now = dayjs()
  return areas.map((area, i) => {
    const industrial = rand(800, 2000)
    const commercial = rand(400, 1200)
    const residential = rand(200, 600)
    return {
      id: `LD${String(i + 1).padStart(3, '0')}`,
      area,
      industrial,
      commercial,
      residential,
      total: Math.round((industrial + commercial + residential) * 10) / 10,
      timestamp: now.format('YYYY-MM-DD HH:mm:ss'),
    }
  })
}

export function generateDispatchOrdersFromBalance(sources: PowerSource[], loadData: LoadData[]): DispatchOrder[] {
  const orders: DispatchOrder[] = []
  const now = dayjs()
  const totalGen = sources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
  const totalLoad = loadData.reduce((sum, l) => sum + l.total, 0)
  const balance = totalGen - totalLoad

  if (Math.abs(balance / totalLoad) > 0.02) {
    const isDeficit = balance < 0
    const onlineSources = sources.filter((s) => s.status === 'online')
    const adjustable = isDeficit
      ? onlineSources.filter((s) => s.currentOutput < s.capacity * 0.95).sort((a, b) => (b.capacity - b.currentOutput) - (a.capacity - a.currentOutput))
      : onlineSources.filter((s) => s.currentOutput > s.capacity * 0.3).sort((a, b) => a.currentOutput - b.currentOutput)

    adjustable.slice(0, 3).forEach((src, i) => {
      const deviation = Math.abs(balance) / Math.min(3, adjustable.length)
      const targetOutput = isDeficit
        ? Math.min(src.capacity * 0.95, src.currentOutput + deviation)
        : Math.max(src.capacity * 0.3, src.currentOutput - deviation)
      const roundTarget = Math.round(targetOutput * 10) / 10
      const areaLoad = loadData.find((l) => l.area === src.area)
      const areaGen = sources.filter((s) => s.area === src.area && s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
      const areaBalance = areaGen - (areaLoad?.total || 0)

      orders.push({
        id: `DO${String(i + 1).padStart(4, '0')}`,
        type: isDeficit ? 'increase' : 'decrease',
        sourceId: src.id,
        sourceName: src.name,
        targetOutput: roundTarget,
        currentOutput: src.currentOutput,
        beforeOutput: src.currentOutput,
        reason: `全网供需偏差${Math.abs(balance).toFixed(0)}MW（${isDeficit ? '供不应求' : '供过于求'}），建议${isDeficit ? '增加' : '减少'}${src.name}出力至${roundTarget}MW`,
        status: 'pending',
        createdAt: now.format('YYYY-MM-DD HH:mm:ss'),
        area: src.area,
        deviation: Math.round(deviation * 10) / 10,
        balanceBefore: Math.round(areaBalance * 10) / 10,
        balanceAfter: Math.round((areaBalance + (isDeficit ? deviation : -deviation)) * 10) / 10,
      })
    })
  }

  return orders
}

export function generateSeedDispatchOrders(sources: PowerSource[], loadData: LoadData[]): DispatchOrder[] {
  const now = dayjs()
  const orders = generateDispatchOrdersFromBalance(sources, loadData)
  const seedStatuses: DispatchOrder['status'][] = ['executing', 'completed', 'completed', 'rejected']
  const onlineSources = sources.filter((s) => s.status === 'online')
  seedStatuses.forEach((status, i) => {
    const src = onlineSources[i % onlineSources.length]
    if (!src) return
    const isDeficit = Math.random() > 0.5
    const targetOutput = Math.round(src.capacity * rand(0.3, 0.9) * 10) / 10
    const areaLoad = loadData.find((l) => l.area === src.area)
    const areaGen = sources.filter((s) => s.area === src.area && s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
    const areaBalance = areaGen - (areaLoad?.total || 0)
    orders.push({
      id: `DO${String(orders.length + i + 1).padStart(4, '0')}`,
      type: isDeficit ? 'increase' : 'decrease',
      sourceId: src.id,
      sourceName: src.name,
      targetOutput,
      currentOutput: status === 'completed' ? targetOutput : src.currentOutput,
      beforeOutput: Math.round(src.currentOutput * rand(0.7, 1.1) * 10) / 10,
      reason: `供需偏差${rand(50, 200).toFixed(0)}MW，需调整${src.name}出力至${targetOutput}MW`,
      status,
      createdAt: now.subtract(Math.floor(Math.random() * 60 + 10), 'minute').format('YYYY-MM-DD HH:mm:ss'),
      confirmedAt: status !== 'pending' ? now.subtract(Math.floor(Math.random() * 50 + 5), 'minute').format('YYYY-MM-DD HH:mm:ss') : undefined,
      completedAt: status === 'completed' ? now.subtract(Math.floor(Math.random() * 30), 'minute').format('YYYY-MM-DD HH:mm:ss') : undefined,
      operator: status !== 'pending' ? '调度员张伟' : undefined,
      area: src.area,
      deviation: Math.round(Math.abs(targetOutput - src.currentOutput) * 10) / 10,
      balanceBefore: Math.round(areaBalance * 10) / 10,
      balanceAfter: status !== 'pending' && status !== 'rejected' ? Math.round((areaBalance + (isDeficit ? 1 : -1) * Math.abs(targetOutput - src.currentOutput)) * 10) / 10 : undefined,
    })
  })
  return orders
}

export function generateDispatchOrders(sources: PowerSource[]): DispatchOrder[] {
  return generateDispatchOrdersFromBalance(sources, generateLoadData())
}

export function generateFaultRecords(): FaultRecord[] {
  const areas = ['华东', '华南', '华北', '华中', '西北', '西南']
  const types = ['线路故障', '变压器故障', '开关拒动', '接地故障', '过载跳闸']
  const levels: FaultRecord['level'][] = ['critical', 'major', 'minor']
  const statuses: FaultRecord['status'][] = ['pending', 'assigned', 'accepted', 'repairing', 'resolved']
  const teams = ['抢修班组A', '抢修班组B', '抢修班组C', '抢修班组D', '抢修班组E']
  const now = dayjs()
  return Array.from({ length: 10 }, (_, i) => {
    const area = areas[Math.floor(Math.random() * areas.length)]
    const level = levels[Math.floor(Math.random() * levels.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const assignedTeam = status !== 'pending' ? teams[Math.floor(Math.random() * teams.length)] : undefined
    const assignedAt = status !== 'pending' ? now.subtract(Math.floor(Math.random() * 60 + 10), 'minute').format('YYYY-MM-DD HH:mm:ss') : undefined
    const acceptedAt = status === 'accepted' || status === 'repairing' || status === 'resolved'
      ? now.subtract(Math.floor(Math.random() * 40 + 5), 'minute').format('YYYY-MM-DD HH:mm:ss') : undefined
    const repairingAt = status === 'repairing' || status === 'resolved'
      ? now.subtract(Math.floor(Math.random() * 30 + 3), 'minute').format('YYYY-MM-DD HH:mm:ss') : undefined
    const resolvedAt = status === 'resolved'
      ? now.subtract(Math.floor(Math.random() * 15), 'minute').format('YYYY-MM-DD HH:mm:ss') : undefined
    return {
      id: `FT${String(i + 1).padStart(4, '0')}`,
      area,
      location: `${area}区域${Math.floor(Math.random() * 10 + 1)}号变电站`,
      type: types[Math.floor(Math.random() * types.length)],
      level,
      description: `${area}区域${types[i % 5]}，影响${rand(10, 100)}MW负荷`,
      status,
      createdAt: now.subtract(Math.floor(Math.random() * 120 + 10), 'minute').format('YYYY-MM-DD HH:mm:ss'),
      assignedTeam,
      assignedAt,
      acceptedAt,
      repairingAt,
      resolvedAt,
      escalated: Math.random() > 0.7,
    }
  })
}

export function checkCapacity(capacity: number, plannedOutput: number[], selectedPoint: string): import('../types').CapacityCheckResult {
  const peakPlan = Math.max(...plannedOutput)
  const point = CONNECTION_POINTS.find((p) => p.name === selectedPoint)
  const pointRemaining = point ? point.maxCapacity - point.usedCapacity : 0
  const capacityOver = capacity > pointRemaining
  const peakOver = peakPlan > pointRemaining
  const passed = !capacityOver && !peakOver

  const reasons: string[] = []
  if (capacityOver) {
    reasons.push(`申请容量${capacity.toFixed(1)}MW超过并网点剩余容量${pointRemaining.toFixed(1)}MW`)
  }
  if (peakOver) {
    reasons.push(`计划峰值${peakPlan.toFixed(1)}MW超过并网点剩余容量${pointRemaining.toFixed(1)}MW`)
  }

  let suggestedPoint: string | undefined
  let suggestedPointRemaining: number | undefined
  if (!passed) {
    const better = CONNECTION_POINTS
      .filter((p) => p.name !== selectedPoint)
      .filter((p) => p.maxCapacity - p.usedCapacity >= Math.max(peakPlan, capacity))
      .sort((a, b) => (b.maxCapacity - b.usedCapacity) - (a.maxCapacity - a.usedCapacity))
    if (better.length > 0) {
      suggestedPoint = better[0].name
      suggestedPointRemaining = better[0].maxCapacity - better[0].usedCapacity
    }
  }

  return {
    passed,
    reason: passed
      ? `申请容量${capacity.toFixed(1)}MW ≤ 剩余容量${pointRemaining.toFixed(1)}MW，计划峰值${peakPlan.toFixed(1)}MW ≤ 剩余容量${pointRemaining.toFixed(1)}MW，校核通过`
      : reasons.join('；'),
    peakPlan,
    capacityOver,
    peakOver,
    pointRemaining,
    capacityValue: capacity,
    suggestedPoint,
    suggestedPointRemaining,
  }
}

export function generateGridApplications(): GridApplication[] {
  const now = dayjs()
  const statuses: GridApplication['status'][] = ['submitted', 'dept_approved', 'vice_approved', 'gm_approved', 'rejected']
  const points = CONNECTION_POINTS.map((p) => p.name)
  return Array.from({ length: 6 }, (_, i) => {
    const status = statuses[i % 5]
    const approvalLevel = status === 'submitted' ? 0 : status === 'dept_approved' ? 1 : status === 'vice_approved' ? 2 : status === 'gm_approved' ? 3 : 0
    const capacity = rand(50, 300)
    const plannedOutput = Array.from({ length: 24 }, () => rand(20, 200))
    const recommendedPoint = points[i % points.length]
    const checkResult = checkCapacity(capacity, plannedOutput, recommendedPoint)
    return {
      id: `GA${String(i + 1).padStart(4, '0')}`,
      applicant: `新能源公司${String.fromCharCode(65 + i)}`,
      sourceType: i % 2 === 0 ? 'wind' : 'solar',
      capacity,
      plannedOutput,
      recommendedPoint,
      status,
      currentApprovalLevel: approvalLevel as 0 | 1 | 2 | 3,
      submittedAt: now.subtract(i * 2 + 1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      deptApprovedAt: approvalLevel >= 1 ? now.subtract(i * 2, 'day').format('YYYY-MM-DD HH:mm:ss') : undefined,
      viceApprovedAt: approvalLevel >= 2 ? now.subtract(i * 2 - 1, 'day').format('YYYY-MM-DD HH:mm:ss') : undefined,
      gmApprovedAt: approvalLevel >= 3 ? now.subtract(i * 2 - 2, 'day').format('YYYY-MM-DD HH:mm:ss') : undefined,
      capacityVerified: checkResult.passed,
      capacityCheckResult: checkResult,
    }
  })
}

export function generateChargeDischargePlan(capacity: number): ChargeDischargePlan[] {
  const priceData = generatePriceData()
  return priceData.map((p, h) => {
    let action: ChargeDischargePlan['action'] = 'standby'
    let rate = 0
    if (p.type === 'valley') {
      action = 'charge'
      rate = Math.min(capacity * 0.3, 30)
    } else if (p.type === 'peak') {
      action = 'discharge'
      rate = Math.min(capacity * 0.3, 30)
    }
    const revenue = action === 'discharge' ? Math.round(rate * p.price * 100) / 100 : action === 'charge' ? -Math.round(rate * p.price * 100) / 100 : 0
    return { hour: h, action, rate: Math.round(rate * 10) / 10, price: p.price, revenue }
  })
}

export function generateStorageStations(): StorageStation[] {
  return Array.from({ length: 5 }, (_, i) => {
    const capacity = rand(50, 200)
    const currentEnergy = rand(10, capacity * 0.9)
    const modes: StorageStation['mode'][] = ['charging', 'discharging', 'standby']
    const mode = modes[i % 3]
    const dailyPlan = generateChargeDischargePlan(capacity)
    const estimatedRevenue = Math.round(dailyPlan.reduce((sum, p) => sum + p.revenue, 0) * 100) / 100
    const participants = [
      { name: `投资方${String.fromCharCode(65 + i)}`, share: rand(30, 50), revenue: 0 },
      { name: `运营方${String.fromCharCode(65 + i)}`, share: rand(20, 40), revenue: 0 },
      { name: '电网公司', share: rand(10, 30), revenue: 0 },
    ]
    const totalRevenue = Math.abs(estimatedRevenue)
    const totalShare = participants.reduce((s, p) => s + p.share, 0)
    participants.forEach((p) => {
      p.revenue = Math.round((totalRevenue * p.share / totalShare) * 100) / 100
      p.share = Math.round(p.share * 10) / 10
    })
    const currentHour = new Date().getHours()
    const planNow = dailyPlan[currentHour]
    const effectiveMode = planNow ? (planNow.action === 'charge' ? 'charging' : planNow.action === 'discharge' ? 'discharging' : 'standby') : mode
    return {
      id: `SS${String(i + 1).padStart(3, '0')}`,
      name: `储能电站${String.fromCharCode(65 + i)}`,
      capacity,
      currentEnergy: Math.round(currentEnergy * 10) / 10,
      mode: effectiveMode,
      strategy: 'auto',
      chargeRate: effectiveMode === 'charging' ? (planNow?.rate || 0) : 0,
      dischargeRate: effectiveMode === 'discharging' ? (planNow?.rate || 0) : 0,
      revenue: totalRevenue,
      participants,
      dailyPlan,
      estimatedRevenue,
      manualOverride: false,
    }
  })
}

export function generateCarbonData(): CarbonData[] {
  const areas = ['华东', '华南', '华北', '华中', '西北', '西南']
  const now = dayjs()
  return areas.map((area, i) => {
    const quota = rand(5000, 15000)
    const used = rand(3000, quota * 1.2)
    return {
      id: `CB${String(i + 1).padStart(3, '0')}`,
      area,
      emission: rand(3000, 12000),
      intensity: rand(0.3, 0.9),
      quota,
      used: Math.round(used * 10) / 10,
      timestamp: now.format('YYYY-MM-DD HH:mm:ss'),
      warning: used > quota,
    }
  })
}

export function generatePriceData(): PriceData[] {
  const data: PriceData[] = []
  const now = dayjs()
  for (let h = 0; h < 24; h++) {
    const type: PriceData['type'] = h >= 8 && h <= 11 || h >= 17 && h <= 21 ? 'peak' : h >= 6 && h <= 7 || h >= 12 && h <= 16 || h >= 22 && h <= 23 ? 'flat' : 'valley'
    const basePrice = type === 'peak' ? 1.2 : type === 'flat' ? 0.8 : 0.4
    data.push({
      timestamp: now.startOf('day').add(h, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      price: Math.round((basePrice + rand(-0.1, 0.1)) * 100) / 100,
      type,
    })
  }
  return data
}

export function generateLoadCurve(): { time: string; value: number }[] {
  const data: { time: string; value: number }[] = []
  const now = dayjs()
  for (let h = 0; h < 24; h++) {
    const base = h >= 8 && h <= 22 ? 8000 + rand(0, 3000) : 4000 + rand(0, 2000)
    data.push({
      time: now.startOf('day').add(h, 'hour').format('HH:00'),
      value: Math.round(base),
    })
  }
  return data
}

export function generateNewEnergyRate(): { time: string; rate: number }[] {
  const data: { time: string; rate: number }[] = []
  const now = dayjs()
  for (let h = 0; h < 24; h++) {
    const base = h >= 6 && h <= 18 ? rand(30, 75) : rand(5, 25)
    data.push({
      time: now.startOf('day').add(h, 'hour').format('HH:00'),
      rate: Math.round(base * 10) / 10,
    })
  }
  return data
}

export function generateCarbonTrend(): { time: string; value: number }[] {
  const data: { time: string; value: number }[] = []
  const now = dayjs()
  for (let d = 29; d >= 0; d--) {
    data.push({
      time: now.subtract(d, 'day').format('MM-DD'),
      value: Math.round(rand(8000, 15000)),
    })
  }
  return data
}

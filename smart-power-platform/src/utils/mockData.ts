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
} from '../types'

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

export function generateDispatchOrders(sources: PowerSource[]): DispatchOrder[] {
  const orders: DispatchOrder[] = []
  const now = dayjs()
  for (let i = 0; i < 8; i++) {
    const src = sources[Math.floor(Math.random() * sources.length)]
    const types: DispatchOrder['type'][] = ['increase', 'decrease', 'shutdown', 'startup']
    const statuses: DispatchOrder['status'][] = ['pending', 'confirmed', 'executing', 'completed', 'rejected']
    const targetOutput = Math.round(src.capacity * rand(0.3, 0.9) * 10) / 10
    orders.push({
      id: `DO${String(i + 1).padStart(4, '0')}`,
      type: types[Math.floor(Math.random() * types.length)],
      sourceId: src.id,
      sourceName: src.name,
      targetOutput,
      currentOutput: src.currentOutput,
      reason: `供需偏差${rand(50, 200)}MW，需调整${src.name}出力至${targetOutput}MW`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      createdAt: now.subtract(Math.floor(Math.random() * 60), 'minute').format('YYYY-MM-DD HH:mm:ss'),
      operator: statuses[i % 5] !== 'pending' ? '调度员张伟' : undefined,
    })
  }
  return orders
}

export function generateFaultRecords(): FaultRecord[] {
  const areas = ['华东', '华南', '华北', '华中', '西北', '西南']
  const types = ['线路故障', '变压器故障', '开关拒动', '接地故障', '过载跳闸']
  const levels: FaultRecord['level'][] = ['critical', 'major', 'minor']
  const statuses: FaultRecord['status'][] = ['pending', 'assigned', 'repairing', 'resolved']
  const teams = ['抢修班组A', '抢修班组B', '抢修班组C', '抢修班组D', '抢修班组E']
  const now = dayjs()
  return Array.from({ length: 10 }, (_, i) => {
    const area = areas[Math.floor(Math.random() * areas.length)]
    const level = levels[Math.floor(Math.random() * levels.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    return {
      id: `FT${String(i + 1).padStart(4, '0')}`,
      area,
      location: `${area}区域${Math.floor(Math.random() * 10 + 1)}号变电站`,
      type: types[Math.floor(Math.random() * types.length)],
      level,
      description: `${area}区域${types[i % 5]}，影响${rand(10, 100)}MW负荷`,
      status,
      createdAt: now.subtract(Math.floor(Math.random() * 120), 'minute').format('YYYY-MM-DD HH:mm:ss'),
      assignedTeam: status !== 'pending' ? teams[Math.floor(Math.random() * teams.length)] : undefined,
      assignedAt: status !== 'pending' ? now.subtract(Math.floor(Math.random() * 60), 'minute').format('YYYY-MM-DD HH:mm:ss') : undefined,
      resolvedAt: status === 'resolved' ? now.subtract(Math.floor(Math.random() * 30), 'minute').format('YYYY-MM-DD HH:mm:ss') : undefined,
      escalated: Math.random() > 0.7,
    }
  })
}

export function generateGridApplications(): GridApplication[] {
  const now = dayjs()
  const statuses: GridApplication['status'][] = ['submitted', 'dept_approved', 'vice_approved', 'gm_approved', 'rejected']
  const points = ['110kV东郊变', '220kV西城变', '110kV南湖变', '220kV北山变', '110kV中心变']
  return Array.from({ length: 6 }, (_, i) => {
    const status = statuses[i % 5]
    const approvalLevel = status === 'submitted' ? 0 : status === 'dept_approved' ? 1 : status === 'vice_approved' ? 2 : status === 'gm_approved' ? 3 : 0
    return {
      id: `GA${String(i + 1).padStart(4, '0')}`,
      applicant: `新能源公司${String.fromCharCode(65 + i)}`,
      sourceType: i % 2 === 0 ? 'wind' : 'solar',
      capacity: rand(50, 300),
      plannedOutput: Array.from({ length: 24 }, () => rand(20, 200)),
      recommendedPoint: points[i % points.length],
      status,
      currentApprovalLevel: approvalLevel as 0 | 1 | 2 | 3,
      submittedAt: now.subtract(i * 2 + 1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      deptApprovedAt: approvalLevel >= 1 ? now.subtract(i * 2, 'day').format('YYYY-MM-DD HH:mm:ss') : undefined,
      viceApprovedAt: approvalLevel >= 2 ? now.subtract(i * 2 - 1, 'day').format('YYYY-MM-DD HH:mm:ss') : undefined,
      gmApprovedAt: approvalLevel >= 3 ? now.subtract(i * 2 - 2, 'day').format('YYYY-MM-DD HH:mm:ss') : undefined,
      capacityVerified: Math.random() > 0.2,
    }
  })
}

export function generateStorageStations(): StorageStation[] {
  return Array.from({ length: 5 }, (_, i) => {
    const capacity = rand(50, 200)
    const currentEnergy = rand(10, capacity * 0.9)
    const modes: StorageStation['mode'][] = ['charging', 'discharging', 'standby']
    const mode = modes[i % 3]
    const participants = [
      { name: `投资方${String.fromCharCode(65 + i)}`, share: rand(30, 50), revenue: 0 },
      { name: `运营方${String.fromCharCode(65 + i)}`, share: rand(20, 40), revenue: 0 },
      { name: '电网公司', share: rand(10, 30), revenue: 0 },
    ]
    const totalRevenue = rand(10, 100)
    const totalShare = participants.reduce((s, p) => s + p.share, 0)
    participants.forEach((p) => {
      p.revenue = Math.round((totalRevenue * p.share / totalShare) * 100) / 100
      p.share = Math.round(p.share * 10) / 10
    })
    return {
      id: `SS${String(i + 1).padStart(3, '0')}`,
      name: `储能电站${String.fromCharCode(65 + i)}`,
      capacity,
      currentEnergy: Math.round(currentEnergy * 10) / 10,
      mode,
      strategy: 'auto',
      chargeRate: mode === 'charging' ? rand(5, 30) : 0,
      dischargeRate: mode === 'discharging' ? rand(5, 30) : 0,
      revenue: totalRevenue,
      participants,
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

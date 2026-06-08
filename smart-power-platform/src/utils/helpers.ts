import dayjs from 'dayjs'

export function formatNumber(n: number, decimals: number = 1): string {
  return n.toFixed(decimals)
}

export function formatPower(mw: number): string {
  if (mw >= 10000) return `${(mw / 10000).toFixed(2)}万MW`
  if (mw >= 1000) return `${(mw / 1000).toFixed(2)}GW`
  return `${mw.toFixed(1)}MW`
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    online: '#52c41a',
    offline: '#ff4d4f',
    maintenance: '#faad14',
    pending: '#faad14',
    confirmed: '#1890ff',
    executing: '#1890ff',
    completed: '#52c41a',
    rejected: '#ff4d4f',
    assigned: '#1890ff',
    repairing: '#1890ff',
    resolved: '#52c41a',
    submitted: '#faad14',
    dept_approved: '#1890ff',
    vice_approved: '#722ed1',
    gm_approved: '#52c41a',
    charging: '#1890ff',
    discharging: '#52c41a',
    standby: '#8c8c8c',
  }
  return map[status] || '#8c8c8c'
}

export function getLevelColor(level: string): string {
  const map: Record<string, string> = {
    critical: '#ff4d4f',
    major: '#faad14',
    minor: '#1890ff',
  }
  return map[level] || '#8c8c8c'
}

export function formatDate(date: string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

export function calcPowerBalance(generation: number, load: number): { balance: number; rate: number; status: 'surplus' | 'deficit' | 'balanced' } {
  const balance = generation - load
  const rate = load > 0 ? (balance / load) * 100 : (generation > 0 ? 100 : 0)
  let status: 'surplus' | 'deficit' | 'balanced' = 'balanced'
  if (rate > 2) status = 'surplus'
  else if (rate < -2) status = 'deficit'
  return { balance: Math.round(balance * 10) / 10, rate: Math.round(rate * 100) / 100, status }
}

export function downloadExcel(data: Record<string, unknown>[], filename: string) {
  import('xlsx').then((XLSX) => {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '数据')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  })
}

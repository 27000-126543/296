import { useEffect, useRef, useState, useMemo } from 'react'
import { Card, Row, Col, Table, Tag, Select, Statistic, Progress, Typography, Space, Button } from 'antd'
import {
  ThunderboltOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { usePowerStore } from '../store/usePowerStore'
import { useAuthStore } from '../store/useAuthStore'
import { formatPower, calcPowerBalance, getStatusColor } from '../utils/helpers'
import { AREAS, SOURCE_TYPES } from '../types'

const { Text, Title } = Typography

const TYPE_COLOR_MAP: Record<string, string> = {
  thermal: 'red',
  hydro: 'blue',
  wind: 'green',
  solar: 'orange',
}

const TYPE_LABEL_MAP: Record<string, string> = {
  thermal: '火电',
  hydro: '水电',
  wind: '风电',
  solar: '光伏',
}

const STATUS_LABEL_MAP: Record<string, string> = {
  online: '在线',
  offline: '离线',
  maintenance: '检修',
}

const BALANCE_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  surplus: { color: '#52c41a', label: '供大于求', icon: <ArrowUpOutlined /> },
  deficit: { color: '#ff4d4f', label: '供不应求', icon: <ArrowDownOutlined /> },
  balanced: { color: '#1890ff', label: '供需平衡', icon: <MinusOutlined /> },
}

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  height: '100%',
}

export default function PowerMonitor() {
  const { sources, totalGeneration, totalLoad, refresh } = usePowerStore()
  const { user } = useAuthStore()
  const [areaFilter, setAreaFilter] = useState<string | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const filteredSources = useMemo(() => {
    let result = sources
    if (user?.role === 1 && user?.plantId) {
      result = result.filter((s) => s.id === user.plantId)
    }
    if (areaFilter) {
      result = result.filter((s) => s.area === areaFilter)
    }
    if (typeFilter) {
      result = result.filter((s) => s.type === typeFilter)
    }
    return result
  }, [sources, areaFilter, typeFilter, user])

  const stats = useMemo(() => {
    const totalCapacity = filteredSources.reduce((sum, s) => sum + s.capacity, 0)
    const currentOutput = filteredSources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
    const onlineCount = filteredSources.filter((s) => s.status === 'online').length
    const utilization = totalCapacity > 0 ? Math.round((currentOutput / totalCapacity) * 1000) / 10 : 0
    return { totalCapacity, currentOutput, onlineCount, utilization }
  }, [filteredSources])

  const balance = useMemo(() => calcPowerBalance(totalGeneration, totalLoad), [totalGeneration, totalLoad])

  const generationByType = useMemo(() => {
    const map: Record<string, number> = { thermal: 0, hydro: 0, wind: 0, solar: 0 }
    filteredSources.filter((s) => s.status === 'online').forEach((s) => {
      map[s.type] = (map[s.type] || 0) + s.currentOutput
    })
    return map
  }, [filteredSources])

  const generationByArea = useMemo(() => {
    const map: Record<string, number> = {}
    filteredSources.filter((s) => s.status === 'online').forEach((s) => {
      map[s.area] = (map[s.area] || 0) + s.currentOutput
    })
    return map
  }, [filteredSources])

  useEffect(() => {
    timerRef.current = setInterval(() => {
      refresh()
      setLastUpdate(new Date())
    }, 5000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [refresh])

  const handleRefresh = () => {
    refresh()
    setLastUpdate(new Date())
  }

  const typeChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any[]) => {
        const p = params[0]
        return `${p.name}<br/>发电量: ${formatPower(p.value)}`
      },
    },
    grid: { top: 40, right: 20, bottom: 30, left: 70 },
    xAxis: {
      type: 'category' as const,
      data: SOURCE_TYPES.map((t) => t.label),
      axisLabel: { fontSize: 12 },
    },
    yAxis: {
      type: 'value' as const,
      name: 'MW',
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: 'bar' as const,
        data: SOURCE_TYPES.map((t, i) => ({
          value: Math.round(generationByType[t.value] || 0),
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: ['#ff4d4f', '#1890ff', '#52c41a', '#faad14'][i] },
                { offset: 1, color: ['#ff7875', '#40a9ff', '#95de64', '#ffd666'][i] },
              ],
            },
            borderRadius: [6, 6, 0, 0],
          },
        })),
        barWidth: '40%',
      },
    ],
  }

  const areaChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any[]) => {
        const p = params[0]
        return `${p.name}<br/>发电量: ${formatPower(p.value)}`
      },
    },
    grid: { top: 40, right: 20, bottom: 30, left: 70 },
    xAxis: {
      type: 'category' as const,
      data: AREAS,
      axisLabel: { fontSize: 12 },
    },
    yAxis: {
      type: 'value' as const,
      name: 'MW',
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: 'bar' as const,
        data: AREAS.map((area) => ({
          value: Math.round(generationByArea[area] || 0),
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#1890ff' },
                { offset: 1, color: '#69c0ff' },
              ],
            },
            borderRadius: [6, 6, 0, 0],
          },
        })),
        barWidth: '40%',
      },
    ],
  }

  const balanceInfo = BALANCE_CONFIG[balance.status]

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 140,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) => <Tag color={TYPE_COLOR_MAP[v]}>{TYPE_LABEL_MAP[v]}</Tag>,
    },
    {
      title: '区域',
      dataIndex: 'area',
      key: 'area',
      width: 70,
    },
    {
      title: '装机容量',
      dataIndex: 'capacity',
      key: 'capacity',
      width: 110,
      render: (v: number) => formatPower(v),
    },
    {
      title: '当前出力',
      dataIndex: 'currentOutput',
      key: 'currentOutput',
      width: 110,
      render: (v: number) => formatPower(v),
    },
    {
      title: '利用率',
      key: 'utilization',
      width: 160,
      render: (_: unknown, record: typeof sources[0]) => {
        const percent = record.capacity > 0 ? Math.round((record.currentOutput / record.capacity) * 100) : 0
        return (
          <Progress
            percent={percent}
            size="small"
            strokeColor={percent >= 80 ? '#52c41a' : percent >= 50 ? '#1890ff' : percent >= 30 ? '#faad14' : '#ff4d4f'}
            format={(p) => `${p}%`}
          />
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => <Tag color={getStatusColor(v)}>{STATUS_LABEL_MAP[v]}</Tag>,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>发电监控</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SyncOutlined spin style={{ color: '#52c41a' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>实时刷新 · {lastUpdate.toLocaleTimeString()}</Text>
        </div>
      </div>

      <Card style={{ ...cardStyle, marginBottom: 16 }} bodyStyle={{ padding: '12px 24px' }}>
        <Space size="middle" wrap>
          <span style={{ fontSize: 14, color: '#595959' }}>区域筛选:</span>
          <Select
            style={{ width: 140 }}
            placeholder="全部区域"
            allowClear
            value={areaFilter}
            onChange={(v) => setAreaFilter(v || undefined)}
            options={AREAS.map((a) => ({ label: a, value: a }))}
          />
          <span style={{ fontSize: 14, color: '#595959' }}>电源类型:</span>
          <Select
            style={{ width: 140 }}
            placeholder="全部类型"
            allowClear
            value={typeFilter}
            onChange={(v) => setTypeFilter(v || undefined)}
            options={SOURCE_TYPES.map((t) => ({ label: t.label, value: t.value }))}
          />
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新数据</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="总装机容量"
              value={stats.totalCapacity.toFixed(0)}
              suffix="MW"
              prefix={<ThunderboltOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="当前出力"
              value={stats.currentOutput.toFixed(0)}
              suffix="MW"
              prefix={<DashboardOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="在线机组"
              value={stats.onlineCount}
              suffix={`/ ${filteredSources.length}`}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="综合利用率"
              value={stats.utilization}
              suffix="%"
              prefix={<SyncOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 28 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            style={cardStyle}
            title={
              <span>
                <ThunderboltOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                电力平衡计算
              </span>
            }
          >
            <Row gutter={[24, 16]} align="middle">
              <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 4 }}>总发电</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: '#1890ff' }}>{formatPower(totalGeneration)}</div>
              </Col>
              <Col xs={24} sm={2} style={{ textAlign: 'center', fontSize: 20, color: '#8c8c8c' }}>
                <MinusOutlined />
              </Col>
              <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 4 }}>总负荷</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: '#faad14' }}>{formatPower(totalLoad)}</div>
              </Col>
              <Col xs={24} sm={2} style={{ textAlign: 'center', fontSize: 20, color: '#8c8c8c' }}>
                =
              </Col>
              <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 4 }}>平衡偏差</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 600, color: balanceInfo.color }}>
                    {balance.balance > 0 ? '+' : ''}{formatPower(balance.balance)}
                  </span>
                  <Tag
                    icon={balanceInfo.icon}
                    color={balance.status === 'surplus' ? 'success' : balance.status === 'deficit' ? 'error' : 'processing'}
                    style={{ fontSize: 13, padding: '2px 10px' }}
                  >
                    {balanceInfo.label}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>偏差率: {balance.rate > 0 ? '+' : ''}{balance.rate}%</div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card
            style={cardStyle}
            title={
              <span>
                <DashboardOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                各类型发电量
              </span>
            }
          >
            <ReactECharts option={typeChartOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card
            style={cardStyle}
            title={
              <span>
                <DashboardOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                各区域发电量
              </span>
            }
          >
            <ReactECharts option={areaChartOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            style={cardStyle}
            title={
              <span>
                <ThunderboltOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                电源列表
              </span>
            }
          >
            <Table
              columns={columns}
              dataSource={filteredSources}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
              scroll={{ x: 800 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

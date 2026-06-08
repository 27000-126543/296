import { useEffect, useRef, useState } from 'react'
import { Row, Col, Card, Statistic, Progress, Tag, Table, Typography } from 'antd'
import {
  ThunderboltOutlined,
  RiseOutlined,
  WarningOutlined,
  CloudOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { usePowerStore } from '../store/usePowerStore'
import { useFaultStore } from '../store/useFaultStore'
import { useCarbonStore } from '../store/useCarbonStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { generateLoadCurve, generateNewEnergyRate, generateCarbonTrend } from '../utils/mockData'
import { calcPowerBalance, formatPower } from '../utils/helpers'

const { Text, Title } = Typography

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  height: '100%',
}

export default function Dashboard() {
  const { sources, loadData, refresh: refreshPower } = usePowerStore()
  const { records: faultRecords, checkTimeout } = useFaultStore()
  const { data: carbonData, refresh: refreshCarbon } = useCarbonStore()
  const { addNotification } = useNotificationStore()
  const [loadCurve, setLoadCurve] = useState(generateLoadCurve)
  const [newEnergyRate, setNewEnergyRate] = useState(generateNewEnergyRate)
  const [carbonTrend, setCarbonTrend] = useState(generateCarbonTrend)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalGen = sources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
  const totalLoad = loadData.reduce((sum, l) => sum + l.total, 0)
  const balance = calcPowerBalance(totalGen, totalLoad)
  const newEnergyGen = sources.filter((s) => s.type === 'wind' || s.type === 'solar').reduce((sum, s) => sum + s.currentOutput, 0)
  const newEnergyRatio = totalGen > 0 ? ((newEnergyGen / totalGen) * 100).toFixed(1) : '0'
  const thermalGen = sources.filter((s) => s.type === 'thermal').reduce((sum, s) => sum + s.currentOutput, 0)
  const hydroGen = sources.filter((s) => s.type === 'hydro').reduce((sum, s) => sum + s.currentOutput, 0)
  const onlineCount = sources.filter((s) => s.status === 'online').length
  const faultPending = faultRecords.filter((r) => r.status !== 'resolved').length
  const faultEscalated = faultRecords.filter((r) => r.escalated && r.status !== 'resolved').length
  const carbonWarning = carbonData.filter((d) => d.warning).length

  useEffect(() => {
    timerRef.current = setInterval(() => {
      refreshPower()
      refreshCarbon()
      checkTimeout()
      setLoadCurve(generateLoadCurve())
      setNewEnergyRate(generateNewEnergyRate())
      setCarbonTrend(generateCarbonTrend())
      setLastUpdate(new Date())

      if (Math.random() > 0.7) {
        const types = ['dispatch', 'fault', 'carbon', 'price'] as const
        const type = types[Math.floor(Math.random() * types.length)]
        const messages: Record<string, { title: string; content: string }> = {
          dispatch: { title: '调度指令建议', content: `供需偏差${(Math.random() * 200 + 50).toFixed(0)}MW，建议调整机组出力` },
          fault: { title: '故障告警', content: `${['华东', '华南', '华北'][Math.floor(Math.random() * 3)]}区域检测到线路异常` },
          carbon: { title: '碳排放预警', content: `碳排放强度超标，建议启动碳交易` },
          price: { title: '用电时段推荐', content: `当前低谷电价，建议启动大功率设备` },
        }
        const msg = messages[type]
        addNotification({ title: msg.title, content: msg.content, type })
      }
    }, 5000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const loadCurveOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { top: 30, right: 20, bottom: 30, left: 60 },
    xAxis: { type: 'category' as const, data: loadCurve.map((d) => d.time), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value' as const, name: 'MW', axisLabel: { fontSize: 11 } },
    series: [
      {
        type: 'line' as const,
        data: loadCurve.map((d) => d.value),
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24,144,255,0.4)' },
              { offset: 1, color: 'rgba(24,144,255,0.05)' },
            ],
          },
        },
        lineStyle: { width: 2, color: '#1890ff' },
        itemStyle: { color: '#1890ff' },
      },
    ],
  }

  const newEnergyOption = {
    tooltip: { trigger: 'axis' as const, formatter: '{b}: {c}%' },
    grid: { top: 30, right: 20, bottom: 30, left: 50 },
    xAxis: { type: 'category' as const, data: newEnergyRate.map((d) => d.time), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value' as const, name: '%', max: 100, axisLabel: { fontSize: 11 } },
    series: [
      {
        type: 'bar' as const,
        data: newEnergyRate.map((d) => d.rate),
        itemStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#52c41a' },
              { offset: 1, color: '#95de64' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  }

  const carbonOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { top: 30, right: 20, bottom: 30, left: 60 },
    xAxis: { type: 'category' as const, data: carbonTrend.map((d) => d.time), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value' as const, name: '吨CO₂', axisLabel: { fontSize: 11 } },
    series: [
      {
        type: 'line' as const,
        data: carbonTrend.map((d) => d.value),
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(250,173,20,0.4)' },
              { offset: 1, color: 'rgba(250,173,20,0.05)' },
            ],
          },
        },
        lineStyle: { width: 2, color: '#faad14' },
        itemStyle: { color: '#faad14' },
      },
    ],
  }

  const sourcePieOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c}MW ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
        data: [
          { value: Math.round(thermalGen), name: '火电', itemStyle: { color: '#ff4d4f' } },
          { value: Math.round(hydroGen), name: '水电', itemStyle: { color: '#1890ff' } },
          { value: Math.round(sources.filter((s) => s.type === 'wind').reduce((a, b) => a + b.currentOutput, 0)), name: '风电', itemStyle: { color: '#52c41a' } },
          { value: Math.round(sources.filter((s) => s.type === 'solar').reduce((a, b) => a + b.currentOutput, 0)), name: '光伏', itemStyle: { color: '#faad14' } },
        ],
      },
    ],
  }

  const faultColumns = [
    { title: '区域', dataIndex: 'area', key: 'area', width: 70 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
    {
      title: '等级', dataIndex: 'level', key: 'level', width: 70,
      render: (v: string) => <Tag color={v === 'critical' ? 'red' : v === 'major' ? 'orange' : 'blue'}>{v === 'critical' ? '紧急' : v === 'major' ? '重大' : '一般'}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => {
        const map: Record<string, { color: string; label: string }> = {
          pending: { color: 'orange', label: '待分配' },
          assigned: { color: 'blue', label: '已分配' },
          repairing: { color: 'processing', label: '抢修中' },
          resolved: { color: 'green', label: '已修复' },
        }
        const info = map[v] || { color: 'default', label: v }
        return <Tag color={info.color}>{info.label}</Tag>
      },
    },
    {
      title: '超时', dataIndex: 'escalated', key: 'escalated', width: 60,
      render: (v: boolean, r: typeof faultRecords[0]) => v && r.status !== 'resolved' ? <Tag color="red">已升级</Tag> : '-',
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>智慧电力调度大屏</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SyncOutlined spin style={{ color: '#52c41a' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>实时刷新 · {lastUpdate.toLocaleTimeString()}</Text>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="总发电功率"
              value={totalGen.toFixed(0)}
              suffix="MW"
              prefix={<ThunderboltOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 28 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>在线机组: {onlineCount}/{sources.length}</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="总负荷功率"
              value={totalLoad.toFixed(0)}
              suffix="MW"
              prefix={<RiseOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 28 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                功率平衡: <span style={{ color: balance.status === 'surplus' ? '#52c41a' : balance.status === 'deficit' ? '#ff4d4f' : '#8c8c8c' }}>
                  {balance.balance > 0 ? '+' : ''}{balance.balance.toFixed(0)}MW
                </span>
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="新能源利用率"
              value={newEnergyRatio}
              suffix="%"
              prefix={<CloudOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 28 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>新能源发电: {formatPower(newEnergyGen)}</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="待处理故障"
              value={faultPending}
              suffix={faultEscalated > 0 ? `（${faultEscalated}件已升级）` : ''}
              prefix={<WarningOutlined style={{ color: faultPending > 3 ? '#ff4d4f' : '#faad14' }} />}
              valueStyle={{ color: faultPending > 3 ? '#ff4d4f' : '#faad14', fontSize: 28 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>碳排放预警: {carbonWarning}个区域</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card style={cardStyle} title={<span><ThunderboltOutlined style={{ marginRight: 8, color: '#1890ff' }} />全网负荷曲线</span>}>
            <ReactECharts option={loadCurveOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card style={cardStyle} title={<span><ThunderboltOutlined style={{ marginRight: 8, color: '#722ed1' }} />电源结构分布</span>}>
            <ReactECharts option={sourcePieOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card style={cardStyle} title={<span><CloudOutlined style={{ marginRight: 8, color: '#52c41a' }} />新能源利用率趋势</span>}>
            <ReactECharts option={newEnergyOption} style={{ height: 240 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card style={cardStyle} title={<span><WarningOutlined style={{ marginRight: 8, color: '#faad14' }} />故障抢修进度</span>}>
            <Table
              columns={faultColumns}
              dataSource={faultRecords.filter((r) => r.status !== 'resolved').slice(0, 5)}
              rowKey="id"
              size="small"
              pagination={false}
              style={{ fontSize: 12 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card style={cardStyle} title={<span><CloudOutlined style={{ marginRight: 8, color: '#faad14' }} />碳排放趋势</span>}>
            <ReactECharts option={carbonOption} style={{ height: 240 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={8}>
          <Card style={cardStyle} bodyStyle={{ textAlign: 'center', padding: 20 }}>
            <Progress
              type="dashboard"
              percent={Number(((totalGen / (totalLoad || 1)) * 100).toFixed(1))}
              format={(p) => `${p}%`}
              strokeColor={totalGen >= totalLoad ? '#52c41a' : '#ff4d4f'}
              size={120}
            />
            <div style={{ marginTop: 8 }}><Text strong>供需平衡率</Text></div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle} bodyStyle={{ textAlign: 'center', padding: 20 }}>
            <Progress
              type="dashboard"
              percent={Number(newEnergyRatio)}
              format={(p) => `${p}%`}
              strokeColor="#52c41a"
              size={120}
            />
            <div style={{ marginTop: 8 }}><Text strong>新能源消纳率</Text></div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle} bodyStyle={{ textAlign: 'center', padding: 20 }}>
            <Progress
              type="dashboard"
              percent={Math.round(((faultRecords.length - faultPending) / faultRecords.length) * 100)}
              format={(p) => `${p}%`}
              strokeColor={Math.round(((faultRecords.length - faultPending) / faultRecords.length) * 100) > 80 ? '#52c41a' : '#faad14'}
              size={120}
            />
            <div style={{ marginTop: 8 }}><Text strong>故障修复率</Text></div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

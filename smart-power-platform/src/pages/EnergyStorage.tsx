import { useState } from 'react'
import { Card, Row, Col, Table, Tag, Button, Statistic, Progress, Typography, Space, Switch, Radio, message, Modal, Input, Alert } from 'antd'
import {
  ThunderboltOutlined,
  DatabaseOutlined,
  DollarOutlined,
  ApartmentOutlined,
  SwapOutlined,
  ExpandOutlined,
  ShrinkOutlined,
  RobotOutlined,
  ScheduleOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useStorageStore } from '../store/useStorageStore'
import { useAuthStore } from '../store/useAuthStore'
import { formatPower } from '../utils/helpers'
import type { ChargeDischargePlan } from '../types'

const { Text, Title } = Typography

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  height: '100%',
}

const modeConfig: Record<string, { label: string; color: string }> = {
  charging: { label: '充电', color: '#1890ff' },
  discharging: { label: '放电', color: '#52c41a' },
  standby: { label: '待机', color: '#8c8c8c' },
}

const actionConfig: Record<string, { label: string; color: string }> = {
  charge: { label: '充电', color: '#1890ff' },
  discharge: { label: '放电', color: '#52c41a' },
  standby: { label: '待机', color: '#8c8c8c' },
}

function buildPlanChartOption(plan: ChargeDischargePlan[]) {
  const hours = plan.map((p) => `${p.hour}:00`)
  const barData = plan.map((p) => p.rate)
  const barColors = plan.map((p) => {
    if (p.action === 'charge') return '#1890ff'
    if (p.action === 'discharge') return '#52c41a'
    return '#d9d9d9'
  })
  const priceData = plan.map((p) => p.price)

  return {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (params: any[]) => {
        let tip = `${params[0].axisValue}<br/>`
        params.forEach((p: any) => {
          if (p.seriesName === '功率') {
            const idx = p.dataIndex
            const action = plan[idx].action
            tip += `${p.marker} ${actionConfig[action].label}功率: ${p.value}MW<br/>`
          } else {
            tip += `${p.marker} ${p.seriesName}: ${p.value}元/kWh<br/>`
          }
        })
        return tip
      },
    },
    legend: { data: ['功率', '电价'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 20, right: 50, bottom: 40, left: 50 },
    xAxis: {
      type: 'category' as const,
      data: hours,
      axisLabel: { fontSize: 10, interval: 2 },
    },
    yAxis: [
      {
        type: 'value' as const,
        name: 'MW',
        axisLabel: { fontSize: 10 },
        nameTextStyle: { fontSize: 10 },
      },
      {
        type: 'value' as const,
        name: '元/kWh',
        axisLabel: { fontSize: 10 },
        nameTextStyle: { fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '功率',
        type: 'bar' as const,
        data: barData.map((v, i) => ({
          value: v,
          itemStyle: { color: barColors[i], borderRadius: [3, 3, 0, 0] },
        })),
        barMaxWidth: 16,
        yAxisIndex: 0,
      },
      {
        name: '电价',
        type: 'line' as const,
        data: priceData,
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#faad14', width: 2 },
        itemStyle: { color: '#faad14' },
      },
    ],
  }
}

const planColumns = [
  {
    title: '时段',
    dataIndex: 'hour',
    key: 'hour',
    width: 70,
    render: (v: number) => `${String(v).padStart(2, '0')}:00`,
  },
  {
    title: '动作',
    dataIndex: 'action',
    key: 'action',
    width: 70,
    render: (v: string) => <Tag color={actionConfig[v]?.color}>{actionConfig[v]?.label}</Tag>,
  },
  {
    title: '功率(MW)',
    dataIndex: 'rate',
    key: 'rate',
    width: 90,
    render: (v: number) => v.toFixed(1),
  },
  {
    title: '电价(元/kWh)',
    dataIndex: 'price',
    key: 'price',
    width: 110,
    render: (v: number) => v.toFixed(2),
  },
  {
    title: '收益(元)',
    dataIndex: 'revenue',
    key: 'revenue',
    width: 100,
    render: (v: number) => {
      const color = v > 0 ? '#52c41a' : v < 0 ? '#ff4d4f' : '#8c8c8c'
      return <span style={{ color }}>{v > 0 ? '+' : ''}{v.toFixed(2)}</span>
    },
  },
]

export default function EnergyStorage() {
  const { stations, setMode, setStrategy, applyAutoPlan, recoverAuto, refresh } = useStorageStore()
  const { user } = useAuthStore()
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [planPage, setPlanPage] = useState<Record<string, number>>({})
  const [overrideModal, setOverrideModal] = useState<{ id: string; mode: 'charging' | 'discharging' | 'standby' } | null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  const canOperate = (user?.role ?? 0) >= 3

  const totalCapacity = stations.reduce((sum, s) => sum + s.capacity, 0)
  const totalEnergy = stations.reduce((sum, s) => sum + s.currentEnergy, 0)
  const totalRevenue = stations.reduce((sum, s) => sum + s.revenue, 0)
  const totalEstimatedRevenue = stations.reduce((sum, s) => sum + s.estimatedRevenue, 0)

  const toggleExpand = (id: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleModeChange = (id: string, mode: 'charging' | 'discharging' | 'standby') => {
    const station = stations.find((s) => s.id === id)
    if (station?.strategy === 'auto') {
      setOverrideModal({ id, mode })
      setOverrideReason('')
    } else {
      setMode(id, mode)
      message.success(`已切换为${modeConfig[mode].label}模式`)
    }
  }

  const handleOverrideConfirm = () => {
    if (!overrideModal) return
    setMode(overrideModal.id, overrideModal.mode, overrideReason || undefined)
    message.success(`已临时覆盖为${modeConfig[overrideModal.mode].label}，预计2小时后恢复自动策略`)
    setOverrideModal(null)
    setOverrideReason('')
  }

  const handleRecoverAuto = (id: string) => {
    recoverAuto(id)
    message.success('已恢复自动策略')
  }

  const handleStrategyChange = (id: string, checked: boolean) => {
    const strategy = checked ? 'auto' : 'manual'
    setStrategy(id, strategy)
    message.success(`已切换为${strategy === 'auto' ? '自动' : '手动'}策略`)
  }

  const handleApplyPlan = (id: string) => {
    applyAutoPlan(id)
    message.success('充放电计划已生成并应用')
  }

  const rateBarOption = {
    tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
    legend: { data: ['充电功率', '放电功率'], bottom: 0 },
    grid: { top: 30, right: 20, bottom: 40, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: stations.map((s) => s.name),
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'value' as const,
      name: 'MW',
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        name: '充电功率',
        type: 'bar' as const,
        data: stations.map((s) => s.chargeRate),
        itemStyle: { color: '#1890ff', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 32,
      },
      {
        name: '放电功率',
        type: 'bar' as const,
        data: stations.map((s) => s.dischargeRate),
        itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 32,
      },
    ],
  }

  const allParticipants = stations.flatMap((s) => s.participants)
  const participantMap = new Map<string, { revenue: number; planRevenue: number }>()
  allParticipants.forEach((p) => {
    const existing = participantMap.get(p.name)
    if (existing) {
      existing.revenue += p.revenue
    } else {
      participantMap.set(p.name, { revenue: p.revenue, planRevenue: 0 })
    }
  })
  stations.forEach((s) => {
    const totalShare = s.participants.reduce((sum, p) => sum + p.share, 0)
    s.participants.forEach((p) => {
      const planRev = Math.round((Math.abs(s.estimatedRevenue) * p.share / totalShare) * 100) / 100
      const existing = participantMap.get(p.name)
      if (existing) {
        existing.planRevenue += planRev
      }
    })
  })
  const pieColors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#ff4d4f', '#13c2c2', '#eb2f96', '#2f54eb']

  const revenuePieOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c}万元 ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
        data: Array.from(participantMap.entries()).map(([name, data], i) => ({
          name,
          value: Math.round(data.revenue * 100) / 100,
          itemStyle: { color: pieColors[i % pieColors.length] },
        })),
      },
    ],
  }

  const participantColumns = [
    { title: '参与方', dataIndex: 'name', key: 'name' },
    {
      title: '分成比例',
      dataIndex: 'share',
      key: 'share',
      render: (v: number) => `${v}%`,
    },
    {
      title: '收益金额',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (v: number) => `${v.toFixed(2)}万元`,
    },
    {
      title: '计划日收益',
      dataIndex: 'planRevenue',
      key: 'planRevenue',
      render: (v: number) => `${v.toFixed(2)}万元`,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>储能电站管理</Title>
        <Button icon={<SwapOutlined />} onClick={refresh}>刷新数据</Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="电站总数"
              value={stations.length}
              suffix="座"
              prefix={<ApartmentOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="总装机容量"
              value={formatPower(totalCapacity)}
              prefix={<ThunderboltOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="总储能电量"
              value={formatPower(totalEnergy)}
              prefix={<DatabaseOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="总收益"
              value={totalRevenue.toFixed(2)}
              suffix="万元"
              prefix={<DollarOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 28 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {stations.map((station) => {
          const energyPercent = Math.round((station.currentEnergy / station.capacity) * 100)
          const isExpanded = expandedKeys.has(station.id)
          const modeInfo = modeConfig[station.mode]
          const isAuto = station.strategy === 'auto'

          const chargingCost = station.dailyPlan
            .filter((p) => p.action === 'charge')
            .reduce((sum, p) => sum + Math.abs(p.revenue), 0)
          const dischargingRevenue = station.dailyPlan
            .filter((p) => p.action === 'discharge')
            .reduce((sum, p) => sum + p.revenue, 0)

          const currentPage = planPage[station.id] || 1

          return (
            <Col xs={24} key={station.id}>
              <Card
                style={{ ...cardStyle, height: 'auto' }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Space>
                      <span style={{ fontWeight: 600 }}>{station.name}</span>
                      {station.manualOverride && (
                        <Tag color="warning">临时覆盖</Tag>
                      )}
                      <Tag color={isAuto ? 'blue' : 'default'}>
                        {isAuto ? <RobotOutlined style={{ marginRight: 4 }} /> : null}
                        {isAuto ? '自动策略运行中' : '手动控制'}
                      </Tag>
                      <Tag color={modeInfo.color}>{modeInfo.label}</Tag>
                    </Space>
                    <Space>
                      <Statistic
                        title="预计日收益"
                        value={station.estimatedRevenue.toFixed(2)}
                        suffix="元"
                        valueStyle={{ color: station.estimatedRevenue >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
                        style={{ marginRight: 8 }}
                      />
                      {canOperate && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<ScheduleOutlined />}
                          onClick={() => handleApplyPlan(station.id)}
                        >
                          生成充放电计划
                        </Button>
                      )}
                    </Space>
                  </div>
                }
              >
                {station.manualOverride && (
                  <Alert
                    type="warning"
                    showIcon
                    message="临时覆盖中"
                    description={
                      <div>
                        <div>覆盖原因：{station.overrideReason || '调度员临时覆盖'}</div>
                        <div>开始时间：{station.overrideStartAt}</div>
                        <div>预计恢复：{station.overrideRecoverAt}</div>
                        <div>计划动作：{station.plannedAction ? modeConfig[station.plannedAction].label : '-'}</div>
                        {canOperate && (
                          <Button size="small" type="primary" style={{ marginTop: 8 }} onClick={() => handleRecoverAuto(station.id)}>
                            立即恢复自动策略
                          </Button>
                        )}
                      </div>
                    }
                    style={{ marginBottom: 12 }}
                  />
                )}
                <Row gutter={[16, 12]}>
                  <Col span={6}>
                    <Text type="secondary">装机容量</Text>
                    <div><Text strong>{formatPower(station.capacity)}</Text></div>
                  </Col>
                  <Col span={6}>
                    <Text type="secondary">当前收益</Text>
                    <div><Text strong style={{ color: '#faad14' }}>{station.revenue.toFixed(2)}万元</Text></div>
                  </Col>
                  <Col span={6}>
                    <Text type="secondary">充电成本</Text>
                    <div><Text strong style={{ color: '#ff4d4f' }}>-{chargingCost.toFixed(2)}元</Text></div>
                  </Col>
                  <Col span={6}>
                    <Text type="secondary">放电收益</Text>
                    <div><Text strong style={{ color: '#52c41a' }}>+{dischargingRevenue.toFixed(2)}元</Text></div>
                  </Col>
                  <Col span={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text type="secondary">当前电量</Text>
                      <Text>{formatPower(station.currentEnergy)} / {formatPower(station.capacity)}</Text>
                    </div>
                    <Progress
                      percent={energyPercent}
                      strokeColor={station.mode === 'charging' ? '#1890ff' : station.mode === 'discharging' ? '#52c41a' : '#8c8c8c'}
                      size="small"
                    />
                  </Col>
                  <Col span={6}>
                    <Text type="secondary">充电功率</Text>
                    <div><Text strong style={{ color: '#1890ff' }}>{station.chargeRate.toFixed(1)}MW</Text></div>
                  </Col>
                  <Col span={6}>
                    <Text type="secondary">放电功率</Text>
                    <div><Text strong style={{ color: '#52c41a' }}>{station.dischargeRate.toFixed(1)}MW</Text></div>
                  </Col>
                  <Col span={24}>
                    {canOperate ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <Space>
                          <Text type="secondary">运行模式</Text>
                          <Radio.Group
                            size="small"
                            value={station.mode}
                            onChange={(e) => handleModeChange(station.id, e.target.value)}
                            optionType="button"
                            buttonStyle="solid"
                            disabled={isAuto}
                          >
                            <Radio.Button value="charging" style={{ color: !isAuto && station.mode === 'charging' ? '#1890ff' : undefined }}>充电</Radio.Button>
                            <Radio.Button value="discharging" style={{ color: !isAuto && station.mode === 'discharging' ? '#52c41a' : undefined }}>放电</Radio.Button>
                            <Radio.Button value="standby">待机</Radio.Button>
                          </Radio.Group>
                        </Space>
                        <Space>
                          <Text type="secondary">自动策略</Text>
                          <Switch
                            size="small"
                            checked={isAuto}
                            onChange={(checked) => handleStrategyChange(station.id, checked)}
                            checkedChildren="自动"
                            unCheckedChildren="手动"
                          />
                        </Space>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Text type="secondary">运行模式:</Text>
                        <Tag color={modeInfo.color}>{modeInfo.label}</Tag>
                        <Text type="secondary" style={{ marginLeft: 8 }}>策略:</Text>
                        <Tag color={isAuto ? 'blue' : 'default'}>{isAuto ? '自动' : '手动'}</Tag>
                      </div>
                    )}
                  </Col>

                  <Col span={24}>
                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 4 }}>
                      <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>每日充放电计划</Text>
                      <ReactECharts option={buildPlanChartOption(station.dailyPlan)} style={{ height: 220 }} />
                    </div>
                  </Col>

                  <Col span={24}>
                    <Table
                      columns={planColumns}
                      dataSource={station.dailyPlan}
                      rowKey="hour"
                      size="small"
                      pagination={{
                        current: currentPage,
                        pageSize: 8,
                        size: 'small',
                        onChange: (page) => setPlanPage((prev) => ({ ...prev, [station.id]: page })),
                      }}
                      style={{ marginTop: 4 }}
                    />
                  </Col>

                  <Col span={24}>
                    <Button
                      type="link"
                      size="small"
                      icon={isExpanded ? <ShrinkOutlined /> : <ExpandOutlined />}
                      onClick={() => toggleExpand(station.id)}
                      style={{ padding: 0 }}
                    >
                      {isExpanded ? '收起收益分成' : '展开收益分成'}
                    </Button>
                    {isExpanded && (
                      <Table
                        columns={participantColumns}
                        dataSource={station.participants.map((p) => {
                          const totalShare = station.participants.reduce((s, pp) => s + pp.share, 0)
                          const planRev = Math.round((Math.abs(station.estimatedRevenue) * p.share / totalShare) * 100) / 100
                          return { ...p, planRevenue: planRev }
                        })}
                        rowKey="name"
                        size="small"
                        pagination={false}
                        style={{ marginTop: 8 }}
                        summary={() => (
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0}><Text strong>合计</Text></Table.Summary.Cell>
                            <Table.Summary.Cell index={1}><Text strong>{station.participants.reduce((s, p) => s + p.share, 0).toFixed(1)}%</Text></Table.Summary.Cell>
                            <Table.Summary.Cell index={2}><Text strong>{station.participants.reduce((s, p) => s + p.revenue, 0).toFixed(2)}万元</Text></Table.Summary.Cell>
                            <Table.Summary.Cell index={3}><Text strong style={{ color: '#52c41a' }}>{Math.abs(station.estimatedRevenue).toFixed(2)}万元</Text></Table.Summary.Cell>
                          </Table.Summary.Row>
                        )}
                      />
                    )}
                  </Col>
                </Row>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card style={cardStyle} title={<span><ThunderboltOutlined style={{ marginRight: 8, color: '#1890ff' }} />充放电功率对比</span>}>
            <ReactECharts option={rateBarOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card style={cardStyle} title={<span><DollarOutlined style={{ marginRight: 8, color: '#faad14' }} />收益分成分布</span>}>
            <ReactECharts option={revenuePieOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card style={cardStyle} bodyStyle={{ padding: 16 }}>
            <Statistic
              title="全站预计日总收益"
              value={totalEstimatedRevenue.toFixed(2)}
              suffix="元"
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: totalEstimatedRevenue >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="临时覆盖确认"
        open={!!overrideModal}
        onOk={handleOverrideConfirm}
        onCancel={() => { setOverrideModal(null); setOverrideReason('') }}
        okText="确认覆盖"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12 }}>
          <Text>将临时覆盖为 <Tag color={overrideModal ? modeConfig[overrideModal.mode].color : ''}>{overrideModal ? modeConfig[overrideModal.mode].label : ''}</Tag> 模式，预计2小时后自动恢复计划策略。</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">覆盖原因：</Text>
        </div>
        <Input.TextArea
          rows={3}
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="请输入临时覆盖原因"
        />
      </Modal>
    </div>
  )
}

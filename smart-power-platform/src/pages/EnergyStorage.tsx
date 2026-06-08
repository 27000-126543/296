import { useState } from 'react'
import { Card, Row, Col, Table, Tag, Button, Statistic, Progress, Typography, Space, Switch, Radio, message } from 'antd'
import {
  ThunderboltOutlined,
  DatabaseOutlined,
  DollarOutlined,
  ApartmentOutlined,
  SwapOutlined,
  ExpandOutlined,
  ShrinkOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useStorageStore } from '../store/useStorageStore'
import { formatPower } from '../utils/helpers'

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

export default function EnergyStorage() {
  const { stations, setMode, setStrategy, refresh } = useStorageStore()
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const totalCapacity = stations.reduce((sum, s) => sum + s.capacity, 0)
  const totalEnergy = stations.reduce((sum, s) => sum + s.currentEnergy, 0)
  const totalRevenue = stations.reduce((sum, s) => sum + s.revenue, 0)

  const toggleExpand = (id: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleModeChange = (id: string, mode: 'charging' | 'discharging' | 'standby') => {
    setMode(id, mode)
    message.success(`已切换为${modeConfig[mode].label}模式`)
  }

  const handleStrategyChange = (id: string, checked: boolean) => {
    const strategy = checked ? 'auto' : 'manual'
    setStrategy(id, strategy)
    message.success(`已切换为${strategy === 'auto' ? '自动' : '手动'}策略`)
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
  const participantMap = new Map<string, number>()
  allParticipants.forEach((p) => {
    participantMap.set(p.name, (participantMap.get(p.name) || 0) + p.revenue)
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
        data: Array.from(participantMap.entries()).map(([name, value], i) => ({
          name,
          value: Math.round(value * 100) / 100,
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

          return (
            <Col xs={24} lg={12} key={station.id}>
              <Card
                style={cardStyle}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{station.name}</span>
                    <Tag color={station.mode === 'charging' ? 'blue' : station.mode === 'discharging' ? 'green' : 'default'}>
                      {modeInfo.label}
                    </Tag>
                  </div>
                }
              >
                <Row gutter={[16, 12]}>
                  <Col span={12}>
                    <Text type="secondary">装机容量</Text>
                    <div><Text strong>{formatPower(station.capacity)}</Text></div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">当前收益</Text>
                    <div><Text strong style={{ color: '#faad14' }}>{station.revenue.toFixed(2)}万元</Text></div>
                  </Col>
                  <Col span={24}>
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
                  <Col span={12}>
                    <Text type="secondary">充电功率</Text>
                    <div><Text strong style={{ color: '#1890ff' }}>{station.chargeRate.toFixed(1)}MW</Text></div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">放电功率</Text>
                    <div><Text strong style={{ color: '#52c41a' }}>{station.dischargeRate.toFixed(1)}MW</Text></div>
                  </Col>
                  <Col span={24}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Space>
                        <Text type="secondary">运行模式</Text>
                        <Radio.Group
                          size="small"
                          value={station.mode}
                          onChange={(e) => handleModeChange(station.id, e.target.value)}
                          optionType="button"
                          buttonStyle="solid"
                        >
                          <Radio.Button value="charging" style={{ color: station.mode === 'charging' ? '#1890ff' : undefined }}>充电</Radio.Button>
                          <Radio.Button value="discharging" style={{ color: station.mode === 'discharging' ? '#52c41a' : undefined }}>放电</Radio.Button>
                          <Radio.Button value="standby">待机</Radio.Button>
                        </Radio.Group>
                      </Space>
                      <Space>
                        <Text type="secondary">自动策略</Text>
                        <Switch
                          size="small"
                          checked={station.strategy === 'auto'}
                          onChange={(checked) => handleStrategyChange(station.id, checked)}
                          checkedChildren="自动"
                          unCheckedChildren="手动"
                        />
                      </Space>
                    </div>
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
                        dataSource={station.participants}
                        rowKey="name"
                        size="small"
                        pagination={false}
                        style={{ marginTop: 8 }}
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
    </div>
  )
}

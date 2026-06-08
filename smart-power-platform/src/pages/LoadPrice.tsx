import { useState, useMemo } from 'react'
import { Card, Row, Col, Table, Tag, Button, Statistic, Typography, Space, Alert, message } from 'antd'
import {
  DollarOutlined,
  ThunderboltOutlined,
  BellOutlined,
  BulbOutlined,
  ArrowDownOutlined,
  BankOutlined,
  ShopOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { usePowerStore } from '../store/usePowerStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { useAuthStore } from '../store/useAuthStore'
import { generatePriceData } from '../utils/mockData'
import { formatPower } from '../utils/helpers'

const { Text, Title } = Typography

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  height: '100%',
}

const PEAK_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  peak: { label: '高峰', color: '#ff4d4f', bg: '#fff1f0' },
  flat: { label: '平段', color: '#1890ff', bg: '#e6f7ff' },
  valley: { label: '低谷', color: '#52c41a', bg: '#f6ffed' },
}

export default function LoadPrice() {
  const { loadData } = usePowerStore()
  const { addNotification } = useNotificationStore()
  const { user } = useAuthStore()
  const [priceData, setPriceData] = useState(() => generatePriceData())

  const filteredLoadData = useMemo(() => {
    if (user?.role === 2 && user?.proxyAreas && user.proxyAreas.length > 0) {
      return loadData.filter((d) => user.proxyAreas!.includes(d.area))
    }
    if (user?.role === 0 && user?.area) {
      return loadData.filter((d) => d.area === user.area)
    }
    return loadData
  }, [loadData, user])

  const currentHour = new Date().getHours()
  const currentPrice = useMemo(() => {
    const item = priceData.find((_, i) => i === currentHour)
    return item || priceData[0]
  }, [priceData, currentHour])

  const peakInfo = PEAK_LABEL[currentPrice.type]

  const cheapestSlots = useMemo(() => {
    const valleyRanges: { start: number; end: number; type: 'valley' | 'flat'; avgPrice: number }[] = []
    const flatRanges: { start: number; end: number; type: 'valley' | 'flat'; avgPrice: number }[] = []

    let start = -1
    let end = -1
    for (let i = 0; i < 24; i++) {
      if (priceData[i].type === 'valley') {
        if (start === -1) start = i
        end = i
      } else {
        if (start !== -1) {
          const avg = priceData.slice(start, end + 1).reduce((s, d) => s + d.price, 0) / (end - start + 1)
          valleyRanges.push({ start, end, type: 'valley', avgPrice: Math.round(avg * 100) / 100 })
        }
        start = -1
        end = -1
      }
    }
    if (start !== -1) {
      const avg = priceData.slice(start, end + 1).reduce((s, d) => s + d.price, 0) / (end - start + 1)
      valleyRanges.push({ start, end, type: 'valley', avgPrice: Math.round(avg * 100) / 100 })
    }

    start = -1
    end = -1
    for (let i = 0; i < 24; i++) {
      if (priceData[i].type === 'flat') {
        if (start === -1) start = i
        end = i
      } else {
        if (start !== -1) {
          const avg = priceData.slice(start, end + 1).reduce((s, d) => s + d.price, 0) / (end - start + 1)
          flatRanges.push({ start, end, type: 'flat', avgPrice: Math.round(avg * 100) / 100 })
        }
        start = -1
        end = -1
      }
    }
    if (start !== -1) {
      const avg = priceData.slice(start, end + 1).reduce((s, d) => s + d.price, 0) / (end - start + 1)
      flatRanges.push({ start, end, type: 'flat', avgPrice: Math.round(avg * 100) / 100 })
    }

    return [...valleyRanges, ...flatRanges].sort((a, b) => a.avgPrice - b.avgPrice)
  }, [priceData])

  const priceChartOption = useMemo(() => {
    const hours = priceData.map((d) => d.timestamp.slice(11, 16))
    const prices = priceData.map((d) => d.price)

    const peakAreas: { xAxis: string }[] = []
    const flatAreas: { xAxis: string }[] = []
    const valleyAreas: { xAxis: string }[] = []

    for (let i = 0; i < 24; i++) {
      const entry = { xAxis: hours[i] }
      if (priceData[i].type === 'peak') peakAreas.push(entry)
      else if (priceData[i].type === 'flat') flatAreas.push(entry)
      else valleyAreas.push(entry)
    }

    const markAreaData: { xAxis: string; itemStyle: { color: string } }[] = []
    let i = 0
    while (i < 24) {
      const type = priceData[i].type
      const color = type === 'peak' ? 'rgba(255,77,79,0.08)' : type === 'flat' ? 'rgba(24,144,255,0.08)' : 'rgba(82,196,26,0.08)'
      const startIdx = i
      while (i < 24 && priceData[i].type === type) i++
      markAreaData.push({ xAxis: hours[startIdx], itemStyle: { color } })
      if (i - 1 < 24) {
        markAreaData.push({ xAxis: hours[Math.min(i - 1, 23)], itemStyle: { color } })
      }
    }

    return {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params
          const idx = p.dataIndex
          const typeLabel = PEAK_LABEL[priceData[idx].type]
          return `${p.name}<br/>电价: ${p.value}元/kWh<br/>时段: <span style="color:${typeLabel.color}">${typeLabel.label}</span>`
        },
      },
      legend: {
        data: ['电价', '高峰时段', '平段时段', '低谷时段'],
        bottom: 0,
        textStyle: { fontSize: 12 },
      },
      grid: { top: 30, right: 20, bottom: 50, left: 50 },
      xAxis: { type: 'category' as const, data: hours, axisLabel: { fontSize: 11 }, boundaryGap: false },
      yAxis: { type: 'value' as const, name: '元/kWh', axisLabel: { fontSize: 11 }, min: 0 },
      series: [
        {
          name: '电价',
          type: 'line' as const,
          data: prices,
          smooth: true,
          lineStyle: { width: 2.5, color: '#1890ff' },
          itemStyle: { color: '#1890ff' },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24,144,255,0.25)' },
                { offset: 1, color: 'rgba(24,144,255,0.02)' },
              ],
            },
          },
          markArea: {
            silent: true,
            data: markAreaData.length > 0 ? [markAreaData] : [],
          },
        },
      ],
    }
  }, [priceData])

  const loadBarOption = useMemo(() => {
    const areas = filteredLoadData.map((d) => d.area)
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      legend: {
        data: ['工业负荷', '商业负荷', '居民负荷'],
        bottom: 0,
        textStyle: { fontSize: 12 },
      },
      grid: { top: 30, right: 20, bottom: 40, left: 60 },
      xAxis: { type: 'category' as const, data: areas, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value' as const, name: 'MW', axisLabel: { fontSize: 11 } },
      series: [
        {
          name: '工业负荷',
          type: 'bar' as const,
          stack: 'total',
          data: filteredLoadData.map((d) => d.industrial),
          itemStyle: { color: '#1890ff', borderRadius: [0, 0, 0, 0] },
        },
        {
          name: '商业负荷',
          type: 'bar' as const,
          stack: 'total',
          data: filteredLoadData.map((d) => d.commercial),
          itemStyle: { color: '#faad14' },
        },
        {
          name: '居民负荷',
          type: 'bar' as const,
          stack: 'total',
          data: filteredLoadData.map((d) => d.residential),
          itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] },
        },
      ],
    }
  }, [filteredLoadData])

  const loadColumns = [
    { title: '区域', dataIndex: 'area', key: 'area', width: 80 },
    {
      title: '工业负荷',
      dataIndex: 'industrial',
      key: 'industrial',
      width: 120,
      render: (v: number) => <span style={{ color: '#1890ff' }}>{formatPower(v)}</span>,
    },
    {
      title: '商业负荷',
      dataIndex: 'commercial',
      key: 'commercial',
      width: 120,
      render: (v: number) => <span style={{ color: '#faad14' }}>{formatPower(v)}</span>,
    },
    {
      title: '居民负荷',
      dataIndex: 'residential',
      key: 'residential',
      width: 120,
      render: (v: number) => <span style={{ color: '#52c41a' }}>{formatPower(v)}</span>,
    },
    {
      title: '总负荷',
      dataIndex: 'total',
      key: 'total',
      width: 120,
      render: (v: number) => <Text strong>{formatPower(v)}</Text>,
    },
  ]

  const handleNotify = () => {
    const cheapest = cheapestSlots[0]
    if (!cheapest) return
    const typeLabel = cheapest.type === 'valley' ? '低谷' : '平段'
    const timeStr = `${String(cheapest.start).padStart(2, '0')}:00-${String(cheapest.end).padStart(2, '0')}:00`
    addNotification({
      title: '最优用电时段通知',
      content: `推荐用电时段: ${timeStr}（${typeLabel}），平均电价 ${cheapest.avgPrice}元/kWh，建议在此时段安排大功率设备运行`,
      type: 'price',
    })
    message.success('已推送最优用电时段通知')
  }

  const handleRefresh = () => {
    setPriceData(generatePriceData())
    message.success('电价数据已刷新')
  }

  const avgPrice = useMemo(() => {
    const sum = priceData.reduce((s, d) => s + d.price, 0)
    return Math.round((sum / priceData.length) * 100) / 100
  }, [priceData])

  const maxPrice = useMemo(() => Math.max(...priceData.map((d) => d.price)), [priceData])
  const minPrice = useMemo(() => Math.min(...priceData.map((d) => d.price)), [priceData])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>负荷与电价分析</Title>
        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={handleRefresh}>刷新电价</Button>
          <Button type="primary" icon={<BellOutlined />} onClick={handleNotify}>推送最优用电通知</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="当前电价"
              value={currentPrice.price}
              suffix="元/kWh"
              prefix={<DollarOutlined style={{ color: peakInfo.color }} />}
              valueStyle={{ color: peakInfo.color, fontSize: 28 }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color={peakInfo.color === '#ff4d4f' ? 'red' : peakInfo.color === '#52c41a' ? 'green' : 'blue'}>
                {peakInfo.label}时段
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{currentHour}:00</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="今日均价"
              value={avgPrice}
              suffix="元/kWh"
              prefix={<DollarOutlined style={{ color: '#8c8c8c' }} />}
              valueStyle={{ color: '#595959', fontSize: 28 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>24小时平均</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="最高电价"
              value={maxPrice}
              suffix="元/kWh"
              prefix={<ArrowDownOutlined style={{ color: '#ff4d4f', transform: 'rotate(180deg)' }} />}
              valueStyle={{ color: '#ff4d4f', fontSize: 28 }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="red">高峰时段</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="最低电价"
              value={minPrice}
              suffix="元/kWh"
              prefix={<ArrowDownOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 28 }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="green">低谷时段</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card style={cardStyle} title={<span><DollarOutlined style={{ marginRight: 8, color: '#1890ff' }} />24小时电价曲线</span>}>
            <ReactECharts option={priceChartOption} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card style={cardStyle} title={<span><BulbOutlined style={{ marginRight: 8, color: '#52c41a' }} />智能用电推荐</span>}>
            <Alert
              message="推荐用电时段"
              description="根据今日电价分析，以下时段电价较低，建议安排大功率设备运行以降低用电成本"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={[12, 12]}>
              {cheapestSlots.map((slot, idx) => {
                const isValley = slot.type === 'valley'
                const tagColor = isValley ? 'green' : 'blue'
                const tagLabel = isValley ? '低谷' : '平段'
                const timeStr = `${String(slot.start).padStart(2, '0')}:00 - ${String(slot.end).padStart(2, '0')}:00`
                const duration = slot.end - slot.start + 1
                return (
                  <Col xs={24} sm={12} md={8} lg={6} key={idx}>
                    <Card
                      size="small"
                      style={{
                        borderColor: isValley ? '#52c41a' : '#1890ff',
                        background: isValley ? '#f6ffed' : '#e6f7ff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Tag color={tagColor} style={{ margin: 0 }}>
                          {idx === 0 ? '最优推荐' : `推荐用电时段`}
                        </Tag>
                        <Tag color={tagColor}>{tagLabel}</Tag>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{timeStr}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>均价: {slot.avgPrice}元/kWh</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>时长: {duration}小时</Text>
                      </div>
                    </Card>
                  </Col>
                )
              })}
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card style={cardStyle} title={<span><BankOutlined style={{ marginRight: 8, color: '#1890ff' }} />各区域负荷数据</span>}>
            <Table
              columns={loadColumns}
              dataSource={filteredLoadData}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card style={cardStyle} title={<span><ShopOutlined style={{ marginRight: 8, color: '#faad14' }} />区域负荷构成</span>}>
            <ReactECharts option={loadBarOption} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

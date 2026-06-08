import React, { useMemo } from 'react'
import { Card, Row, Col, Table, Tag, Button, Statistic, Progress, Typography, Alert, Space, message } from 'antd'
import {
  CloudOutlined,
  WarningOutlined,
  DashboardOutlined,
  PercentageOutlined,
  BellOutlined,
  SwapOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useCarbonStore } from '../store/useCarbonStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { useAuthStore } from '../store/useAuthStore'
import { formatNumber } from '../utils/helpers'

const { Text, Title } = Typography

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  height: '100%',
}

export default function CarbonMonitor() {
  const { data, refresh } = useCarbonStore()
  const { addNotification } = useNotificationStore()
  const { user } = useAuthStore()

  const filteredData = useMemo(() => {
    if (!user) return data
    if (user.role === 1 && user.area) {
      return data.filter((d) => d.area === user.area)
    }
    if (user.role === 0 && user.area) {
      return data.filter((d) => d.area === user.area)
    }
    return data
  }, [data, user])

  const warningAreas = useMemo(() => filteredData.filter((d) => d.warning), [filteredData])

  const totalEmission = useMemo(() => filteredData.reduce((sum, d) => sum + d.emission, 0), [filteredData])
  const avgIntensity = useMemo(() => {
    if (filteredData.length === 0) return 0
    return filteredData.reduce((sum, d) => sum + d.intensity, 0) / filteredData.length
  }, [filteredData])
  const totalQuota = useMemo(() => filteredData.reduce((sum, d) => sum + d.quota, 0), [filteredData])
  const totalUsed = useMemo(() => filteredData.reduce((sum, d) => sum + d.used, 0), [filteredData])
  const quotaUtilRate = useMemo(() => {
    if (totalQuota === 0) return 0
    return (totalUsed / totalQuota) * 100
  }, [totalUsed, totalQuota])
  const warningCount = warningAreas.length

  const barChartOption = useMemo(() => ({
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['实际排放', '配额'], top: 0, textStyle: { fontSize: 12 } },
    grid: { top: 40, right: 20, bottom: 30, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: filteredData.map((d) => d.area),
      axisLabel: { fontSize: 12 },
    },
    yAxis: {
      type: 'value' as const,
      name: '吨CO₂',
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        name: '实际排放',
        type: 'bar' as const,
        barMaxWidth: 36,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (params: { dataIndex: number }) => {
            return filteredData[params.dataIndex]?.warning ? '#ff4d4f' : '#1890ff'
          },
        },
        data: filteredData.map((d) => d.emission),
      },
      {
        name: '配额',
        type: 'bar' as const,
        barMaxWidth: 36,
        itemStyle: { color: '#95de64', borderRadius: [4, 4, 0, 0] },
        data: filteredData.map((d) => d.quota),
      },
    ],
  }), [filteredData])

  const gaugeChartOption = useMemo(() => ({
    series: [
      {
        type: 'gauge' as const,
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 10,
        itemStyle: { color: quotaUtilRate > 90 ? '#ff4d4f' : quotaUtilRate > 70 ? '#faad14' : '#52c41a' },
        progress: { show: true, width: 18 },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 18 } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          formatter: `{value}%`,
          fontSize: 28,
          fontWeight: 'bold',
          offsetCenter: [0, '10%'],
          color: quotaUtilRate > 90 ? '#ff4d4f' : quotaUtilRate > 70 ? '#faad14' : '#52c41a',
        },
        title: { offsetCenter: [0, '40%'], fontSize: 14, color: '#8c8c8c' },
        data: [{ value: Number(quotaUtilRate.toFixed(1)), name: '配额利用率' }],
      },
    ],
  }), [quotaUtilRate])

  const handlePushNotification = (area: string, overAmount: number) => {
    addNotification({
      title: '碳排放预警',
      content: `${area}区域碳排放已超出配额${formatNumber(overAmount)}吨CO₂，建议购买碳配额`,
      type: 'carbon',
    })
    message.success(`已推送${area}区域碳排放预警通知`)
  }

  const handlePushTradeSuggestion = (area: string, amount: number, price: string) => {
    addNotification({
      title: '碳交易建议',
      content: `建议${area}区域购买${formatNumber(amount)}吨碳配额，参考价格${price}元/吨`,
      type: 'carbon',
    })
    message.success(`已推送${area}区域碳交易建议`)
  }

  const columns = [
    { title: '编号', dataIndex: 'id', key: 'id', width: 80 },
    { title: '区域', dataIndex: 'area', key: 'area', width: 80 },
    {
      title: '排放量(吨CO₂)',
      dataIndex: 'emission',
      key: 'emission',
      width: 130,
      render: (v: number) => formatNumber(v),
    },
    {
      title: '排放强度(吨CO₂/MWh)',
      dataIndex: 'intensity',
      key: 'intensity',
      width: 170,
      render: (v: number) => formatNumber(v, 2),
    },
    {
      title: '配额(吨CO₂)',
      dataIndex: 'quota',
      key: 'quota',
      width: 120,
      render: (v: number) => formatNumber(v),
    },
    {
      title: '已用(吨CO₂)',
      dataIndex: 'used',
      key: 'used',
      width: 120,
      render: (v: number) => formatNumber(v),
    },
    {
      title: '利用率',
      key: 'utilRate',
      width: 160,
      render: (_: unknown, record: (typeof filteredData)[0]) => {
        const rate = record.quota > 0 ? (record.used / record.quota) * 100 : 0
        return (
          <Progress
            percent={Number(rate.toFixed(1))}
            size="small"
            strokeColor={rate > 100 ? '#ff4d4f' : rate > 80 ? '#faad14' : '#52c41a'}
          />
        )
      },
    },
    {
      title: '预警状态',
      key: 'warning',
      width: 100,
      render: (_: unknown, record: (typeof filteredData)[0]) =>
        record.warning ? <Tag color="red">超配额</Tag> : <Tag color="green">正常</Tag>,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>碳排放监控</Title>
        <Button icon={<ReloadOutlined />} onClick={refresh}>刷新数据</Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6} lg={5}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="总排放量"
              value={formatNumber(totalEmission)}
              suffix="吨CO₂"
              prefix={<CloudOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={5}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="平均排放强度"
              value={formatNumber(avgIntensity, 2)}
              suffix="吨CO₂/MWh"
              prefix={<DashboardOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={5}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="总配额"
              value={formatNumber(totalQuota)}
              suffix="吨CO₂"
              prefix={<PercentageOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={5}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="配额利用率"
              value={quotaUtilRate.toFixed(1)}
              suffix="%"
              prefix={<PercentageOutlined style={{ color: quotaUtilRate > 90 ? '#ff4d4f' : '#faad14' }} />}
              valueStyle={{ color: quotaUtilRate > 90 ? '#ff4d4f' : quotaUtilRate > 70 ? '#faad14' : '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="预警区域"
              value={warningCount}
              suffix="个"
              prefix={<WarningOutlined style={{ color: warningCount > 0 ? '#ff4d4f' : '#52c41a' }} />}
              valueStyle={{ color: warningCount > 0 ? '#ff4d4f' : '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {warningAreas.length > 0 && (
        <Alert
          style={{ marginTop: 16 }}
          type="error"
          showIcon
          icon={<WarningOutlined />}
          message="碳排放预警"
          description={
            <Space direction="vertical" size={4}>
              {warningAreas.map((d) => (
                <div key={d.id}>
                  {d.area}区域碳排放已超出配额，超出{formatNumber(d.used - d.quota)}吨CO₂
                  <Button
                    type="link"
                    size="small"
                    icon={<BellOutlined />}
                    onClick={() => handlePushNotification(d.area, d.used - d.quota)}
                  >
                    推送通知
                  </Button>
                </div>
              ))}
            </Space>
          }
        />
      )}

      {warningAreas.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {warningAreas.map((d) => {
            const overAmount = d.used - d.quota
            const price = (45 + Math.random() * 15).toFixed(2)
            const totalCost = (overAmount * Number(price)).toFixed(0)
            return (
              <Col xs={24} sm={12} md={8} key={d.id}>
                <Card
                  style={cardStyle}
                  title={
                    <span>
                      <SwapOutlined style={{ marginRight: 8, color: '#faad14' }} />
                      {d.area}区域 - 碳交易建议
                    </span>
                  }
                  extra={<Tag color="red">超配额</Tag>}
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">超出配额: </Text>
                      <Text strong style={{ color: '#ff4d4f' }}>{formatNumber(overAmount)} 吨CO₂</Text>
                    </div>
                    <div>
                      <Text type="secondary">建议购买量: </Text>
                      <Text strong>{formatNumber(overAmount)} 吨</Text>
                    </div>
                    <div>
                      <Text type="secondary">参考价格: </Text>
                      <Text strong>{price} 元/吨</Text>
                    </div>
                    <div>
                      <Text type="secondary">预估费用: </Text>
                      <Text strong style={{ color: '#faad14' }}>{Number(totalCost).toLocaleString()} 元</Text>
                    </div>
                    <Button
                      type="primary"
                      icon={<BellOutlined />}
                      onClick={() => handlePushTradeSuggestion(d.area, overAmount, price)}
                      style={{ width: '100%' }}
                    >
                      推送交易建议
                    </Button>
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            style={cardStyle}
            title={<span><CloudOutlined style={{ marginRight: 8, color: '#1890ff' }} />各区域排放与配额对比</span>}
          >
            <ReactECharts option={barChartOption} style={{ height: 360 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            style={cardStyle}
            title={<span><DashboardOutlined style={{ marginRight: 8, color: '#722ed1' }} />碳配额总利用率</span>}
          >
            <ReactECharts option={gaugeChartOption} style={{ height: 360 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card
            style={cardStyle}
            title={<span><CloudOutlined style={{ marginRight: 8, color: '#52c41a' }} />碳排放数据明细</span>}
          >
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
              rowClassName={(record) => record.warning ? 'carbon-warning-row' : ''}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

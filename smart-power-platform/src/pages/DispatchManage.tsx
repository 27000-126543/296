import { useState, useEffect } from 'react'
import { Card, Row, Col, Table, Tag, Button, Statistic, Typography, Modal, Space, Steps, message } from 'antd'
import {
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useDispatchStore } from '../store/useDispatchStore'
import { usePowerStore } from '../store/usePowerStore'
import { useAuthStore } from '../store/useAuthStore'
import { formatDate, calcPowerBalance } from '../utils/helpers'
import type { DispatchOrder } from '../types'

const { Title, Text } = Typography

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  height: '100%',
}

const TYPE_CONFIG: Record<DispatchOrder['type'], { label: string; color: string }> = {
  increase: { label: '增出力', color: 'blue' },
  decrease: { label: '减出力', color: 'orange' },
  shutdown: { label: '停机', color: 'red' },
  startup: { label: '开机', color: 'green' },
}

const STATUS_CONFIG: Record<DispatchOrder['status'], { label: string; color: string }> = {
  pending: { label: '待确认', color: 'orange' },
  confirmed: { label: '已确认', color: 'blue' },
  executing: { label: '执行中', color: 'processing' },
  completed: { label: '已完成', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
}

const STATUS_STEP_MAP: Record<DispatchOrder['status'], number> = {
  pending: 0,
  confirmed: 1,
  executing: 2,
  completed: 3,
  rejected: -1,
}

export default function DispatchManage() {
  const { orders, confirmOrder, rejectOrder, completeOrder, autoGenerate } = useDispatchStore()
  const { totalGeneration, totalLoad } = usePowerStore()
  const user = useAuthStore((s) => s.user)
  const [detailOrder, setDetailOrder] = useState<DispatchOrder | null>(null)

  const canOperate = (user?.role ?? 0) >= 3

  const balanceInfo = calcPowerBalance(totalGeneration, totalLoad)

  useEffect(() => {
    useDispatchStore.getState().refresh()
  }, [])

  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const executingCount = orders.filter((o) => o.status === 'executing').length
  const completedTodayCount = orders.filter((o) => {
    if (o.status !== 'completed' || !o.completedAt) return false
    const completedDate = new Date(o.completedAt).toDateString()
    const today = new Date().toDateString()
    return completedDate === today
  }).length
  const rejectedCount = orders.filter((o) => o.status === 'rejected').length

  const handleConfirm = (id: string) => {
    confirmOrder(id)
    message.success('调度指令已确认执行')
  }

  const handleComplete = (id: string) => {
    completeOrder(id)
    message.success('调度指令已标记完成')
  }

  const handleReject = (id: string) => {
    Modal.confirm({
      title: '确认拒绝',
      icon: <ExclamationCircleOutlined />,
      content: '确定要拒绝该调度指令吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        rejectOrder(id)
        message.warning('调度指令已拒绝')
      },
    })
  }

  const handleAutoGenerate = () => {
    autoGenerate()
    message.success('已检测供需状态并生成调度建议')
  }

  const typeCountMap: Record<string, number> = {}
  orders.forEach((o) => {
    typeCountMap[o.type] = (typeCountMap[o.type] || 0) + 1
  })

  const pieOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c}条 ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
        data: Object.entries(typeCountMap).map(([type, count]) => ({
          value: count,
          name: TYPE_CONFIG[type as DispatchOrder['type']]?.label || type,
          itemStyle: { color: TYPE_CONFIG[type as DispatchOrder['type']]?.color === 'blue' ? '#1890ff' : TYPE_CONFIG[type as DispatchOrder['type']]?.color === 'orange' ? '#fa8c16' : TYPE_CONFIG[type as DispatchOrder['type']]?.color === 'red' ? '#ff4d4f' : '#52c41a' },
        })),
      },
    ],
  }

  const columns = [
    {
      title: '指令编号',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '电源名称',
      dataIndex: 'sourceName',
      key: 'sourceName',
      width: 140,
    },
    {
      title: '指令类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: DispatchOrder['type']) => {
        const cfg = TYPE_CONFIG[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '目标出力(MW)',
      dataIndex: 'targetOutput',
      key: 'targetOutput',
      width: 120,
      render: (v: number) => v.toFixed(1),
    },
    {
      title: '当前出力(MW)',
      dataIndex: 'currentOutput',
      key: 'currentOutput',
      width: 120,
      render: (v: number) => v.toFixed(1),
    },
    {
      title: '偏差(MW)',
      key: 'deviation',
      width: 110,
      render: (_: unknown, record: DispatchOrder) => {
        const dev = record.deviation ?? (record.targetOutput - record.currentOutput)
        const color = Math.abs(dev) < 10 ? '#52c41a' : Math.abs(dev) < 50 ? '#faad14' : '#ff4d4f'
        return <Text style={{ color }}>{dev > 0 ? '+' : ''}{dev.toFixed(1)}</Text>
      },
    },
    {
      title: '平衡影响',
      key: 'balanceImpact',
      width: 160,
      render: (_: unknown, record: DispatchOrder) => {
        if (record.balanceBefore == null || record.balanceAfter == null) return <Text type="secondary">-</Text>
        const before = record.balanceBefore
        const after = record.balanceAfter
        const improved = Math.abs(after) < Math.abs(before)
        const color = improved ? '#52c41a' : '#ff4d4f'
        return (
          <span>
            <Text style={{ color: before >= 0 ? '#52c41a' : '#ff4d4f' }}>{before.toFixed(1)}</Text>
            <ArrowRightOutlined style={{ margin: '0 6px', fontSize: 10, color }} />
            <Text style={{ color: after >= 0 ? '#52c41a' : '#ff4d4f' }}>{after.toFixed(1)}</Text>
          </span>
        )
      },
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 180,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: DispatchOrder['status']) => {
        const cfg = STATUS_CONFIG[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 110,
      render: (v: string | undefined) => v || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => formatDate(v),
    },
    {
      title: '操作',
      key: 'action',
      width: canOperate ? 220 : 80,
      fixed: 'right' as const,
      render: (_: unknown, record: DispatchOrder) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailOrder(record)}>
            详情
          </Button>
          {canOperate && record.status === 'pending' && (
            <Button type="primary" size="small" onClick={() => handleConfirm(record.id)}>
              确认执行
            </Button>
          )}
          {canOperate && record.status === 'executing' && (
            <Button type="primary" size="small" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => handleComplete(record.id)}>
              标记完成
            </Button>
          )}
          {canOperate && record.status === 'pending' && (
            <Button danger size="small" onClick={() => handleReject(record.id)}>
              拒绝
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const currentStep = detailOrder ? STATUS_STEP_MAP[detailOrder.status] : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>调度指令管理</Title>
        {canOperate && (
          <Button type="primary" icon={<RobotOutlined />} onClick={handleAutoGenerate}>
            检测并生成调度建议
          </Button>
        )}
      </div>

      <Card
        style={{ ...cardStyle, marginBottom: 16, borderLeft: `4px solid ${balanceInfo.status === 'surplus' ? '#52c41a' : balanceInfo.status === 'deficit' ? '#ff4d4f' : '#1890ff'}` }}
        bodyStyle={{ padding: '16px 24px' }}
      >
        <Row gutter={24} align="middle">
          <Col span={5}>
            <Statistic
              title="总发电量"
              value={totalGeneration.toFixed(1)}
              suffix="MW"
              prefix={<ThunderboltOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="总负荷"
              value={totalLoad.toFixed(1)}
              suffix="MW"
              valueStyle={{ fontSize: 22 }}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="供需差值"
              value={balanceInfo.balance.toFixed(1)}
              suffix="MW"
              valueStyle={{ color: balanceInfo.balance >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 22 }}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="偏差率"
              value={balanceInfo.rate}
              suffix="%"
              valueStyle={{ color: Math.abs(balanceInfo.rate) <= 2 ? '#52c41a' : '#ff4d4f', fontSize: 22 }}
            />
          </Col>
          <Col span={4} style={{ textAlign: 'center' }}>
            <Tag
              color={balanceInfo.status === 'surplus' ? 'success' : balanceInfo.status === 'deficit' ? 'error' : 'processing'}
              style={{ fontSize: 16, padding: '4px 16px', borderRadius: 4 }}
            >
              {balanceInfo.status === 'balanced' ? '供需平衡' : '供需失衡'}
            </Tag>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="待确认指令"
              value={pendingCount}
              suffix="条"
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="执行中指令"
              value={executingCount}
              suffix="条"
              prefix={<SyncOutlined spin style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="今日完成"
              value={completedTodayCount}
              suffix="条"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="已拒绝"
              value={rejectedCount}
              suffix="条"
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f', fontSize: 28 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card style={cardStyle} title="调度指令列表">
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              size="middle"
              scroll={{ x: 1600 }}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card style={cardStyle} title="指令类型分布">
            <ReactECharts option={pieOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Modal
        title="调度指令详情"
        open={!!detailOrder}
        onCancel={() => setDetailOrder(null)}
        footer={null}
        width={640}
      >
        {detailOrder && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>执行进度</Text>
              <Steps
                current={currentStep}
                size="small"
                style={{ marginTop: 8 }}
                items={[
                  { title: '待确认' },
                  { title: '已确认' },
                  { title: '执行中' },
                  { title: '已完成' },
                ]}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              <div>
                <Text type="secondary">指令编号</Text>
                <div><Text strong>{detailOrder.id}</Text></div>
              </div>
              <div>
                <Text type="secondary">电源名称</Text>
                <div><Text strong>{detailOrder.sourceName}</Text></div>
              </div>
              <div>
                <Text type="secondary">指令类型</Text>
                <div><Tag color={TYPE_CONFIG[detailOrder.type].color}>{TYPE_CONFIG[detailOrder.type].label}</Tag></div>
              </div>
              <div>
                <Text type="secondary">状态</Text>
                <div><Tag color={STATUS_CONFIG[detailOrder.status].color}>{STATUS_CONFIG[detailOrder.status].label}</Tag></div>
              </div>
              <div>
                <Text type="secondary">目标出力</Text>
                <div><Text strong>{detailOrder.targetOutput.toFixed(1)} MW</Text></div>
              </div>
              <div>
                <Text type="secondary">当前出力</Text>
                <div><Text strong>{detailOrder.currentOutput.toFixed(1)} MW</Text></div>
              </div>
              <div>
                <Text type="secondary">偏差</Text>
                <div>
                  {(() => {
                    const dev = detailOrder.deviation ?? (detailOrder.targetOutput - detailOrder.currentOutput)
                    const color = Math.abs(dev) < 10 ? '#52c41a' : Math.abs(dev) < 50 ? '#faad14' : '#ff4d4f'
                    return <Text strong style={{ color }}>{dev > 0 ? '+' : ''}{dev.toFixed(1)} MW</Text>
                  })()}
                </div>
              </div>
              <div>
                <Text type="secondary">操作人</Text>
                <div><Text strong>{detailOrder.operator || '-'}</Text></div>
              </div>
            </div>

            <div style={{ marginTop: 20, padding: 16, background: '#fafafa', borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>调整前后对比</Text>
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={12}>
                  <div style={{ textAlign: 'center', padding: 12, background: '#fff', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>出力调整</Text>
                    <div style={{ marginTop: 8 }}>
                      <Text strong style={{ fontSize: 18, color: '#595959' }}>{detailOrder.beforeOutput.toFixed(1)}</Text>
                      <Text type="secondary" style={{ margin: '0 8px' }}>MW</Text>
                      <ArrowRightOutlined style={{ color: detailOrder.targetOutput > detailOrder.beforeOutput ? '#52c41a' : '#ff4d4f', margin: '0 8px' }} />
                      <Text strong style={{ fontSize: 18, color: detailOrder.targetOutput > detailOrder.beforeOutput ? '#52c41a' : '#ff4d4f' }}>{detailOrder.targetOutput.toFixed(1)}</Text>
                      <Text type="secondary" style={{ marginLeft: 4 }}>MW</Text>
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center', padding: 12, background: '#fff', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>平衡变化</Text>
                    <div style={{ marginTop: 8 }}>
                      {detailOrder.balanceBefore != null && detailOrder.balanceAfter != null ? (
                        <>
                          <Text strong style={{ fontSize: 18, color: detailOrder.balanceBefore >= 0 ? '#52c41a' : '#ff4d4f' }}>{detailOrder.balanceBefore.toFixed(1)}</Text>
                          <Text type="secondary" style={{ margin: '0 4px' }}>MW</Text>
                          <ArrowRightOutlined style={{ color: Math.abs(detailOrder.balanceAfter) < Math.abs(detailOrder.balanceBefore) ? '#52c41a' : '#ff4d4f', margin: '0 8px' }} />
                          <Text strong style={{ fontSize: 18, color: detailOrder.balanceAfter >= 0 ? '#52c41a' : '#ff4d4f' }}>{detailOrder.balanceAfter.toFixed(1)}</Text>
                          <Text type="secondary" style={{ marginLeft: 4 }}>MW</Text>
                        </>
                      ) : (
                        <Text type="secondary">暂无数据</Text>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', marginTop: 20 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <Text type="secondary">调度原因</Text>
                <div><Text>{detailOrder.reason}</Text></div>
              </div>
              <div>
                <Text type="secondary">创建时间</Text>
                <div><Text>{formatDate(detailOrder.createdAt)}</Text></div>
              </div>
              <div>
                <Text type="secondary">确认时间</Text>
                <div><Text>{detailOrder.confirmedAt ? formatDate(detailOrder.confirmedAt) : '-'}</Text></div>
              </div>
              <div>
                <Text type="secondary">完成时间</Text>
                <div><Text>{detailOrder.completedAt ? formatDate(detailOrder.completedAt) : '-'}</Text></div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

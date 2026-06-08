import { useState, useEffect } from 'react'
import { Card, Row, Col, Table, Tag, Button, Statistic, Typography, Modal, Select, Space, message } from 'antd'
import {
  WarningOutlined,
  ClockCircleOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  AlertOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useFaultStore } from '../store/useFaultStore'
import { useAuthStore } from '../store/useAuthStore'
import { formatDate, getLevelColor } from '../utils/helpers'
import type { FaultRecord } from '../types'

const { Title, Text } = Typography

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  height: '100%',
}

const LEVEL_CONFIG: Record<FaultRecord['level'], { label: string; color: string }> = {
  critical: { label: '紧急', color: 'red' },
  major: { label: '重大', color: 'orange' },
  minor: { label: '一般', color: 'blue' },
}

const STATUS_CONFIG: Record<FaultRecord['status'], { label: string; color: string }> = {
  pending: { label: '待分配', color: 'orange' },
  assigned: { label: '已分配', color: 'blue' },
  repairing: { label: '抢修中', color: 'processing' },
  resolved: { label: '已修复', color: 'green' },
}

const TEAMS = ['抢修班组A', '抢修班组B', '抢修班组C', '抢修班组D', '抢修班组E']

export default function FaultManage() {
  const { records, assignTeam, resolveFault, escalateFault, checkTimeout, refresh } = useFaultStore()
  const user = useAuthStore((s) => s.user)
  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [selectedFault, setSelectedFault] = useState<FaultRecord | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>(undefined)

  const canOperate = (user?.role ?? 0) >= 3

  useEffect(() => {
    checkTimeout()
    const timer = setInterval(() => {
      checkTimeout()
    }, 60000)
    return () => clearInterval(timer)
  }, [checkTimeout])

  const totalCount = records.length
  const pendingCount = records.filter((r) => r.status === 'pending' || r.status === 'assigned').length
  const repairingCount = records.filter((r) => r.status === 'repairing').length
  const resolvedCount = records.filter((r) => r.status === 'resolved').length
  const escalatedCount = records.filter((r) => r.escalated).length

  const handleAssign = () => {
    if (!selectedFault || !selectedTeam) return
    assignTeam(selectedFault.id, selectedTeam)
    message.success(`已将故障 ${selectedFault.id} 分配给 ${selectedTeam}`)
    setAssignModalVisible(false)
    setSelectedFault(null)
    setSelectedTeam(undefined)
  }

  const handleResolve = (id: string) => {
    resolveFault(id)
    message.success('故障已标记为修复')
  }

  const handleEscalate = (id: string) => {
    escalateFault(id)
    message.warning('已升级至主管处理')
  }

  const openAssignModal = (record: FaultRecord) => {
    setSelectedFault(record)
    setSelectedTeam(undefined)
    setAssignModalVisible(true)
  }

  const areaCountMap: Record<string, number> = {}
  records.forEach((r) => {
    areaCountMap[r.area] = (areaCountMap[r.area] || 0) + 1
  })

  const areaPieOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c}条 ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
        data: Object.entries(areaCountMap).map(([area, count]) => ({
          value: count,
          name: area,
        })),
      },
    ],
  }

  const levelCountMap: Record<string, number> = {}
  records.forEach((r) => {
    levelCountMap[r.level] = (levelCountMap[r.level] || 0) + 1
  })

  const levelPieOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c}条 ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
        data: Object.entries(levelCountMap).map(([level, count]) => ({
          value: count,
          name: LEVEL_CONFIG[level as FaultRecord['level']]?.label || level,
          itemStyle: { color: getLevelColor(level) },
        })),
      },
    ],
  }

  const columns = [
    {
      title: '故障编号',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '区域',
      dataIndex: 'area',
      key: 'area',
      width: 80,
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      width: 120,
      ellipsis: true,
    },
    {
      title: '故障类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (v: FaultRecord['level']) => {
        const cfg = LEVEL_CONFIG[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 180,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: FaultRecord['status']) => {
        const cfg = STATUS_CONFIG[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '负责班组',
      dataIndex: 'assignedTeam',
      key: 'assignedTeam',
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
      title: '升级标记',
      dataIndex: 'escalated',
      key: 'escalated',
      width: 100,
      render: (v: boolean, _record: FaultRecord) => {
        if (!v) return '-'
        return <Tag color="red">超时升级</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: canOperate ? 260 : 60,
      fixed: 'right' as const,
      render: (_: unknown, record: FaultRecord) => (
        <Space size="small">
          {canOperate && record.status === 'pending' && (
            <Button type="primary" size="small" onClick={() => openAssignModal(record)}>
              分配班组
            </Button>
          )}
          {canOperate && record.status === 'repairing' && (
            <Button type="primary" size="small" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => handleResolve(record.id)}>
              标记修复
            </Button>
          )}
          {canOperate && record.escalated && record.status !== 'resolved' && (
            <Button danger size="small" onClick={() => handleEscalate(record.id)}>
              升级主管
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>故障管理</Title>
        {canOperate && (
          <Button icon={<WarningOutlined />} onClick={() => { refresh(); message.success('数据已刷新') }}>
            刷新数据
          </Button>
        )}
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="故障总数"
              value={totalCount}
              suffix="条"
              prefix={<WarningOutlined style={{ color: '#595959' }} />}
              valueStyle={{ color: '#595959', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="待处理"
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
              title="抢修中"
              value={repairingCount}
              suffix="条"
              prefix={<ToolOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="已修复"
              value={resolvedCount}
              suffix="条"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 28 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="升级告警"
              value={escalatedCount}
              suffix="条"
              prefix={<AlertOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card style={cardStyle} title="故障区域分布">
            <ReactECharts option={areaPieOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card style={cardStyle} title="故障等级分布">
            <ReactECharts option={levelPieOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ ...cardStyle, marginTop: 16 }} title="故障记录列表">
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          size="middle"
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          rowClassName={(record) => (record.escalated && record.status !== 'resolved' ? 'ant-table-row-escalated' : '')}
        />
      </Card>

      <Modal
        title="分配抢修班组"
        open={assignModalVisible}
        onOk={handleAssign}
        onCancel={() => {
          setAssignModalVisible(false)
          setSelectedFault(null)
          setSelectedTeam(undefined)
        }}
        okText="确认分配"
        cancelText="取消"
        okButtonProps={{ disabled: !selectedTeam }}
      >
        {selectedFault && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">故障编号：</Text>
            <Text strong>{selectedFault.id}</Text>
            <br />
            <Text type="secondary">故障描述：</Text>
            <Text>{selectedFault.description}</Text>
          </div>
        )}
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>选择抢修班组：</Text>
          <Select
            style={{ width: '100%' }}
            placeholder="请选择抢修班组"
            value={selectedTeam}
            onChange={setSelectedTeam}
            options={TEAMS.map((t) => ({ label: t, value: t }))}
          />
        </div>
      </Modal>
    </div>
  )
}

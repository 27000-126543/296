import React, { useState } from 'react'
import { Card, Row, Col, Table, Tag, Button, Statistic, Typography, Modal, Form, Input, InputNumber, Select, Steps, Space, message, Checkbox } from 'antd'
import {
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useGridStore } from '../store/useGridStore'
import { useAuthStore } from '../store/useAuthStore'
import { formatDate } from '../utils/helpers'

const { Title } = Typography

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  height: '100%',
}

const CONNECTION_POINTS = [
  '110kV东郊变',
  '220kV西城变',
  '110kV南湖变',
  '220kV北山变',
  '110kV中心变',
]

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  submitted: { color: 'gold', label: '待部门审批' },
  dept_approved: { color: 'blue', label: '待分管审批' },
  vice_approved: { color: 'purple', label: '待总经理审批' },
  gm_approved: { color: 'green', label: '已通过' },
  rejected: { color: 'red', label: '已拒绝' },
}

const SOURCE_CONFIG: Record<string, { color: string; label: string }> = {
  wind: { color: 'blue', label: '风电' },
  solar: { color: 'orange', label: '光伏' },
}

export default function GridApplicationPage() {
  const { applications, approveDept, approveVice, approveGm, reject, submitApplication, refresh } = useGridStore()
  const { user } = useAuthStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const userRole = user?.role ?? 0

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      submitApplication({
        applicant: values.applicant,
        sourceType: values.sourceType,
        capacity: values.capacity,
        recommendedPoint: values.recommendedPoint,
        capacityVerified: values.capacityVerified ?? false,
      })
      message.success('并网申请已提交')
      form.resetFields()
      setModalOpen(false)
    })
  }

  const canApproveDept = userRole >= 3
  const canApproveVice = userRole >= 3
  const canApproveGm = userRole >= 4

  const columns = [
    { title: '申请编号', dataIndex: 'id', key: 'id', width: 120 },
    { title: '申请人', dataIndex: 'applicant', key: 'applicant', width: 120 },
    {
      title: '电源类型', dataIndex: 'sourceType', key: 'sourceType', width: 100,
      render: (v: string) => {
        const cfg = SOURCE_CONFIG[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    { title: '容量(MW)', dataIndex: 'capacity', key: 'capacity', width: 100, render: (v: number) => v.toFixed(1) },
    { title: '推荐并网点', dataIndex: 'recommendedPoint', key: 'recommendedPoint', width: 140 },
    {
      title: '容量校核', dataIndex: 'capacityVerified', key: 'capacityVerified', width: 90,
      render: (v: boolean) => v
        ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
        : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />,
    },
    {
      title: '审批状态', dataIndex: 'status', key: 'status', width: 120,
      render: (v: string) => {
        const cfg = STATUS_CONFIG[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    { title: '提交时间', dataIndex: 'submittedAt', key: 'submittedAt', width: 150, render: (v: string) => v ? formatDate(v) : '-' },
    { title: '部门审批', dataIndex: 'deptApprovedAt', key: 'deptApprovedAt', width: 150, render: (v: string) => v ? formatDate(v) : '-' },
    { title: '分管审批', dataIndex: 'viceApprovedAt', key: 'viceApprovedAt', width: 150, render: (v: string) => v ? formatDate(v) : '-' },
    { title: '总经理审批', dataIndex: 'gmApprovedAt', key: 'gmApprovedAt', width: 150, render: (v: string) => v ? formatDate(v) : '-' },
  ]

  const expandedRowRender = (record: (typeof applications)[0]) => {
    let currentStep = -1
    if (record.status === 'submitted') currentStep = 0
    else if (record.status === 'dept_approved') currentStep = 1
    else if (record.status === 'vice_approved') currentStep = 2
    else if (record.status === 'gm_approved') currentStep = 3
    else if (record.status === 'rejected') {
      currentStep = record.currentApprovalLevel
    }

    const isRejected = record.status === 'rejected'

    const getStepStatus = (stepIndex: number): 'wait' | 'process' | 'finish' | 'error' => {
      if (isRejected && stepIndex === record.currentApprovalLevel) return 'error'
      if (stepIndex < currentStep) return 'finish'
      if (stepIndex === currentStep && !isRejected) return 'process'
      return 'wait'
    }

    const getStepTitle = (stepIndex: number, defaultTitle: string) => {
      if (isRejected && stepIndex === record.currentApprovalLevel) return `${defaultTitle}（已拒绝）`
      return defaultTitle
    }

    const showDeptActions = record.status === 'submitted' && canApproveDept
    const showViceActions = record.status === 'dept_approved' && canApproveVice
    const showGmActions = record.status === 'vice_approved' && canApproveGm

    return (
      <div style={{ padding: '16px 24px' }}>
        <Steps
          current={isRejected ? record.currentApprovalLevel : currentStep}
          status={isRejected ? 'error' : 'process'}
          items={[
            { title: getStepTitle(0, '部门审批'), status: getStepStatus(0), icon: <AuditOutlined /> },
            { title: getStepTitle(1, '分管审批'), status: getStepStatus(1), icon: <SafetyCertificateOutlined /> },
            { title: getStepTitle(2, '总经理审批'), status: getStepStatus(2), icon: <CrownOutlined /> },
          ]}
        />
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            {showDeptActions && (
              <>
                <Button type="primary" size="small" onClick={() => { approveDept(record.id); message.success('部门审批已通过') }}>通过</Button>
                <Button danger size="small" onClick={() => { reject(record.id); message.error('申请已拒绝') }}>拒绝</Button>
              </>
            )}
            {showViceActions && (
              <>
                <Button type="primary" size="small" onClick={() => { approveVice(record.id); message.success('分管审批已通过') }}>通过</Button>
                <Button danger size="small" onClick={() => { reject(record.id); message.error('申请已拒绝') }}>拒绝</Button>
              </>
            )}
            {showGmActions && (
              <>
                <Button type="primary" size="small" onClick={() => { approveGm(record.id); message.success('总经理审批已通过') }}>通过</Button>
                <Button danger size="small" onClick={() => { reject(record.id); message.error('申请已拒绝') }}>拒绝</Button>
              </>
            )}
          </Space>
        </div>
      </div>
    )
  }

  const statusCounts = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    name: cfg.label,
    value: applications.filter((a) => a.status === key).length,
  }))

  const chartOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c}件 ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: '{b}\n{c}件', fontSize: 11 },
        data: statusCounts.map((item) => ({
          ...item,
          itemStyle: {
            color: STATUS_CONFIG[Object.keys(STATUS_CONFIG).find((k) => STATUS_CONFIG[k].label === item.name) ?? '']?.color ?? '#8c8c8c',
          },
        })),
      },
    ],
  }

  const totalCount = applications.length
  const approvedCount = applications.filter((a) => a.status === 'gm_approved').length
  const pendingCount = applications.filter((a) => a.status !== 'gm_approved' && a.status !== 'rejected').length
  const rejectedCount = applications.filter((a) => a.status === 'rejected').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>并网申请管理</Title>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>新建并网申请</Button>
          <Button onClick={() => { refresh(); message.success('数据已刷新') }}>刷新</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic title="申请总数" value={totalCount} valueStyle={{ color: '#1890ff', fontSize: 28 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic title="已通过" value={approvedCount} valueStyle={{ color: '#52c41a', fontSize: 28 }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic title="审批中" value={pendingCount} valueStyle={{ color: '#faad14', fontSize: 28 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic title="已拒绝" value={rejectedCount} valueStyle={{ color: '#ff4d4f', fontSize: 28 }} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card style={cardStyle} title="并网申请列表">
            <Table
              columns={columns}
              dataSource={applications}
              rowKey="id"
              size="small"
              scroll={{ x: 1400 }}
              expandable={{ expandedRowRender, rowExpandable: () => true }}
              pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card style={cardStyle} title="申请状态统计">
            <ReactECharts option={chartOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Modal
        title="新建并网申请"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { form.resetFields(); setModalOpen(false) }}
        okText="提交"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="applicant" label="申请人" rules={[{ required: true, message: '请输入申请人' }]}>
            <Input placeholder="请输入申请人名称" />
          </Form.Item>
          <Form.Item name="sourceType" label="电源类型" rules={[{ required: true, message: '请选择电源类型' }]}>
            <Select placeholder="请选择电源类型">
              <Select.Option value="wind">风电</Select.Option>
              <Select.Option value="solar">光伏</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="capacity" label="容量(MW)" rules={[{ required: true, message: '请输入容量' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入装机容量" />
          </Form.Item>
          <Form.Item name="recommendedPoint" label="推荐并网点" rules={[{ required: true, message: '请选择并网点' }]}>
            <Select placeholder="请选择推荐并网点">
              {CONNECTION_POINTS.map((p) => (
                <Select.Option key={p} value={p}>{p}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="capacityVerified" valuePropName="checked">
            <Checkbox>容量校核通过</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

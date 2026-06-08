import React, { useState } from 'react'
import { Card, Row, Col, Table, Tag, Button, Statistic, Typography, Modal, Form, Input, InputNumber, Select, Steps, Space, message, Alert } from 'antd'
import {
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
  ImportOutlined,
  LineChartOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useGridStore } from '../store/useGridStore'
import { useAuthStore } from '../store/useAuthStore'
import { formatDate } from '../utils/helpers'
import { CONNECTION_POINTS } from '../types'
import type { GridApplication, CapacityCheckResult } from '../types'

const { Title } = Typography
const { TextArea } = Input

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  height: '100%',
}

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

function generateTypicalCurve(sourceType: 'wind' | 'solar', capacity: number): number[] {
  if (sourceType === 'wind') {
    return [
      0.55, 0.50, 0.45, 0.40, 0.38, 0.35,
      0.30, 0.28, 0.35, 0.50, 0.65, 0.75,
      0.80, 0.78, 0.72, 0.65, 0.60, 0.58,
      0.62, 0.68, 0.60, 0.55, 0.52, 0.50,
    ].map((r) => Math.round(capacity * r * 10) / 10)
  }
  return [
    0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
    0.02, 0.10, 0.30, 0.55, 0.75, 0.90,
    0.95, 0.90, 0.78, 0.58, 0.35, 0.12,
    0.02, 0.00, 0.00, 0.00, 0.00, 0.00,
  ].map((r) => Math.round(capacity * r * 10) / 10)
}

export default function GridApplicationPage() {
  const { applications, approveDept, approveVice, approveGm, reject, submitApplication, adoptSuggestion, refresh } = useGridStore()
  const { user } = useAuthStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [hourlyPlan, setHourlyPlan] = useState<number[]>(Array(24).fill(0))
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchText, setBatchText] = useState('')
  const [sourceType, setSourceType] = useState<'wind' | 'solar'>('wind')

  const userRole = user?.role ?? 0

  const handleSourceTypeChange = (value: 'wind' | 'solar') => {
    setSourceType(value)
  }

  const handleTypicalCurve = () => {
    const capacity = form.getFieldValue('capacity') || 100
    const curve = generateTypicalCurve(sourceType, capacity)
    setHourlyPlan(curve)
  }

  const handleBatchImport = () => {
    const values = batchText.split(/[,，\s]+/).map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v))
    if (values.length !== 24) {
      message.error('请输入24个数值，以逗号分隔')
      return
    }
    setHourlyPlan(values)
    setBatchModalOpen(false)
    setBatchText('')
    message.success('批量导入成功')
  }

  const handleHourlyChange = (index: number, value: number | null) => {
    const newPlan = [...hourlyPlan]
    newPlan[index] = value ?? 0
    setHourlyPlan(newPlan)
  }

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      submitApplication({
        applicant: values.applicant,
        sourceType: values.sourceType,
        capacity: values.capacity,
        recommendedPoint: values.recommendedPoint,
        plannedOutput: hourlyPlan,
        capacityVerified: false,
      })
      message.success('并网申请已提交')
      form.resetFields()
      setHourlyPlan(Array(24).fill(0))
      setSourceType('wind')
      setModalOpen(false)
    })
  }

  const handleAdoptSuggestion = (record: GridApplication) => {
    const checkResult = record.capacityCheckResult
    if (!checkResult?.suggestedPoint) return
    adoptSuggestion(record.id)
    message.success(`已采纳建议并网点：${checkResult.suggestedPoint}，当前申请已更新`)
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
      title: '容量校核', dataIndex: 'capacityCheckResult', key: 'capacityCheckResult', width: 100,
      render: (v: CapacityCheckResult) => v?.passed
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
  ]

  const renderCapacityAlert = (record: GridApplication) => {
    const checkResult = record.capacityCheckResult
    if (!checkResult) return null
    if (checkResult.passed) {
      return (
        <Alert
          type="success"
          showIcon
          message="容量校核通过"
          description={checkResult.reason}
          style={{ marginBottom: 16 }}
        />
      )
    }
    const failReasons: string[] = []
    if (checkResult.capacityOver) {
      failReasons.push(`申请容量${checkResult.capacityValue.toFixed(1)}MW超过并网点剩余容量${checkResult.pointRemaining.toFixed(1)}MW`)
    }
    if (checkResult.peakOver) {
      failReasons.push(`计划峰值${checkResult.peakPlan.toFixed(1)}MW超过并网点剩余容量${checkResult.pointRemaining.toFixed(1)}MW`)
    }
    const suggestText = checkResult.suggestedPoint
      ? `建议并网点：${checkResult.suggestedPoint}（剩余容量 ${checkResult.suggestedPointRemaining?.toFixed(1)}MW）`
      : ''
    return (
      <Alert
        type="error"
        showIcon
        message="容量校核未通过"
        description={`${failReasons.join('；')}${suggestText ? '。' + suggestText : ''}`}
        action={
          checkResult.suggestedPoint ? (
            <Button size="small" type="primary" onClick={() => handleAdoptSuggestion(record)}>
              采纳建议
            </Button>
          ) : undefined
        }
        style={{ marginBottom: 16 }}
      />
    )
  }

  const renderPlanCurve = (record: GridApplication) => {
    const lineColor = record.sourceType === 'wind' ? '#52c41a' : '#fa8c16'
    const option = {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params
          return `${p.name}:00<br/>计划出力: ${p.value}MW`
        },
      },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: Array.from({ length: 24 }, (_, i) => i),
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { fontSize: 11, formatter: '{value}MW' },
      },
      series: [
        {
          type: 'line' as const,
          data: record.plannedOutput || Array(24).fill(0),
          smooth: true,
          lineStyle: { color: lineColor, width: 2 },
          itemStyle: { color: lineColor },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: lineColor + '40' },
                { offset: 1, color: lineColor + '05' },
              ],
            },
          },
        },
      ],
    }
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: '#595959' }}>
          <LineChartOutlined style={{ marginRight: 4 }} />
          24小时计划出力曲线
        </div>
        <ReactECharts option={option} style={{ height: 200 }} />
      </div>
    )
  }

  const expandedRowRender = (record: GridApplication) => {
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
        {renderCapacityAlert(record)}
        {renderPlanCurve(record)}
        <div style={{ marginTop: 16 }}>
          <Steps
            current={isRejected ? record.currentApprovalLevel : currentStep}
            status={isRejected ? 'error' : 'process'}
            items={[
              { title: getStepTitle(0, '部门审批'), status: getStepStatus(0), icon: <AuditOutlined /> },
              { title: getStepTitle(1, '分管审批'), status: getStepStatus(1), icon: <SafetyCertificateOutlined /> },
              { title: getStepTitle(2, '总经理审批'), status: getStepStatus(2), icon: <CrownOutlined /> },
            ]}
          />
        </div>
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
              scroll={{ x: 1000 }}
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
        onCancel={() => { form.resetFields(); setHourlyPlan(Array(24).fill(0)); setSourceType('wind'); setModalOpen(false) }}
        okText="提交"
        cancelText="取消"
        width={720}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="applicant" label="申请人" rules={[{ required: true, message: '请输入申请人' }]}>
            <Input placeholder="请输入申请人名称" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sourceType" label="电源类型" rules={[{ required: true, message: '请选择电源类型' }]}>
                <Select placeholder="请选择电源类型" onChange={handleSourceTypeChange}>
                  <Select.Option value="wind">风电</Select.Option>
                  <Select.Option value="solar">光伏</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="capacity" label="容量(MW)" rules={[{ required: true, message: '请输入容量' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入装机容量" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="recommendedPoint" label="推荐并网点" rules={[{ required: true, message: '请选择并网点' }]}>
            <Select placeholder="请选择推荐并网点">
              {CONNECTION_POINTS.map((p) => {
                const remaining = p.maxCapacity - p.usedCapacity
                return (
                  <Select.Option key={p.name} value={p.name}>
                    {p.name}（剩余 {remaining}MW）
                  </Select.Option>
                )
              })}
            </Select>
          </Form.Item>
          <Form.Item label="24小时发电计划（MW）">
            <div style={{ marginBottom: 8 }}>
              <Space>
                <Button size="small" icon={<ImportOutlined />} onClick={() => setBatchModalOpen(true)}>批量导入</Button>
                <Button size="small" icon={<LineChartOutlined />} onClick={handleTypicalCurve}>一键生成典型曲线</Button>
              </Space>
            </div>
            <Row gutter={[8, 8]}>
              {hourlyPlan.map((val, i) => (
                <Col key={i} span={4}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>{i}时</div>
                    <InputNumber
                      size="small"
                      min={0}
                      value={val}
                      onChange={(v) => handleHourlyChange(i, v)}
                      style={{ width: 60 }}
                    />
                  </div>
                </Col>
              ))}
            </Row>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量导入发电计划"
        open={batchModalOpen}
        onOk={handleBatchImport}
        onCancel={() => { setBatchModalOpen(false); setBatchText('') }}
        okText="导入"
        cancelText="取消"
        width={480}
      >
        <div style={{ marginBottom: 8, color: '#8c8c8c', fontSize: 13 }}>
          请输入24个小时的计划出力值，以逗号分隔（例如：50,45,40,...）
        </div>
        <TextArea
          rows={4}
          value={batchText}
          onChange={(e) => setBatchText(e.target.value)}
          placeholder="50,45,40,35,30,25,20,18,25,40,55,65,70,68,62,55,50,48,52,58,50,45,42,40"
        />
      </Modal>
    </div>
  )
}

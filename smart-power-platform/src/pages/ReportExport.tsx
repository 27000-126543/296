import React, { useState, useMemo } from 'react'
import { Card, Row, Col, Table, Tag, Button, Select, DatePicker, Statistic, Typography, Space, Checkbox, message } from 'antd'
import {
  SearchOutlined,
  UndoOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
  WarningOutlined,
  CloudOutlined,
  PieChartOutlined,
  LineChartOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { usePowerStore } from '../store/usePowerStore'
import { useFaultStore } from '../store/useFaultStore'
import { useCarbonStore } from '../store/useCarbonStore'
import { downloadExcel, formatPower, calcPowerBalance } from '../utils/helpers'
import { AREAS, SOURCE_TYPES } from '../types'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

const TYPE_LABEL_MAP: Record<string, string> = {
  thermal: '火电',
  hydro: '水电',
  wind: '风电',
  solar: '光伏',
}

const TYPE_COLOR_MAP: Record<string, string> = {
  thermal: '#ff4d4f',
  hydro: '#1890ff',
  wind: '#52c41a',
  solar: '#faad14',
}

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  height: '100%',
}

export default function ReportExport() {
  const { sources, loadData } = usePowerStore()
  const { records: faultRecords } = useFaultStore()
  const { data: carbonData } = useCarbonStore()

  const [areaFilter, setAreaFilter] = useState<string | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [exportOptions, setExportOptions] = useState<string[]>(['power', 'load', 'fault', 'carbon'])

  const filteredSources = useMemo(() => {
    let result = sources
    if (areaFilter) {
      result = result.filter((s) => s.area === areaFilter)
    }
    if (typeFilter) {
      result = result.filter((s) => s.type === typeFilter)
    }
    return result
  }, [sources, areaFilter, typeFilter])

  const filteredLoad = useMemo(() => {
    let result = loadData
    if (areaFilter) {
      result = result.filter((l) => l.area === areaFilter)
    }
    return result
  }, [loadData, areaFilter])

  const filteredFaults = useMemo(() => {
    let result = faultRecords
    if (areaFilter) {
      result = result.filter((f) => f.area === areaFilter)
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day')
      const end = dateRange[1].endOf('day')
      result = result.filter((f) => {
        const d = dayjs(f.createdAt)
        return d.isAfter(start) && d.isBefore(end)
      })
    }
    return result
  }, [faultRecords, areaFilter, dateRange])

  const filteredCarbon = useMemo(() => {
    let result = carbonData
    if (areaFilter) {
      result = result.filter((c) => c.area === areaFilter)
    }
    return result
  }, [carbonData, areaFilter])

  const stats = useMemo(() => {
    const totalGen = filteredSources.filter((s) => s.status === 'online').reduce((sum, s) => sum + s.currentOutput, 0)
    const totalLd = filteredLoad.reduce((sum, l) => sum + l.total, 0)
    const balanceInfo = calcPowerBalance(totalGen, totalLd)
    const newEnergyOutput = filteredSources
      .filter((s) => s.status === 'online' && (s.type === 'wind' || s.type === 'solar'))
      .reduce((sum, s) => sum + s.currentOutput, 0)
    const newEnergyRatio = totalGen > 0 ? Math.round((newEnergyOutput / totalGen) * 1000) / 10 : 0
    const faultCount = filteredFaults.filter((f) => f.status !== 'resolved').length
    const totalEmission = filteredCarbon.reduce((sum, c) => sum + c.emission, 0)
    return { totalGen, totalLd, balanceInfo, newEnergyRatio, faultCount, totalEmission }
  }, [filteredSources, filteredLoad, filteredFaults, filteredCarbon])

  const generationByType = useMemo(() => {
    const map: Record<string, number> = { thermal: 0, hydro: 0, wind: 0, solar: 0 }
    filteredSources.filter((s) => s.status === 'online').forEach((s) => {
      map[s.type] = (map[s.type] || 0) + s.currentOutput
    })
    return map
  }, [filteredSources])

  const pieChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'item' as const,
      formatter: '{b}: {c}MW ({d}%)',
    },
    legend: { orient: 'vertical' as const, right: 10, top: 'center', textStyle: { fontSize: 12 } },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{d}%' },
        data: SOURCE_TYPES.map((t) => ({
          name: t.label,
          value: Math.round(generationByType[t.value] || 0),
          itemStyle: { color: TYPE_COLOR_MAP[t.value] },
        })).filter((d) => d.value > 0),
      },
    ],
  }), [generationByType])

  const loadCurveOption = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
    const industrialData = hours.map(() => Math.round(800 + Math.random() * 400))
    const commercialData = hours.map(() => Math.round(400 + Math.random() * 300))
    const residentialData = hours.map(() => Math.round(200 + Math.random() * 200))
    return {
      tooltip: { trigger: 'axis' as const },
      legend: { data: ['工业负荷', '商业负荷', '居民负荷'], top: 0, textStyle: { fontSize: 12 } },
      grid: { top: 40, right: 20, bottom: 30, left: 60 },
      xAxis: { type: 'category' as const, data: hours, axisLabel: { fontSize: 11, interval: 2 } },
      yAxis: { type: 'value' as const, name: 'MW', axisLabel: { fontSize: 11 } },
      series: [
        {
          name: '工业负荷',
          type: 'line' as const,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          itemStyle: { color: '#1890ff' },
          areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(24,144,255,0.25)' }, { offset: 1, color: 'rgba(24,144,255,0.02)' }] } },
          data: industrialData,
        },
        {
          name: '商业负荷',
          type: 'line' as const,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          itemStyle: { color: '#faad14' },
          areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(250,173,20,0.25)' }, { offset: 1, color: 'rgba(250,173,20,0.02)' }] } },
          data: commercialData,
        },
        {
          name: '居民负荷',
          type: 'line' as const,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          itemStyle: { color: '#52c41a' },
          areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(82,196,26,0.25)' }, { offset: 1, color: 'rgba(82,196,26,0.02)' }] } },
          data: residentialData,
        },
      ],
    }
  }, [filteredLoad])

  const carbonBarOption = useMemo(() => ({
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['实际排放', '配额'], top: 0, textStyle: { fontSize: 12 } },
    grid: { top: 40, right: 20, bottom: 30, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: filteredCarbon.map((c) => c.area),
      axisLabel: { fontSize: 12 },
    },
    yAxis: { type: 'value' as const, name: '吨CO₂', axisLabel: { fontSize: 11 } },
    series: [
      {
        name: '实际排放',
        type: 'bar' as const,
        barMaxWidth: 36,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (params: { dataIndex: number }) => filteredCarbon[params.dataIndex]?.warning ? '#ff4d4f' : '#1890ff',
        },
        data: filteredCarbon.map((c) => c.emission),
      },
      {
        name: '配额',
        type: 'bar' as const,
        barMaxWidth: 36,
        itemStyle: { color: '#95de64', borderRadius: [4, 4, 0, 0] },
        data: filteredCarbon.map((c) => c.quota),
      },
    ],
  }), [filteredCarbon])

  const handleSearch = () => {
    message.success('查询完成')
  }

  const handleReset = () => {
    setAreaFilter(undefined)
    setTypeFilter(undefined)
    setDateRange(null)
    message.info('筛选条件已重置')
  }

  const handleExport = () => {
    if (exportOptions.length === 0) {
      message.warning('请至少选择一项导出内容')
      return
    }
    const now = dayjs()
    const filename = `月度电力运行分析报告_${now.format('YYYYMM')}`
    const allData: Record<string, unknown>[] = []

    if (exportOptions.includes('power')) {
      filteredSources.forEach((s) => {
        allData.push({
          '名称': s.name,
          '类型': TYPE_LABEL_MAP[s.type],
          '区域': s.area,
          '装机容量(MW)': s.capacity,
          '当前出力(MW)': s.currentOutput,
          '状态': s.status === 'online' ? '在线' : s.status === 'offline' ? '离线' : '检修',
        })
      })
    }
    if (exportOptions.includes('load')) {
      filteredLoad.forEach((l) => {
        allData.push({
          '区域': l.area,
          '工业负荷(MW)': l.industrial,
          '商业负荷(MW)': l.commercial,
          '居民负荷(MW)': l.residential,
          '总负荷(MW)': l.total,
          '时间': l.timestamp,
        })
      })
    }
    if (exportOptions.includes('fault')) {
      filteredFaults.forEach((f) => {
        allData.push({
          '故障编号': f.id,
          '区域': f.area,
          '位置': f.location,
          '类型': f.type,
          '等级': f.level === 'critical' ? '严重' : f.level === 'major' ? '重大' : '一般',
          '描述': f.description,
          '状态': f.status === 'pending' ? '待处理' : f.status === 'assigned' ? '已分配' : f.status === 'repairing' ? '修复中' : '已解决',
          '发生时间': f.createdAt,
        })
      })
    }
    if (exportOptions.includes('carbon')) {
      filteredCarbon.forEach((c) => {
        allData.push({
          '区域': c.area,
          '排放量(吨CO₂)': c.emission,
          '排放强度(吨CO₂/MWh)': c.intensity,
          '配额(吨CO₂)': c.quota,
          '已用(吨CO₂)': c.used,
          '预警': c.warning ? '是' : '否',
        })
      })
    }

    downloadExcel(allData, filename)
    message.success('报告导出成功')
  }

  const exportOptionsList = [
    { label: '电源数据', value: 'power' },
    { label: '负荷数据', value: 'load' },
    { label: '故障数据', value: 'fault' },
    { label: '碳排放数据', value: 'carbon' },
  ]

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 140 },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) => <Tag color={TYPE_COLOR_MAP[v]}>{TYPE_LABEL_MAP[v]}</Tag>,
    },
    { title: '区域', dataIndex: 'area', key: 'area', width: 80 },
    {
      title: '装机容量',
      dataIndex: 'capacity',
      key: 'capacity',
      width: 120,
      render: (v: number) => formatPower(v),
    },
    {
      title: '当前出力',
      dataIndex: 'currentOutput',
      key: 'currentOutput',
      width: 120,
      render: (v: number) => formatPower(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => {
        const map: Record<string, { color: string; label: string }> = {
          online: { color: 'green', label: '在线' },
          offline: { color: 'red', label: '离线' },
          maintenance: { color: 'orange', label: '检修' },
        }
        const info = map[v] || { color: 'default', label: v }
        return <Tag color={info.color}>{info.label}</Tag>
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>报表导出</Title>
      </div>

      <Card style={{ ...cardStyle, marginBottom: 16 }} bodyStyle={{ padding: '12px 24px' }}>
        <Space size="middle" wrap>
          <span style={{ fontSize: 14, color: '#595959' }}>区域:</span>
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
          <span style={{ fontSize: 14, color: '#595959' }}>日期范围:</span>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            style={{ width: 280 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
          <Button icon={<UndoOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={4}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="总发电量"
              value={stats.totalGen.toFixed(0)}
              suffix="MW"
              prefix={<ThunderboltOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="总负荷"
              value={stats.totalLd.toFixed(0)}
              suffix="MW"
              prefix={<DashboardOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="电力平衡"
              value={stats.balanceInfo.balance > 0 ? '+' : ''}
              suffix={formatPower(Math.abs(stats.balanceInfo.balance))}
              prefix={<ThunderboltOutlined style={{ color: stats.balanceInfo.status === 'surplus' ? '#52c41a' : stats.balanceInfo.status === 'deficit' ? '#ff4d4f' : '#1890ff' }} />}
              valueStyle={{ color: stats.balanceInfo.status === 'surplus' ? '#52c41a' : stats.balanceInfo.status === 'deficit' ? '#ff4d4f' : '#1890ff', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="新能源占比"
              value={stats.newEnergyRatio}
              suffix="%"
              prefix={<PieChartOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="故障数"
              value={stats.faultCount}
              suffix="个"
              prefix={<WarningOutlined style={{ color: stats.faultCount > 0 ? '#ff4d4f' : '#52c41a' }} />}
              valueStyle={{ color: stats.faultCount > 0 ? '#ff4d4f' : '#52c41a', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title="碳排放"
              value={stats.totalEmission.toFixed(0)}
              suffix="吨CO₂"
              prefix={<CloudOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontSize: 22 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={8}>
          <Card
            style={cardStyle}
            title={<span><PieChartOutlined style={{ marginRight: 8, color: '#722ed1' }} />各类电源发电量</span>}
          >
            <ReactECharts option={pieChartOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={cardStyle}
            title={<span><LineChartOutlined style={{ marginRight: 8, color: '#1890ff' }} />负荷曲线</span>}
          >
            <ReactECharts option={loadCurveOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={cardStyle}
            title={<span><BarChartOutlined style={{ marginRight: 8, color: '#52c41a' }} />碳排放趋势</span>}
          >
            <ReactECharts option={carbonBarOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ ...cardStyle, marginTop: 16 }}
        title={<span><ThunderboltOutlined style={{ marginRight: 8, color: '#1890ff' }} />电源数据预览</span>}
        extra={
          <Space>
            <Checkbox.Group
              options={exportOptionsList}
              value={exportOptions}
              onChange={(vals) => setExportOptions(vals as string[])}
            />
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
              导出月度电力运行分析报告
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredSources}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 620 }}
        />
      </Card>
    </div>
  )
}

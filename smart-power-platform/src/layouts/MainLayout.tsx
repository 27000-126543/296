import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Badge, List, Button, Select, Typography, theme } from 'antd'
import {
  DashboardOutlined,
  ThunderboltOutlined,
  SendOutlined,
  DollarOutlined,
  WarningOutlined,
  ApiOutlined,
  CloudOutlined,
  FileTextOutlined,
  BellOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ControlOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { USER_ROLES } from '../types'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const MENU_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: '调度大屏', minRole: 0 },
  { key: '/power', icon: <ThunderboltOutlined />, label: '电源监控', minRole: 1 },
  { key: '/dispatch', icon: <SendOutlined />, label: '调度指令', minRole: 3 },
  { key: '/load-price', icon: <DollarOutlined />, label: '负荷电价', minRole: 0 },
  { key: '/fault', icon: <WarningOutlined />, label: '故障管理', minRole: 1 },
  { key: '/grid', icon: <ApiOutlined />, label: '并网申请', minRole: 1 },
  { key: '/storage', icon: <ControlOutlined />, label: '储能电站', minRole: 1 },
  { key: '/carbon', icon: <CloudOutlined />, label: '碳排放监控', minRole: 1 },
  { key: '/report', icon: <FileTextOutlined />, label: '报表分析', minRole: 2 },
]

const DEFAULT_PATHS: Record<number, string> = {
  0: '/load-price',
  1: '/power',
  2: '/load-price',
  3: '/',
  4: '/',
}

const NOTIFICATION_TYPE_MAP: Record<string, { color: string; label: string }> = {
  dispatch: { color: '#1890ff', label: '调度' },
  fault: { color: '#ff4d4f', label: '故障' },
  carbon: { color: '#faad14', label: '碳排' },
  price: { color: '#52c41a', label: '电价' },
  grid: { color: '#722ed1', label: '并网' },
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, switchRole } = useAuthStore()
  const { notifications, markRead, markAllRead, unreadCount } = useNotificationStore()
  const { token } = theme.useToken()

  const userRole = user?.role ?? 0
  const filteredMenu = MENU_ITEMS.filter((item) => userRole >= item.minRole)

  useEffect(() => {
    const allowedPaths = filteredMenu.map((m) => m.key)
    if (!allowedPaths.includes(location.pathname)) {
      navigate(DEFAULT_PATHS[userRole] || '/')
    }
  }, [userRole])

  const notifDropdown = (
    <div style={{ width: 360, background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 480, overflow: 'auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>通知中心</Text>
        <Button type="link" size="small" onClick={markAllRead}>全部已读</Button>
      </div>
      <List
        dataSource={notifications.slice(0, 20)}
        renderItem={(item) => {
          const typeInfo = NOTIFICATION_TYPE_MAP[item.type] || { color: '#8c8c8c', label: '系统' }
          return (
            <List.Item
              style={{ padding: '8px 16px', background: item.read ? '#fff' : '#f6ffed', cursor: 'pointer' }}
              onClick={() => markRead(item.id)}
            >
              <List.Item.Meta
                title={
                  <span>
                    <Tag color={typeInfo.color} style={{ marginRight: 8, fontSize: 11 }}>{typeInfo.label}</Tag>
                    {item.title}
                  </span>
                }
                description={item.content}
              />
              <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{item.time.slice(11, 16)}</Text>
            </List.Item>
          )
        }}
      />
    </div>
  )

  const userDropdown = (
    <div style={{ width: 280, background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <Text strong>切换角色（演示）</Text>
      </div>
      <Select
        style={{ width: '100%' }}
        value={userRole}
        onChange={(v) => switchRole(v as 0 | 1 | 2 | 3 | 4)}
        options={Object.entries(USER_ROLES).map(([k, v]) => ({ value: Number(k), label: `${v.label} - ${v.description}` }))}
      />
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{
          background: 'linear-gradient(180deg, #001529 0%, #003a70 100%)',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <ThunderboltOutlined style={{ fontSize: 24, color: '#40a9ff' }} />
          {!collapsed && (
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginLeft: 10, whiteSpace: 'nowrap' }}>
              智慧电力调度平台
            </span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={filteredMenu.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
          }))}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 40, height: 40 }}
            />
            <Text style={{ marginLeft: 8, color: '#8c8c8c' }}>
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Dropdown dropdownRender={() => notifDropdown} trigger={['click']} placement="bottomRight">
              <Badge count={unreadCount()} size="small">
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
              </Badge>
            </Dropdown>
            <Dropdown dropdownRender={() => userDropdown} trigger={['click']} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                <Avatar icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
                <div>
                  <Text strong style={{ fontSize: 13 }}>{user?.username}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>{USER_ROLES[userRole]?.label}</Text>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 0,
            minHeight: 280,
            background: '#f0f2f5',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

function Tag({ color, children, style }: { color: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0 7px',
        fontSize: 12,
        lineHeight: '20px',
        borderRadius: 4,
        background: color,
        color: '#fff',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

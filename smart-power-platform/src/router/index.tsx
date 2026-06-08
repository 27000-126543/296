import { createBrowserRouter } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import Dashboard from '../pages/Dashboard'
import PowerMonitor from '../pages/PowerMonitor'
import DispatchManage from '../pages/DispatchManage'
import LoadPrice from '../pages/LoadPrice'
import FaultManage from '../pages/FaultManage'
import GridApplication from '../pages/GridApplication'
import EnergyStorage from '../pages/EnergyStorage'
import CarbonMonitor from '../pages/CarbonMonitor'
import ReportExport from '../pages/ReportExport'

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'power', element: <PowerMonitor /> },
      { path: 'dispatch', element: <DispatchManage /> },
      { path: 'load-price', element: <LoadPrice /> },
      { path: 'fault', element: <FaultManage /> },
      { path: 'grid', element: <GridApplication /> },
      { path: 'storage', element: <EnergyStorage /> },
      { path: 'carbon', element: <CarbonMonitor /> },
      { path: 'report', element: <ReportExport /> },
    ],
  },
])

export default router

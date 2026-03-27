import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard/index'
import ProcessList from './pages/Processes/ProcessList'
import ProcessForm from './pages/Processes/ProcessForm'
import ProcessDetail from './pages/Processes/ProcessDetail'
import ApplicationList from './pages/Applications/ApplicationList'
import ApplicationDetail from './pages/Applications/ApplicationDetail'
import ApplicationForm from './pages/Applications/ApplicationForm'
import BiaPage from './pages/Bia/BiaPage'
import RtoRpoPage from './pages/RtoRpo/RtoRpoPage'
import BusinessContextPage from './pages/BusinessContext/BusinessContextPage'
import ExportPage from './pages/Export/ExportPage'
import Ketenarchitectuur from './pages/Ketenarchitectuur'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/processes" element={<ProcessList />} />
          <Route path="/processes/new" element={<ProcessForm />} />
          <Route path="/processes/:id" element={<ProcessDetail />} />
          <Route path="/processes/:id/edit" element={<ProcessForm />} />
          <Route path="/applications" element={<ApplicationList />} />
          <Route path="/applications/new" element={<ApplicationForm />} />
          <Route path="/applications/:id" element={<ApplicationDetail />} />
          <Route path="/applications/:id/edit" element={<ApplicationForm />} />
          <Route path="/bia" element={<BiaPage />} />
          <Route path="/bia/:processId" element={<BiaPage />} />
          <Route path="/rto-rpo" element={<RtoRpoPage />} />
          <Route path="/rto-rpo/:processId" element={<RtoRpoPage />} />
          <Route path="/business-context" element={<BusinessContextPage />} />
          <Route path="/business-context/:processId" element={<BusinessContextPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/ketenarchitectuur" element={<Ketenarchitectuur />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import './index.css'

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Workbench = lazy(() => import('./pages/Workbench').then((m) => ({ default: m.Workbench })))
const DataImport = lazy(() => import('./pages/DataImport').then((m) => ({ default: m.DataImport })))
const Standardize = lazy(() => import('./pages/Standardize').then((m) => ({ default: m.Standardize })))
const Personnel = lazy(() => import('./pages/Personnel').then((m) => ({ default: m.Personnel })))
const PolicyStandards = lazy(() => import('./pages/PolicyStandards').then((m) => ({ default: m.PolicyStandards })))
const Rules = lazy(() => import('./pages/Rules').then((m) => ({ default: m.Rules })))
const Issues = lazy(() => import('./pages/Issues').then((m) => ({ default: m.Issues })))
const Remediation = lazy(() => import('./pages/Remediation').then((m) => ({ default: m.Remediation })))
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">正在加载业务模块…</div>}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workbench" element={<Workbench />} />
            <Route path="/import" element={<DataImport />} />
            <Route path="/standardize" element={<Standardize />} />
            <Route path="/personnel" element={<Personnel />} />
            <Route path="/policy-standards" element={<PolicyStandards />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/issues" element={<Issues />} />
            <Route path="/remediation" element={<Remediation />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </Suspense>
  </React.StrictMode>,
)

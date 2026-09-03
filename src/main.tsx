import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Workbench } from './pages/Workbench'
import { DataImport } from './pages/DataImport'
import { Standardize } from './pages/Standardize'
import { Personnel } from './pages/Personnel'
import { Rules } from './pages/Rules'
import { Issues } from './pages/Issues'
import { Remediation } from './pages/Remediation'
import { Reports } from './pages/Reports'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workbench" element={<Workbench />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/standardize" element={<Standardize />} />
          <Route path="/personnel" element={<Personnel />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/issues" element={<Issues />} />
          <Route path="/remediation" element={<Remediation />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>,
)

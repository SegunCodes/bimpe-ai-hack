import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { CustomersPage } from './pages/CustomersPage'
import { JoinPage } from './pages/JoinPage'
import { LiveCallsPage } from './pages/LiveCallsPage'
import { OrdersPage } from './pages/OrdersPage'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/join" element={<JoinPage />} />
          <Route element={<Layout />}>
            <Route index element={<OrdersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/calls" element={<LiveCallsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}

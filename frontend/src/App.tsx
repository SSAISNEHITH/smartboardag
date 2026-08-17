import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import LandingPage from './views/LandingPage';
import RegistrationFlow from './views/RegistrationFlow';
import LoginPage from './views/LoginPage';
import Dashboard from './views/Dashboard';
import Smartboard from './views/Smartboard';
import ViewOnlyBoard from './views/ViewOnlyBoard';

function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegistrationFlow />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/board/:id" element={<Smartboard />} />
          <Route path="/board/:id/view" element={<ViewOnlyBoard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;

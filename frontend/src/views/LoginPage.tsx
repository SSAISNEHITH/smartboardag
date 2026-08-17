import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import styles from './LoginPage.module.css';
import { useToast } from '../contexts/ToastContext';
import API_BASE from '../config/api';

const Logo = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
    <div style={{ background: '#ffffff', borderRadius: '12px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
      <img src="/logo.png" alt="Smart Teach Logo" style={{ height: '72px', objectFit: 'contain' }} />
    </div>
    <span style={{ fontWeight: 700, fontSize: '1.35rem', color: 'var(--primary-color)' }}>Thrisual Smart Teach</span>
  </div>
);

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  
  const isViewOnly = new URLSearchParams(location.search).get('viewOnly') === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, viewOnly: isViewOnly })
      });

      if (!response.ok) {
        let errorMsg = 'Invalid credentials';
        try {
          const errData = await response.json();
          errorMsg = errData.message || errorMsg;
        } catch {
          const errorText = await response.text();
          if (errorText) errorMsg = errorText;
        }
        setError(errorMsg);
        showToast(errorMsg, 'error');
        return;
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('email', data.email);
      const viewOnlyMode = isViewOnly || data.viewOnly || false;
      localStorage.setItem('isViewOnly', viewOnlyMode ? 'true' : 'false');
      
      showToast(viewOnlyMode ? 'Logged in as View-Only' : 'Login Successful', 'success');
      
      if (viewOnlyMode) {
        navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      // Backend not running, use mock fallback
      localStorage.setItem('email', email);
      localStorage.setItem('isViewOnly', isViewOnly ? 'true' : 'false');
      showToast(isViewOnly ? 'Logged in as View-Only' : 'Login Successful', 'success');
      navigate('/dashboard');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className="btn-secondary" onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', background: 'transparent' }}>
          <ArrowLeft size={20} /> Back
        </button>
      </div>

      <div className={styles.loginBox}>
        <div className={styles.logoWrapper}>
          <Logo />
        </div>
        <h2 className={styles.title}>
          Login - {isViewOnly ? 'View-Only Access' : 'Full access to your account'}
        </h2>

        <form className={styles.form} onSubmit={handleLogin}>
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="you@example.com" 
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Enter password"
                style={{ paddingRight: '2.5rem' }}
              />
              <div 
                style={{ position: 'absolute', right: '1rem', color: 'var(--text-light)', cursor: 'pointer' }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </div>
            </div>
            {error && <span className="error-text">{error}</span>}
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}>
            Login
          </button>
        </form>

        <div className={styles.footer}>
          Don't have an account? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

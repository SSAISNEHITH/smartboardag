import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import styles from './LandingPage.module.css';

const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
    <div style={{ background: '#ffffff', borderRadius: '8px', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src="/logo.png" alt="Smart Teach Logo" style={{ height: '40px', objectFit: 'contain' }} />
    </div>
    <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary-color)' }}>Thrisual Smart Teach</span>
  </div>
);

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <Logo />
        </div>
        <div className={styles.navButtons}>
          <button className="btn-secondary" onClick={() => navigate('/login')}>Login</button>
          <button className="btn-primary" onClick={() => navigate('/register')}>Get Started</button>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1>Your Digital<br/><span>Smart Teaching</span><br/>Platform</h1>
            <p>Create, organize, and teach with an interactive smartboard. 1TB cloud storage, unlimited folders, and powerful topic boards.</p>
            <div className={styles.heroActions}>
              <button className="btn-primary" onClick={() => navigate('/register')}>Create Account</button>
              <button className="btn-secondary" onClick={() => navigate('/login')}>Login</button>
              <button className="btn-secondary" onClick={() => navigate('/login?viewOnly=true')}>View Only Login</button>
            </div>
          </div>
          <div className={styles.heroImage}>
            <img src="/hero.png" alt="Interactive Smartboard" style={{ maxWidth: '100%', borderRadius: '1rem', boxShadow: 'var(--shadow-xl)' }} />
          </div>
        </section>

        <section className={styles.features}>
          <h2>Everything You Need to Teach Smarter</h2>
          <div className={styles.grid}>
            <div className={styles.card}>
              <h3>📁 1TB Cloud Storage</h3>
              <p>Organize your content in unlimited folders with topic-based smartboards.</p>
            </div>
            <div className={styles.card}>
              <h3>🖊️ Interactive Smartboard</h3>
              <p>Touch & keyboard input with 356-line scrollable boards and line controls.</p>
            </div>
            <div className={styles.card}>
              <h3>🔒 Dual Password Security</h3>
              <p>Full access login + view-only mode with separate passwords for security.</p>
            </div>
            <div className={styles.card}>
              <h3>👥 Real-Time Collaboration</h3>
              <p>Share your Smartboard with up to 249 students via a QR code or link. Students can view only—no writing or editing.</p>
            </div>
          </div>
        </section>

        <section className={styles.pricing}>
          <h2>Choose Your Plan</h2>
          <p style={{ color: 'var(--text-light)', marginTop: '-1.5rem', marginBottom: '2.5rem', fontSize: '1.05rem' }}>
            Start free, upgrade when you're ready.
          </p>
          <div className={styles.pricingGrid}>

            {/* ── FREE PLAN ── */}
            <div className={styles.priceCard} style={{ border: '2px solid #10B981', position: 'relative', overflow: 'hidden' }}>
              {/* FREE badge ribbon */}
              <div style={{
                position: 'absolute', top: 16, right: -28,
                background: '#10B981', color: '#fff',
                fontSize: '0.7rem', fontWeight: 800,
                padding: '0.2rem 2.5rem',
                transform: 'rotate(45deg)',
                letterSpacing: '0.08em'
              }}>FREE</div>

              <h3 style={{ color: '#10B981' }}>Free Forever</h3>
              <div className={styles.price} style={{ color: '#10B981' }}>
                ₹0
                <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-light)', marginLeft: '0.35rem' }}>/ forever</span>
              </div>

              <ul>
                <li><Check size={16} color="#10B981"/> 1 Device Login</li>
                <li><Check size={16} color="#10B981"/> 100MB Cloud Storage</li>
                <li><Check size={16} color="#10B981"/> Basic Smartboard</li>
                <li><Check size={16} color="#10B981"/> Dual Password Security</li>
                <li><Check size={16} color="#10B981"/> View-Only Sharing</li>
                <li style={{ color: '#94A3B8', fontSize: '0.9rem' }}>
                  <span style={{ width: 16, height: 16, display: 'inline-block' }}>✕</span>
                  &nbsp;No 1TB Storage
                </li>
                <li style={{ color: '#94A3B8', fontSize: '0.9rem' }}>
                  <span style={{ width: 16, height: 16, display: 'inline-block' }}>✕</span>
                  &nbsp;No Multi-Device Login
                </li>
              </ul>

              <button
                className="btn-secondary"
                style={{ border: '2px solid #10B981', color: '#10B981', fontWeight: 700 }}
                onClick={() => navigate('/register')}
              >
                Start for Free
              </button>
            </div>

            {/* ── 15 MONTHS ── */}
            <div className={styles.priceCard}>
              <div style={{
                display: 'inline-block', background: '#EFF6FF', color: '#2563EB',
                fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.65rem',
                borderRadius: '1rem', marginBottom: '0.6rem', letterSpacing: '0.06em'
              }}>POPULAR</div>
              <h3>15 Months</h3>
              <div className={styles.price}>
                ₹100
                <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-light)', marginLeft: '0.35rem' }}>/ 15 mo</span>
              </div>
              <ul>
                <li><Check size={16} color="var(--success)"/> 2 Devices Login</li>
                <li><Check size={16} color="var(--success)"/> 1TB Cloud Storage</li>
                <li><Check size={16} color="var(--success)"/> Unlimited Folders</li>
                <li><Check size={16} color="var(--success)"/> Full Smartboard</li>
                <li><Check size={16} color="var(--success)"/> Dual Password Security</li>
                <li><Check size={16} color="var(--success)"/> View-Only Sharing + QR</li>
              </ul>
              <button className="btn-primary" onClick={() => navigate('/register')}>Get Started</button>
            </div>

            {/* ── 48 MONTHS ── */}
            <div className={styles.priceCard}>
              <div style={{
                display: 'inline-block', background: '#F5F3FF', color: '#7C3AED',
                fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.65rem',
                borderRadius: '1rem', marginBottom: '0.6rem', letterSpacing: '0.06em'
              }}>VALUE</div>
              <h3>48 Months</h3>
              <div className={styles.price}>
                ₹149
                <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-light)', marginLeft: '0.35rem' }}>/ 48 mo</span>
              </div>
              <ul>
                <li><Check size={16} color="var(--success)"/> 4 Devices Login</li>
                <li><Check size={16} color="var(--success)"/> 1TB Cloud Storage</li>
                <li><Check size={16} color="var(--success)"/> Unlimited Folders</li>
                <li><Check size={16} color="var(--success)"/> Full Smartboard</li>
                <li><Check size={16} color="var(--success)"/> Dual Password Security</li>
                <li><Check size={16} color="var(--success)"/> View-Only Sharing + QR</li>
              </ul>
              <button className="btn-primary" onClick={() => navigate('/register')}>Get Started</button>
            </div>

            {/* ── LIFETIME ── */}
            <div className={styles.priceCard} style={{ border: '2px solid var(--primary-color)' }}>
              <div style={{
                display: 'inline-block', background: '#FEE2E2', color: '#DC2626',
                fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.65rem',
                borderRadius: '1rem', marginBottom: '0.6rem', letterSpacing: '0.06em'
              }}>BEST DEAL</div>
              <h3>Lifetime</h3>
              <div className={styles.price}>
                ₹200
                <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-light)', marginLeft: '0.35rem' }}>/ forever</span>
              </div>
              <ul>
                <li><Check size={16} color="var(--success)"/> 6 Devices Login</li>
                <li><Check size={16} color="var(--success)"/> 1TB Cloud Storage</li>
                <li><Check size={16} color="var(--success)"/> Unlimited Folders</li>
                <li><Check size={16} color="var(--success)"/> Full Smartboard</li>
                <li><Check size={16} color="var(--success)"/> Dual Password Security</li>
                <li><Check size={16} color="var(--success)"/> View-Only Sharing + QR</li>
              </ul>
              <button className="btn-primary" onClick={() => navigate('/register')}>Get Started</button>
            </div>

          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Logo />
        </div>
        <p>© 2026 Thrisual Smart Teach. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;

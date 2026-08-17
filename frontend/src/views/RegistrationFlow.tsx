import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle, Eye, EyeOff, Home, Sparkles } from 'lucide-react';
import styles from './RegistrationFlow.module.css';
import { useToast } from '../contexts/ToastContext';
import API_BASE from '../config/api';

const steps = [
  { id: 1, title: 'Account' },
  { id: 2, title: 'Passwords' },
  { id: 3, title: 'Plan' },
  { id: 4, title: 'Profile' }
];

const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
    <div style={{ background: '#ffffff', borderRadius: '8px', padding: '3px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src="/logo.png" alt="Smart Teach Logo" style={{ height: '32px', objectFit: 'contain' }} />
    </div>
    <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--white)' }}>Thrisual Smart Teach</span>
  </div>
);

const RegistrationFlow: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    mobile: '',
    loginPassword: '',
    viewOnlyPassword: '',
    plan: 'free',
    fullName: '',
    qualification: '',
    contactInfo: ''
  });

  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);

  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileOtp, setMobileOtp] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);

  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showViewPwd, setShowViewPwd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendOTP = async (type: 'email' | 'mobile') => {
    const target = type === 'email' ? formData.email.trim() : formData.mobile.trim();
    if (!target) {
      showToast(`Please enter your ${type} first`, 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, target })
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Demo OTP sent for ${type}`, 'info');
      } else {
        showToast(`Demo OTP generated: 123456`, 'info');
      }
    } catch {
      showToast(`Demo OTP generated: 123456`, 'info');
    }

    if (type === 'email') {
      setEmailOtpSent(true);
      setEmailOtp('123456'); // Pre-fill demo OTP for convenience
    } else {
      setMobileOtpSent(true);
      setMobileOtp('123456'); // Pre-fill demo OTP for convenience
    }
  };

  const handleVerifyOTP = async (type: 'email' | 'mobile') => {
    const target = type === 'email' ? formData.email.trim() : formData.mobile.trim();
    const otp = type === 'email' ? emailOtp.trim() : mobileOtp.trim();

    if (!otp) {
      showToast('Please enter the 6-digit OTP', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, target, otp })
      });

      if (res.ok) {
        if (type === 'email') setEmailVerified(true);
        if (type === 'mobile') setMobileVerified(true);
        showToast(`${type === 'email' ? 'Email' : 'Mobile number'} verified successfully!`, 'success');
      } else {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.message || (otp === '123456' ? null : 'Invalid OTP. Please use demo OTP: 123456');
        
        if (otp === '123456') {
          if (type === 'email') setEmailVerified(true);
          if (type === 'mobile') setMobileVerified(true);
          showToast(`${type === 'email' ? 'Email' : 'Mobile number'} verified successfully!`, 'success');
        } else {
          showToast(errMsg || 'Invalid OTP. Please use demo OTP: 123456', 'error');
        }
      }
    } catch {
      if (otp === '123456' || otp === '000000') {
        if (type === 'email') setEmailVerified(true);
        if (type === 'mobile') setMobileVerified(true);
        showToast(`${type === 'email' ? 'Email' : 'Mobile number'} verified successfully!`, 'success');
      } else {
        showToast('Invalid OTP. Use Demo OTP: 123456', 'error');
      }
    }
  };

  const handleNextStep1 = () => {
    if (!emailVerified || !mobileVerified) {
      showToast("Please verify both email and mobile using Demo OTP", "error");
      return;
    }
    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    if (!formData.loginPassword || !formData.viewOnlyPassword) {
      showToast("Please enter both passwords", "error");
      return;
    }
    if (formData.loginPassword === formData.viewOnlyPassword) {
      showToast("Passwords must be different (Login vs View-Only)", "error");
      return;
    }
    setCurrentStep(3);
  };

  const handleComplete = async () => {
    if (!formData.fullName.trim() || !formData.qualification) {
      showToast("Please enter your full name and qualification", "error");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const resData = await response.json().catch(() => null);
      
      if (!response.ok) {
        const errorMsg = resData?.message || "Registration failed. Please check your details.";
        showToast(errorMsg, "error");
        setIsSubmitting(false);
        return;
      }
      
      showToast("Registration Successful! Please login with your credentials.", "success");
      navigate('/login');
    } catch (e: any) {
      showToast("Registration failed: Could not connect to server", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.leftSidebar}>
        <Logo />
        <h2>Join Smart Teach</h2>
        <p>Create your account in 4 simple steps</p>

        <div className={styles.progressContainer}>
          {steps.map(step => (
            <div key={step.id} className={styles.progressStep}>
              <div className={`${styles.dot} ${currentStep > step.id ? styles.completed : currentStep === step.id ? styles.active : ''}`}>
                {currentStep > step.id && <Check size={14} color="var(--white)" />}
              </div>
              <span className={`${styles.stepText} ${currentStep >= step.id ? styles.active : ''}`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.rightContent}>
        <div className={styles.topBar}>
          <button className="btn-secondary" onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Home size={16} /> Home
          </button>
        </div>

        <div className={styles.formContainer}>
          {currentStep === 1 && (
            <div>
              <h3>Create Your Account</h3>
              <p className={styles.description}>Verify your email address and mobile number with demo OTP.</p>
              
              {/* Email Verification Section */}
              <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                <label>Email Address</label>
                <div className={styles.otpGroup}>
                  <input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => {
                      setFormData({...formData, email: e.target.value});
                      setEmailVerified(false);
                      setEmailOtpSent(false);
                    }} 
                    placeholder="you@example.com" 
                    disabled={emailVerified} 
                  />
                  {emailVerified ? (
                    <div className={styles.verifiedChip}>
                      <CheckCircle size={16} /> Verified
                    </div>
                  ) : (
                    <button 
                      type="button"
                      className="btn-primary" 
                      onClick={() => handleSendOTP('email')} 
                      disabled={!formData.email.trim()}
                    >
                      {emailOtpSent ? 'Resend OTP' : 'Send OTP'}
                    </button>
                  )}
                </div>

                {emailOtpSent && !emailVerified && (
                  <div className={styles.otpVerificationBox}>
                    <div className={styles.otpPromptRow}>
                      <span style={{ fontWeight: 600 }}>Enter Email OTP</span>
                      <button 
                        type="button"
                        className={styles.demoOtpBadge}
                        onClick={() => setEmailOtp('123456')}
                        title="Click to fill Demo OTP"
                      >
                        <Sparkles size={12} /> Demo OTP: <strong>123456</strong>
                      </button>
                    </div>
                    <div className={styles.otpInputs}>
                      <input 
                        type="text" 
                        maxLength={6}
                        value={emailOtp} 
                        onChange={e => setEmailOtp(e.target.value)} 
                        placeholder="123456" 
                        className={styles.otpInputField}
                      />
                      <button 
                        type="button" 
                        className="btn-primary" 
                        style={{ height: '42px', padding: '0 1.25rem' }}
                        onClick={() => handleVerifyOTP('email')}
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Verification Section */}
              <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                <label>Mobile Number</label>
                <div className={styles.otpGroup}>
                  <input 
                    type="tel" 
                    value={formData.mobile} 
                    onChange={e => {
                      setFormData({...formData, mobile: e.target.value});
                      setMobileVerified(false);
                      setMobileOtpSent(false);
                    }} 
                    placeholder="+91 98765 43210" 
                    disabled={mobileVerified} 
                  />
                  {mobileVerified ? (
                    <div className={styles.verifiedChip}>
                      <CheckCircle size={16} /> Verified
                    </div>
                  ) : (
                    <button 
                      type="button"
                      className="btn-primary" 
                      onClick={() => handleSendOTP('mobile')} 
                      disabled={!formData.mobile.trim()}
                    >
                      {mobileOtpSent ? 'Resend OTP' : 'Send OTP'}
                    </button>
                  )}
                </div>

                {mobileOtpSent && !mobileVerified && (
                  <div className={styles.otpVerificationBox}>
                    <div className={styles.otpPromptRow}>
                      <span style={{ fontWeight: 600 }}>Enter Mobile OTP</span>
                      <button 
                        type="button"
                        className={styles.demoOtpBadge}
                        onClick={() => setMobileOtp('123456')}
                        title="Click to fill Demo OTP"
                      >
                        <Sparkles size={12} /> Demo OTP: <strong>123456</strong>
                      </button>
                    </div>
                    <div className={styles.otpInputs}>
                      <input 
                        type="text" 
                        maxLength={6}
                        value={mobileOtp} 
                        onChange={e => setMobileOtp(e.target.value)} 
                        placeholder="123456" 
                        className={styles.otpInputField}
                      />
                      <button 
                        type="button" 
                        className="btn-primary" 
                        style={{ height: '42px', padding: '0 1.25rem' }}
                        onClick={() => handleVerifyOTP('mobile')}
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={handleNextStep1} disabled={!emailVerified || !mobileVerified}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h3>Set Up Passwords</h3>
              <p className={styles.description}>Set two separate passwords — one for full access, one for view-only mode.</p>
              
              <div className="input-group">
                <label>Login Password (Full Access)</label>
                <div className={styles.passwordInputWrapper}>
                  <input type={showLoginPwd ? 'text' : 'password'} value={formData.loginPassword} onChange={e => setFormData({...formData, loginPassword: e.target.value})} placeholder="Enter full access password" />
                  {showLoginPwd ? <EyeOff className={styles.eyeIcon} onClick={() => setShowLoginPwd(false)} size={18} /> : <Eye className={styles.eyeIcon} onClick={() => setShowLoginPwd(true)} size={18} />}
                </div>
              </div>

              <div className="input-group">
                <label>View-Only Password</label>
                <div className={styles.passwordInputWrapper}>
                  <input type={showViewPwd ? 'text' : 'password'} value={formData.viewOnlyPassword} onChange={e => setFormData({...formData, viewOnlyPassword: e.target.value})} placeholder="Enter view-only password" />
                  {showViewPwd ? <EyeOff className={styles.eyeIcon} onClick={() => setShowViewPwd(false)} size={18} /> : <Eye className={styles.eyeIcon} onClick={() => setShowViewPwd(true)} size={18} />}
                </div>
                <span className="error-text" style={{ fontSize: '0.8rem', color: '#64748b' }}>Allows visitors or students to view boards without editing permissions. Must differ from Login Password.</span>
              </div>

              <div className={styles.actions}>
                <button className="btn-secondary" onClick={() => setCurrentStep(1)}>Back</button>
                <button className="btn-primary" onClick={handleNextStep2}>Continue</button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h3>Choose Your Plan</h3>
              <p className={styles.description}>Select the plan that works best for you.</p>
              
              <div className={styles.planGrid}>
                {[
                  { id: 'free',  title: 'Free',              price: '₹0',   period: 'Forever',    desc: '1 Device Login • 100MB Storage • Basic Smartboard',  badge: 'FREE',  badgeColor: '#10B981' },
                  { id: '15mo', title: 'Starter',           price: '₹100', period: '15 Months',  desc: '2 Devices Login • 1TB Storage • Full Smartboard',     badge: 'POPULAR', badgeColor: '#2563EB' },
                  { id: '48mo', title: 'Professional',      price: '₹149', period: '48 Months',  desc: '4 Devices Login • 1TB Storage • Full Smartboard',     badge: 'VALUE',  badgeColor: '#7C3AED' },
                  { id: 'life', title: 'Lifetime',          price: '₹200', period: 'Lifetime',   desc: '6 Devices Login • 1TB Storage • Full Smartboard',     badge: 'BEST',   badgeColor: '#DC2626' }
                ].map(plan => (
                  <div
                    key={plan.id}
                    className={`${styles.planCard} ${formData.plan === plan.id ? styles.selected : ''}`}
                    onClick={() => setFormData({...formData, plan: plan.id})}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <h4 style={{ fontSize: '1.05rem', margin: 0 }}>{plan.title}</h4>
                        <span style={{
                          background: plan.badgeColor, color: '#fff',
                          fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.45rem',
                          borderRadius: '0.75rem', letterSpacing: '0.06em'
                        }}>{plan.badge}</span>
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)', lineHeight: 1.1, marginBottom: '0.2rem' }}>
                        {plan.price}
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-light)', marginLeft: '0.35rem' }}>/ {plan.period}</span>
                      </div>
                      <p style={{ color: 'var(--text-light)', fontSize: '0.82rem', margin: 0 }}>{plan.desc}</p>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${formData.plan === plan.id ? plan.badgeColor : 'var(--primary-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {formData.plan === plan.id && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: plan.badgeColor }} />}
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.actions}>
                <button className="btn-secondary" onClick={() => setCurrentStep(2)}>Back</button>
                <button className="btn-primary" onClick={() => setCurrentStep(4)}>Continue</button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h3>Setup Profile</h3>
              <p className={styles.description}>Tell us a bit about yourself.</p>
              
              <div className="input-group">
                <label>Full Name</label>
                <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="Jane Doe" />
              </div>

              <div className="input-group">
                <label>Qualification</label>
                <select value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})}>
                  <option value="">Select Qualification</option>
                  <option value="bachelors">Bachelor's Degree</option>
                  <option value="masters">Master's Degree</option>
                  <option value="phd">Ph.D.</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="input-group">
                <label>Additional Contact Info</label>
                <input type="text" value={formData.contactInfo} onChange={e => setFormData({...formData, contactInfo: e.target.value})} placeholder="Optional alternate email or phone" />
              </div>

              <div className={styles.actions}>
                <button className="btn-secondary" onClick={() => setCurrentStep(3)} disabled={isSubmitting}>Back</button>
                <button className="btn-primary" onClick={handleComplete} disabled={isSubmitting}>
                  {isSubmitting ? 'Registering...' : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationFlow;


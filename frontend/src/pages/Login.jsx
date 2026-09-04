import React, { useState } from 'react';
import { User, Lock, ArrowRight } from 'lucide-react';
import { loginUser } from '../api';
import './Login.css';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const data = await loginUser(username, password);
      // Save token to localStorage
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      // Notify parent component
      onLogin();
    } catch (err) {
      setError("Invalid username or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2 className="text-gradient" style={{fontSize: '2rem', marginBottom: '1rem'}}>ERP Trading</h2>
          <h1>Welcome Back</h1>
          <p>Enter your credentials to access the system</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email or Username</label>
            <div className="login-input-wrapper">
              <User size={18} />
              <input 
                type="text" 
                className="login-input" 
                placeholder="admin@erp.com" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="login-input-wrapper">
              <Lock size={18} />
              <input 
                type="password" 
                className="login-input" 
                placeholder="••••••••" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            <span style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
              {isLoading ? 'Authenticating...' : 'Sign In'} <ArrowRight size={18} />
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

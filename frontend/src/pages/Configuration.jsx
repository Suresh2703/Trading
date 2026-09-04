import React, { useState } from 'react';
import { Building, Globe, Shield, Bell, Key, Save } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import './Configuration.css';

export default function Configuration() {
  const [activeTab, setActiveTab] = useState('general');
  const { currency, updateCurrency } = useCurrency();

  return (
    <div className="config-container">
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>System Configuration</h1>
          <p>Manage your ERP settings, defaults, and integrations.</p>
        </div>
        <div className="dashboard-controls">
          <button className="btn-primary" style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      <div className="config-layout">
        {/* Settings Sidebar */}
        <div className="config-sidebar glass-panel">
          <div 
            className={`config-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Building size={18} /> Company Details
          </div>
          <div 
            className={`config-tab ${activeTab === 'regional' ? 'active' : ''}`}
            onClick={() => setActiveTab('regional')}
          >
            <Globe size={18} /> Regional & Currency
          </div>
          <div 
            className={`config-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Shield size={18} /> Security
          </div>
          <div 
            className={`config-tab ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={18} /> Notifications
          </div>
          <div 
            className={`config-tab ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            <Key size={18} /> API Integrations
          </div>
        </div>

        {/* Settings Content */}
        <div className="config-content glass-panel">
          {activeTab === 'general' && (
            <div className="animate-fade-in">
              <h2 className="config-section-title">Company Details</h2>
              <div className="form-group">
                <label>Company Name</label>
                <input type="text" className="config-input" defaultValue="Acme Trading Co." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Registration Number</label>
                  <input type="text" className="config-input" defaultValue="REG-9923-11" />
                </div>
                <div className="form-group">
                  <label>Tax ID / GSTIN</label>
                  <input type="text" className="config-input" defaultValue="GST-00998877" />
                </div>
              </div>
              <div className="form-group">
                <label>Billing Address</label>
                <textarea className="config-input" rows="3" defaultValue="123 Trading Lane, Financial District, NY 10001"></textarea>
              </div>
            </div>
          )}

          {activeTab === 'regional' && (
            <div className="animate-fade-in">
              <h2 className="config-section-title">Regional & Currency</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Base Currency</label>
                  <select 
                    className="config-input" 
                    value={currency} 
                    onChange={(e) => updateCurrency(e.target.value)}
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="INR">INR - Indian Rupee</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Timezone</label>
                  <select className="config-input" defaultValue="EST">
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="EST">EST (Eastern Standard Time)</option>
                    <option value="IST">IST (Indian Standard Time)</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date Format</label>
                  <select className="config-input" defaultValue="YYYY-MM-DD">
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Financial Year Start</label>
                  <select className="config-input" defaultValue="April">
                    <option value="January">January 1st</option>
                    <option value="April">April 1st</option>
                    <option value="July">July 1st</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'security' || activeTab === 'notifications' || activeTab === 'api') && (
             <div className="animate-fade-in">
                <h2 className="config-section-title" style={{textTransform: 'capitalize'}}>{activeTab} Settings</h2>
                <p style={{color: 'var(--text-muted)'}}>Configuration options for this module are currently being built.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

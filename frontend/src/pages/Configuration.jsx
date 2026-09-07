import React, { useState } from 'react';
import { Building, Globe, Shield, Bell, Key, Save } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { usePermissions } from '../context/PermissionContext';
import SettingsSection from './config/SettingsSection';
import ApiKeysPanel from './config/ApiKeysPanel';
import NotificationPreview from './config/NotificationPreview';
import './Configuration.css';

export default function Configuration() {
  const [activeTab, setActiveTab] = useState('general');
  const { currency, updateCurrency } = useCurrency();
  // Writing settings is administrator-only on the server; reflecting that here
  // keeps the screen honest rather than offering a save that will be refused.
  const { canEdit } = usePermissions();
  const mayEdit = canEdit('SETTINGS');

  return (
    <div className="config-container">
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>System Configuration</h1>
          <p>Manage your ERP settings, defaults, and integrations.</p>
        </div>
        {/* Each section saves itself, so there is no page-wide button that
            would have to guess which tab it applied to. */}
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

          {activeTab === 'security' && (
            <SettingsSection
              section="security"
              title="Security"
              blurb="Password rules, lockout and session length. Each applies the
                     next time it is relevant — a tightened password rule at the
                     next password change, a session length at the next sign-in."
              canEdit={mayEdit} />
          )}

          {activeTab === 'notifications' && (
            <SettingsSection
              section="notifications"
              title="Notifications"
              blurb="Which alerts the bell raises, and at what thresholds. Alerts
                     are worked out from the live books each time they are asked
                     for, so one clears itself once the cause is dealt with."
              canEdit={mayEdit}>
              <NotificationPreview />
            </SettingsSection>
          )}

          {activeTab === 'api' && (
            <div className="animate-fade-in">
              <SettingsSection
                section="api"
                title="API integrations"
                blurb="Access for other systems calling this API."
                canEdit={mayEdit} />
              <ApiKeysPanel canEdit={mayEdit} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

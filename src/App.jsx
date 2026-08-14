import React, { useState, useEffect, useCallback } from 'react';
import './index.css';

// API Base URL (Vite proxy maps this to 5001 locally, cPanel serves it directly)
const API_BASE = '/api';

// ── The 8 Official Units from Field Requirement ──
const ORGANIZATIONAL_UNITS = [
  'Procurement [Marketing Department]',
  'Warehousing [Marketing Department]',
  'Donor cell along with Concurrent audit on donation of all allied trusts and Srivani Trust Receipts [Tirumali]',
  'Kalyanakatta',
  'Annaprasadam Trust and Canteens TML & TPT',
  'Sri Padmavathi Ammavari Temple, Tiruchanoor (Sri PAT)',
  'Reception, TML including Marriage halls',
  'Auctions'
];

// Short Display Titles for Pie Chart Legend to prevent long text overflow
const SHORT_UNIT_NAMES = [
  'Procurement [Marketing]',
  'Warehousing [Marketing]',
  'Donor Cell & Srivani',
  'Kalyanakatta Unit',
  'Annaprasadam Trust',
  'Sri PAT Temple',
  'Reception & Halls',
  'Auctions Wing'
];

// Color palette for the 8 official units in Pie Chart & UI
const UNIT_COLORS = [
  '#2563EB', // Procurement - Royal Blue
  '#059669', // Warehousing - Emerald Green
  '#D97706', // Donor cell - Amber Gold
  '#7C3AED', // Kalyanakatta - Deep Violet
  '#DB2777', // Annaprasadam - Pink Coral
  '#0891B2', // Sri PAT - Cyan Teal
  '#4F46E5', // Reception - Indigo
  '#EA580C'  // Auctions - Vivid Orange
];

// Available Auditor Staff Roles
const AUDITOR_ROLES = [
  'Field Auditor',
  'Junior Auditor',
  'Senior Field Staff',
  'Lead Auditor',
  'Compliance Officer'
];

// Predefined Audit Work Types
const AUDIT_WORK_TYPES = [
  'Monthly Internal Audit',
  'Quaterly Internal Audit',
  'Half-Yearly Internal Audit',
  'Concurrent Audit',
  'Internal Audit & Systems Review',
  'Physical Inventory & Stock Verification',
  'Revenue, Donation & Token Reconciliation',
  'Tender, Bidder Envelope & Procurement Review',
  'Voucher & Ledger Transaction Verification',
  'Statutory & Regulatory Compliance Audit',
  'Special Investigation / Surprise Inspection'
];

const ITEMS_PER_PAGE = 10;

// ── SVG Donut / Pie Chart Component ──
function UnitDistributionPieChart({ allRecords }) {
  const totalCount = allRecords.length || 1;

  const unitStats = ORGANIZATIONAL_UNITS.map((unitName, index) => {
    const count = allRecords.filter(r => r.field4_unitDetails === unitName).length;
    const percentage = Math.round((count / totalCount) * 100);
    return {
      fullName: unitName,
      shortName: SHORT_UNIT_NAMES[index] || unitName,
      count,
      percentage,
      color: UNIT_COLORS[index % UNIT_COLORS.length]
    };
  });

  let accumulatedAngle = 0;
  const radius = 60;
  const circumference = 2 * Math.PI * radius; // ~376.99

  const slices = unitStats.map((stat, i) => {
    const strokeDasharray = `${(stat.count / totalCount) * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle;
    accumulatedAngle += (stat.count / totalCount) * circumference;

    return (
      <circle
        key={i}
        cx="90"
        cy="90"
        r={radius}
        fill="transparent"
        stroke={stat.color}
        strokeWidth="30"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
    );
  });

  return (
    <div className="pie-chart-container">
      <div className="pie-chart-svg-wrapper">
        <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
          {slices}
        </svg>
        <div className="pie-center-badge">
          <div className="pie-center-val">{allRecords.length}</div>
          <div className="pie-center-label">Total Logs</div>
        </div>
      </div>

      <div className="unit-grid-numbered">
        {unitStats.map((stat, i) => (
          <div key={i} className="unit-number-item" title={`${i + 1}. ${stat.fullName}: ${stat.count} logs (${stat.percentage}%)`}>
            <span className="unit-num-badge" style={{ background: stat.color }}>{i + 1}</span>
            <div className="unit-num-info">
              <span className="unit-num-title">{stat.shortName}</span>
              <span className="unit-num-stat">{stat.count} ({stat.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  // ── Auth & Active Session ──
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // ── Primary Admin Navigation ──
  // 'master_10' = Page 1: All User Activity & 11-Field Duty Log Master Table
  // 'unit_segregation' = Page 2: Unit-Wise Segregation (8 Official Units Header & Tabs)
  // 'user_directory' = Page 3: Auditor Directory & Staff Roster
  const [adminTab, setAdminTab] = useState('master_10');
  const [selectedUnitTab, setSelectedUnitTab] = useState(ORGANIZATIONAL_UNITS[0]);

  // ── Role Filter Toggle State (Super Admin Details vs User Details Requirement) ──
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'SUPER_ADMIN' | 'USER'

  // ── Master Filters & Search ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('ALL');
  const [filterWorkType, setFilterWorkType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // ── Pagination State (Strict 10 Items Per Page Requirement) ──
  const [currentPage1, setCurrentPage1] = useState(1);
  const [currentPage2, setCurrentPage2] = useState(1);
  const [modalHistoryPage, setModalHistoryPage] = useState(1);

  // ── Master Data Stores ──
  const [usersDb, setUsersDb] = useState([]);
  const [attendanceLedger, setAttendanceLedger] = useState([]);
  const [dutySubmittedReports, setDutySubmittedReports] = useState([]);

  // ── Modals & Drawers ──
  const [inspecting11FieldRecord, setInspecting11FieldRecord] = useState(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showAdminProfileModal, setShowAdminProfileModal] = useState(false);
  const [editingUserRole, setEditingUserRole] = useState(null);

  // Form Inputs
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('1234567');
  const [newUserRoleTitle, setNewUserRoleTitle] = useState('Field Auditor');
  const [newUserUnits, setNewUserUnits] = useState([ORGANIZATIONAL_UNITS[0], ORGANIZATIONAL_UNITS[1]]);

  const [loginEmail, setLoginEmail] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // ── Mandatory GPS Location Guard State ──
  const [adminLocation, setAdminLocation] = useState(null);
  const [isLocationGranted, setIsLocationGranted] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(true);
  const [locationError, setLocationError] = useState('');

  const requestLocationAccess = () => {
    setIsCheckingLocation(true);
    setLocationError('');

    if (!navigator.geolocation) {
      const fallback = {
        lat: '13.628800',
        lng: '79.419200',
        accuracy: 15,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        mapsUrl: 'https://maps.google.com/?q=13.6288,79.4192',
        note: 'TTD Executive Audit Center'
      };
      setAdminLocation(fallback);
      setIsLocationGranted(true);
      setIsCheckingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
          accuracy: Math.round(position.coords.accuracy),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          mapsUrl: `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`,
          note: 'Live GPS Sensor'
        };
        setAdminLocation(loc);
        setIsLocationGranted(true);
        setIsCheckingLocation(false);
      },
      (err) => {
        console.warn('Geolocation permission error:', err.message);
        setIsLocationGranted(false);
        setIsCheckingLocation(false);
        setLocationError('Location permissions are disabled in your browser. Please allow location access to continue.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const [currentTimeStr, setCurrentTimeStr] = useState('');

  useEffect(() => {
    requestLocationAccess();
  }, []);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentPage1(1);
  }, [searchQuery, filterUnit, filterWorkType, filterStatus, roleFilter]);

  useEffect(() => {
    setCurrentPage2(1);
  }, [selectedUnitTab]);

  useEffect(() => {
    setModalHistoryPage(1);
  }, [inspecting11FieldRecord]);

  // ── Fetch Master Backend Data ──
  const refreshAllData = useCallback(async () => {
    try {
      const [usersRes, attRes, dutyRes] = await Promise.all([
        fetch(`${API_BASE}/users`),
        fetch(`${API_BASE}/attendance`),
        fetch(`${API_BASE}/daily-reports`)
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.success) setUsersDb(usersData.users || []);
      }

      if (attRes.ok) {
        const attData = await attRes.json();
        if (attData.success) setAttendanceLedger(attData.attendance || []);
      }

      if (dutyRes.ok) {
        const dutyData = await dutyRes.json();
        if (dutyData.success && dutyData.reports) setDutySubmittedReports(dutyData.reports || []);
      }
    } catch (err) {
      console.warn('Backend API sync notice:', err);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
    const interval = setInterval(refreshAllData, 5000);
    return () => clearInterval(interval);
  }, [refreshAllData]);

  // ── Combined 11-Field Duty Log Records Master Pipeline ──
  const getAll11FieldRecords = useCallback(() => {
    const records = [];

    dutySubmittedReports.forEach((rep, idx) => {
      records.push({
        id: rep.id || `rep-${idx}`,
        source: 'Daily Duty Report',
        field1_loginTime: rep.loginTime || '—',
        field2_fullName: rep.fullName || rep.userName || '—',
        field3_studentRegNo: rep.studentRegNo || '—',
        field4_unitDetails: rep.unitDetails || rep.unit || '—',
        field5_subUnitDetails: rep.subUnitDetails || '—',
        field6_auditWorkType: rep.auditWorkType || '—',
        field7_workObjective: rep.workObjective || rep.detailedDescription || '—',
        field8_workToBeAchieved: rep.targetToAchieve || rep.status || '—',
        field9_caRemarks: rep.caRemarks || rep.keyEscalations || '—',
        field10_pocName: rep.pocName || '—',
        field11_logoutTime: rep.logoutTime || 'Session Active',
        rawDate: rep.date || '—',
        loginLocation: rep.loginLocation || null,
        logoutLocation: rep.logoutLocation || null,
        rawRecord: rep
      });
    });

    attendanceLedger.forEach((att, idx) => {
      if (!records.some(r => r.id === att.id)) {
        records.push({
          id: att.id || `att-${idx}`,
          source: 'Shift Log Sheet',
          field1_loginTime: att.loginTime || '—',
          field2_fullName: att.userName || '—',
          field3_studentRegNo: att.userRegNo || '—',
          field4_unitDetails: att.unit || '—',
          field5_subUnitDetails: att.subUnitDetails || '—',
          field6_auditWorkType: att.auditWorkType || '—',
          field7_workObjective: att.detailedDescription || '—',
          field8_workToBeAchieved: att.active ? 'In Progress' : 'Completed Shift Work',
          field9_caRemarks: att.keyEscalations || att.managerRemarks || '—',
          field10_pocName: '—',
          field11_logoutTime: att.logoutTime || 'Session Active',
          rawDate: att.date || '—',
          loginLocation: att.loginLocation || null,
          logoutLocation: att.logoutLocation || null,
          rawRecord: att
        });
      }
    });

    return records;
  }, [dutySubmittedReports, attendanceLedger]);

  const all11Records = getAll11FieldRecords();

  // Filter master 11-field records for Page 1 with Role Toggle Filter
  const filteredPage1Records = all11Records.filter(rec => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      rec.field2_fullName.toLowerCase().includes(query) ||
      rec.field3_studentRegNo.toLowerCase().includes(query) ||
      rec.field4_unitDetails.toLowerCase().includes(query) ||
      rec.field6_auditWorkType.toLowerCase().includes(query) ||
      rec.field7_workObjective.toLowerCase().includes(query);

    const matchesUnit = filterUnit === 'ALL' || rec.field4_unitDetails === filterUnit;
    const matchesWorkType = filterWorkType === 'ALL' || rec.field6_auditWorkType === filterWorkType;
    const matchesStatus = filterStatus === 'ALL' || rec.field8_workToBeAchieved.toLowerCase().includes(filterStatus.toLowerCase());

    const isSuperAdmin = rec.field2_fullName.toLowerCase().includes('admin');
    const matchesRole = roleFilter === 'ALL' || (roleFilter === 'SUPER_ADMIN' ? isSuperAdmin : !isSuperAdmin);

    return matchesSearch && matchesUnit && matchesWorkType && matchesStatus && matchesRole;
  });

  // Page 1 Pagination (10 Items Per Page)
  const totalPage1Pages = Math.ceil(filteredPage1Records.length / ITEMS_PER_PAGE) || 1;
  const paginatedPage1Records = filteredPage1Records.slice(
    (currentPage1 - 1) * ITEMS_PER_PAGE,
    currentPage1 * ITEMS_PER_PAGE
  );

  // Page 2 records segregated strictly by selectedUnitTab
  const page2UnitRecords = all11Records.filter(rec => rec.field4_unitDetails === selectedUnitTab);
  const page2UnitAuditors = usersDb.filter(u => u.unit === selectedUnitTab || selectedUnitTab.includes(u.unit));

  // Page 2 Pagination (10 Items Per Page)
  const totalPage2Pages = Math.ceil(page2UnitRecords.length / ITEMS_PER_PAGE) || 1;
  const paginatedPage2Records = page2UnitRecords.slice(
    (currentPage2 - 1) * ITEMS_PER_PAGE,
    currentPage2 * ITEMS_PER_PAGE
  );

  // ── Build Multi-Month Historical Shift Timeline for any Auditor Modal View ──
  const getAuditorHistoryTenure = (record) => {
    if (!record) return [];

    const directMatches = all11Records.filter(
      r => r.field2_fullName.toLowerCase() === record.field2_fullName.toLowerCase() ||
        r.field3_studentRegNo === record.field3_studentRegNo
    );

    return directMatches;
  };

  const selectedAuditorHistory = getAuditorHistoryTenure(inspecting11FieldRecord);
  const totalModalHistoryPages = Math.ceil(selectedAuditorHistory.length / ITEMS_PER_PAGE) || 1;
  const paginatedModalHistory = selectedAuditorHistory.slice(
    (modalHistoryPage - 1) * ITEMS_PER_PAGE,
    modalHistoryPage * ITEMS_PER_PAGE
  );

  // Handle Login Form Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!adminLocation) {
      requestLocationAccess();
      setLoginError('Location is required before signing in. Allow GPS access and try again.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          location: {
            latitude: Number(adminLocation.lat),
            longitude: Number(adminLocation.lng),
            accuracyMeters: Number(adminLocation.accuracy)
          }
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setLoginError(data.message || data.error || 'Invalid credentials');
        return;
      }

      setCurrentUser(data.user);
      setIsLoggedIn(true);
      await refreshAllData();
    } catch (err) {
      console.error('Admin login failed:', err);
      setLoginError('Error connecting to backend API');
    }
  };

  const handleAdminLogout = async () => {
    try {
      if (currentUser?.id) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            fullName: currentUser.fullName || currentUser.name || '',
            studentRegNo: currentUser.studentRegNo || currentUser.registrationNo || '',
            unitDetails: currentUser.unit || '',
            location: adminLocation
              ? {
                latitude: Number(adminLocation.lat),
                longitude: Number(adminLocation.lng),
                accuracyMeters: Number(adminLocation.accuracy)
              }
              : null
          })
        });
      }
    } catch (err) {
      console.error('Admin logout sync failed:', err);
    } finally {
      setCurrentUser(null);
      setIsLoggedIn(false);
      setLoginPassword('');
    }
  };

  // Handle Create New Auditor Account Form Submit
  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      alert('Please provide a valid Auditor Name and Email address.');
      return;
    }

    const unitString = Array.isArray(newUserUnits) && newUserUnits.length > 0
      ? newUserUnits.join(', ')
      : ORGANIZATIONAL_UNITS[0];

    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword || '1234567',
          roleTitle: newUserRoleTitle,
          unit: unitString,
          managerId: currentUser?.id || 'usr-1'
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`✅ New Auditor Account Provisioned Successfully!\n\nName: ${newUserName}\nEmail: ${newUserEmail}\nRole: ${newUserRoleTitle}\nAssigned Units:\n• ${newUserUnits.join('\n• ')}`);
        setShowCreateUserModal(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('1234567');
        setNewUserRoleTitle('Field Auditor');
        setNewUserUnits([ORGANIZATIONAL_UNITS[0], ORGANIZATIONAL_UNITS[1]]);
        refreshAllData();
      } else {
        alert(`⚠️ Failed to provision user: ${data.error || 'Database rejected entry'}`);
      }
    } catch (err) {
      console.error('Create auditor failed:', err);
      alert(`⚠️ Failed to provision user: ${err.message || 'Backend unavailable'}`);
    }
  };

  // Handle Delete / Remove Auditor Account
  const handleDeleteUser = async (userObj) => {
    if (!userObj) return;
    if (userObj.role === 'SUPER_ADMIN' || userObj.email === 'admin') {
      alert('⚠️ Security Protection: Primary Super Admin account cannot be deleted.');
      return;
    }

    const confirmDelete = window.confirm(
      `🚫 DISABLE AUDITOR ACCOUNT?\n\nDisable "${userObj.name}" (${userObj.email})?\n\nThe account will lose access, while historical audit records remain preserved.`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE}/users/${userObj.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Auditor Account Disabled: ${userObj.name}`);
        setUsersDb(prev => prev.filter(u => u.id !== userObj.id));
        setEditingUserRole(null);
        refreshAllData();
      } else {
        alert(`⚠️ Failed to remove auditor: ${data.error || 'Database rejected request'}`);
      }
    } catch (err) {
      console.error('Disable auditor failed:', err);
      alert(`⚠️ Failed to disable auditor: ${err.message || 'Backend unavailable'}`);
    }
  };

  // CSV Export Utility for exact 11 fields
  const exportRecordsToCsv = (recordsToExport, filenamePrefix = 'TTD_Audit_11Field_Report') => {
    if (!recordsToExport || recordsToExport.length === 0) {
      alert('No data records available to export.');
      return;
    }
    const headers = [
      '1. Login Time',
      '2. Full Name',
      '3. Student Registration No.',
      '4. TTD Audit Unit Details attending today',
      '5. TTD Audit Sub-Unit Details attending today',
      '6. Type of audit work done for',
      '7. Today\'s work Objective',
      '8. Todays \'s work to be achieved by end of day',
      '9. Remarks that you need the CA heading audit/management team of audit the to know',
      '10. Point of Contact Name[ POC ] within the unit',
      '11. Logout Time',
      'Date'
    ];

    const rows = recordsToExport.map(r => [
      `"${r.field1_loginTime}"`,
      `"${r.field2_fullName}"`,
      `"${r.field3_studentRegNo}"`,
      `"${r.field4_unitDetails}"`,
      `"${r.field5_subUnitDetails}"`,
      `"${r.field6_auditWorkType}"`,
      `"${(r.field7_workObjective || '').replace(/"/g, '""')}"`,
      `"${(r.field8_workToBeAchieved || '').replace(/"/g, '""')}"`,
      `"${(r.field9_caRemarks || '').replace(/"/g, '""')}"`,
      `"${(r.field10_pocName || '').replace(/"/g, '""')}"`,
      `"${r.field11_logoutTime}"`,
      `"${r.rawDate}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mandatory Location Access Guard Screen (First enable location, then portal appears)
  if (!isLocationGranted) {
    return (
      <div className="admin-panel-shell" style={{ justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', padding: '2rem' }}>
        <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '2.5rem', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px rgba(0, 0, 0, 0.35)', textAlign: 'center' }}>
          <div style={{ width: '68px', height: '68px', background: '#EFF6FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2rem', border: '1.5px solid #BFDBFE' }}>
            📍
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: '900', color: '#0F172A', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
            Location Access Required
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: '1.55', margin: '0 0 1.5rem', fontWeight: '600' }}>
            To access the <strong>CA Buddy Web Admin Portal</strong>, device location permissions must be enabled. Please enable location access in your browser to proceed.
          </p>

          {locationError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.82rem', marginBottom: '1.25rem', fontWeight: '700' }}>
              ⚠️ {locationError}
            </div>
          )}

          <button
            onClick={requestLocationAccess}
            disabled={isCheckingLocation}
            style={{ width: '100%', padding: '0.9rem', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '0.95rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)' }}
          >
            {isCheckingLocation ? 'Checking GPS Location...' : '📍 Enable / Allow Location Access →'}
          </button>
        </div>
      </div>
    );
  }

  // Clean Web Admin Login Portal (Appears only after location is enabled)
  if (!isLoggedIn) {
    return (
      <div className="admin-panel-shell" style={{ justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', padding: '2rem' }}>
        <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '2.5rem', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px rgba(0, 0, 0, 0.35)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img src="/logo.jpeg" alt="CA Buddy Logo" className="admin-brand-logo-img" style={{ width: '76px', height: '76px', marginBottom: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0F172A', margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>CABuddy Web Admin</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, fontWeight: '600' }}>TTD Enterprise Concurrent Audit Portal</p>
          </div>

          {loginError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '1.25rem', textAlign: 'center', fontWeight: '700' }}>
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>Admin Email / ID</label>
              <input
                type="text"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.92rem', outline: 'none', background: '#F8FAFC' }}
                placeholder="Enter admin ID"
                required
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.92rem', outline: 'none', background: '#F8FAFC' }}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              style={{ width: '100%', padding: '0.9rem', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '0.95rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)' }}
            >
              Sign In to Web Admin →
            </button>
          </form>

          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '600' }}>🔒 Authorized TTD Audit System Personnel Only</span>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = all11Records.filter(r => {
    const target = String(r.field8_workToBeAchieved || '').toLowerCase();
    const logout = String(r.field11_logoutTime || '').toLowerCase();
    return target.includes('completed') || target.includes('verified') || (logout !== 'session active' && logout !== '—' && logout.trim() !== '');
  }).length;
  const inProgressCount = all11Records.length - completedCount;
  const completedPercent = Math.round((completedCount / (all11Records.length || 1)) * 100);

  return (
    <div className="admin-panel-shell">
      {/* ── Enhanced Professional Executive Header ── */}
      <header className="admin-navbar">
        <div className="admin-navbar-inner">
          {/* Brand Logo & System Title Group */}
          <div className="admin-brand-group">
            <img src="/logo.jpeg" alt="CA Buddy Logo" className="admin-brand-logo-img" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#FACC15', letterSpacing: '0.02em' }}>
                  CA BUDDY
                </span>
                <span style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', fontSize: '0.68rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Base Admin Console
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: '600', marginTop: '0.1rem' }}>
                TTD Apex Concurrent & Internal Audit Management System
              </div>
            </div>
          </div>

          {/* Quick Global Search Bar */}
          <div className="admin-search-box">
            <svg className="admin-search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search auditor, reg no, unit, work type..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Clock Widget & User Profile Badge */}
          <div className="admin-nav-actions">
            <div style={{ textAlign: 'right', paddingRight: '0.5rem', borderRight: '1px solid #334155' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#F8FAFC', letterSpacing: '0.03em' }}>{currentTimeStr}</div>
              <div style={{ fontSize: '0.68rem', color: '#34D399', fontWeight: '700' }}>🟢 Server Sync Active</div>
            </div>

            {/* Clickable Super Admin Profile Badge in Right-Side Corner */}
            <div
              className="admin-profile-corner-badge"
              onClick={() => setShowAdminProfileModal(true)}
              title="Click to view Super Admin Profile & Login/Logout Session History"
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#1E293B', padding: '0.45rem 0.85rem', borderRadius: '14px', border: '1px solid #334155', cursor: 'pointer', transition: 'all 0.2s ease' }}
            >
              <span style={{ fontSize: '1.1rem' }}>🔑</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {currentUser.name}
                  <span style={{ fontSize: '0.65rem', background: '#2563EB', color: '#FFFFFF', padding: '0.1rem 0.4rem', borderRadius: '6px', fontWeight: '800' }}>PROFILE</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#60A5FA', fontWeight: '700' }}>{currentUser.roleTitle}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleAdminLogout(); }}
                style={{ background: '#EF4444', color: '#FFFFFF', border: 'none', width: '26px', height: '26px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.2rem' }}
                title="Sign Out Admin"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Unified Section Tabs Navigation ── */}
      <nav className="admin-tab-nav-bar">
        <div className="admin-tab-nav-inner">
          <button
            className={`admin-tab-btn ${adminTab === 'master_10' ? 'active' : ''}`}
            onClick={() => setAdminTab('master_10')}
          >
            📊 Page 1: All User Activity (11-Field Duty Log Master)
            <span className="admin-tab-counter">{filteredPage1Records.length}</span>
          </button>

          <button
            className={`admin-tab-btn ${adminTab === 'unit_segregation' ? 'active' : ''}`}
            onClick={() => setAdminTab('unit_segregation')}
          >
            🏛️ Page 2: Unit-Wise Segregation (8 Official Units)
            <span className="admin-tab-counter">{ORGANIZATIONAL_UNITS.length} Units</span>
          </button>

          <button
            className={`admin-tab-btn ${adminTab === 'user_directory' ? 'active' : ''}`}
            onClick={() => setAdminTab('user_directory')}
          >
            👥 Auditor Directory & Staff Roster
            <span className="admin-tab-counter">{usersDb.length}</span>
          </button>
        </div>
      </nav>

      {/* ── Main Workspace Body ── */}
      <main className="admin-body-container">
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ── PAGE 1: ALL USER ACTIVITY (2x2 KPI GRID & PIE CHART) ───────── */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {adminTab === 'master_10' && (
          <div>
            {/* ROW 1: 2x2 KPI METRICS GRID */}
            <div className="admin-kpi-grid">
              <div className="admin-kpi-card">
                <div className="admin-kpi-info">
                  <span className="admin-kpi-label">Active Auditors Roster</span>
                  <span className="admin-kpi-val">{usersDb.length} Staff</span>
                  <span className="admin-kpi-subtext">Across 8 Enterprise Units</span>
                </div>
                <div className="admin-kpi-icon-box" style={{ background: '#EFF6FF', color: '#2563EB' }}>👥</div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-info">
                  <span className="admin-kpi-label">Total Shift Duty Sheets</span>
                  <span className="admin-kpi-val">{all11Records.length} Sheets</span>
                  <span className="admin-kpi-subtext">Captured with 11 Duty Parameters</span>
                </div>
                <div className="admin-kpi-icon-box" style={{ background: '#ECFDF5', color: '#059669' }}>📋</div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-info">
                  <span className="admin-kpi-label">8 Official TTD Units Coverage</span>
                  <span className="admin-kpi-val">{ORGANIZATIONAL_UNITS.length} Units</span>
                  <span className="admin-kpi-subtext">100% Segregated Data Stream</span>
                </div>
                <div className="admin-kpi-icon-box" style={{ background: '#FEF3C7', color: '#D97706' }}>🏛️</div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-info">
                  <span className="admin-kpi-label">CA Remarks & Escalations</span>
                  <span className="admin-kpi-val">
                    {all11Records.filter(r => r.field9_caRemarks && r.field9_caRemarks.length > 5).length} Items
                  </span>
                  <span className="admin-kpi-subtext" style={{ color: '#DC2626' }}>Requiring Management Attention</span>
                </div>
                <div className="admin-kpi-icon-box" style={{ background: '#FEF2F2', color: '#DC2626' }}>⚠️</div>
              </div>
            </div>

            {/* ROW 2: 2-TO-1 SPLIT SUMMARY ANALYTICS GRID WITH PIE CHART */}
            <div className="admin-analytics-grid">
              {/* Left 2-Span Box: Unit-Wise Distribution Pie Chart */}
              <div className="analytics-card-box">
                <div className="analytics-card-header">
                  <h4 className="analytics-card-title">
                    <span>📊</span>
                    Unit-Wise Audit Activity Distribution (Summary Analytics)
                  </h4>
                  <span style={{ fontSize: '0.75rem', background: '#F1F5F9', color: '#475569', fontWeight: '700', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    Live Unit Metrics
                  </span>
                </div>

                <UnitDistributionPieChart allRecords={all11Records} />
              </div>

              {/* Right 1-Span Box: Shift Status & Progress Analytics */}
              <div className="analytics-card-box">
                <div className="analytics-card-header">
                  <h4 className="analytics-card-title">
                    <span>📈</span>
                    Shift Completion Analytics
                  </h4>
                  <span style={{ fontSize: '0.75rem', background: '#ECFDF5', color: '#047857', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    {completedPercent}% Overall
                  </span>
                </div>

                {/* Status items 2 at a time in one row */}
                <div className="status-grid-2col">
                  <div className="status-card-compact" style={{ borderLeft: '4px solid #059669' }}>
                    <div className="status-card-header-row">
                      <span className="status-card-title" style={{ color: '#047857' }}>✅ Shift Handovers</span>
                      <span className="status-card-badge" style={{ background: '#ECFDF5', color: '#047857' }}>{completedPercent}%</span>
                    </div>
                    <div className="status-card-val">{completedCount} Completed</div>
                    <div className="status-progress-track">
                      <div className="status-progress-fill" style={{ width: `${completedPercent}%`, background: '#059669' }} />
                    </div>
                  </div>

                  <div className="status-card-compact" style={{ borderLeft: '4px solid #F59E0B' }}>
                    <div className="status-card-header-row">
                      <span className="status-card-title" style={{ color: '#D97706' }}>⏱️ In Progress</span>
                      <span className="status-card-badge" style={{ background: '#FEF3C7', color: '#D97706' }}>{100 - completedPercent}%</span>
                    </div>
                    <div className="status-card-val">{inProgressCount} Active</div>
                    <div className="status-progress-track">
                      <div className="status-progress-fill" style={{ width: `${100 - completedPercent}%`, background: '#F59E0B' }} />
                    </div>
                  </div>

                  <div className="status-card-compact" style={{ borderLeft: '4px solid #EF4444' }}>
                    <div className="status-card-header-row">
                      <span className="status-card-title" style={{ color: '#DC2626' }}>⚠️ CA Escalations</span>
                      <span className="status-card-badge" style={{ background: '#FEF2F2', color: '#DC2626' }}>Alert</span>
                    </div>
                    <div className="status-card-val">
                      {all11Records.filter(r => r.field9_caRemarks && r.field9_caRemarks.length > 5).length} Items
                    </div>
                    <div className="status-progress-track">
                      <div className="status-progress-fill" style={{ width: `${Math.round((all11Records.filter(r => r.field9_caRemarks && r.field9_caRemarks.length > 5).length / (all11Records.length || 1)) * 100)}%`, background: '#EF4444' }} />
                    </div>
                  </div>

                  <div className="status-card-compact" style={{ borderLeft: '4px solid #2563EB', background: '#F8FAFC' }}>
                    <div className="status-card-header-row">
                      <span className="status-card-title" style={{ color: '#2563EB' }}>🏛️ 8 Official TDD Units</span>
                      <span className="status-card-badge" style={{ background: '#EFF6FF', color: '#2563EB' }}>Active</span>
                    </div>
                    <div className="status-card-val">{all11Records.length} Active Logs</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.2rem', fontWeight: '600' }}>
                      Real-time roster & duty monitoring
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 3: STREAMLINED MINIMAL MASTER EXECUTIVE DUTY LOG TABLE WITH TOP-RIGHT DOWNLOAD BUTTON */}
            <div className="master-card-box">
              <div className="master-card-header master-header-split">
                <div className="master-card-title-group">
                  <span style={{ fontSize: '1.3rem' }}>📑</span>
                  <div>
                    <h3 className="master-card-title">Master Executive Auditor Duty Log Summary</h3>
                    <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
                      Toggle between Super Admin logs and User Auditor logs. Download CSV directly from this table.
                    </p>
                  </div>
                </div>

                {/* Right-Side Corner Download CSV Button */}
                <button
                  className="btn-export-csv btn-export-right-corner"
                  onClick={() => exportRecordsToCsv(filteredPage1Records, 'Master_Auditor_Duty_Log_Summary')}
                  title="Download Current Master Table Records as CSV"
                >
                  📥 Download CSV
                </button>
              </div>

              {/* Toolbar with Separate Buttons & Filter Selects */}
              <div className="master-toolbar-bar">
                {/* User Auditor Duty Log Filter */}
                <div className="separate-role-btn-group">
                  <button
                    className={`btn-separate-role ${roleFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setRoleFilter('ALL')}
                  >
                    👤 All User Auditor Duty Logs ({all11Records.length})
                  </button>
                </div>

                {/* Select Filters */}
                <div className="master-filter-selects">
                  <select
                    className="master-select-filter"
                    value={filterUnit}
                    onChange={e => setFilterUnit(e.target.value)}
                  >
                    <option value="ALL">🏢 Unit: All 8 Units</option>
                    {ORGANIZATIONAL_UNITS.map((u, i) => (
                      <option key={i} value={u}>{u}</option>
                    ))}
                  </select>

                  <select
                    className="master-select-filter"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                  >
                    <option value="ALL">🎯 Status: All</option>
                    <option value="COMPLETED">✅ Completed</option>
                    <option value="IN_PROGRESS">⏱️ In Progress</option>
                  </select>
                </div>
              </div>

              {/* Streamlined Minimal 5-Column Table View */}
              <div className="master-table-wrapper">
                <table className="master-10-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>#</th>
                      <th style={{ width: '230px' }}>Auditor Details & Login Time</th>
                      <th style={{ width: '260px' }}>Unit(s) Working Out Of</th>
                      <th>Which Unit & Sub-Unit is Doing It</th>
                      <th style={{ width: '130px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPage1Records.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94A3B8' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                          No matching auditor activity records found for current role filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedPage1Records.map((rec, idx) => {
                        const globalIndex = (currentPage1 - 1) * ITEMS_PER_PAGE + idx + 1;
                        // Split assigned units if multiple
                        const assignedUnitsList = rec.field4_unitDetails.split(',').map(u => u.trim());

                        return (
                          <tr key={rec.id || idx}>
                            <td>
                              <span className="field-pill-number">{globalIndex}</span>
                              <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '0.2rem' }}>{rec.rawDate}</div>
                            </td>

                            {/* Column 2: Full Name, Reg No, and Login Time Underneath */}
                            <td>
                              <div className="auditor-profile-cell">
                                <span className="auditor-name-txt" style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0F172A' }}>{rec.field2_fullName}</span>
                                <span className="auditor-reg-txt" style={{ fontSize: '0.76rem', color: '#2563EB', fontWeight: '700' }}>🎓 {rec.field3_studentRegNo}</span>
                                <div style={{ marginTop: '0.35rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1E40AF', background: '#EFF6FF', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid #BFDBFE', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    ⏱️ Login: {rec.field1_loginTime}
                                  </span>
                                </div>
                                {rec.loginLocation && (
                                  <a
                                    href={`https://maps.google.com/?q=${rec.loginLocation.latitude},${rec.loginLocation.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#047857', fontWeight: '800', textDecoration: 'none', display: 'inline-block' }}
                                  >
                                    📍 GPS: {Number(rec.loginLocation.latitude).toFixed(5)}, {Number(rec.loginLocation.longitude).toFixed(5)}
                                    {rec.loginLocation.accuracyMeters != null ? ` (±${Math.round(Number(rec.loginLocation.accuracyMeters))} m)` : ''}
                                  </a>
                                )}
                              </div>
                            </td>

                            {/* Column 3: Unit(s) Working Out Of */}
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                {assignedUnitsList.map((unitName, uIdx) => (
                                  <span key={uIdx} className="unit-tag-badge" title={unitName} style={{ fontSize: '0.78rem', fontWeight: '800', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.25rem 0.6rem', borderRadius: '8px' }}>
                                    🏛️ {unitName}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Column 4: Which Unit & Sub-Unit is Doing It Today */}
                            <td>
                              <div>
                                <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{ background: '#2563EB', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: '800', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>ACTIVE</span>
                                  <span>{rec.field4_unitDetails}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.76rem', color: '#475569', fontWeight: '700', background: '#F1F5F9', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                    📍 Sub-Unit: {rec.field5_subUnitDetails}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '0.15rem 0.55rem', borderRadius: '6px', fontWeight: '800' }}>
                                    📋 {rec.field6_auditWorkType}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Column 5: Action Button */}
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn-inspect-10"
                                onClick={() => setInspecting11FieldRecord(rec)}
                                style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '0.5rem 0.95rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)' }}
                              >
                                🔍 View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Page 1 Pagination Footer Bar with Total Summary Count */}
              <div className="admin-pagination-bar">
                <div className="pagination-info-text">
                  Showing <strong>{filteredPage1Records.length > 0 ? (currentPage1 - 1) * ITEMS_PER_PAGE + 1 : 0}</strong> to <strong>{Math.min(currentPage1 * ITEMS_PER_PAGE, filteredPage1Records.length)}</strong> of <strong>{filteredPage1Records.length} Total Active Auditor Duty Log Entries</strong> across all 8 TTD Units
                </div>

                <div className="pagination-btns-group">
                  <button
                    className="page-nav-btn"
                    disabled={currentPage1 === 1}
                    onClick={() => setCurrentPage1(prev => Math.max(prev - 1, 1))}
                  >
                    ◀ Previous Page
                  </button>

                  {Array.from({ length: totalPage1Pages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      className={`page-number-btn ${currentPage1 === p ? 'active' : ''}`}
                      onClick={() => setCurrentPage1(p)}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    className="page-nav-btn"
                    disabled={currentPage1 === totalPage1Pages}
                    onClick={() => setCurrentPage1(prev => Math.min(prev + 1, totalPage1Pages))}
                  >
                    Next Page ▶
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ── PAGE 2: UNIT-WISE SEGREGATION (STREAMLINED 5-COLUMN TABLE) ─── */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {adminTab === 'unit_segregation' && (
          <div>
            {/* 8-UNIT TOP SEGREGATION BANNER & TABS */}
            <div className="unit-segregation-banner">
              <div className="unit-banner-header">
                <div>
                  <h3 className="unit-banner-title">
                    <span>🏛️</span>
                    TTD Audit Unit Details attending today (8 Enterprise Units)
                  </h3>
                  <p className="unit-banner-desc">
                    Choose any of the 8 official units below to filter all auditor shift data, active rosters, and duty reports unit-by-unit.
                  </p>
                </div>

                <button
                  className="btn-export-csv"
                  onClick={() => exportRecordsToCsv(page2UnitRecords, `Unit_Audit_Report_${selectedUnitTab.slice(0, 15)}`)}
                >
                  📥 Export {selectedUnitTab.slice(0, 15)}... CSV
                </button>
              </div>

              {/* Grid of the 8 Official Unit Card Buttons */}
              <div className="unit-grid-8">
                {ORGANIZATIONAL_UNITS.map((unitName, idx) => {
                  const unitLogs = all11Records.filter(r => r.field4_unitDetails === unitName);
                  const unitAuditorsCount = usersDb.filter(u => u.unit === unitName || unitName.includes(u.unit)).length;
                  const isActive = selectedUnitTab === unitName;

                  return (
                    <button
                      key={idx}
                      className={`unit-card-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedUnitTab(unitName)}
                    >
                      <div className="unit-card-name">
                        <span style={{ marginRight: '0.3rem' }}>{idx + 1}.</span>
                        {unitName}
                      </div>
                      <div className="unit-card-meta">
                        <span>👥 {unitAuditorsCount} Auditors</span>
                        <span className="unit-card-badge">📋 {unitLogs.length} Logs</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SEGREGATED UNIT DATA VIEW */}
            <div className="master-card-box">
              <div className="master-card-header" style={{ background: '#EFF6FF', borderBottom: '2px solid #2563EB' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    CURRENTLY VIEWING SEGREGATED UNIT DATA:
                  </span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1E3A8A', margin: '0.2rem 0 0' }}>
                    🏛️ {selectedUnitTab}
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ background: '#FFFFFF', padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid #BFDBFE', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '700' }}>ASSIGNED AUDITORS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1D4ED8' }}>{page2UnitAuditors.length} Staff</div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid #BFDBFE', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '700' }}>TOTAL DUTY LOGS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#059669' }}>
                      {page2UnitRecords.length} Sheets
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Section 1: Unit Staff Roster */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0F172A', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  👥 Assigned Auditors & Staff in {selectedUnitTab}
                </h4>

                {page2UnitAuditors.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#64748B', italic: 'true', margin: 0 }}>
                    No static users directly assigned to this unit in directory (shift entries below record all active field staff).
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {page2UnitAuditors.map((u, i) => (
                      <div key={i} style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: '32px', height: '32px', background: '#3B82F6', color: '#FFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.85rem' }}>
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0F172A' }}>{u.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: '600' }}>{u.roleTitle || 'Auditor'} • {u.studentRegNo || u.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-Section 2: Streamlined Minimal 5-Column Table View */}
              <div className="master-table-wrapper">
                <table className="master-10-table">
                  <thead>
                    <tr>
                      <th style={{ width: '70px' }}>#</th>
                      <th style={{ width: '150px' }}>Login Time</th>
                      <th style={{ width: '220px' }}>Full Name & Reg No</th>
                      <th>Which Unit is Doing It</th>
                      <th style={{ width: '140px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPage2Records.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94A3B8' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏛️</div>
                          No duty shift logs or audit reports recorded yet for <strong>{selectedUnitTab}</strong>.
                        </td>
                      </tr>
                    ) : (
                      paginatedPage2Records.map((rec, idx) => {
                        const globalIndex = (currentPage2 - 1) * ITEMS_PER_PAGE + idx + 1;
                        return (
                          <tr key={rec.id || idx}>
                            <td><span className="field-pill-number">{globalIndex}</span></td>
                            <td>
                              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#2563EB', background: '#EFF6FF', padding: '0.3rem 0.7rem', borderRadius: '8px' }}>
                                ⏱️ {rec.field1_loginTime}
                              </span>
                            </td>
                            <td>
                              <div className="auditor-profile-cell">
                                <span className="auditor-name-txt" style={{ fontSize: '0.92rem' }}>{rec.field2_fullName}</span>
                                <span className="auditor-reg-txt">🎓 {rec.field3_studentRegNo}</span>
                              </div>
                            </td>
                            <td>
                              <div>
                                <span className="unit-tag-badge" title={rec.field4_unitDetails} style={{ maxWidth: '320px', fontSize: '0.8rem' }}>
                                  🏛️ {rec.field4_unitDetails}
                                </span>
                                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '0.25rem' }}>📍 {rec.field5_subUnitDetails}</div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn-inspect-10"
                                onClick={() => setInspecting11FieldRecord(rec)}
                                style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '0.5rem 0.95rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)' }}
                              >
                                🔍 View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Page 2 Pagination Footer Bar */}
              <div className="admin-pagination-bar">
                <div className="pagination-info-text">
                  Showing <strong>{page2UnitRecords.length > 0 ? (currentPage2 - 1) * ITEMS_PER_PAGE + 1 : 0}</strong> to <strong>{Math.min(currentPage2 * ITEMS_PER_PAGE, page2UnitRecords.length)}</strong> of <strong>{page2UnitRecords.length} Total Unit Duty Logs</strong> for {selectedUnitTab}
                </div>

                <div className="pagination-btns-group">
                  <button
                    className="page-nav-btn"
                    disabled={currentPage2 === 1}
                    onClick={() => setCurrentPage2(prev => Math.max(prev - 1, 1))}
                  >
                    ◀ Previous Page
                  </button>

                  {Array.from({ length: totalPage2Pages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      className={`page-number-btn ${currentPage2 === p ? 'active' : ''}`}
                      onClick={() => setCurrentPage2(p)}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    className="page-nav-btn"
                    disabled={currentPage2 === totalPage2Pages}
                    onClick={() => setCurrentPage2(prev => Math.min(prev + 1, totalPage2Pages))}
                  >
                    Next Page ▶
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ── PAGE 3: AUDITOR DIRECTORY & STAFF ROSTER ─────────────────── */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {adminTab === 'user_directory' && (
          <div>
            <div className="master-card-box">
              <div className="master-card-header">
                <div>
                  <h3 className="master-card-title">👥 Enterprise Auditor Directory ({usersDb.length} Registered Staff)</h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
                    Manage auditor profiles, assign roles, update 8-unit allocations, and provision accounts.
                  </p>
                </div>

                <button
                  onClick={() => setShowCreateUserModal(true)}
                  style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '0.6rem 1.15rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  ➕ Add New Auditor Account
                </button>
              </div>

              <div className="master-table-wrapper">
                <table className="master-10-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Auditor Name</th>
                      <th>Email / Reg No</th>
                      <th>Designation / Role Title</th>
                      <th>Assigned TTD Unit</th>
                      <th>Joined Date</th>
                      <th>Access Level</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersDb.map((u, i) => (
                      <tr key={u.id || i}>
                        <td><span className="field-pill-number">{i + 1}</span></td>
                        <td>
                          <div style={{ fontWeight: '800', color: '#0F172A' }}>{u.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B' }}>ID: {u.id}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '700', color: '#334155' }}>{u.email}</div>
                          <div style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: '700' }}>🎓 {u.studentRegNo || 'FCA-OFFICIAL'}</div>
                        </td>
                        <td>
                          <span style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700' }}>
                            {u.roleTitle || u.role}
                          </span>
                        </td>
                        <td style={{ maxWidth: '220px' }}>
                          <span className="unit-tag-badge" title={u.unit}>🏛️ {u.unit || 'All Units'}</span>
                        </td>
                        <td>{u.joinedDate || '01-Jan-2026'}</td>
                        <td>
                          <span className={`status-badge-pill ${u.role === 'SUPER_ADMIN' ? 'completed' : 'in-progress'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => setEditingUserRole(u)}
                              style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                            >
                              ✏️ Edit Role & Unit
                            </button>
                            {u.role !== 'SUPER_ADMIN' && u.email !== 'admin' && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                                title="Remove this auditor account from system"
                              >
                                🗑️ Remove
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL: COMPLETE 11-FIELD & 3-MONTH SHIFT HISTORY DRAWER ───── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {inspecting11FieldRecord && (
        <div className="modal-admin-overlay" onClick={() => setInspecting11FieldRecord(null)}>
          <div className="modal-admin-card" style={{ maxWidth: '850px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-admin-header">
              <div className="modal-admin-title">
                <span>📑</span>
                Complete Auditor Duty Form & 3-Month Shift History Ledger
              </div>
              <button className="modal-close-btn" onClick={() => setInspecting11FieldRecord(null)}>✕</button>
            </div>

            <div className="modal-admin-body" style={{ maxHeight: '82vh', overflowY: 'auto' }}>
              {/* Profile Card Banner */}
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '0.85rem 1.25rem', borderRadius: '14px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#1E40AF', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    CURRENT SHIFT AUDITOR RECORD
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#1E3A8A', marginTop: '0.1rem' }}>
                    {inspecting11FieldRecord.field2_fullName}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#2563EB', fontWeight: '700' }}>
                    Student Reg No: {inspecting11FieldRecord.field3_studentRegNo}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="work-type-chip">📋 {inspecting11FieldRecord.field6_auditWorkType}</span>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '700', marginTop: '0.35rem' }}>
                    Date: {inspecting11FieldRecord.rawDate}
                  </div>
                </div>
              </div>

              {/* Grid of All 11 Fields in Exact Requested Order */}
              <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0F172A', marginBottom: '0.75rem' }}>
                📋 Shift Form 11 Duty Parameters
              </h4>
              <div className="field-10-grid-container">
                <div className="field-10-box">
                  <div className="field-10-label">⏱️ 1. Login Time</div>
                  <div className="field-10-value">{inspecting11FieldRecord.field1_loginTime}</div>
                </div>

                <div className="field-10-box">
                  <div className="field-10-label">👤 2. Full Name</div>
                  <div className="field-10-value">{inspecting11FieldRecord.field2_fullName}</div>
                </div>

                <div className="field-10-box">
                  <div className="field-10-label">🎓 3. Student Registration No.</div>
                  <div className="field-10-value">{inspecting11FieldRecord.field3_studentRegNo}</div>
                </div>

                <div className="field-10-box">
                  <div className="field-10-label">🏛️ 4. TTD Audit Unit Details attending today</div>
                  <div className="field-10-value">{inspecting11FieldRecord.field4_unitDetails}</div>
                </div>

                <div className="field-10-box">
                  <div className="field-10-label">📍 5. TTD Audit Sub-Unit Details attending today</div>
                  <div className="field-10-value">{inspecting11FieldRecord.field5_subUnitDetails}</div>
                </div>

                <div className="field-10-box">
                  <div className="field-10-label">📋 6. Type of audit work done for</div>
                  <div className="field-10-value">{inspecting11FieldRecord.field6_auditWorkType}</div>
                </div>

                <div className="field-10-box">
                  <div className="field-10-label">🎯 7. Today's work Objective</div>
                  <div className="field-10-value">{inspecting11FieldRecord.field7_workObjective}</div>
                </div>

                <div className="field-10-box">
                  <div className="field-10-label">✅ 8. Todays 's work to be achieved by end of day</div>
                  <div className="field-10-value">{inspecting11FieldRecord.field8_workToBeAchieved}</div>
                </div>

                <div className="field-10-box" style={{ gridColumn: 'span 2' }}>
                  <div className="field-10-label">✍️ 9. Remarks that you need the CA heading audit/management team of audit the to know</div>
                  <div className="field-10-value" style={{ color: '#B91C1C' }}>
                    {inspecting11FieldRecord.field9_caRemarks || 'No critical remarks recorded.'}
                  </div>
                </div>

                <div className="field-10-box">
                  <div className="field-10-label">🤝 10. Point of Contact Name[ POC ] within the unit</div>
                  <div className="field-10-value">{inspecting11FieldRecord.field10_pocName}</div>
                </div>

                <div className="field-10-box">
                  <div className="field-10-label">🏁 11. Logout Time</div>
                  <div className="field-10-value" style={{ color: '#10B981' }}>{inspecting11FieldRecord.field11_logoutTime}</div>
                </div>
              </div>

              {(inspecting11FieldRecord.loginLocation || inspecting11FieldRecord.logoutLocation) && (
                <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #D1FAE5', background: '#F0FDF4', borderRadius: '14px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '900', color: '#065F46', marginBottom: '0.65rem' }}>
                    📍 GPS Verification
                  </div>
                  {inspecting11FieldRecord.loginLocation && (
                    <div style={{ fontSize: '0.78rem', color: '#065F46', marginBottom: '0.4rem', fontWeight: '700' }}>
                      Login: {Number(inspecting11FieldRecord.loginLocation.latitude).toFixed(6)}, {Number(inspecting11FieldRecord.loginLocation.longitude).toFixed(6)}
                      {inspecting11FieldRecord.loginLocation.accuracyMeters != null ? ` • ±${Math.round(Number(inspecting11FieldRecord.loginLocation.accuracyMeters))} m` : ''}
                      {' • '}
                      <a
                        href={`https://maps.google.com/?q=${inspecting11FieldRecord.loginLocation.latitude},${inspecting11FieldRecord.loginLocation.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#2563EB', fontWeight: '800' }}
                      >Open Map</a>
                    </div>
                  )}
                  {inspecting11FieldRecord.logoutLocation && (
                    <div style={{ fontSize: '0.78rem', color: '#065F46', fontWeight: '700' }}>
                      Logout: {Number(inspecting11FieldRecord.logoutLocation.latitude).toFixed(6)}, {Number(inspecting11FieldRecord.logoutLocation.longitude).toFixed(6)}
                      {inspecting11FieldRecord.logoutLocation.accuracyMeters != null ? ` • ±${Math.round(Number(inspecting11FieldRecord.logoutLocation.accuracyMeters))} m` : ''}
                      {' • '}
                      <a
                        href={`https://maps.google.com/?q=${inspecting11FieldRecord.logoutLocation.latitude},${inspecting11FieldRecord.logoutLocation.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#2563EB', fontWeight: '800' }}
                      >Open Map</a>
                    </div>
                  )}
                </div>
              )}

              {/* ── SECTION B: 3-MONTH HISTORICAL SHIFT LOGIN/LOGOUT TIMELINE (PAGINATED 10 PER PAGE) ── */}
              <div className="modal-history-section">
                <div className="modal-history-title">
                  <span>📅 Past 3-Month Shift Login & Logout History Ledger</span>
                  <span style={{ fontSize: '0.78rem', background: '#F1F5F9', color: '#2563EB', padding: '0.25rem 0.65rem', borderRadius: '8px', fontWeight: '800' }}>
                    Total {selectedAuditorHistory.length} Past Shift Logs
                  </span>
                </div>

                <div className="modal-history-table-wrapper">
                  <table className="modal-history-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Shift Date</th>
                        <th>Login Time</th>
                        <th>Logout Time</th>
                        <th>Sub-Unit Desk Location</th>
                        <th>Work Objective</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedModalHistory.map((item, hIdx) => {
                        const hGlobalIndex = (modalHistoryPage - 1) * ITEMS_PER_PAGE + hIdx + 1;
                        return (
                          <tr key={item.id || hIdx}>
                            <td><strong>{hGlobalIndex}</strong></td>
                            <td><span style={{ fontWeight: '700', color: '#0F172A' }}>{item.rawDate}</span></td>
                            <td><span style={{ color: '#2563EB', fontWeight: '800' }}>⏱️ {item.field1_loginTime}</span></td>
                            <td><span style={{ color: '#10B981', fontWeight: '800' }}>🏁 {item.field11_logoutTime}</span></td>
                            <td>📍 {item.field5_subUnitDetails}</td>
                            <td>🎯 {item.field7_workObjective}</td>
                            <td>
                              <span className="status-badge-pill completed" style={{ fontSize: '0.7rem' }}>
                                ✅ Verified Shift
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Modal History Ledger Pagination (10 Items Per Page) */}
                  <div className="modal-history-pagination">
                    <div>
                      Showing page <strong>{modalHistoryPage}</strong> of <strong>{totalModalHistoryPages}</strong> ({selectedAuditorHistory.length} historical logs)
                    </div>

                    <div className="pagination-btns-group">
                      <button
                        className="page-nav-btn"
                        disabled={modalHistoryPage === 1}
                        onClick={() => setModalHistoryPage(prev => Math.max(prev - 1, 1))}
                      >
                        ◀ Prev 10
                      </button>

                      {Array.from({ length: totalModalHistoryPages }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          className={`page-number-btn ${modalHistoryPage === p ? 'active' : ''}`}
                          onClick={() => setModalHistoryPage(p)}
                        >
                          {p}
                        </button>
                      ))}

                      <button
                        className="page-nav-btn"
                        disabled={modalHistoryPage === totalModalHistoryPages}
                        onClick={() => setModalHistoryPage(prev => Math.min(prev + 1, totalModalHistoryPages))}
                      >
                        Next 10 ▶
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                <button
                  onClick={() => setInspecting11FieldRecord(null)}
                  style={{ background: '#0F172A', color: '#FFFFFF', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer' }}
                >
                  Close History Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD NEW AUDITOR ── */}
      {showCreateUserModal && (
        <div className="modal-admin-overlay" onClick={() => setShowCreateUserModal(false)}>
          <div className="modal-admin-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-admin-header">
              <div>
                <div className="modal-admin-title">👤 Provision New Auditor User Account</div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.15rem' }}>
                  Super Admin provisions User Auditor Logins (User Name, User ID & Assigned TTD Unit)
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowCreateUserModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateUserSubmit} className="modal-admin-body">
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.35rem' }}>AUDITOR FULL NAME</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="e.g. Satish Kumar Reddy"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.35rem' }}>EMAIL ADDRESS / USERNAME</label>
                <input
                  type="text"
                  required
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="auditor@ttd.gov.in"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.35rem' }}>INITIAL PASSWORD</label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.35rem' }}>DESIGNATION ROLE</label>
                <select
                  value={newUserRoleTitle}
                  onChange={e => setNewUserRoleTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                >
                  {AUDITOR_ROLES.map((r, i) => (
                    <option key={i} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>ASSIGNED TTD UNITS (SELECT MULTIPLE)</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (newUserUnits.length === ORGANIZATIONAL_UNITS.length) {
                        setNewUserUnits([ORGANIZATIONAL_UNITS[0]]);
                      } else {
                        setNewUserUnits([...ORGANIZATIONAL_UNITS]);
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer' }}
                  >
                    {newUserUnits.length === ORGANIZATIONAL_UNITS.length ? 'Deselect All' : 'Select All 8 Units'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto', padding: '0.5rem', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '10px' }}>
                  {ORGANIZATIONAL_UNITS.map((u, i) => {
                    const isChecked = newUserUnits.includes(u);
                    return (
                      <label
                        key={i}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.6rem', background: isChecked ? '#EFF6FF' : '#FFFFFF', border: isChecked ? '1px solid #93C5FD' : '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: isChecked ? '800' : '600', color: isChecked ? '#1E40AF' : '#334155' }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              if (newUserUnits.length > 1) {
                                setNewUserUnits(newUserUnits.filter(x => x !== u));
                              }
                            } else {
                              setNewUserUnits([...newUserUnits, u]);
                            }
                          }}
                          style={{ width: '15px', height: '15px', accentColor: '#2563EB' }}
                        />
                        <span>🏛️ {u}</span>
                      </label>
                    );
                  })}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.35rem', fontWeight: '600' }}>
                  Selected: <span style={{ color: '#2563EB', fontWeight: '800' }}>{newUserUnits.length} TTD Unit(s)</span> assigned to this auditor.
                </div>
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '0.75rem', background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
              >
                Create Auditor Account →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT ROLE & UNIT ── */}
      {editingUserRole && (
        <div className="modal-admin-overlay" onClick={() => setEditingUserRole(null)}>
          <div className="modal-admin-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-admin-header">
              <div className="modal-admin-title">✏️ Edit Role & Unit Assignment</div>
              <button className="modal-close-btn" onClick={() => setEditingUserRole(null)}>✕</button>
            </div>
            <div className="modal-admin-body">
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B' }}>AUDITOR</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0F172A' }}>{editingUserRole.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#2563EB' }}>{editingUserRole.email}</div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.35rem' }}>DESIGNATION ROLE</label>
                <select
                  value={editingUserRole.roleTitle || AUDITOR_ROLES[0]}
                  onChange={e => setEditingUserRole({ ...editingUserRole, roleTitle: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                >
                  {AUDITOR_ROLES.map((r, i) => (
                    <option key={i} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.35rem' }}>ASSIGNED TTD UNIT</label>
                <select
                  value={editingUserRole.unit || ORGANIZATIONAL_UNITS[0]}
                  onChange={e => setEditingUserRole({ ...editingUserRole, unit: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                >
                  {ORGANIZATIONAL_UNITS.map((u, i) => (
                    <option key={i} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  setUsersDb(prev => prev.map(u => u.id === editingUserRole.id ? editingUserRole : u));
                  setEditingUserRole(null);
                }}
                style={{ width: '100%', padding: '0.75rem', background: '#059669', color: '#FFFFFF', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
              >
                Save Assignment Updates
              </button>

              {editingUserRole.role !== 'SUPER_ADMIN' && editingUserRole.email !== 'admin' && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(editingUserRole)}
                    style={{ width: '100%', padding: '0.75rem', background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FCA5A5', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    🗑️ Remove the Auditor Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SUPER ADMIN PROFILE & LOGIN/LOGOUT SESSION LEDGER ── */}
      {showAdminProfileModal && (
        <div className="modal-admin-overlay" onClick={() => setShowAdminProfileModal(false)}>
          <div className="modal-admin-card" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-admin-header" style={{ background: '#0F172A', color: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '16px 16px 0 0' }}>
              <div className="modal-admin-title" style={{ color: '#FFFFFF' }}>
                🔑 Super Admin Profile & Session Ledger
              </div>
              <button className="modal-close-btn" style={{ color: '#94A3B8' }} onClick={() => setShowAdminProfileModal(false)}>✕</button>
            </div>

            <div className="modal-admin-body" style={{ padding: '1.25rem' }}>
              {/* Profile Card Header */}
              <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', color: '#FFFFFF', padding: '1.25rem', borderRadius: '14px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ background: '#2563EB', color: '#FFFFFF', fontSize: '0.68rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    SUPER ADMINISTRATOR
                  </span>
                  <h3 style={{ margin: '0.3rem 0 0.1rem', fontSize: '1.2rem', fontWeight: '900', color: '#FFFFFF' }}>{currentUser.name}</h3>
                  <div style={{ fontSize: '0.8rem', color: '#93C5FD', fontWeight: '700' }}>🎓 Reg No: {currentUser.studentRegNo || 'FCA108920'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.2rem' }}>📧 Email: {currentUser.email} | 🏛️ Unit: {currentUser.unit}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', background: '#059669', color: '#FFFFFF', padding: '0.25rem 0.65rem', borderRadius: '8px', fontWeight: '800' }}>
                    🟢 ACTIVE SESSION
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#34D399', marginTop: '0.4rem', fontWeight: '700' }}>
                    Server Verified (Anti-Tamper)
                  </div>
                </div>
              </div>

              {/* Captured GPS Location Block */}
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    📍 Captured Login GPS Location Coordinates
                  </span>
                  {adminLocation && (
                    <a
                      href={adminLocation.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: '#2563EB', color: '#FFFFFF', padding: '0.25rem 0.7rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '800', textDecoration: 'none' }}
                    >
                      🌐 View on Google Maps ↗
                    </a>
                  )}
                </div>

                {adminLocation ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #DBEAFE' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: '700' }}>LATITUDE</div>
                      <div style={{ fontSize: '0.9rem', color: '#1E3A8A', fontWeight: '900' }}>{adminLocation.lat}° N</div>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #DBEAFE' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: '700' }}>LONGITUDE</div>
                      <div style={{ fontSize: '0.9rem', color: '#1E3A8A', fontWeight: '900' }}>{adminLocation.lng}° E</div>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #DBEAFE' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: '700' }}>ACCURACY / SENSOR</div>
                      <div style={{ fontSize: '0.9rem', color: '#059669', fontWeight: '900' }}>±{adminLocation.accuracy}m (Hardware)</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Location not captured yet. Click "📍 Enable & Capture GPS Location" on login.
                  </div>
                )}
              </div>

              {/* Login & Logout History Table */}
              <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0F172A', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ⏱️ Super Admin Session History & Login/Logout Timestamps
              </h4>

              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                <table className="master-10-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Session Date</th>
                      <th>Login Time</th>
                      <th>Logout Time</th>
                      <th>Duration</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="field-pill-number">1</span></td>
                      <td style={{ fontWeight: '700' }}>Today ({new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})</td>
                      <td><span style={{ color: '#2563EB', fontWeight: '800', background: '#EFF6FF', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>⏱️ 09:00:00 AM</span></td>
                      <td><span style={{ color: '#059669', fontWeight: '800', background: '#ECFDF5', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>Session Active (Logged In)</span></td>
                      <td style={{ fontWeight: '700', color: '#475569' }}>Active</td>
                      <td><span className="status-badge-pill completed">VERIFIED</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

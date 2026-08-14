import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'db.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 5001;
const BCRYPT_ROUNDS = 12;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ── Fixed Demo Super Admin Accounts ──
// These are intentionally hardcoded because this deployment is for demonstration only.
// Do not use hardcoded credentials when this application is moved to real production data.
const DEMO_SUPER_ADMINS = [
  {
    id: 'usr-1',
    name: 'Super Administrator 1',
    email: 'admin1@cabuddy.com',
    password: 'Admin@1234',
    studentRegNo: 'ADMIN001',
    phone: '+91 90000 00001'
  },
  {
    id: 'usr-super-2',
    name: 'Super Administrator 2',
    email: 'admin2@cabuddy.com',
    password: 'Admin@5678',
    studentRegNo: 'ADMIN002',
    phone: '+91 90000 00002'
  }
];

function sanitizeUser(user) {
  if (!user) return null;

  const { password: _password, ...safeUser } = user;
  return safeUser;
}

function isBcryptHash(value) {
  return (
    typeof value === 'string' &&
    /^\$2[aby]\$\d{2}\$/.test(value)
  );
}

async function verifyStoredPassword(plainPassword, storedPassword) {
  if (
    typeof plainPassword !== 'string' ||
    !plainPassword ||
    typeof storedPassword !== 'string' ||
    !storedPassword
  ) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(plainPassword, storedPassword);
  }

  // Compatibility with older demo accounts that still contain plaintext passwords.
  return plainPassword === storedPassword;
}

async function bootstrapSuperAdmins(conn) {
  const joinedDate = '14-Aug-2026';

  for (const admin of DEMO_SUPER_ADMINS) {
    const passwordHash = await bcrypt.hash(
      admin.password,
      BCRYPT_ROUNDS
    );

    await conn.query(
      `
      INSERT INTO users (
        id,
        name,
        email,
        password,
        role,
        roleTitle,
        studentRegNo,
        phone,
        unit,
        subUnit,
        joinedDate,
        managedBy
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        'SUPER_ADMIN',
        'Super Administrator',
        ?,
        ?,
        'All Enterprise Units',
        'Central Administration',
        ?,
        NULL
      )
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        password = VALUES(password),
        role = 'SUPER_ADMIN',
        roleTitle = 'Super Administrator',
        studentRegNo = VALUES(studentRegNo),
        phone = VALUES(phone),
        unit = 'All Enterprise Units',
        subUnit = 'Central Administration',
        joinedDate = VALUES(joinedDate),
        managedBy = NULL
      `,
      [
        admin.id,
        admin.name,
        admin.email,
        passwordHash,
        admin.studentRegNo,
        admin.phone,
        joinedDate
      ]
    );
  }

  console.log('✅ Two fixed demo Super Admin accounts configured.');
}

// ── The 8 Official Units ──
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

// Helper: Format Server-Authoritative Timestamps
function getServerTimeDetails() {
  const now = new Date();

  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const isoStr = now.toISOString();

  return {
    timeStr,
    dateStr,
    isoStr,
    fullTimeframe: `${timeStr} (UTC+5:30) • ${dateStr}`
  };
}

// ── MySQL Connection Pool ──
let pool = null;
let useMySql = false;
let authBootstrapReady = false;

async function initializeMySqlTables() {
  if (!pool) return;

  let conn = null;
  authBootstrapReady = false;

  try {
    conn = await pool.getConnection();

    console.log(
      '🔄 Checking database tables and running initialization...'
    );

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        roleTitle VARCHAR(100),
        studentRegNo VARCHAR(100),
        phone VARCHAR(50),
        unit VARCHAR(255),
        subUnit VARCHAR(255),
        joinedDate VARCHAR(50),
        managedBy VARCHAR(50)
      )
      ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50) NOT NULL,
        userName VARCHAR(255) NOT NULL,
        userEmail VARCHAR(255) NOT NULL,
        managerId VARCHAR(50),
        roleTitle VARCHAR(100),
        unit VARCHAR(255),
        loginTime VARCHAR(50),
        logoutTime VARCHAR(50),
        date VARCHAR(50),
        timeWindow VARCHAR(100),
        duration VARCHAR(50),
        active BOOLEAN DEFAULT TRUE,
        serverVerified BOOLEAN DEFAULT TRUE,
        serverUtcIso VARCHAR(100),
        serverLogoutIso VARCHAR(100),
        managerRemarks TEXT,
        loginLocation TEXT,
        logoutLocation TEXT
      )
      ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id VARCHAR(50) PRIMARY KEY,
        fullName VARCHAR(255) NOT NULL,
        studentRegNo VARCHAR(100) NOT NULL,
        unitDetails VARCHAR(255),
        studentPhone VARCHAR(50),
        dutyAssignedDate VARCHAR(50),
        dutyTimePeriod VARCHAR(50),
        reportVerificationTime VARCHAR(50),
        auditWorkType VARCHAR(255),
        workObjective TEXT,
        vouchersVerified VARCHAR(50),
        caRemarks TEXT,
        status VARCHAR(100),
        createdAt VARCHAR(100),
        studentEmail VARCHAR(255)
      )
      ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(50),
        category VARCHAR(100),
        project VARCHAR(255),
        assignedTo VARCHAR(255),
        dueDate VARCHAR(50),
        status VARCHAR(50)
      )
      ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS moms (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        date VARCHAR(50),
        time VARCHAR(50),
        organizer VARCHAR(255),
        location VARCHAR(255),
        attendees TEXT,
        agenda TEXT,
        discussions TEXT,
        actionItems TEXT,
        nextMeeting TEXT
      )
      ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4;
    `);

    await bootstrapSuperAdmins(conn);

    authBootstrapReady = true;

    console.log(
      '✅ MySQL database initialization complete.'
    );
  } catch (err) {
    authBootstrapReady = false;

    console.error(
      '❌ MySQL initialization error:',
      err.message
    );
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

if (process.env.DB_NAME && process.env.DB_USER) {
  try {
    const dbName = process.env.DB_NAME.trim();
    const dbUser = process.env.DB_USER.trim();
    const dbHost = (process.env.DB_HOST || 'localhost').trim();
    const dbPass = (process.env.DB_PASSWORD || '').trim();

    pool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPass,
      database: dbName,
      port: process.env.DB_PORT
        ? Number(process.env.DB_PORT)
        : 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    pool
      .getConnection()
      .then(async conn => {
        console.log(
          `✅ Connected to cPanel MySQL Database: ${process.env.DB_NAME}`
        );

        useMySql = true;

        conn.release();

        await initializeMySqlTables();
      })
      .catch(err => {
        console.warn(
          `⚠️ MySQL Connection note: ${err.message}`
        );

        useMySql = false;
      });
  } catch (err) {
    console.warn(
      `⚠️ MySQL pool initialization note: ${err.message}`
    );

    useMySql = false;
  }
}

// ── Resilient JSON File Fallback ──
const DEFAULT_DB = {
  users: [
    {
      id: 'usr-1',
      name: 'Super Administrator 1',
      email: 'admin1@cabuddy.com',
      password: 'Admin@1234',
      role: 'SUPER_ADMIN',
      roleTitle: 'Super Administrator',
      studentRegNo: 'ADMIN001',
      phone: '+91 90000 00001',
      unit: 'All Enterprise Units',
      subUnit: 'Central Administration',
      joinedDate: '14-Aug-2026',
      managedBy: null
    },
    {
      id: 'usr-super-2',
      name: 'Super Administrator 2',
      email: 'admin2@cabuddy.com',
      password: 'Admin@5678',
      role: 'SUPER_ADMIN',
      roleTitle: 'Super Administrator',
      studentRegNo: 'ADMIN002',
      phone: '+91 90000 00002',
      unit: 'All Enterprise Units',
      subUnit: 'Central Administration',
      joinedDate: '14-Aug-2026',
      managedBy: null
    },
    {
      id: 'usr-2',
      name: 'Suresh N., Audit Manager',
      email: 'manager@eluc',
      password: '1234567',
      role: 'MANAGER',
      roleTitle: 'Department Audit Manager',
      studentRegNo: 'ACA219842',
      phone: '+91 94401 54321',
      unit: 'Auctions',
      subUnit: 'Auctions Admin Wing & Counter #1',
      joinedDate: '15-Mar-2024',
      managedBy: 'usr-1'
    },
    {
      id: 'usr-3',
      name: 'Ravi Teja, Field Auditor',
      email: 'auditor@eluc',
      password: '1234567',
      role: 'USER',
      roleTitle: 'Field Auditor',
      studentRegNo: 'SRO0682194',
      phone: '+91 91234 56780',
      unit: 'Procurement [Marketing Department]',
      subUnit: 'Marketing Procurement Cell & Tenders Desk',
      joinedDate: '10-Aug-2025',
      managedBy: 'usr-2'
    },
    {
      id: 'usr-4',
      name: 'Priya Sharma, ACA',
      email: 'priya@eluc',
      password: '1234567',
      role: 'USER',
      roleTitle: 'Junior Auditor',
      studentRegNo: 'SRO0741295',
      phone: '+91 98765 43210',
      unit: 'Auctions',
      subUnit: 'Counter No. 4 Daily Token Drawer',
      joinedDate: '01-Nov-2025',
      managedBy: 'usr-2'
    },
    {
      id: 'usr-5',
      name: 'Ananya Rao, Field Staff',
      email: 'ananya@eluc',
      password: '1234567',
      role: 'USER',
      roleTitle: 'Compliance Officer',
      studentRegNo: 'SRO0892341',
      phone: '+91 99887 76655',
      unit: 'Kalyanakatta',
      subUnit: 'Kalyanakatta Hall No. 3 Counter Desk',
      joinedDate: '15-Dec-2025',
      managedBy: 'usr-1'
    },
    {
      id: 'usr-6',
      name: 'Vikram Mehta, Auditor',
      email: 'vikram@eluc',
      password: '1234567',
      role: 'USER',
      roleTitle: 'Field Auditor',
      studentRegNo: 'CRO0123456',
      phone: '+91 97654 32109',
      unit: 'Warehousing [Marketing Department]',
      subUnit: 'Warehousing Cold Storage Thermograph Desk',
      joinedDate: '01-Feb-2026',
      managedBy: 'usr-1'
    }
  ],

  attendance: [
    {
      id: 'log-1',
      userId: 'usr-3',
      userName: 'Ravi Teja, Field Auditor',
      userEmail: 'auditor@eluc',
      managerId: 'usr-2',
      roleTitle: 'Field Auditor',
      unit: 'Auctions',
      loginTime: '09:02:14 AM',
      logoutTime: null,
      date: '12-Aug-2026',
      timeWindow: '09:02 AM - Active',
      duration: '4h 45m',
      active: true,
      serverVerified: true,
      managerRemarks: 'Verified on-site token inventory.'
    },
    {
      id: 'log-2',
      userId: 'usr-4',
      userName: 'Priya Sharma, ACA',
      userEmail: 'priya@eluc',
      managerId: 'usr-2',
      roleTitle: 'Junior Auditor',
      unit: 'Auctions',
      loginTime: '08:45:00 AM',
      logoutTime: '04:30:00 PM',
      date: '12-Aug-2026',
      timeWindow: '08:45 AM - 04:30 PM',
      duration: '7h 45m',
      active: false,
      serverVerified: true,
      managerRemarks: 'Audit physical tokens matched voucher book.'
    },
    {
      id: 'log-3',
      userId: 'usr-5',
      userName: 'Ananya Rao, Field Staff',
      userEmail: 'ananya@eluc',
      managerId: 'usr-1',
      roleTitle: 'Compliance Officer',
      unit: 'Kalyanakatta',
      loginTime: '09:15:30 AM',
      logoutTime: null,
      date: '12-Aug-2026',
      timeWindow: '09:15 AM - Active',
      duration: '4h 32m',
      active: true,
      serverVerified: true,
      managerRemarks: 'Routine queue compliance verified.'
    },
    {
      id: 'log-4',
      userId: 'usr-6',
      userName: 'Vikram Mehta, Auditor',
      userEmail: 'vikram@eluc',
      managerId: 'usr-1',
      roleTitle: 'Field Auditor',
      unit: 'Warehousing [Marketing Department]',
      loginTime: '08:30:00 AM',
      logoutTime: '05:00:00 PM',
      date: '12-Aug-2026',
      timeWindow: '08:30 AM - 05:00 PM',
      duration: '8h 30m',
      active: false,
      serverVerified: true,
      managerRemarks: 'Completed stock ledger reconciliation.'
    },
    {
      id: 'log-5',
      userId: 'usr-2',
      userName: 'Suresh N., Audit Manager',
      userEmail: 'manager@eluc',
      managerId: 'usr-1',
      roleTitle: 'Department Audit Manager',
      unit: 'Auctions',
      loginTime: '08:50:00 AM',
      logoutTime: null,
      date: '12-Aug-2026',
      timeWindow: '08:50 AM - Active',
      duration: '4h 55m',
      active: true,
      serverVerified: true,
      managerRemarks: 'Manager shift active.'
    }
  ],

  assignments: [
    {
      id: 'asn-1',
      assignedToId: 'usr-3',
      assignedToName: 'Ravi Teja, Field Auditor',
      managerId: 'usr-2',
      managerName: 'Suresh N., Audit Manager',
      unit: 'Auctions',
      taskTitle: 'Concurrent Physical Bid Token Audit',
      instructions:
        'Cross-check day-end auction sheet against cash counter collection ledger and upload token report PDF.',
      deadline: 'Today, 05:00 PM',
      status: 'IN_PROGRESS'
    },
    {
      id: 'asn-2',
      assignedToId: 'usr-4',
      assignedToName: 'Priya Sharma, ACA',
      managerId: 'usr-2',
      managerName: 'Suresh N., Audit Manager',
      unit: 'Auctions',
      taskTitle: 'Voucher Book & E-Token Verification',
      instructions:
        'Upload scanned voucher summary PDF or photo with day collection total.',
      deadline: 'Today, 04:30 PM',
      status: 'COMPLETED'
    }
  ],

  complaints: [
    {
      id: 'CMP-2026-0812-001',
      unit: 'Auctions',
      title: 'Cash Collection & Token Reconciliation',
      category: 'Cash Collection & Token Reconciliation',
      urgency: 'HIGH',
      remarks:
        'Scanned voucher sheets show 3 extra tokens unrecorded in the electronic terminal.',
      fileName: 'token_discrepancy_evidence.pdf',
      fileType: 'application/pdf',
      fileSize: '412 KB',
      fileData: null,
      sampleFileUrl:
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      auditorId: 'usr-3',
      auditorName: 'Ravi Teja, Field Auditor',
      managerId: 'usr-2',
      managerName: 'Suresh N., Audit Manager',
      date: '12-Aug-2026',
      timeFrame: '09:02:00 AM - 10:15:00 AM (UTC+5:30)',
      serverTimestamp: '10:15:00 AM • 12-Aug-2026',
      status: 'UNDER_REVIEW',
      robotVerified: true
    },
    {
      id: 'CMP-2026-0812-002',
      unit: 'Procurement [Marketing Department]',
      title: 'Tender Compliance & Vendor Billing Irregularity',
      category: 'Tender Compliance & Vendor Billing Irregularity',
      urgency: 'CRITICAL',
      remarks:
        'Photographic evidence attached showing broken paper seal on bidder envelope #12.',
      fileName: 'seal_breach_photo.png',
      fileType: 'image/png',
      fileSize: '1.2 MB',
      fileData: null,
      sampleFileUrl:
        'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80',
      auditorId: 'usr-7',
      auditorName: 'Kiran Reddy, Lead Auditor',
      managerId: 'usr-1',
      managerName: 'Executive Admin',
      date: '12-Aug-2026',
      timeFrame: '09:30:00 AM - 11:45:00 AM (UTC+5:30)',
      serverTimestamp: '11:45:00 AM • 12-Aug-2026',
      status: 'ESCALATED',
      robotVerified: true
    },
    {
      id: 'CMP-2026-0812-003',
      unit: 'Annaprasadam Trust and Canteens TML & TPT',
      title: 'Others (Manual Specification)',
      category: 'Others (Manual Specification)',
      urgency: 'HIGH',
      remarks:
        'Digital thermograph report attached verifying +8°C temperature lag over 3 hours.',
      fileName: 'temperature_log_sheet.pdf',
      fileType: 'application/pdf',
      fileSize: '298 KB',
      fileData: null,
      sampleFileUrl:
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      auditorId: 'usr-9',
      auditorName: 'Manoj Varma, Inspector',
      managerId: 'usr-1',
      managerName: 'Canteen Directorate',
      date: '12-Aug-2026',
      timeFrame: '07:30:00 AM - 09:45:00 AM (UTC+5:30)',
      serverTimestamp: '09:45:00 AM • 12-Aug-2026',
      status: 'RESOLVED',
      robotVerified: true
    }
  ]
};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(
        fs.readFileSync(DB_FILE, 'utf8')
      );
    }
  } catch (err) {
    console.error(
      'Error reading db.json:',
      err
    );
  }

  return DEFAULT_DB;
}

function saveDb(data) {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(data, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error(
      'Error saving db.json:',
      err
    );
  }
}

// ======================================================
// AUTH LOGIN
// ======================================================

app.post('/api/auth/login', async (req, res) => {
  const { email, password, location } = req.body || {};

  const input = String(email || '').trim().toLowerCase();
  const pass = String(password || '');

  const { timeStr, dateStr, isoStr } = getServerTimeDetails();

  const demoAdmins = [
    {
      id: 'usr-1',
      name: 'Super Administrator 1',
      email: 'admin1@cabuddy.com',
      password: 'Admin@1234',
      role: 'SUPER_ADMIN',
      roleTitle: 'Super Administrator',
      studentRegNo: 'ADMIN001',
      phone: '+91 90000 00001',
      unit: 'All Enterprise Units',
      subUnit: 'Central Administration',
      joinedDate: '14-Aug-2026',
      managedBy: null
    },
    {
      id: 'usr-super-2',
      name: 'Super Administrator 2',
      email: 'admin2@cabuddy.com',
      password: 'Admin@5678',
      role: 'SUPER_ADMIN',
      roleTitle: 'Super Administrator',
      studentRegNo: 'ADMIN002',
      phone: '+91 90000 00002',
      unit: 'All Enterprise Units',
      subUnit: 'Central Administration',
      joinedDate: '14-Aug-2026',
      managedBy: null
    }
  ];

  const user = demoAdmins.find(
    admin =>
      admin.email.toLowerCase() === input &&
      admin.password === pass
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const { password: _password, ...safeUser } = user;

  const activeLog = {
    id: `log-${Date.now()}`,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    managerId: null,
    roleTitle: user.roleTitle,
    unit: user.unit,
    loginTime: timeStr,
    logoutTime: null,
    date: dateStr,
    timeWindow: `${timeStr} - Active`,
    duration: 'Session Active',
    active: true,
    serverVerified: true,
    serverUtcIso: isoStr,
    managerRemarks: 'Demo Super Admin session active.',
    loginLocation: location || null
  };

  return res.json({
    success: true,
    user: safeUser,
    serverTimestamp: timeStr,
    serverDate: dateStr,
    activeLog
  });
});

// ======================================================
// LOGOUT
// ======================================================

app.post(
  '/api/auth/logout',
  async (req, res) => {
    const {
      userId,
      fullName,
      studentRegNo,
      unitDetails,
      subUnitDetails,
      auditWorkType,
      workObjective,
      eodAchievement,
      keyEscalations,
      detailedWork,
      logoutRemarks,
      location
    } = req.body;

    const {
      timeStr,
      dateStr,
      isoStr
    } = getServerTimeDetails();

    if (useMySql && pool) {
      try {
        const [uRows] =
          await pool.query(
            'SELECT * FROM users WHERE id = ?',
            [userId]
          );

        const user = uRows[0];

        const targetRegNo =
          studentRegNo ||
          (
            user
              ? user.studentRegNo
              : ''
          );

        await pool.query(
          `
          UPDATE daily_reports
          SET
            fullName = COALESCE(?, fullName),
            unitDetails = COALESCE(?, unitDetails),
            subUnitDetails = COALESCE(?, subUnitDetails),
            auditWorkType = COALESCE(?, auditWorkType),
            workObjective = COALESCE(?, workObjective),
            eodAchievement = COALESCE(?, eodAchievement),
            keyEscalations = COALESCE(?, keyEscalations),
            detailedWork = COALESCE(?, detailedWork),
            logoutRemarks = COALESCE(?, logoutRemarks),
            status = 'COMPLETED & VERIFIED',
            logoutTime = ?
          WHERE
            studentRegNo = ?
            AND (
              logoutTime IS NULL
              OR dutyAssignedDate = ?
            )
          `,
          [
            fullName,
            unitDetails,
            subUnitDetails,
            auditWorkType,
            workObjective,
            eodAchievement,
            keyEscalations,
            detailedWork,
            logoutRemarks,
            timeStr,
            targetRegNo,
            dateStr
          ]
        );

        const [attUpdateResult] =
          await pool.query(
            `
            UPDATE attendance
            SET
              active = 0,
              logoutTime = ?,
              timeWindow =
                CONCAT(loginTime, ' - ', ?),
              duration = 'Session Completed',
              serverLogoutIso = ?,
              managerRemarks = ?,
              logoutLocation = ?
            WHERE
              userId = ?
              AND active = 1
            `,
            [
              timeStr,
              timeStr,
              isoStr,
              logoutRemarks ||
                'Logged out by user action.',
              location
                ? JSON.stringify(location)
                : null,
              userId
            ]
          );

        if (
          attUpdateResult.affectedRows === 0
        ) {
          const activeLog = {
            id: `log-${Date.now()}`,
            userId,

            userName:
              fullName ||
              user?.name ||
              'Staff User',

            userEmail:
              user?.email || '',

            managerId:
              user?.managedBy || null,

            roleTitle:
              user?.roleTitle || 'Staff',

            unit:
              unitDetails ||
              user?.unit ||
              ORGANIZATIONAL_UNITS[0],

            loginTime: '09:00:00 AM',
            logoutTime: timeStr,
            date: dateStr,
            timeWindow:
              `09:00 AM - ${timeStr}`,
            duration: 'Session Closed',
            active: 0,
            serverVerified: 1,

            managerRemarks:
              logoutRemarks ||
              'Logged out by user action.',

            logoutLocation:
              location
                ? JSON.stringify(location)
                : null
          };

          await pool.query(
            `
            INSERT INTO attendance (
              id,
              userId,
              userName,
              userEmail,
              managerId,
              roleTitle,
              unit,
              loginTime,
              logoutTime,
              date,
              timeWindow,
              duration,
              active,
              serverVerified,
              managerRemarks,
              logoutLocation
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              0, 1, ?, ?
            )
            `,
            [
              activeLog.id,
              activeLog.userId,
              activeLog.userName,
              activeLog.userEmail,
              activeLog.managerId,
              activeLog.roleTitle,
              activeLog.unit,
              activeLog.loginTime,
              activeLog.logoutTime,
              activeLog.date,
              activeLog.timeWindow,
              activeLog.duration,
              activeLog.managerRemarks,
              activeLog.logoutLocation
            ]
          );
        }

        const [allReports] =
          await pool.query(
            'SELECT * FROM daily_reports ORDER BY id DESC'
          );

        const [allAttendance] =
          await pool.query(
            'SELECT * FROM attendance ORDER BY id DESC'
          );

        const formattedAttendance =
          allAttendance.map(att => {
            try {
              if (att.loginLocation) {
                att.loginLocation =
                  JSON.parse(
                    att.loginLocation
                  );
              }

              if (att.logoutLocation) {
                att.logoutLocation =
                  JSON.parse(
                    att.logoutLocation
                  );
              }
            } catch {
              // Ignore malformed old location values
            }

            return att;
          });

        return res.json({
          success: true,
          serverLogoutTime: timeStr,
          serverDate: dateStr,
          reports: allReports,
          attendance:
            formattedAttendance,
          message:
            `Session securely closed and exit timestamp recorded on server at ${timeStr}`
        });
      } catch (dbErr) {
        console.warn(
          'MySQL Logout fail (falling back to JSON):',
          dbErr.message
        );
      }
    }

    const db = loadDb();

    if (userId) {
      if (!db.dailyReports) {
        db.dailyReports = [];
      }

      let reportFound = false;

      const targetReg =
        studentRegNo ||
        db.users.find(
          u => u.id === userId
        )?.studentRegNo;

      db.dailyReports =
        db.dailyReports.map(rep => {
          if (
            (
              rep.userId === userId ||
              (
                targetReg &&
                rep.studentRegNo ===
                  targetReg
              )
            ) &&
            (
              !rep.logoutTime ||
              rep.date === dateStr ||
              rep.dutyAssignedDate ===
                dateStr
            )
          ) {
            reportFound = true;

            return {
              ...rep,

              fullName:
                fullName ||
                rep.fullName,

              studentRegNo:
                targetReg ||
                rep.studentRegNo ||
                '0001',

              unitDetails:
                unitDetails ||
                rep.unitDetails,

              subUnitDetails:
                subUnitDetails ||
                rep.subUnitDetails ||
                '',

              auditWorkType:
                auditWorkType ||
                rep.auditWorkType,

              workObjective:
                workObjective ||
                rep.workObjective,

              eodAchievement:
                eodAchievement ||
                rep.eodAchievement ||
                rep.targetToAchieve ||
                '',

              keyEscalations:
                keyEscalations ||
                rep.keyEscalations ||
                '',

              detailedWork:
                detailedWork ||
                rep.detailedWork ||
                '',

              logoutRemarks:
                logoutRemarks ||
                rep.logoutRemarks ||
                '',

              logoutTime:
                timeStr,

              status:
                'COMPLETED & VERIFIED',

              concludedAt:
                isoStr
            };
          }

          return rep;
        });

      if (!reportFound) {
        const user =
          db.users.find(
            u => u.id === userId
          );

        const userAtt =
          (db.attendance || []).find(
            a =>
              a.userId === userId &&
              a.active
          );

        db.dailyReports.unshift({
          id: `dr-${Date.now()}`,
          userId,

          loginTime:
            userAtt
              ? userAtt.loginTime
              : '09:00:00 AM',

          fullName:
            fullName ||
            user?.name ||
            'Audit Staff',

          studentRegNo:
            targetReg ||
            user?.studentRegNo ||
            '0001',

          unitDetails:
            unitDetails ||
            user?.unit ||
            ORGANIZATIONAL_UNITS[0],

          subUnitDetails:
            subUnitDetails ||
            user?.subUnit ||
            'General Unit Counter',

          auditWorkType:
            auditWorkType ||
            'Monthly Internal Audit',

          workObjective:
            workObjective ||
            'Daily audit duty & physical verification',

          eodAchievement:
            eodAchievement ||
            'Work achieved by end of day',

          keyEscalations:
            keyEscalations || '',

          detailedWork:
            detailedWork || '',

          logoutRemarks:
            logoutRemarks ||
            'Standard evening shift conclusion',

          logoutTime:
            timeStr,

          status:
            'COMPLETED & VERIFIED',

          date:
            dateStr,

          dutyAssignedDate:
            dateStr,

          timestamp:
            timeStr,

          concludedAt:
            isoStr
        });
      }

      let attFound = false;

      db.attendance =
        (db.attendance || []).map(
          rec => {
            if (
              rec.userId === userId &&
              rec.active
            ) {
              attFound = true;

              return {
                ...rec,
                active: false,
                logoutTime:
                  timeStr,
                timeWindow:
                  `${rec.loginTime} - ${timeStr}`,
                duration:
                  'Session Completed',
                serverLogoutIso:
                  isoStr,
                managerRemarks:
                  logoutRemarks ||
                  rec.managerRemarks ||
                  'Logged out by user action.',
                logoutLocation:
                  location || null
              };
            }

            return rec;
          }
        );

      if (!attFound) {
        const user =
          db.users.find(
            u => u.id === userId
          );

        db.attendance.unshift({
          id: `log-${Date.now()}`,
          userId,

          userName:
            user?.name ||
            'Staff User',

          userEmail:
            user?.email || '',

          managerId:
            user?.managedBy ||
            null,

          roleTitle:
            user?.roleTitle ||
            'Staff',

          unit:
            user?.unit ||
            ORGANIZATIONAL_UNITS[0],

          loginTime:
            '09:00:00 AM',

          logoutTime:
            timeStr,

          date:
            dateStr,

          timeWindow:
            `09:00 AM - ${timeStr}`,

          duration:
            'Session Closed',

          active:
            false,

          serverVerified:
            true,

          managerRemarks:
            logoutRemarks ||
            'Logged out by user action.'
        });
      }

      saveDb(db);
    }

    return res.json({
      success: true,
      serverLogoutTime: timeStr,
      serverDate: dateStr,
      reports:
        db.dailyReports || [],
      attendance:
        db.attendance || [],
      message:
        `Session securely closed and exit timestamp recorded on server at ${timeStr}`
    });
  }
);

// ======================================================
// ATTENDANCE TOGGLE
// ======================================================

app.post(
  '/api/attendance/toggle',
  async (req, res) => {
    const {
      userId,
      isClockedIn
    } = req.body;

    const {
      timeStr,
      dateStr
    } = getServerTimeDetails();

    const db = loadDb();

    const user =
      db.users.find(
        u => u.id === userId
      );

    if (isClockedIn) {
      db.attendance =
        db.attendance.map(rec => {
          if (
            rec.userId === userId &&
            rec.active
          ) {
            return {
              ...rec,
              active: false,
              logoutTime: timeStr,
              duration:
                'Shift Closed'
            };
          }

          return rec;
        });
    } else {
      db.attendance.unshift({
        id: `log-${Date.now()}`,

        userId:
          userId ||
          'usr-temp',

        userName:
          user?.name ||
          'Field Auditor',

        userEmail:
          user?.email ||
          'auditor@eluc',

        managerId:
          user?.managedBy ||
          'usr-2',

        roleTitle:
          user?.roleTitle ||
          'Auditor',

        unit:
          user?.unit ||
          ORGANIZATIONAL_UNITS[0],

        loginTime:
          timeStr,

        logoutTime:
          null,

        date:
          dateStr,

        timeWindow:
          `${timeStr} - Active`,

        duration:
          '0h 01m',

        active:
          true,

        serverVerified:
          true,

        managerRemarks:
          'Re-punched shift.'
      });
    }

    saveDb(db);

    return res.json({
      success: true,
      attendance:
        db.attendance,
      timeStr
    });
  }
);

// ======================================================
// GET USERS
// ======================================================

app.get(
  '/api/users',
  async (req, res) => {
    if (useMySql && pool) {
      try {
        const [rows] =
          await pool.query(
            `
            SELECT
              id,
              name,
              email,
              role,
              roleTitle,
              studentRegNo,
              phone,
              unit,
              subUnit,
              joinedDate,
              managedBy
            FROM users
            ORDER BY id DESC
            `
          );

        return res.json({
          success: true,
          users: rows
        });
      } catch (err) {
        console.error(
          'MySQL get users error:',
          err.message
        );

        return res
          .status(500)
          .json({
            success: false,
            message:
              'Unable to load users'
          });
      }
    }

    const db = loadDb();

    return res.json({
      success: true,
      users:
        (db.users || [])
          .map(sanitizeUser)
    });
  }
);

// ======================================================
// CREATE USER
// ======================================================

app.post(
  '/api/users',
  async (req, res) => {
    const {
      name,
      email,
      password,
      roleTitle,
      unit,
      managerId
    } = req.body || {};

    const cleanName =
      String(name || '').trim();

    const emailClean =
      String(email || '')
        .trim()
        .toLowerCase();

    const cleanPassword =
      String(password || '');

    const cleanRoleTitle =
      String(
        roleTitle ||
        'Field Auditor'
      ).trim();

    const {
      dateStr
    } = getServerTimeDetails();

    if (
      !cleanName ||
      !emailClean ||
      !emailClean.includes('@')
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Valid name and email are required'
      });
    }

    if (
      cleanPassword.length < 10
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Password must be at least 10 characters'
      });
    }

    if (
      /super/i.test(
        cleanRoleTitle
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Super Admin accounts are fixed demo accounts configured in server.js'
      });
    }

    const role =
      /manager/i.test(
        cleanRoleTitle
      )
        ? 'MANAGER'
        : 'USER';

    const newId =
      `usr-${Date.now()}`;

    const passwordHash =
      await bcrypt.hash(
        cleanPassword,
        BCRYPT_ROUNDS
      );

    if (useMySql && pool) {
      try {
        await pool.query(
          `
          INSERT INTO users (
            id,
            name,
            email,
            password,
            role,
            roleTitle,
            unit,
            managedBy,
            joinedDate
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
          `,
          [
            newId,
            cleanName,
            emailClean,
            passwordHash,
            role,
            cleanRoleTitle,
            unit ||
              ORGANIZATIONAL_UNITS[0],
            managerId ||
              'usr-1',
            dateStr
          ]
        );

        const [allUsers] =
          await pool.query(
            `
            SELECT
              id,
              name,
              email,
              role,
              roleTitle,
              studentRegNo,
              phone,
              unit,
              subUnit,
              joinedDate,
              managedBy
            FROM users
            ORDER BY id DESC
            `
          );

        return res
          .status(201)
          .json({
            success: true,

            user: {
              id: newId,
              name: cleanName,
              email: emailClean,
              role,
              roleTitle:
                cleanRoleTitle,
              unit:
                unit ||
                ORGANIZATIONAL_UNITS[0],
              managedBy:
                managerId ||
                'usr-1'
            },

            users:
              allUsers
          });
      } catch (err) {
        console.error(
          'MySQL create user error:',
          err.message
        );

        if (
          err?.code ===
          'ER_DUP_ENTRY'
        ) {
          return res
            .status(409)
            .json({
              success: false,
              message:
                'A user with that email already exists'
            });
        }

        return res
          .status(500)
          .json({
            success: false,
            message:
              IS_PRODUCTION
                ? 'Unable to create user'
                : err.message
          });
      }
    }

    if (IS_PRODUCTION) {
      return res
        .status(503)
        .json({
          success: false,
          message:
            'Database is unavailable'
        });
    }

    const db = loadDb();

    const exists =
      (db.users || []).some(
        u =>
          String(
            u.email || ''
          ).toLowerCase() ===
          emailClean
      );

    if (exists) {
      return res
        .status(409)
        .json({
          success: false,
          message:
            'A user with that email already exists'
        });
    }

    const newUser = {
      id: newId,
      name: cleanName,
      email: emailClean,
      password: passwordHash,
      role,
      roleTitle:
        cleanRoleTitle,
      unit:
        unit ||
        ORGANIZATIONAL_UNITS[0],
      managedBy:
        managerId ||
        'usr-1',
      joinedDate:
        dateStr
    };

    db.users.unshift(
      newUser
    );

    saveDb(db);

    return res
      .status(201)
      .json({
        success: true,
        user:
          sanitizeUser(
            newUser
          ),
        users:
          db.users.map(
            sanitizeUser
          )
      });
  }
);

// ======================================================
// UPDATE USER ROLE
// ======================================================

app.patch(
  '/api/users/:id/role',
  async (req, res) => {
    const { id } = req.params;

    const {
      roleTitle,
      unit
    } = req.body;

    if (useMySql && pool) {
      try {
        await pool.query(
          `
          UPDATE users
          SET
            roleTitle = ?,
            unit = ?
          WHERE id = ?
          `,
          [
            roleTitle,
            unit,
            id
          ]
        );

        await pool.query(
          `
          UPDATE attendance
          SET
            roleTitle = ?,
            unit = ?
          WHERE userId = ?
          `,
          [
            roleTitle,
            unit,
            id
          ]
        );

        return res.json({
          success: true
        });
      } catch (err) {
        console.warn(
          'MySQL role update fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    db.users =
      db.users.map(u => {
        if (u.id === id) {
          return {
            ...u,
            roleTitle:
              roleTitle ||
              u.roleTitle,
            unit:
              unit ||
              u.unit
          };
        }

        return u;
      });

    db.attendance =
      db.attendance.map(a => {
        if (a.userId === id) {
          return {
            ...a,
            roleTitle:
              roleTitle ||
              a.roleTitle,
            unit:
              unit ||
              a.unit
          };
        }

        return a;
      });

    saveDb(db);

    return res.json({
      success: true,
      users: db.users,
      attendance:
        db.attendance
    });
  }
);

// ======================================================
// ATTENDANCE LIST
// ======================================================

app.get(
  '/api/attendance',
  async (req, res) => {
    const {
      role,
      managerId
    } = req.query;

    if (useMySql && pool) {
      try {
        let query =
          'SELECT * FROM attendance ORDER BY id DESC';

        let params = [];

        if (
          role === 'MANAGER' &&
          managerId
        ) {
          query =
            'SELECT * FROM attendance WHERE managerId = ? ORDER BY id DESC';

          params = [
            managerId
          ];
        }

        const [rows] =
          await pool.query(
            query,
            params
          );

        const formatted =
          rows.map(r => {
            let loginLoc = null;
            let logoutLoc = null;

            try {
              if (r.loginLocation) {
                loginLoc =
                  JSON.parse(
                    r.loginLocation
                  );
              }

              if (r.logoutLocation) {
                logoutLoc =
                  JSON.parse(
                    r.logoutLocation
                  );
              }
            } catch {
              // old malformed data
            }

            return {
              id: r.id,
              userId: r.userId,
              userName:
                r.userName,
              userEmail:
                r.userEmail,
              managerId:
                r.managerId,
              roleTitle:
                r.roleTitle,
              unit: r.unit,
              loginTime:
                r.loginTime,
              logoutTime:
                r.logoutTime,
              date: r.date,
              timeWindow:
                r.timeWindow,
              duration:
                r.duration,
              active:
                Boolean(
                  r.active
                ),
              serverVerified:
                Boolean(
                  r.serverVerified
                ),
              managerRemarks:
                r.managerRemarks,
              loginLocation:
                loginLoc,
              logoutLocation:
                logoutLoc
            };
          });

        return res.json({
          success: true,
          attendance:
            formatted
        });
      } catch (err) {
        console.warn(
          'MySQL attendance get fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    let records =
      db.attendance;

    if (
      role === 'MANAGER' &&
      managerId
    ) {
      records =
        db.attendance.filter(
          r =>
            r.managerId ===
            managerId
        );
    }

    return res.json({
      success: true,
      attendance:
        records
    });
  }
);

// ======================================================
// MANAGER REMARKS
// ======================================================

app.patch(
  '/api/attendance/:id/remark',
  async (req, res) => {
    const { id } = req.params;

    const {
      remarks
    } = req.body;

    if (useMySql && pool) {
      try {
        await pool.query(
          `
          UPDATE attendance
          SET managerRemarks = ?
          WHERE id = ?
          `,
          [
            remarks,
            id
          ]
        );

        return res.json({
          success: true
        });
      } catch (err) {
        console.warn(
          'MySQL remark update fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    db.attendance =
      db.attendance.map(
        item => {
          if (
            item.id === id
          ) {
            return {
              ...item,
              managerRemarks:
                remarks
            };
          }

          return item;
        }
      );

    saveDb(db);

    return res.json({
      success: true,
      attendance:
        db.attendance
    });
  }
);

// ======================================================
// ASSIGNMENTS
// ======================================================

app.get(
  '/api/assignments',
  (req, res) => {
    const {
      userId,
      managerId
    } = req.query;

    const db = loadDb();

    let results =
      db.assignments || [];

    if (userId) {
      results =
        results.filter(
          a =>
            a.assignedToId ===
            userId
        );
    }

    if (managerId) {
      results =
        results.filter(
          a =>
            a.managerId ===
            managerId
        );
    }

    return res.json({
      success: true,
      assignments:
        results
    });
  }
);

app.post(
  '/api/assignments',
  (req, res) => {
    const {
      assignedToId,
      managerId,
      unit,
      taskTitle,
      instructions,
      deadline
    } = req.body;

    const db = loadDb();

    const targetUser =
      db.users.find(
        u =>
          u.id ===
          assignedToId
      );

    const manager =
      db.users.find(
        u =>
          u.id ===
          managerId
      );

    const newAssignment = {
      id:
        `asn-${Date.now()}`,

      assignedToId,

      assignedToName:
        targetUser
          ? targetUser.name
          : 'Field Auditor',

      managerId,

      managerName:
        manager
          ? manager.name
          : 'Department Manager',

      unit,

      taskTitle,

      instructions:
        instructions ||
        'Complete full physical verification and upload evidence document.',

      deadline:
        deadline ||
        'Today, 05:30 PM',

      status:
        'ASSIGNED'
    };

    if (!db.assignments) {
      db.assignments = [];
    }

    db.assignments.unshift(
      newAssignment
    );

    saveDb(db);

    return res.json({
      success: true,
      assignment:
        newAssignment,
      assignments:
        db.assignments
    });
  }
);

// ======================================================
// COMPLAINT UPLOAD
// ======================================================

app.post(
  '/api/complaints/upload',
  async (req, res) => {
    const {
      unit,
      title,
      category,
      urgency,
      remarks,
      fileName,
      fileType,
      fileSize,
      fileData,
      auditorId,
      auditorName
    } = req.body;

    const db = loadDb();

    const {
      timeStr,
      dateStr,
      fullTimeframe
    } = getServerTimeDetails();

    const user =
      db.users.find(
        u =>
          u.id ===
          auditorId
      );

    const manager =
      db.users.find(
        u =>
          u.id ===
          (
            user?.managedBy ||
            'usr-2'
          )
      );

    const newId =
      `CMP-2026-0812-00${(db.complaints?.length || 0) + 1}`;

    const sampleUrl =
      fileType?.includes(
        'image'
      )
        ? 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80'
        : 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

    if (useMySql && pool) {
      try {
        await pool.query(
          `
          INSERT INTO complaints (
            id,
            unit,
            title,
            category,
            urgency,
            remarks,
            file_name,
            file_type,
            file_size,
            file_data,
            sample_file_url,
            auditor_id,
            auditor_name,
            manager_id,
            manager_name,
            date_str,
            time_frame,
            server_timestamp,
            status,
            robot_verified
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            'SUBMITTED',
            1
          )
          `,
          [
            newId,

            unit ||
            user?.unit ||
            ORGANIZATIONAL_UNITS[0],

            title ||
            'Field Observation',

            category ||
            'Sub-Risk',

            urgency ||
            'MEDIUM',

            remarks,

            fileName ||
            'document.pdf',

            fileType ||
            'application/pdf',

            fileSize ||
            '250 KB',

            fileData ||
            null,

            sampleUrl,

            auditorId ||
            'usr-3',

            auditorName ||
            'Field Auditor',

            user?.managedBy ||
            'usr-2',

            manager?.name ||
            'Department Audit Manager',

            dateStr,

            fullTimeframe,

            `${timeStr} • ${dateStr}`
          ]
        );
      } catch (err) {
        console.warn(
          'MySQL complaint insert fallback:',
          err.message
        );
      }
    }

    const newComplaint = {
      id: newId,

      unit:
        unit ||
        user?.unit ||
        ORGANIZATIONAL_UNITS[0],

      title:
        title ||
        'Field Observation',

      category:
        category ||
        'Audit Discrepancy',

      urgency:
        urgency ||
        'MEDIUM',

      remarks:
        remarks ||
        'Evidence document submitted for management review.',

      fileName:
        fileName ||
        'document.pdf',

      fileType:
        fileType ||
        'application/pdf',

      fileSize:
        fileSize ||
        '150 KB',

      fileData:
        fileData ||
        null,

      sampleFileUrl:
        sampleUrl,

      auditorId:
        auditorId ||
        'usr-3',

      auditorName:
        auditorName ||
        user?.name ||
        'Field Auditor',

      managerId:
        user?.managedBy ||
        'usr-2',

      managerName:
        manager?.name ||
        'Department Audit Manager',

      date:
        dateStr,

      timeFrame:
        fullTimeframe,

      serverTimestamp:
        `${timeStr} • ${dateStr}`,

      status:
        'SUBMITTED',

      robotVerified:
        true
    };

    if (!db.complaints) {
      db.complaints = [];
    }

    db.complaints.unshift(
      newComplaint
    );

    saveDb(db);

    return res.json({
      success: true,
      message:
        'Complaint & File verified by Robot Backend Vault',
      complaint:
        newComplaint,
      complaints:
        db.complaints,
      receiptToken:
        `RB-VAULT-CERT-${Date.now()
          .toString(36)
          .toUpperCase()}`
    });
  }
);

// ======================================================
// GET COMPLAINTS
// ======================================================

app.get(
  '/api/complaints',
  async (req, res) => {
    const {
      role,
      managerId,
      unit
    } = req.query;

    if (useMySql && pool) {
      try {
        let query =
          'SELECT * FROM complaints WHERE 1=1';

        const params = [];

        if (
          role === 'MANAGER' &&
          managerId
        ) {
          query +=
            ' AND manager_id = ?';

          params.push(
            managerId
          );
        }

        if (
          unit &&
          unit !== 'ALL'
        ) {
          query +=
            ' AND unit = ?';

          params.push(unit);
        }

        query +=
          ' ORDER BY created_at DESC';

        const [rows] =
          await pool.query(
            query,
            params
          );

        const formatted =
          rows.map(r => ({
            id:
              r.id,

            unit:
              r.unit,

            title:
              r.title,

            category:
              r.category,

            urgency:
              r.urgency,

            remarks:
              r.remarks,

            fileName:
              r.file_name,

            fileType:
              r.file_type,

            fileSize:
              r.file_size,

            fileData:
              r.file_data,

            sampleFileUrl:
              r.sample_file_url,

            auditorId:
              r.auditor_id,

            auditorName:
              r.auditor_name,

            managerId:
              r.manager_id,

            managerName:
              r.manager_name,

            date:
              r.date_str,

            timeFrame:
              r.time_frame,

            serverTimestamp:
              r.server_timestamp,

            status:
              r.status,

            robotVerified:
              Boolean(
                r.robot_verified
              )
          }));

        return res.json({
          success: true,
          complaints:
            formatted
        });
      } catch (err) {
        console.warn(
          'MySQL get complaints fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    let results =
      db.complaints || [];

    if (
      role === 'MANAGER' &&
      managerId
    ) {
      results =
        results.filter(
          c =>
            c.managerId ===
            managerId
        );
    }

    if (
      unit &&
      unit !== 'ALL'
    ) {
      results =
        results.filter(
          c =>
            c.unit === unit
        );
    }

    return res.json({
      success: true,
      complaints:
        results
    });
  }
);

// ======================================================
// UPDATE COMPLAINT STATUS
// ======================================================

app.patch(
  '/api/complaints/:id/status',
  async (req, res) => {
    const { id } = req.params;

    const {
      status
    } = req.body;

    if (useMySql && pool) {
      try {
        await pool.query(
          `
          UPDATE complaints
          SET status = ?
          WHERE id = ?
          `,
          [
            status,
            id
          ]
        );
      } catch (err) {
        console.warn(
          'MySQL status update fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    db.complaints =
      (db.complaints || [])
        .map(c => {
          if (c.id === id) {
            return {
              ...c,
              status
            };
          }

          return c;
        });

    saveDb(db);

    return res.json({
      success: true,
      complaint:
        db.complaints.find(
          c => c.id === id
        )
    });
  }
);

// ======================================================
// DAILY REPORTS
// ======================================================

app.get(
  '/api/daily-reports',
  async (req, res) => {
    if (useMySql && pool) {
      try {
        const [rows] =
          await pool.query(
            'SELECT * FROM daily_reports ORDER BY id DESC'
          );

        return res.json({
          success: true,
          reports: rows
        });
      } catch (err) {
        console.warn(
          'MySQL get reports fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    return res.json({
      success: true,
      reports:
        db.dailyReports || []
    });
  }
);

app.post(
  '/api/daily-reports',
  async (req, res) => {
    const {
      userId,
      loginTime,
      fullName,
      studentRegNo,
      unitDetails,
      studentPhone,
      dutyAssignedDate,
      dutyTimePeriod,
      reportVerificationTime,
      auditWorkType,
      workObjective,
      vouchersVerified,
      caRemarks,
      status
    } = req.body;

    const {
      timeStr,
      dateStr
    } = getServerTimeDetails();

    const targetDate =
      dutyAssignedDate ||
      dateStr;

    if (useMySql && pool) {
      try {
        const [rows] =
          await pool.query(
            `
            SELECT *
            FROM daily_reports
            WHERE
              studentRegNo = ?
              AND dutyAssignedDate = ?
            `,
            [
              studentRegNo,
              targetDate
            ]
          );

        let targetReport;

        if (rows.length > 0) {
          targetReport =
            rows[0];

          await pool.query(
            `
            UPDATE daily_reports
            SET
              fullName = ?,
              unitDetails = ?,
              studentPhone = ?,
              dutyTimePeriod = ?,
              reportVerificationTime = ?,
              auditWorkType = ?,
              workObjective = ?,
              vouchersVerified = ?,
              caRemarks = ?,
              status = ?
            WHERE id = ?
            `,
            [
              fullName ||
              targetReport.fullName,

              unitDetails ||
              targetReport.unitDetails,

              studentPhone ||
              targetReport.studentPhone,

              dutyTimePeriod ||
              targetReport.dutyTimePeriod,

              reportVerificationTime ||
              targetReport.reportVerificationTime,

              auditWorkType ||
              targetReport.auditWorkType,

              workObjective ||
              targetReport.workObjective,

              vouchersVerified ||
              targetReport.vouchersVerified,

              caRemarks !== undefined
                ? caRemarks
                : targetReport.caRemarks,

              status ||
              targetReport.status,

              targetReport.id
            ]
          );
        } else {
          const newId =
            `dr-${Date.now()}`;

          await pool.query(
            `
            INSERT INTO daily_reports (
              id,
              fullName,
              studentRegNo,
              unitDetails,
              studentPhone,
              dutyAssignedDate,
              dutyTimePeriod,
              reportVerificationTime,
              auditWorkType,
              workObjective,
              vouchersVerified,
              caRemarks,
              status,
              createdAt,
              studentEmail
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            `,
            [
              newId,

              fullName ||
              'Audit Student',

              studentRegNo ||
              '',

              unitDetails ||
              ORGANIZATIONAL_UNITS[0],

              studentPhone ||
              '',

              targetDate,

              dutyTimePeriod ||
              timeStr,

              reportVerificationTime ||
              '',

              auditWorkType ||
              'Monthly Internal Audit',

              workObjective ||
              '',

              vouchersVerified ||
              '0',

              caRemarks ||
              '',

              status ||
              'SUBMITTED',

              new Date().toISOString(),

              ''
            ]
          );
        }

        const [allReports] =
          await pool.query(
            'SELECT * FROM daily_reports ORDER BY id DESC'
          );

        return res.json({
          success: true,
          reports:
            allReports
        });
      } catch (err) {
        console.warn(
          'MySQL post report fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    if (!db.dailyReports) {
      db.dailyReports = [];
    }

    const existingIndex =
      db.dailyReports.findIndex(
        r =>
          (
            userId &&
            r.userId === userId &&
            r.date === dateStr
          ) ||
          (
            studentRegNo &&
            r.studentRegNo ===
              studentRegNo &&
            r.date === dateStr
          )
      );

    let targetReport;

    if (
      existingIndex >= 0
    ) {
      db.dailyReports[
        existingIndex
      ] = {
        ...db.dailyReports[
          existingIndex
        ],

        loginTime:
          db.dailyReports[
            existingIndex
          ].loginTime ||
          loginTime ||
          timeStr,

        fullName:
          fullName ||
          db.dailyReports[
            existingIndex
          ].fullName,

        studentRegNo:
          studentRegNo ||
          db.dailyReports[
            existingIndex
          ].studentRegNo,

        unitDetails:
          unitDetails ||
          db.dailyReports[
            existingIndex
          ].unitDetails,

        studentPhone:
          studentPhone ||
          db.dailyReports[
            existingIndex
          ].studentPhone ||
          '',

        dutyAssignedDate:
          targetDate,

        auditWorkType:
          auditWorkType ||
          db.dailyReports[
            existingIndex
          ].auditWorkType,

        workObjective:
          workObjective ||
          db.dailyReports[
            existingIndex
          ].workObjective,

        vouchersVerified:
          vouchersVerified ||
          db.dailyReports[
            existingIndex
          ].vouchersVerified,

        caRemarks:
          caRemarks !== undefined
            ? caRemarks
            : db.dailyReports[
                existingIndex
              ].caRemarks,

        status:
          status ||
          'ACTIVE_DUTY',

        updatedAt:
          new Date().toISOString()
      };

      targetReport =
        db.dailyReports[
          existingIndex
        ];
    } else {
      targetReport = {
        id:
          `dr-${Date.now()}`,

        userId:
          userId || null,

        loginTime:
          loginTime ||
          timeStr,

        fullName:
          fullName ||
          'Audit Student',

        studentRegNo:
          studentRegNo ||
          '',

        unitDetails:
          unitDetails ||
          ORGANIZATIONAL_UNITS[0],

        studentPhone:
          studentPhone ||
          '',

        dutyAssignedDate:
          targetDate,

        auditWorkType:
          auditWorkType ||
          'Monthly Internal Audit',

        workObjective:
          workObjective ||
          '',

        vouchersVerified:
          vouchersVerified ||
          '0',

        caRemarks:
          caRemarks ||
          '',

        status:
          status ||
          'SUBMITTED',

        date:
          dateStr,

        createdAt:
          new Date().toISOString()
      };

      db.dailyReports.unshift(
        targetReport
      );
    }

    saveDb(db);

    return res.json({
      success: true,
      report:
        targetReport,
      reports:
        db.dailyReports
    });
  }
);

// ======================================================
// SERVER TIME
// ======================================================

app.get(
  '/api/server-time',
  (req, res) => {
    const timeData =
      getServerTimeDetails();

    return res.json({
      success: true,
      ...timeData
    });
  }
);

// ======================================================
// MINUTES OF MEETING
// ======================================================

app.get(
  '/api/moms',
  async (req, res) => {
    if (useMySql && pool) {
      try {
        const [rows] =
          await pool.query(
            'SELECT * FROM moms ORDER BY id DESC'
          );

        const formatted =
          rows.map(r => ({
            id:
              r.id,
            title:
              r.title,
            type:
              r.type,
            date:
              r.date,
            time:
              r.time,
            organizer:
              r.organizer,
            location:
              r.location,
            attendees:
              r.attendees,
            agenda:
              r.agenda,
            discussions:
              r.discussions,
            actionItems:
              r.actionItems,
            nextMeeting:
              r.nextMeeting
          }));

        return res.json({
          success: true,
          moms:
            formatted
        });
      } catch (err) {
        console.warn(
          'MySQL get moms fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    return res.json({
      success: true,
      moms:
        db.moms || []
    });
  }
);

app.post(
  '/api/moms',
  async (req, res) => {
    const {
      meetingTitle,
      meetingType,
      date,
      time,
      organizer,
      location,
      attendees,
      agenda,
      discussions,
      actionItems,
      nextMeeting
    } = req.body;

    const {
      timeStr,
      dateStr
    } = getServerTimeDetails();

    if (useMySql && pool) {
      try {
        const newId =
          `mom-${Date.now()}`;

        await pool.query(
          `
          INSERT INTO moms (
            id,
            title,
            type,
            date,
            time,
            organizer,
            location,
            attendees,
            agenda,
            discussions,
            actionItems,
            nextMeeting
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
          `,
          [
            newId,

            meetingTitle ||
            'Weekly Team Meeting',

            meetingType ||
            'Team Meeting',

            date ||
            dateStr,

            time ||
            timeStr,

            organizer ||
            'Demo Managing Partner',

            location ||
            'Conference Room A',

            attendees ||
            '',

            agenda ||
            '',

            discussions ||
            '',

            actionItems ||
            '',

            nextMeeting ||
            ''
          ]
        );

        const [rows] =
          await pool.query(
            'SELECT * FROM moms ORDER BY id DESC'
          );

        const formatted =
          rows.map(r => ({
            id:
              r.id,
            title:
              r.title,
            type:
              r.type,
            date:
              r.date,
            time:
              r.time,
            organizer:
              r.organizer,
            location:
              r.location,
            attendees:
              r.attendees,
            agenda:
              r.agenda,
            discussions:
              r.discussions,
            actionItems:
              r.actionItems,
            nextMeeting:
              r.nextMeeting
          }));

        return res.json({
          success: true,
          moms:
            formatted
        });
      } catch (err) {
        console.warn(
          'MySQL post mom fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    if (!db.moms) {
      db.moms = [];
    }

    const newMom = {
      id:
        `mom-${Date.now()}`,

      meetingTitle:
        meetingTitle ||
        'Weekly Team Meeting',

      meetingType:
        meetingType ||
        'Team Meeting',

      date:
        date ||
        dateStr,

      time:
        time ||
        timeStr,

      organizer:
        organizer ||
        'Demo Managing Partner',

      location:
        location ||
        'Conference Room A',

      attendees:
        attendees ||
        '',

      agenda:
        agenda ||
        '',

      discussions:
        discussions ||
        '',

      actionItems:
        actionItems ||
        '',

      nextMeeting:
        nextMeeting ||
        '',

      serverTimestamp:
        `${timeStr} • ${dateStr}`,

      createdAt:
        new Date().toISOString()
    };

    db.moms.unshift(
      newMom
    );

    saveDb(db);

    return res.json({
      success: true,
      mom:
        newMom,
      moms:
        db.moms
    });
  }
);

// ======================================================
// TASKS
// ======================================================

app.get(
  '/api/tasks',
  async (req, res) => {
    if (useMySql && pool) {
      try {
        const [rows] =
          await pool.query(
            'SELECT * FROM tasks ORDER BY id DESC'
          );

        const formatted =
          rows.map(r => ({
            id:
              r.id,

            title:
              r.title,

            priority:
              r.priority,

            description:
              r.description,

            assignedTo:
              r.assignedTo,

            dueDate:
              r.dueDate,

            project:
              r.project,

            category:
              r.category,

            status:
              r.status
          }));

        return res.json({
          success: true,
          tasks:
            formatted
        });
      } catch (err) {
        console.warn(
          'MySQL get tasks fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    return res.json({
      success: true,
      tasks:
        db.tasks || []
    });
  }
);

app.post(
  '/api/tasks',
  async (req, res) => {
    const {
      taskTitle,
      priority,
      description,
      assignedTo,
      dueDate,
      project,
      category
    } = req.body;

    const {
      timeStr,
      dateStr
    } = getServerTimeDetails();

    if (useMySql && pool) {
      try {
        const newId =
          `tsk-${Date.now()}`;

        await pool.query(
          `
          INSERT INTO tasks (
            id,
            title,
            description,
            priority,
            category,
            project,
            assignedTo,
            dueDate,
            status
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS'
          )
          `,
          [
            newId,

            taskTitle ||
            'Audit Verification Task',

            description ||
            '',

            priority ||
            'Medium Priority',

            category ||
            'General',

            project ||
            '',

            assignedTo ||
            'Demo Managing Partner',

            dueDate ||
            dateStr
          ]
        );

        const [rows] =
          await pool.query(
            'SELECT * FROM tasks ORDER BY id DESC'
          );

        const formatted =
          rows.map(r => ({
            id:
              r.id,

            title:
              r.title,

            priority:
              r.priority,

            description:
              r.description,

            assignedTo:
              r.assignedTo,

            dueDate:
              r.dueDate,

            project:
              r.project,

            category:
              r.category,

            status:
              r.status
          }));

        return res.json({
          success: true,
          tasks:
            formatted
        });
      } catch (err) {
        console.warn(
          'MySQL post task fallback:',
          err.message
        );
      }
    }

    const db = loadDb();

    if (!db.tasks) {
      db.tasks = [];
    }

    const newTask = {
      id:
        `tsk-${Date.now()}`,

      taskTitle:
        taskTitle ||
        'Audit Verification Task',

      priority:
        priority ||
        'Medium Priority',

      description:
        description ||
        '',

      assignedTo:
        assignedTo ||
        'Demo Managing Partner',

      dueDate:
        dueDate ||
        dateStr,

      project:
        project ||
        '',

      category:
        category ||
        'General',

      status:
        'IN_PROGRESS',

      serverTimestamp:
        `${timeStr} • ${dateStr}`,

      createdAt:
        new Date().toISOString()
    };

    db.tasks.unshift(
      newTask
    );

    saveDb(db);

    return res.json({
      success: true,
      task:
        newTask,
      tasks:
        db.tasks
    });
  }
);

// ======================================================
// SERVE FRONTEND
// ======================================================

const distPath =
  path.join(
    __dirname,
    'dist'
  );

if (
  fs.existsSync(
    distPath
  )
) {
  app.use(
    express.static(
      distPath
    )
  );

  app.use(
    (
      req,
      res,
      next
    ) => {
      if (
        req.method === 'GET' &&
        !req.path.startsWith(
          '/api'
        )
      ) {
        return res.sendFile(
          path.join(
            distPath,
            'index.html'
          )
        );
      }

      next();
    }
  );
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Centralized Audit Backend running on port ${PORT}`);
  });
}

export default app;
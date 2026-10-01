import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

interface AttendanceItem {
  id: string;
  regNo: string;
  studentName: string;
  rollNo: string;
  subject: string;
  semester: string;
  timestamp: string;
  rssi: number;
  distance: number;
  biometricVerified: boolean;
  biometricType?: string;
  status: 'Present' | 'Late' | 'Excused' | 'Sick' | 'Absent';
  deviceUUID?: string;
  verifiedAt: string;
}

interface ActiveSession {
  id: string;
  docId: string;
  subject: string;
  semester: string;
  date: string;
  teacherName: string;
  teacherEmail: string;
  beaconUUID: string;
  major: number;
  minor: number;
  txPower: number;
  rssiThreshold: number;
  placement: 'center' | 'blackboard';
  status: 'broadcasting' | 'paused' | 'completed';
  startedAt: string;
  studentsMap: Record<string, AttendanceItem>;
  uploadedToCloud: boolean;
}

const todayStr = new Date().toISOString().split('T')[0];

let activeSession: ActiveSession = {
  id: 'sess-' + Date.now(),
  docId: `${todayStr}_ComputerNetworks_Sem6`,
  subject: 'Computer Networks & BLE',
  semester: 'Semester 6',
  date: todayStr,
  teacherName: 'Prof. Sushil S. Chavhan',
  teacherEmail: 'sushil.chavhan@ycce.edu',
  beaconUUID: 'e2c56db5-dffb-48d2-b060-d0f5a71096e0',
  major: 101,
  minor: 1,
  txPower: -59,
  rssiThreshold: -90,
  placement: 'center',
  status: 'broadcasting',
  startedAt: new Date().toISOString(),
  studentsMap: {
    '2023IT10101': {
      id: 'rec-1',
      regNo: '2023IT10101',
      studentName: 'Ajinkya Ronghe',
      rollNo: 'IT-02',
      subject: 'Computer Networks & BLE',
      semester: 'Semester 6',
      timestamp: new Date(Date.now() - 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      rssi: -77,
      distance: 4.5,
      biometricVerified: true,
      biometricType: 'Capacitive Fingerprint Sensor',
      status: 'Present',
      verifiedAt: new Date(Date.now() - 120000).toISOString(),
    },
    '2023IT10102': {
      id: 'rec-2',
      regNo: '2023IT10102',
      studentName: 'Aniket Pipare',
      rollNo: 'IT-03',
      subject: 'Computer Networks & BLE',
      semester: 'Semester 6',
      timestamp: new Date(Date.now() - 95000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      rssi: -47,
      distance: 0.7,
      biometricVerified: true,
      biometricType: 'Hardware Biometric (TouchID)',
      status: 'Present',
      verifiedAt: new Date(Date.now() - 95000).toISOString(),
    },
    '2023IT10103': {
      id: 'rec-3',
      regNo: '2023IT10103',
      studentName: 'Chetash Turkar',
      rollNo: 'IT-04',
      subject: 'Computer Networks & BLE',
      semester: 'Semester 6',
      timestamp: new Date(Date.now() - 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      rssi: -55,
      distance: 1.0,
      biometricVerified: true,
      biometricType: 'Capacitive Fingerprint Sensor',
      status: 'Present',
      verifiedAt: new Date(Date.now() - 60000).toISOString(),
    },
  },
  uploadedToCloud: false,
};

let historicalSessions: any[] = [];
let sseClients: Response[] = [];

function notifyClients(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch {}
  });
}

app.get('/api/session', (req: Request, res: Response) => {
  const studentsList = Object.values(activeSession.studentsMap);
  res.json({
    ...activeSession,
    studentsQueue: studentsList,
    totalPresent: studentsList.filter((s) => s.status === 'Present').length,
  });
});

app.post('/api/session/start', (req: Request, res: Response) => {
  const { subject, semester, date, placement, rssiThreshold, beaconUUID } = req.body;
  const cleanSubject = (subject || 'Subject').replace(/\s+/g, '');
  const cleanSemester = (semester || 'Sem').replace(/\s+/g, '');
  const sessionDate = date || new Date().toISOString().split('T')[0];
  const docId = `${sessionDate}_${cleanSubject}_${cleanSemester}`;

  activeSession = {
    ...activeSession,
    id: 'sess-' + Date.now(),
    docId,
    subject: subject || activeSession.subject,
    semester: semester || activeSession.semester,
    date: sessionDate,
    placement: placement || activeSession.placement,
    rssiThreshold: typeof rssiThreshold === 'number' ? rssiThreshold : -90,
    beaconUUID: beaconUUID || activeSession.beaconUUID,
    status: 'broadcasting',
    startedAt: new Date().toISOString(),
    studentsMap: {},
    uploadedToCloud: false,
  };

  notifyClients('session_updated', activeSession);
  res.json({ success: true, session: activeSession });
});

app.post('/api/session/toggle-pause', (req: Request, res: Response) => {
  activeSession.status = activeSession.status === 'broadcasting' ? 'paused' : 'broadcasting';
  notifyClients('session_updated', activeSession);
  res.json({ success: true, status: activeSession.status });
});

app.post('/api/session/stop', (req: Request, res: Response) => {
  activeSession.status = 'completed';
  notifyClients('session_updated', activeSession);
  res.json({ success: true, session: activeSession });
});

app.post('/api/attendance/mark', (req: Request, res: Response) => {
  const {
    studentName,
    rollNo,
    regNo,
    subject,
    semester,
    rssi,
    distance,
    biometricVerified,
    biometricType,
    deviceUUID,
  } = req.body;

  if (!regNo || !studentName) {
    return res.status(400).json({ success: false, error: 'Registration number and name are required.' });
  }

  if (activeSession.status !== 'broadcasting') {
    return res.status(403).json({
      success: false,
      error: 'Teacher beacon is currently paused. Attendance disabled.',
    });
  }

  if (!biometricVerified) {
    return res.status(401).json({
      success: false,
      error: 'Biometric fingerprint verification required.',
    });
  }

  const currentThreshold = activeSession.rssiThreshold ?? -90;
  if (typeof rssi === 'number' && rssi < currentThreshold) {
    return res.status(403).json({
      success: false,
      error: `Proximity verification failed: RSSI ${rssi} dBm is below threshold (${currentThreshold} dBm). Signal attenuated by walls or closed doors.`,
      rssi,
      threshold: currentThreshold,
    });
  }

  const existing = activeSession.studentsMap[regNo];
  if (existing) {
    return res.json({
      success: true,
      duplicate: true,
      message: `Attendance already recorded for ${studentName} (${regNo}) at ${existing.timestamp}.`,
      record: existing,
    });
  }

  const record: AttendanceItem = {
    id: 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    regNo,
    studentName,
    rollNo: rollNo || 'N/A',
    subject: subject || activeSession.subject,
    semester: semester || activeSession.semester,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    rssi: rssi ?? -75,
    distance: distance ?? 2.5,
    biometricVerified: true,
    biometricType: biometricType || 'Capacitive Fingerprint Sensor',
    status: 'Present',
    deviceUUID,
    verifiedAt: new Date().toISOString(),
  };

  activeSession.studentsMap[regNo] = record;
  notifyClients('student_marked', record);

  res.json({
    success: true,
    message: 'Attendance successfully marked via BLE GATT write & biometric verification.',
    record,
  });
});

app.put('/api/attendance/update-status', (req: Request, res: Response) => {
  const { regNo, status } = req.body;
  if (!regNo || !status) {
    return res.status(400).json({ success: false, error: 'regNo and status required' });
  }

  if (activeSession.studentsMap[regNo]) {
    activeSession.studentsMap[regNo].status = status;
    notifyClients('student_status_changed', { regNo, status });
    return res.json({ success: true, record: activeSession.studentsMap[regNo] });
  }

  res.status(404).json({ success: false, error: 'Student record not found in active session.' });
});

app.post('/api/attendance/upload-cloud', (req: Request, res: Response) => {
  const studentsList = Object.values(activeSession.studentsMap);
  activeSession.uploadedToCloud = true;

  const historyEntry = {
    docId: activeSession.docId,
    subject: activeSession.subject,
    semester: activeSession.semester,
    date: activeSession.date,
    totalPresent: studentsList.filter((s) => s.status === 'Present').length,
    totalEnrolled: Math.max(30, studentsList.length),
    uploadedAt: new Date().toISOString(),
    records: studentsList,
  };

  historicalSessions.unshift(historyEntry);
  notifyClients('cloud_uploaded', { docId: activeSession.docId, count: studentsList.length });
  res.json({
    success: true,
    docId: activeSession.docId,
    count: studentsList.length,
    message: `Session records saved under ${activeSession.docId}`,
  });
});

app.get('/api/attendance/history', (req: Request, res: Response) => {
  res.json({ sessions: historicalSessions });
});

app.get('/api/attendance/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`event: session_init\ndata: ${JSON.stringify(activeSession)}\n\n`);
  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BeaconCheck server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

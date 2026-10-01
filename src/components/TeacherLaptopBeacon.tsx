import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { AttendanceRecord, AttendanceStatus, BeaconPlacement, SessionConfig } from '../types/attendance';
import { ClassroomRadar } from './ClassroomRadar';
import { PythonScriptModal } from './PythonScriptModal';
import { EmpiricalResearchModal } from './EmpiricalResearchModal';
import { SUBJECTS, SEMESTERS } from '../data/mockData';

interface TeacherLaptopBeaconProps {
  session: SessionConfig;
  onUpdateSession: (updated: Partial<SessionConfig>) => void;
  onStartNewSession: (data: { subject: string; semester: string; date: string; placement: BeaconPlacement; threshold: number }) => void;
  onUploadCloud: () => Promise<void>;
  onUpdateStudentStatus: (regNo: string, status: AttendanceStatus) => void;
  mobileUrl: string;
}

export const TeacherLaptopBeacon: React.FC<TeacherLaptopBeaconProps> = ({
  session,
  onUpdateSession,
  onStartNewSession,
  onUploadCloud,
  onUpdateStudentStatus,
  mobileUrl,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [showResearchModal, setShowResearchModal] = useState<boolean>(false);
  const [showNewSessionModal, setShowNewSessionModal] = useState<boolean>(false);
  const [doorClosed, setDoorClosed] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const [newSubject, setNewSubject] = useState<string>(session.subject || SUBJECTS[0]);
  const [newSemester, setNewSemester] = useState<string>(session.semester || SEMESTERS[3]);
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newPlacement, setNewPlacement] = useState<BeaconPlacement>(session.placement);
  const [newThreshold, setNewThreshold] = useState<number>(session.rssiThreshold);

  const [customSharedUrl, setCustomSharedUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sams_public_url');
      if (saved) return saved;
      // If dev url, default suggest the shared pre-url
      return mobileUrl.replace('ais-dev-', 'ais-pre-');
    }
    return '';
  });
  const [usePublicUrl, setUsePublicUrl] = useState<boolean>(true);

  // Active target URL for QR code
  const effectiveMobileUrl = usePublicUrl && customSharedUrl ? customSharedUrl : mobileUrl;

  useEffect(() => {
    if (effectiveMobileUrl) {
      QRCode.toDataURL(effectiveMobileUrl, {
        width: 320,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Error generating QR code:', err));
    }
  }, [effectiveMobileUrl]);

  const handleUpload = async () => {
    setIsUploading(true);
    setUploadSuccessMsg(null);
    try {
      await onUploadCloud();
      setUploadSuccessMsg(`Saved to Firestore document: ${session.docId}`);
      setTimeout(() => setUploadSuccessMsg(null), 5000);
    } catch {
      // handled
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(mobileUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Registration No', 'Student Name', 'Roll No', 'Subject', 'Semester', 'Timestamp', 'RSSI (dBm)', 'Distance (m)', 'Biometric Verified', 'Status'];
    const rows = session.studentsQueue.map((s) => [
      s.regNo,
      `"${s.studentName}"`,
      s.rollNo,
      `"${s.subject}"`,
      s.semester,
      s.timestamp,
      s.rssi,
      s.distance,
      s.biometricVerified ? 'Yes' : 'No',
      s.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${session.docId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isBroadcasting = session.status === 'broadcasting';

  return (
    <div className="space-y-6">
      {/* Phone + Laptop Pair Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-xl p-5 shadow-sm border border-blue-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded">
                Simultaneous Phone + Laptop Sync
              </span>
              <span className="text-xs text-blue-200">
                Real-Time SSE & Bluetooth Ingestion
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Scan this QR code with your Smartphone camera
            </h2>
            <p className="text-xs text-blue-200 leading-relaxed max-w-xl">
              Keep this tab open on your laptop. Open the scanner on your phone using the QR code or link below. When you tap <strong>&ldquo;Mark Attendance&rdquo;</strong> on your phone, your attendance will instantly stream and appear right here on your laptop screen in real time!
            </p>

            <div className="bg-amber-500/20 border border-amber-400/40 rounded-lg p-2.5 text-xs text-amber-200 space-y-1.5">
              <div className="font-semibold text-amber-100 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Allow Every Email ID to Access:</span>
                </span>
                <span className="text-[10px] text-blue-200">Public Access Setup</span>
              </div>
              <p className="text-[11px] text-amber-100 leading-normal">
                To let <strong>anyone with any email ID (or no login)</strong> scan and mark attendance on their phone:
                <br />
                1. Click the <strong>Share</strong> button at the top-right corner of Google AI Studio.
                <br />
                2. Set permission to <strong>&ldquo;Anyone with the link&rdquo;</strong> and copy that public URL.
                <br />
                3. Paste it below to update this QR code for your classroom.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Paste AI Studio Public Shared App URL here..."
                  value={customSharedUrl}
                  onChange={(e) => {
                    setCustomSharedUrl(e.target.value);
                    localStorage.setItem('sams_public_url', e.target.value);
                  }}
                  className="flex-1 text-[11px] font-mono p-1.5 bg-slate-900 border border-blue-400/40 rounded text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => {
                  if (navigator?.clipboard) {
                    navigator.clipboard.writeText(effectiveMobileUrl);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                {copiedUrl ? 'Copied Link!' : 'Copy QR Target Link'}
              </button>
              <button
                onClick={() => {
                  window.open(effectiveMobileUrl, 'MobileScanner', 'width=412,height=820,left=1000,top=100');
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors border border-white/20 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Phone Window Next to Laptop
              </button>
              <button
                onClick={() => setShowQrModal(true)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors border border-white/20"
              >
                View Fullscreen QR
              </button>
            </div>
          </div>

          {/* Quick inline QR box */}
          <div className="bg-white p-2.5 rounded-xl shadow-md shrink-0 cursor-pointer" onClick={() => setShowQrModal(true)}>
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="Mobile App QR Code" className="w-28 h-28" />
            ) : (
              <div className="w-28 h-28 flex items-center justify-center text-xs text-slate-400">
                Loading QR...
              </div>
            )}
            <span className="text-[10px] font-semibold text-slate-700 block text-center mt-1">
              Scan with Phone
            </span>
          </div>
        </div>
      </div>

      {/* Top Banner: Teacher Beacon Host Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-3 w-3">
                {isBroadcasting && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isBroadcasting ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Laptop BLE Beacon & GATT Server
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500 font-mono">
                {isBroadcasting ? 'Advertising Active (Low Latency)' : 'Advertising Paused'}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {session.subject}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Instructor: {session.teacherName} · {session.semester} · Session Document:{' '}
              <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                {session.docId}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowNewSessionModal(true)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            >
              New Session
            </button>
            <button
              onClick={() => setShowScriptModal(true)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
              Hardware Python Script
            </button>
            <button
              onClick={() => setShowResearchModal(true)}
              className="px-3.5 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Research Paper Data
            </button>
          </div>
        </div>

        {/* Technical Beacon Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-5">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-500 block">Beacon UUID</span>
            <span className="text-xs font-mono text-slate-800 truncate block mt-0.5" title={session.beaconUUID}>
              {session.beaconUUID.slice(0, 13)}...
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-500 block">Major / Minor</span>
            <span className="text-xs font-mono text-slate-800 block mt-0.5">
              {session.major} / {session.minor}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-500 block">Tx Power @ 1m</span>
            <span className="text-xs font-mono text-slate-800 block mt-0.5">
              {session.txPower} dBm
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-500 block">Proximity Gate</span>
            <span className="text-xs font-mono font-semibold text-emerald-700 block mt-0.5">
              RSSI ≥ {session.rssiThreshold} dBm
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-500 block">Beacon Placement</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <select
                value={session.placement}
                onChange={(e) => onUpdateSession({ placement: e.target.value as BeaconPlacement })}
                className="text-xs font-medium text-slate-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
              >
                <option value="center">Center of Room (Recommended)</option>
                <option value="blackboard">Near Blackboard</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200">
            <span className="text-[10px] font-semibold uppercase text-emerald-800 block">Present Students</span>
            <span className="text-sm font-bold font-mono text-emerald-900 block mt-0.5">
              {session.studentsQueue.filter((s) => s.status === 'Present').length} / {Math.max(30, session.studentsQueue.length)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Classroom Radar + Live Student Queue & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Classroom Visual Radar */}
        <div className="lg:col-span-5 space-y-4">
          <ClassroomRadar
            placement={session.placement}
            threshold={session.rssiThreshold}
            doorClosed={doorClosed}
            onToggleDoor={() => setDoorClosed(!doorClosed)}
          />

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              GATT Server & Proximity Controls
            </h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Proximity RSSI Threshold:</span>
                <span className="font-mono font-semibold text-slate-900">{session.rssiThreshold} dBm</span>
              </div>
              <input
                type="range"
                min="-95"
                max="-70"
                step="1"
                value={session.rssiThreshold}
                onChange={(e) => onUpdateSession({ rssiThreshold: Number(e.target.value) })}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>-95 dBm (Permissive)</span>
                <span>-90 dBm (Paper Standard)</span>
                <span>-70 dBm (Strict Front Rows)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-600">Beacon Broadcast State:</span>
              <button
                onClick={() =>
                  onUpdateSession({
                    status: session.status === 'broadcasting' ? 'paused' : 'broadcasting',
                  })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  isBroadcasting
                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {isBroadcasting ? 'Pause Broadcast' : 'Resume Broadcast'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Attendance Records Table */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 mb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Real-Time Attendance Ingestion (Mutable Map)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Indexed uniquely by Student Registration Number · Proxy-Proof Verification
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                title="Download CSV"
              >
                Export CSV
              </button>

              <button
                onClick={handleUpload}
                disabled={isUploading || session.studentsQueue.length === 0}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload to Firestore
                  </>
                )}
              </button>
            </div>
          </div>

          {uploadSuccessMsg && (
            <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{uploadSuccessMsg}</span>
            </div>
          )}

          {/* Table Container */}
          <div className="overflow-x-auto flex-1 min-h-[340px]">
            {session.studentsQueue.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <svg className="w-10 h-10 mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium text-slate-600">Waiting for Student Mobile Scanners...</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Scan the QR code at the top with your phone camera, tap &ldquo;Mark Attendance&rdquo;, and watch your attendance record land here live!
                </p>
                <button
                  onClick={() => setShowQrModal(true)}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Show Mobile App QR Code
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                    <th className="py-2.5 px-3">Reg No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Proximity</th>
                    <th className="py-2.5 px-3">Biometrics</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {session.studentsQueue.map((student) => (
                    <tr key={student.regNo} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-900 font-medium">
                        {student.regNo}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-slate-900 block">{student.studentName}</span>
                        <span className="text-[10px] text-slate-400">Roll: {student.rollNo}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                        {student.timestamp}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              student.rssi >= session.rssiThreshold ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          ></span>
                          <span className="font-mono tabular-nums font-semibold">
                            {student.rssi} dBm
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({student.distance}m)
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 font-medium">
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Verified
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={student.status}
                          onChange={(e) => onUpdateStudentStatus(student.regNo, e.target.value as AttendanceStatus)}
                          className={`text-[11px] font-medium rounded px-2 py-1 border transition-colors cursor-pointer ${
                            student.status === 'Present'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : student.status === 'Late'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : student.status === 'Excused'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-red-50 text-red-800 border-red-200'
                          }`}
                        >
                          <option value="Present">Present</option>
                          <option value="Late">Late</option>
                          <option value="Excused">Excused</option>
                          <option value="Sick">Sick</option>
                          <option value="Absent">Absent</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* QR Code Projector Modal for Phone Users */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-xl overflow-hidden p-6 text-center">
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Scan with Smartphone
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Open your phone camera to launch BeaconCheck Mobile Scanner
            </p>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 inline-block mb-4">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="Student Mobile App QR Code" className="w-56 h-56 mx-auto" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500 mb-4">
              <span className="block font-medium text-slate-700 mb-1">Direct URL for Phone:</span>
              <input
                type="text"
                readOnly
                value={mobileUrl}
                className="w-full text-[11px] font-mono p-2 bg-slate-100 rounded border border-slate-200 text-slate-800 select-all"
              />
              <p className="text-[10px] text-slate-500 mt-2 text-left bg-slate-50 p-2 rounded border border-slate-200">
                <strong>Note:</strong> Make sure your phone&apos;s mobile browser (Chrome recommended) is signed into <strong>parasharvedant60@gmail.com</strong>, otherwise Google returns a 403 error.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {copiedUrl ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="flex-1 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Session Creation Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Start New Attendance Session
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure classroom subject, date, semester, and beacon layout
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onStartNewSession({
                  subject: newSubject,
                  semester: newSemester,
                  date: newDate,
                  placement: newPlacement,
                  threshold: newThreshold,
                });
                setShowNewSessionModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Subject</label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Semester</label>
                <select
                  value={newSemester}
                  onChange={(e) => setNewSemester(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {SEMESTERS.map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Teacher Laptop Placement</label>
                <select
                  value={newPlacement}
                  onChange={(e) => setNewPlacement(e.target.value as BeaconPlacement)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="center">Center of Classroom (Recommended)</option>
                  <option value="blackboard">Near Blackboard / Podium</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  Initialize & Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PythonScriptModal
        session={session}
        isOpen={showScriptModal}
        onClose={() => setShowScriptModal(false)}
      />

      <EmpiricalResearchModal
        isOpen={showResearchModal}
        onClose={() => setShowResearchModal(false)}
      />
    </div>
  );
};

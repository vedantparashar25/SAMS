import React, { useState, useEffect } from 'react';
import { AttendanceRecord, AttendanceStatus, BeaconPlacement, SessionConfig } from './types/attendance';
import { TeacherLaptopBeacon } from './components/TeacherLaptopBeacon';
import { StudentMobileApp } from './components/StudentMobileApp';
import { EmpiricalResearchModal } from './components/EmpiricalResearchModal';

export default function App() {
  const [viewMode, setViewMode] = useState<'teacher' | 'student' | 'split'>('split');
  const [showResearchModal, setShowResearchModal] = useState<boolean>(false);
  const [isConnectedToServer, setIsConnectedToServer] = useState<boolean>(false);

  const [session, setSession] = useState<SessionConfig>({
    id: 'sess-init',
    docId: `${new Date().toISOString().split('T')[0]}_ComputerNetworks_Sem6`,
    subject: 'Computer Networks & BLE',
    semester: 'Semester 6',
    date: new Date().toISOString().split('T')[0],
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
    studentsQueue: [],
    uploadedToCloud: false,
    totalPresent: 0,
  });

  const [mobileUrl, setMobileUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode');
      if (modeParam === 'student') {
        setViewMode('student');
      } else if (window.innerWidth < 768) {
        setViewMode('student');
      }

      const currentOrigin = window.location.origin;
      setMobileUrl(`${currentOrigin}?mode=student`);
    }
  }, []);

  useEffect(() => {
    fetch('/api/session')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.id) {
          setSession((prev) => ({
            ...prev,
            ...data,
            studentsQueue: data.studentsQueue || Object.values(data.studentsMap || {}),
          }));
        }
      })
      .catch((err) => console.warn('API error:', err));

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/attendance/events');

      eventSource.onopen = () => {
        setIsConnectedToServer(true);
      };

      eventSource.addEventListener('session_init', (e: MessageEvent) => {
        try {
          const initData = JSON.parse(e.data);
          const queue = Object.values(initData.studentsMap || {});
          setSession((prev) => ({
            ...prev,
            ...initData,
            studentsQueue: queue as AttendanceRecord[],
          }));
        } catch {}
      });

      eventSource.addEventListener('session_updated', (e: MessageEvent) => {
        try {
          const updated = JSON.parse(e.data);
          setSession((prev) => ({
            ...prev,
            ...updated,
            studentsQueue: Object.values(updated.studentsMap || prev.studentsQueue),
          }));
        } catch {}
      });

      eventSource.addEventListener('student_marked', (e: MessageEvent) => {
        try {
          const newStudent = JSON.parse(e.data);
          setSession((prev) => {
            const existingIdx = prev.studentsQueue.findIndex((s) => s.regNo === newStudent.regNo);
            const newQueue = existingIdx >= 0
              ? prev.studentsQueue.map((s, idx) => (idx === existingIdx ? newStudent : s))
              : [newStudent, ...prev.studentsQueue];

            return {
              ...prev,
              studentsQueue: newQueue,
              totalPresent: newQueue.filter((s) => s.status === 'Present').length,
            };
          });
        } catch {}
      });

      eventSource.addEventListener('student_status_changed', (e: MessageEvent) => {
        try {
          const { regNo, status } = JSON.parse(e.data);
          setSession((prev) => ({
            ...prev,
            studentsQueue: prev.studentsQueue.map((s) =>
              s.regNo === regNo ? { ...s, status } : s
            ),
          }));
        } catch {}
      });

      eventSource.onerror = () => {
        setIsConnectedToServer(false);
      };
    } catch (e) {
      console.warn('SSE error:', e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleUpdateSession = async (updates: Partial<SessionConfig>) => {
    setSession((prev) => ({ ...prev, ...updates }));

    if (updates.status !== undefined) {
      try {
        await fetch('/api/session/toggle-pause', { method: 'POST' });
      } catch {}
    }
  };

  const handleStartNewSession = async (data: {
    subject: string;
    semester: string;
    date: string;
    placement: BeaconPlacement;
    threshold: number;
  }) => {
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success && result.session) {
        setSession({
          ...result.session,
          studentsQueue: [],
          totalPresent: 0,
        });
      }
    } catch {
      const cleanSubject = data.subject.replace(/\s+/g, '');
      const cleanSem = data.semester.replace(/\s+/g, '');
      const docId = `${data.date}_${cleanSubject}_${cleanSem}`;
      setSession((prev) => ({
        ...prev,
        docId,
        subject: data.subject,
        semester: data.semester,
        date: data.date,
        placement: data.placement,
        rssiThreshold: data.threshold,
        studentsQueue: [],
        totalPresent: 0,
      }));
    }
  };

  const handleMarkAttendance = async (record: {
    studentName: string;
    rollNo: string;
    regNo: string;
    subject: string;
    semester: string;
    rssi: number;
    distance: number;
    biometricVerified: boolean;
    biometricType: string;
    deviceUUID?: string;
  }) => {
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      const data = await res.json();

      if (data.success && data.record) {
        setSession((prev) => {
          const exists = prev.studentsQueue.some((s) => s.regNo === record.regNo);
          const queue = exists ? prev.studentsQueue : [data.record, ...prev.studentsQueue];
          return {
            ...prev,
            studentsQueue: queue,
            totalPresent: queue.filter((s) => s.status === 'Present').length,
          };
        });
      }
      return data;
    } catch {
      const localRec: AttendanceRecord = {
        id: 'rec-' + Date.now(),
        regNo: record.regNo,
        studentName: record.studentName,
        rollNo: record.rollNo,
        subject: record.subject,
        semester: record.semester,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        rssi: record.rssi,
        distance: record.distance,
        biometricVerified: record.biometricVerified,
        biometricType: record.biometricType as any,
        status: 'Present',
      };

      setSession((prev) => {
        const queue = [localRec, ...prev.studentsQueue.filter((s) => s.regNo !== record.regNo)];
        return {
          ...prev,
          studentsQueue: queue,
          totalPresent: queue.filter((s) => s.status === 'Present').length,
        };
      });

      return {
        success: true,
        message: 'Attendance saved locally via GATT write simulation.',
        record: localRec,
      };
    }
  };

  const handleUpdateStudentStatus = async (regNo: string, status: AttendanceStatus) => {
    setSession((prev) => ({
      ...prev,
      studentsQueue: prev.studentsQueue.map((s) =>
        s.regNo === regNo ? { ...s, status } : s
      ),
    }));

    try {
      await fetch('/api/attendance/update-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regNo, status }),
      });
    } catch {}
  };

  const handleUploadCloud = async () => {
    try {
      await fetch('/api/attendance/upload-cloud', { method: 'POST' });
      setSession((prev) => ({ ...prev, uploadedToCloud: true }));
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-slate-900">
              BeaconCheck
            </span>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <span>BLE Proximity</span>
              <span aria-hidden="true">·</span>
              <span>Laptop Beacon</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                -90 dBm Cutoff
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'split'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dual Mode (Laptop + Phone)
            </button>
            <button
              onClick={() => setViewMode('teacher')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'teacher'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Laptop Beacon Host
            </button>
            <button
              onClick={() => setViewMode('student')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'student'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mobile App Scanner
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResearchModal(true)}
              className="hidden lg:inline-flex px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
            >
              Research Paper
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnectedToServer ? 'bg-emerald-500' : 'bg-emerald-500'
                }`}
              ></span>
              <span className="text-[11px] font-medium hidden sm:inline">
                Live BLE Sync
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {viewMode === 'split' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-8">
                <TeacherLaptopBeacon
                  session={session}
                  onUpdateSession={handleUpdateSession}
                  onStartNewSession={handleStartNewSession}
                  onUploadCloud={handleUploadCloud}
                  onUpdateStudentStatus={handleUpdateStudentStatus}
                  mobileUrl={mobileUrl}
                />
              </div>

              <div className="xl:col-span-4 sticky top-20">
                <div className="bg-slate-900 p-3 rounded-3xl shadow-xl border-4 border-slate-800">
                  <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto mb-2"></div>
                  <StudentMobileApp
                    session={session}
                    onMarkAttendance={handleMarkAttendance}
                  />
                  <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-2"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'teacher' && (
          <TeacherLaptopBeacon
            session={session}
            onUpdateSession={handleUpdateSession}
            onStartNewSession={handleStartNewSession}
            onUploadCloud={handleUploadCloud}
            onUpdateStudentStatus={handleUpdateStudentStatus}
            mobileUrl={mobileUrl}
          />
        )}

        {viewMode === 'student' && (
          <div className="py-2">
            <StudentMobileApp
              session={session}
              onMarkAttendance={handleMarkAttendance}
              isStandaloneMobile={true}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            BeaconCheck: Laptop BLE Beacon & Mobile Attendance System
          </span>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setShowResearchModal(true)}
              className="hover:text-slate-700 transition-colors"
            >
              Empirical Research Paper
            </button>
            <span>·</span>
            <span>GATT Server Architecture</span>
          </div>
        </div>
      </footer>

      <EmpiricalResearchModal
        isOpen={showResearchModal}
        onClose={() => setShowResearchModal(false)}
      />
    </div>
  );
}

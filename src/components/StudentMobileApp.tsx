import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  AttendanceRecord,
  AttendanceStatus,
  ClassroomPosition,
  SessionConfig,
  Student,
} from '../types/attendance';
import { INITIAL_STUDENTS, CLASSROOM_LAYOUT_POINTS, SUBJECTS } from '../data/mockData';
import {
  authenticateStudentBiometric,
  checkWebBluetoothSupport,
  computeSuccessiveRssiReadings,
  scanRealBluetoothDevice,
} from '../services/bleBeaconService';

interface StudentMobileAppProps {
  session: SessionConfig;
  onMarkAttendance: (record: {
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
  }) => Promise<{ success: boolean; duplicate?: boolean; message?: string; error?: string }>;
  isStandaloneMobile?: boolean;
}

export const StudentMobileApp: React.FC<StudentMobileAppProps> = ({
  session,
  onMarkAttendance,
  isStandaloneMobile = false,
}) => {
  const [activeTab, setActiveTab] = useState<'mark' | 'history'>('mark');

  const [selectedStudent, setSelectedStudent] = useState<Student>(INITIAL_STUDENTS[0]);
  const [isCustomStudent, setIsCustomStudent] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customRegNo, setCustomRegNo] = useState('');
  const [customRollNo, setCustomRollNo] = useState('');

  const [currentPosition, setCurrentPosition] = useState<ClassroomPosition>(
    CLASSROOM_LAYOUT_POINTS[0]
  );
  const [doorClosed, setDoorClosed] = useState<boolean>(true);
  const [deviceVertical, setDeviceVertical] = useState<boolean>(true);

  const [stepState, setStepState] = useState<
    'idle' | 'fingerprint_scan' | 'fingerprint_verified' | 'ble_scan' | 'evaluated' | 'submitting' | 'success' | 'failed'
  >('idle');

  const [biometricMethod, setBiometricMethod] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [rawReadings, setRawReadings] = useState<number[]>([]);
  const [calculatedAvgRssi, setCalculatedAvgRssi] = useState<number>(-75);
  const [estimatedDistance, setEstimatedDistance] = useState<number>(2.5);
  const [proximityPassed, setProximityPassed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [webBleSupport, setWebBleSupport] = useState<{ supported: boolean; reason?: string }>({
    supported: false,
  });

  useEffect(() => {
    setWebBleSupport(checkWebBluetoothSupport());
  }, []);

  useEffect(() => {
    const isInside = currentPosition.actualLocation === 'inside';
    const hasDoor = !isInside && doorClosed;
    const hasWall = !isInside && currentPosition.id === 'outside-wall';

    const baseDist =
      session.placement === 'center'
        ? currentPosition.approxDistanceCenter
        : currentPosition.approxDistanceBlackboard;

    const { rawReadings: readings, avgRssi, estimatedDistance: dist } = computeSuccessiveRssiReadings(
      baseDist,
      hasDoor,
      hasWall,
      deviceVertical
    );

    setRawReadings(readings);
    setCalculatedAvgRssi(avgRssi);
    setEstimatedDistance(dist);
    setProximityPassed(avgRssi >= session.rssiThreshold);
  }, [currentPosition, session.placement, session.rssiThreshold, doorClosed, deviceVertical]);

  const currentStudentName = isCustomStudent ? customName || 'Guest Student' : selectedStudent.name;
  const currentStudentRegNo = isCustomStudent ? customRegNo || '2023IT10109' : selectedStudent.regNo;
  const currentStudentRollNo = isCustomStudent ? customRollNo || 'IT-10' : selectedStudent.rollNo;

  const handleStartAttendance = async () => {
    setErrorMessage(null);
    setStepState('fingerprint_scan');
    setStatusMessage('Place thumb on capacitive fingerprint sensor...');

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }

    try {
      const bioResult = await authenticateStudentBiometric(currentStudentName, currentStudentRegNo);
      setBiometricMethod(bioResult.method);
      setStepState('fingerprint_verified');
      setStatusMessage('Fingerprint Authenticated. Initializing BLE Scanner...');

      setTimeout(() => {
        handleScanBle();
      }, 700);
    } catch (err: any) {
      setStepState('idle');
      setErrorMessage(err.message || 'Biometric authentication failed.');
    }
  };

  const handleScanBle = async () => {
    setStepState('ble_scan');
    setStatusMessage(`Scanning for Teacher BLE Beacon (${session.beaconUUID.slice(0, 8)}...)...`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const isInside = currentPosition.actualLocation === 'inside';
    const hasDoor = !isInside && doorClosed;
    const hasWall = !isInside && currentPosition.id === 'outside-wall';

    const baseDist =
      session.placement === 'center'
        ? currentPosition.approxDistanceCenter
        : currentPosition.approxDistanceBlackboard;

    const { rawReadings: readings, avgRssi, estimatedDistance: dist } = computeSuccessiveRssiReadings(
      baseDist,
      hasDoor,
      hasWall,
      deviceVertical
    );

    setRawReadings(readings);
    setCalculatedAvgRssi(avgRssi);
    setEstimatedDistance(dist);

    const isInsideClassroom = avgRssi >= session.rssiThreshold;
    setProximityPassed(isInsideClassroom);
    setStepState('evaluated');

    if (!isInsideClassroom) {
      setStepState('failed');
      setStatusMessage(
        `Proximity Check Failed: RSSI ${avgRssi} dBm is below the classroom threshold of ${session.rssiThreshold} dBm. Signal is heavily attenuated by walls/door.`
      );
      return;
    }

    setStatusMessage(`Proximity Verified: RSSI ${avgRssi} dBm. Transmitting GATT write request to laptop...`);
    handleSubmitGattPayload(avgRssi, dist);
  };

  const handleRealHardwareScan = async () => {
    try {
      setStatusMessage('Requesting Bluetooth pairing from system...');
      const result = await scanRealBluetoothDevice();
      if (result.success) {
        setStatusMessage(`Connected to Bluetooth device: ${result.deviceName}`);
        handleScanBle();
      } else {
        setErrorMessage(result.error || 'Bluetooth device scan cancelled.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Bluetooth scan error.');
    }
  };

  const handleSubmitGattPayload = async (rssiVal: number, distVal: number) => {
    setStepState('submitting');

    try {
      const response = await onMarkAttendance({
        studentName: currentStudentName,
        rollNo: currentStudentRollNo,
        regNo: currentStudentRegNo,
        subject: session.subject,
        semester: session.semester,
        rssi: rssiVal,
        distance: distVal,
        biometricVerified: true,
        biometricType: biometricMethod || 'Capacitive Fingerprint Sensor',
        deviceUUID: 'dev-' + Math.random().toString(36).slice(2, 9),
      });

      if (response.success) {
        setStepState('success');
        setStatusMessage(
          response.duplicate
            ? response.message || 'Attendance already marked.'
            : 'Attendance marked successfully via Proximity BLE GATT Write!'
        );

        try {
          confetti({
            particleCount: 60,
            spread: 60,
            origin: { y: 0.7 },
          });
        } catch {}
      } else {
        setStepState('failed');
        setErrorMessage(response.error || 'Failed to submit attendance.');
      }
    } catch (err: any) {
      setStepState('failed');
      setErrorMessage(err.message || 'Network error while submitting to teacher GATT server.');
    }
  };

  const handleResetFlow = () => {
    setStepState('idle');
    setErrorMessage(null);
    setStatusMessage('');
  };

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-[580px] rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
      <div className="bg-slate-900 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight block">BeaconCheck Mobile</span>
              <span className="text-[10px] text-slate-400">Student Attendance Scanner</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${
                session.status === 'broadcasting' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            ></span>
            <span className="text-[10px] font-mono text-slate-300">
              {session.status === 'broadcasting' ? 'Beacon Online' : 'Beacon Paused'}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Logged in as:</span>
            <span className="font-semibold text-slate-100">{currentStudentName}</span>
            <span className="text-[11px] text-slate-400 font-mono ml-1.5">({currentStudentRegNo})</span>
          </div>

          <button
            onClick={() => setIsCustomStudent(!isCustomStudent)}
            className="text-[10px] text-blue-400 hover:text-blue-300 underline"
          >
            {isCustomStudent ? 'Choose Preset' : 'Switch Student'}
          </button>
        </div>

        {isCustomStudent ? (
          <div className="mt-3 p-3 bg-slate-800/80 rounded-lg space-y-2 text-xs">
            <input
              type="text"
              placeholder="Student Full Name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Reg No (e.g. 2023IT10109)"
                value={customRegNo}
                onChange={(e) => setCustomRegNo(e.target.value)}
                className="p-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
              />
              <input
                type="text"
                placeholder="Roll No (e.g. IT-10)"
                value={customRollNo}
                onChange={(e) => setCustomRollNo(e.target.value)}
                className="p-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
              />
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <select
              value={selectedStudent.regNo}
              onChange={(e) => {
                const s = INITIAL_STUDENTS.find((st) => st.regNo === e.target.value);
                if (s) setSelectedStudent(s);
              }}
              className="w-full text-xs p-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 cursor-pointer"
            >
              {INITIAL_STUDENTS.map((st) => (
                <option key={st.regNo} value={st.regNo}>
                  {st.name} ({st.rollNo} · {st.regNo})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setActiveTab('mark')}
          className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors ${
            activeTab === 'mark'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Mark Attendance (BLE Scanner)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          View Past Records
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        {activeTab === 'mark' ? (
          <div className="space-y-4">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                Target Broadcast Session
              </span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-sm font-bold text-slate-900">{session.subject}</span>
                <span className="text-xs text-slate-500 font-medium">{session.semester}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Beacon: {session.beaconUUID.slice(0, 8)}...</span>
                <span>Threshold: {session.rssiThreshold} dBm</span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  Student Classroom Position Simulator:
                </span>
                <button
                  onClick={() => setDeviceVertical(!deviceVertical)}
                  className={`text-[10px] px-2 py-0.5 rounded border ${
                    deviceVertical
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  Orientation: {deviceVertical ? 'Vertical' : 'Horizontal'}
                </button>
              </div>

              <select
                value={currentPosition.id}
                onChange={(e) => {
                  const p = CLASSROOM_LAYOUT_POINTS.find((pt) => pt.id === e.target.value);
                  if (p) setCurrentPosition(p);
                }}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800"
              >
                {CLASSROOM_LAYOUT_POINTS.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.label} ({pos.actualLocation === 'inside' ? 'Inside Room' : 'Proxy Zone Outside'})
                  </option>
                ))}
              </select>

              {currentPosition.actualLocation === 'outside' && (
                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-600">Classroom Door Status:</span>
                  <button
                    onClick={() => setDoorClosed(!doorClosed)}
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      doorClosed
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    {doorClosed ? 'Door Closed (High Attenuation)' : 'Door Open'}
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  BLE Signal RSSI Evaluation
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    proximityPassed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {proximityPassed ? 'Inside Classroom Boundary' : 'Blocked / Out of Range'}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-500">Live Averaged RSSI (n=5):</span>
                  <span className="font-bold text-slate-900">{calculatedAvgRssi} dBm</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-300 ${
                      proximityPassed ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.max(5, Math.min(100, ((calculatedAvgRssi + 110) / 70) * 100))}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>-110 dBm (Weak)</span>
                  <span className="text-red-500 font-semibold">Cutoff: {session.rssiThreshold} dBm</span>
                  <span>-40 dBm (Close)</span>
                </div>
              </div>

              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-600">
                <span>Samples (R1–R5):</span>
                <div className="flex gap-1.5 tabular-nums">
                  {rawReadings.map((r, i) => (
                    <span key={i} className="bg-white px-1 py-0.5 rounded border border-slate-200">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-semibold block">Submission Rejected:</span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {statusMessage && !errorMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  stepState === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {stepState === 'submitting' || stepState === 'ble_scan' ? (
                  <svg className="animate-spin w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span>{statusMessage}</span>
              </div>
            )}

            {stepState === 'idle' && (
              <div className="text-center pt-2">
                <button
                  onClick={handleStartAttendance}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9c.55 0 1-.45 1-1 0-2.21 1.79-4 4-4s4 1.79 4 4c0 .55.45 1 1 1s1-.45 1-1c0-3.31-2.69-6-6-6s-6 2.69-6 6c0 .55.45 1 1 1z" />
                  </svg>
                  Scan Fingerprint & Mark Attendance
                </button>
                <p className="text-[11px] text-slate-400 mt-2">
                  Fingerprint authentication + BLE proximity check (RSSI &ge; {session.rssiThreshold} dBm)
                </p>
              </div>
            )}

            {stepState === 'fingerprint_scan' && (
              <div className="p-6 bg-white rounded-xl border-2 border-blue-500 shadow-lg text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600 animate-pulse">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004.07 9m1.536 8.35A9.97 9.97 0 014 12" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-slate-900">Verifying Biometrics...</h4>
                <p className="text-xs text-slate-500">
                  Capacitive signature match for {currentStudentName}
                </p>
              </div>
            )}

            {stepState === 'success' && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">Attendance Confirmed</h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Written to Teacher GATT Server
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-emerald-100 text-left text-xs font-mono space-y-1 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Student:</span>
                    <span className="font-semibold text-slate-900">{currentStudentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reg No:</span>
                    <span>{currentStudentRegNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recorded RSSI:</span>
                    <span className="text-emerald-700 font-semibold">{calculatedAvgRssi} dBm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Biometric:</span>
                    <span className="text-emerald-700">Verified</span>
                  </div>
                </div>

                <button
                  onClick={handleResetFlow}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg"
                >
                  Done / Scan Another Student
                </button>
              </div>
            )}

            {stepState === 'failed' && (
              <button
                onClick={handleResetFlow}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg"
              >
                Try Again
              </button>
            )}

            {webBleSupport.supported && stepState === 'idle' && (
              <div className="pt-2 text-center">
                <button
                  onClick={handleRealHardwareScan}
                  className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Pair with Real Bluetooth Hardware (Web Bluetooth API)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Select Subject:
              </label>
              <select className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white">
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-800">
                  Attendance Statistics
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  92% Present
                </span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 block">Today (Current Session)</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {session.docId}
                    </span>
                  </div>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                    Present
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 block">Previous Class</span>
                    <span className="text-[10px] text-slate-400 font-mono">BLE Beacon Center</span>
                  </div>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                    Present
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400">
          BeaconCheck BLE System · Hardware-Free Proximity
        </div>
      </div>
    </div>
  );
};

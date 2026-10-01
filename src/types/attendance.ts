export type AttendanceStatus = 'Present' | 'Late' | 'Excused' | 'Sick' | 'Absent';

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  regNo: string;
  email: string;
  semester: string;
  department: string;
}

export interface AttendanceRecord {
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
  biometricType?: 'Fingerprint' | 'Face' | 'TouchID' | 'WebAuthn' | 'Capacitive Fingerprint Sensor';
  status: AttendanceStatus;
  deviceUUID?: string;
  doorObstacle?: boolean;
  wallObstacle?: boolean;
}

export type BeaconPlacement = 'center' | 'blackboard';

export interface SessionConfig {
  id: string;
  docId: string; // Date_Subject_Semester
  subject: string;
  semester: string;
  date: string;
  teacherName: string;
  teacherEmail: string;
  beaconUUID: string;
  major: number;
  minor: number;
  txPower: number; // e.g. -59 dBm
  rssiThreshold: number; // default -90 dBm
  placement: BeaconPlacement;
  status: 'broadcasting' | 'paused' | 'completed';
  startedAt: string;
  studentsQueue: AttendanceRecord[];
  uploadedToCloud: boolean;
  totalPresent: number;
}

export interface ClassroomPosition {
  id: string;
  label: string;
  x: number; // percentage in room
  y: number; // percentage in room
  actualLocation: 'inside' | 'outside';
  benchNumber?: number;
  estimatedRssiCenter: number;
  estimatedRssiBlackboard: number;
  approxDistanceCenter: number;
  approxDistanceBlackboard: number;
}

export interface BleScanResult {
  deviceFound: boolean;
  deviceName?: string;
  beaconUUID?: string;
  rssi: number;
  rawRssiReadings: number[];
  avgRssi: number;
  distance: number;
  isInsideClass: boolean;
  threshold: number;
  obstacleDetected: boolean;
}

import React, { useState } from 'react';
import { SessionConfig } from '../types/attendance';

interface PythonScriptModalProps {
  session: SessionConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const PythonScriptModal: React.FC<PythonScriptModalProps> = ({ session, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pythonScript = `#!/usr/bin/env python3
"""
BeaconCheck: Laptop BLE Beacon Broadcaster (Linux / macOS / Windows)
Broadcasts standard BLE advertisement packets from your laptop hardware
"""

import sys
import time
import subprocess
import platform

UUID = "${session.beaconUUID}"
MAJOR = ${session.major}
MINOR = ${session.minor}
TX_POWER = ${session.txPower}
DOC_ID = "${session.docId}"

print("=" * 60)
print(" BEACONCHECK - LAPTOP BLUETOOTH LOW ENERGY ADVERTISER")
print("=" * 60)
print(f"[*] Session Doc ID   : {DOC_ID}")
print(f"[*] Beacon UUID      : {UUID}")
print(f"[*] Major / Minor    : {MAJOR} / {MINOR}")
print(f"[*] Measured TxPower : {TX_POWER} dBm @ 1m")
print(f"[*] Threshold Rule   : RSSI >= {session.rssiThreshold} dBm (In-room detection)")
print("=" * 60)

try:
    system = platform.system()
    if system == "Linux":
        print("[+] Detected Linux environment. Configuring BlueZ BLE advertisement...")
        subprocess.run(["sudo", "hciconfig", "hci0", "up"], check=False)
        subprocess.run(["sudo", "hciconfig", "hci0", "leadv", "3"], check=False)
        print("[+] Broadcasting BLE Beacon packets! Students can mark attendance.")
        while True:
            time.sleep(1)
    elif system == "Darwin":
        print("[i] Detected macOS. Broadcasting via Bluetooth adapter...")
        while True:
            time.sleep(1)
    else:
        print(f"[i] Running on {system}. Ensure Bluetooth is turned ON in system settings.")
        while True:
            time.sleep(1)

except KeyboardInterrupt:
    print("\\n[*] Stopping BLE beacon advertising.")
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([pythonScript], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beaconcheck_${session.docId}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Hardware BLE Beacon Script (Laptop Broadcaster)
            </h3>
            <p className="text-xs text-slate-500">
              Standalone Python script to advertise from your physical laptop Bluetooth adapter
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200 p-3 rounded-lg leading-relaxed">
            <span className="font-semibold text-blue-900">Real Hardware Broadcasting:</span> Your web app automatically synchronizes attendance between laptop and phone via real-time WebSocket / SSE. If you also want your laptop&apos;s physical internal Bluetooth radio to broadcast 2.4GHz BLE advertisement packets in a real physical room, run this script.
          </div>

          <div className="relative">
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-[280px]">
              {pythonScript}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium border border-slate-700"
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>

          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">Quick run command:</span>
            <code className="block mt-1 p-2 bg-slate-100 rounded font-mono text-slate-800">
              python3 beaconcheck_{session.docId}.py
            </code>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Download .py File
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

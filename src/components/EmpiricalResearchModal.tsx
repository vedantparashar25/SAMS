import React from 'react';

interface EmpiricalResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmpiricalResearchModal: React.FC<EmpiricalResearchModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-3xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Proximity BLE Research Foundation & Empirical Validation
            </h3>
            <p className="text-xs text-slate-500">
              Proximity-Based Efficient Attendance Management System Using RSSI and BLE
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

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-1">
              Core Architecture
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Eliminates dedicated hardware beacons by turning the teacher&apos;s laptop into a BLE beacon and GATT server. Student smartphones scan the beacon, verify proximity (RSSI &ge; -90 dBm), authenticate with their fingerprint, and submit attendance via GATT write.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-2">
              1. Signal Attenuation: BLE vs Wi-Fi vs Classic Bluetooth
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2.5 border-b">Technology</th>
                    <th className="p-2.5 border-b">Wall/Door Attenuation</th>
                    <th className="p-2.5 border-b">Corridor Leakage Risk</th>
                    <th className="p-2.5 border-b">In-Room Reliability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-600">
                  <tr>
                    <td className="p-2.5 font-medium text-slate-900">Wi-Fi Fingerprint</td>
                    <td className="p-2.5">Negligible (&lt; 3 dBm)</td>
                    <td className="p-2.5 text-red-600 font-medium">Very High (Penetrates walls)</td>
                    <td className="p-2.5">Poor boundary control</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-slate-900">Classic Bluetooth</td>
                    <td className="p-2.5">Slight (~4 dBm)</td>
                    <td className="p-2.5 text-amber-600 font-medium">High (Overlaps corridors)</td>
                    <td className="p-2.5">Inconclusive</td>
                  </tr>
                  <tr className="bg-blue-50/50">
                    <td className="p-2.5 font-semibold text-blue-900">BLE (BeaconCheck)</td>
                    <td className="p-2.5 text-blue-900 font-medium">Significant (14 to 20 dBm drop)</td>
                    <td className="p-2.5 text-emerald-600 font-semibold">None (Strict wall cutoff)</td>
                    <td className="p-2.5 text-blue-900 font-semibold">Definitive room boundary</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-2">
              2. Optimal Placement: Center vs Blackboard
            </h4>
            <p className="text-xs text-slate-600 mb-2">
              Central placement increases separation: inside students remain between -77 dBm and -80 dBm, while outside corridor students drop to -93 dBm to -98 dBm, creating a clear gap against the -90 dBm threshold.
            </p>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

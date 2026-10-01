import React, { useState } from 'react';
import { BeaconPlacement, ClassroomPosition } from '../types/attendance';
import { CLASSROOM_LAYOUT_POINTS } from '../data/mockData';

interface ClassroomRadarProps {
  placement: BeaconPlacement;
  threshold: number;
  onSelectPosition?: (pos: ClassroomPosition, calculatedRssi: number) => void;
  selectedPosId?: string;
  doorClosed?: boolean;
  onToggleDoor?: () => void;
}

export const ClassroomRadar: React.FC<ClassroomRadarProps> = ({
  placement,
  threshold,
  onSelectPosition,
  selectedPosId,
  doorClosed = true,
  onToggleDoor,
}) => {
  const teacherX = placement === 'center' ? 50 : 50;
  const teacherY = placement === 'center' ? 50 : 12;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Classroom Proximity Radar (10m × 8m)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Empirical BLE attenuation model · 42cm concrete walls · 4cm door
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleDoor}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
              doorClosed
                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Door: {doorClosed ? 'Closed (Attenuates ~15dBm)' : 'Open (Signal Leaks)'}
          </button>
        </div>
      </div>

      <div className="relative w-full aspect-[10/8] max-h-[380px] bg-slate-50 rounded-lg border-2 border-slate-800 overflow-hidden select-none">
        <div className="absolute inset-0 border-[6px] border-slate-700/80 pointer-events-none rounded-sm"></div>

        <div className="absolute top-2 left-1/4 right-1/4 h-3 bg-slate-800 rounded-sm flex items-center justify-center">
          <span className="text-[9px] font-medium text-slate-200 tracking-wider">
            FRONT / BLACKBOARD (10m)
          </span>
        </div>

        <div
          onClick={onToggleDoor}
          className={`absolute bottom-0 left-6 w-14 h-2.5 cursor-pointer flex items-center justify-center transition-colors ${
            doorClosed ? 'bg-amber-600' : 'bg-emerald-500'
          }`}
          title="Classroom Entrance Door (Click to toggle)"
        >
          <span className="text-[8px] font-bold text-white tracking-wider">
            {doorClosed ? 'DOOR CLOSED' : 'DOOR OPEN'}
          </span>
        </div>

        <div className="absolute bottom-1 right-3 text-[9px] font-medium text-slate-400">
          OUTSIDE CORRIDOR (Proxy Zone)
        </div>

        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <radialGradient id="signalGlow" cx={`${teacherX}%`} cy={`${teacherY}%`} r="60%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.08" />
              <stop offset="85%" stopColor="#3b82f6" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="100%" height="100%" fill="url(#signalGlow)" />

          <circle
            cx={`${teacherX}%`}
            cy={`${teacherY}%`}
            r="16%"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.5"
          />
          <circle
            cx={`${teacherX}%`}
            cy={`${teacherY}%`}
            r="32%"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.4"
          />
          <circle
            cx={`${teacherX}%`}
            cy={`${teacherY}%`}
            r={placement === 'center' ? '46%' : '44%'}
            fill="none"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="5 3"
            opacity="0.75"
          />
        </svg>

        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-500"
          style={{ left: `${teacherX}%`, top: `${teacherY}%` }}
        >
          <div className="relative group cursor-pointer">
            <span className="absolute -inset-2 rounded-full bg-blue-500/20 animate-ping"></span>
            <div className="relative w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md border-2 border-white">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-9 whitespace-nowrap bg-slate-900 text-white text-[10px] font-medium py-0.5 px-2 rounded shadow pointer-events-none">
              Laptop Beacon ({placement === 'center' ? 'Center' : 'Podium'})
            </div>
          </div>
        </div>

        {CLASSROOM_LAYOUT_POINTS.map((pt) => {
          const isSelected = selectedPosId === pt.id;
          const isInside = pt.actualLocation === 'inside';

          let baseRssi =
            placement === 'center' ? pt.estimatedRssiCenter : pt.estimatedRssiBlackboard;

          if (!doorClosed && !isInside) {
            baseRssi += 10;
          }

          const passesThreshold = baseRssi >= threshold;

          return (
            <div
              key={pt.id}
              onClick={() => onSelectPosition && onSelectPosition(pt, baseRssi)}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer transition-transform hover:scale-110"
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            >
              <div
                className={`relative w-6 h-6 rounded-full flex items-center justify-center border-2 text-[10px] font-semibold transition-all ${
                  isSelected
                    ? 'ring-4 ring-blue-400 border-white text-white bg-blue-600 scale-110'
                    : passesThreshold
                    ? 'border-emerald-600 bg-emerald-100 text-emerald-800'
                    : 'border-red-500 bg-red-100 text-red-700'
                }`}
              >
                {pt.benchNumber ? `B${pt.benchNumber}` : 'P'}
              </div>

              <div
                className={`absolute left-1/2 -translate-x-1/2 top-7 text-[9px] font-mono tabular-nums whitespace-nowrap px-1 py-0.5 rounded shadow-xs ${
                  passesThreshold
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {baseRssi} dBm
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Inside Room (RSSI ≥ {threshold} dBm · Present)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
            <span>Corridor / Outside (RSSI &lt; {threshold} dBm · Blocked)</span>
          </div>
        </div>

        <div className="text-slate-500">
          Click any position circle (B1–B6, Corridor) to test position
        </div>
      </div>
    </div>
  );
};

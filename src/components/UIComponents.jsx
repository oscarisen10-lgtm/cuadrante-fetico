import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className="btn3d flex flex-col items-center gap-1 flex-1"
      role="tab"
      aria-selected={isActive}
      aria-label={`${label}${isActive ? ' (pestaña activa)' : ''}`}
    >
      <div
        className={`grid place-items-center w-11 h-11 rounded-2xl transition-all duration-200 ${isActive ? 'text-white -translate-y-0.5' : 'text-slate-400'}`}
        style={isActive ? { background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 7px 15px rgba(5,150,105,0.45), inset 0 1.5px 1px rgba(255,255,255,0.55), inset 0 -3px 6px rgba(4,120,87,0.55)' } : {}}
        aria-hidden="true"
      >
        {React.cloneElement(icon, { size: 20, strokeWidth: isActive ? 2.6 : 2 })}
      </div>
      <span className={`text-[9px] uppercase tracking-tight leading-none ${isActive ? 'font-black text-emerald-700' : 'font-bold text-slate-400'}`}>{label}</span>
    </button>
  );
}

export function StatBar({ label, currentValue, totalValue, percentage, color, large = false }) {
  const clampedPercentage = Math.max(0, Math.min(percentage, 100));

  return (
    <div className="space-y-2.5 flex flex-col" role="meter" aria-label={label} aria-valuenow={clampedPercentage} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex justify-between items-end leading-none">
        <span className={`font-black uppercase ${large ? "text-xs text-slate-500 tracking-tight" : "text-[10px] text-slate-400 tracking-widest"}`}>{label}</span>
        <span className={`font-bold text-slate-400 ${large ? "text-base mr-0.5" : "text-xs mr-1"}`}>
          {currentValue} <span className="text-slate-300">/</span> <span className={`${large ? "text-2xl font-black tracking-tighter" : "text-sm font-black"} text-slate-900`}>{totalValue}</span>
        </span>
      </div>
      <div
        className={`relative w-full rounded-full overflow-hidden ${large ? "h-4" : "h-3.5"}`}
        style={{ background: 'linear-gradient(180deg,#e6e8eb,#f1f3f5)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.14), inset 0 -1px 0 rgba(255,255,255,0.85)' }}
        role="progressbar" aria-valuenow={clampedPercentage} aria-valuemin={0} aria-valuemax={100}
      >
        <div
          className={`${color} h-full rounded-full relative transition-[width] duration-1000 ease-out`}
          style={{ width: `${clampedPercentage}%`, boxShadow: '0 1px 3px rgba(0,0,0,0.22), inset 0 -3px 5px rgba(0,0,0,0.18)' }}
        >
          {/* brillo superior (volumen) */}
          <div className="absolute inset-x-0 top-0 h-1/2 rounded-full pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.55), transparent)' }} />
          {/* destello que recorre la barra */}
          {clampedPercentage > 6 && <div className="absolute inset-0 sheen rounded-full" />}
        </div>
      </div>
    </div>
  );
}

export function InputGroup({ label, name, icon, type = "text", maxLength, minLength, small = false, ...props }) {
  const inputId = `input-${name}`;
  const isPassword = type === "password";
  const [show, setShow] = useState(false);
  const inputType = isPassword ? (show ? "text" : "password") : type;
  return (
    <div className="space-y-1.5 flex flex-col">
      <label htmlFor={inputId} className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" aria-hidden="true">{React.cloneElement(icon, { size: 18 })}</div>}
        <input
          id={inputId}
          name={name} type={inputType} maxLength={maxLength} minLength={minLength} required
          className={`w-full ${icon ? 'pl-10' : 'px-3'} ${isPassword ? 'pr-11' : ''} border-none ${small ? 'p-3 text-sm' : 'p-3.5 text-base'} rounded-2xl outline-none text-slate-800 leading-none transition-all ring-1 ring-slate-200/80 shadow-[inset_0_2px_4px_rgba(15,23,42,0.07)] focus:ring-2 focus:ring-emerald-500 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.16)]`}
          style={{ background: 'linear-gradient(180deg,#f6f7f9,#eef0f3)' }}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 p-1.5 rounded-lg active:scale-90 transition-all"
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            tabIndex={-1}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

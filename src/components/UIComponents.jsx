import React from 'react';

export function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center gap-1.5 transition-all flex-1 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}
      role="tab"
      aria-selected={isActive}
      aria-label={`${label}${isActive ? ' (pestaña activa)' : ''}`}
    >
      <div className={`p-2 rounded-2xl transition-all ${isActive ? 'bg-emerald-50 shadow-inner scale-110' : 'hover:bg-slate-100'}`} aria-hidden="true">{React.cloneElement(icon, { size: 20, strokeWidth: isActive ? 3 : 2 })}</div>
      <span className={`text-[9px] uppercase tracking-tighter leading-none ${isActive ? 'font-black' : 'font-bold'}`}>{label}</span>
    </button>
  );
}

export function StatBar({ label, currentValue, totalValue, percentage, color, large = false }) {
  const clampedPercentage = Math.min(percentage, 100);
  
  return (
    <div className="space-y-3 flex flex-col" role="meter" aria-label={label} aria-valuenow={clampedPercentage} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex justify-between font-black uppercase tracking-widest items-end leading-none">
        <span className={large ? "text-xs text-slate-500 font-bold tracking-tight" : "text-[10px] text-slate-400"}>{label}</span>
        <span className={`text-slate-900 ${large ? "text-2xl font-black tracking-tighter" : "text-sm"}`}>
          {currentValue} <span className={`${large ? "text-xs" : "text-[9px]"} text-slate-400 font-bold tracking-normal`}>/ {totalValue}</span>
        </span>
      </div>
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50 shadow-inner ${large ? "h-4" : "h-3.5"}`} role="progressbar" aria-valuenow={clampedPercentage} aria-valuemin={0} aria-valuemax={100}>
        <div className={`${color} h-full transition-all duration-1000 shadow-sm`} style={{ width: `${clampedPercentage}%` }}></div>
      </div>
    </div>
  );
}

export function InputGroup({ label, name, icon, type = "text", maxLength, minLength, small = false, ...props }) {
  const inputId = `input-${name}`;
  return (
    <div className="space-y-1.5 flex flex-col">
      <label htmlFor={inputId} className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" aria-hidden="true">{React.cloneElement(icon, { size: 18 })}</div>}
        <input 
          id={inputId}
          name={name} type={type} maxLength={maxLength} minLength={minLength} required 
          className={`w-full ${icon ? 'pl-10' : 'px-3'} bg-slate-50 border-none ${small ? 'p-3 text-sm' : 'p-3.5 text-base'} rounded-xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm text-slate-800 leading-none`} 
          {...props}
        />
      </div>
    </div>
  );
}

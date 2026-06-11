import React, { useState, useEffect, useMemo } from 'react';
import { getTeamMembers, subscribeToTeamRequests, subscribeToShifts, saveShift, updateRequestStatus, deleteShift } from '../../services/firebaseService';
import { MonthGrid, WeekdayHeader } from './CalendarGrid';
import { User, CheckCircle, XCircle } from 'lucide-react';

export function TeamView({ user, userStore, currentDate, navigateBack, navigateForward }) {
  const [team, setTeam] = useState([]);
  const [selectedUid, setSelectedUid] = useState(null);
  const [teamRequests, setTeamRequests] = useState([]);
  const [memberShifts, setMemberShifts] = useState([]);
  
  const isBoss = user?.rank && (user.rank.toLowerCase().includes('jefe') || user.rank.toLowerCase().includes('coordinador'));
  const storeKey = `${user?.company || "Supercor"}_${userStore}_${user?.section || "Sin especificar"}`;

  useEffect(() => {
    if (isBoss && userStore) {
      getTeamMembers(user?.company, userStore, user?.section).then(members => {
        // Incluimos al propio jefe en la lista para que pueda probarlo o gestionar sus propios turnos
        setTeam(members);
      });
      
      const unsubReq = subscribeToTeamRequests(storeKey, (data) => {
        setTeamRequests(data);
      });
      return () => unsubReq();
    }
  }, [isBoss, userStore, user?.company, user?.section, storeKey, user?.uid]);

  useEffect(() => {
    if (selectedUid) {
      const unsubShifts = subscribeToShifts(selectedUid, (data) => {
        setMemberShifts(data);
      }, () => {});
      return () => unsubShifts();
    } else {
      setMemberShifts([]);
    }
  }, [selectedUid]);

  const memberShiftsMap = useMemo(() => {
    const map = {};
    memberShifts.forEach(s => { map[s.date] = s; });
    // Also inject pending requests into their calendar
    teamRequests.forEach(req => {
      if (req.uid === selectedUid && req.status === 'pending') {
        map[req.date] = { ...map[req.date], type: 'request', requestData: req };
      }
    });
    return map;
  }, [memberShifts, teamRequests, selectedUid]);

  const handleApprove = async (req) => {
    try {
      // 1. Create a "rest" shift for the user
      await saveShift(req.uid, {
        date: req.date,
        type: 'rest',
        hours: 0,
        isHA: false,
        id: Date.now()
      });
      // 2. Mark request as approved
      await updateRequestStatus(req.id, 'approved');
    } catch(e) {
      console.error(e);
    }
  };

  const handleReject = async (req) => {
    try {
      // Reject request, no shift changes needed (it stays empty/work)
      await updateRequestStatus(req.id, 'rejected');
      // If it was just an empty shift, the user will see it empty.
    } catch(e) {
      console.error(e);
    }
  };

  if (!isBoss) {
    return (
      <div className="p-6 text-center text-slate-500 font-bold text-sm">
        No tienes permisos para acceder a esta vista.
      </div>
    );
  }

  const selectedMemberRequests = teamRequests.filter(r => r.uid === selectedUid);

  return (
    <div className="flex flex-col relative w-full h-full pb-4">
      {/* Team selector */}
      <div className="px-4 py-3 border-b border-slate-100 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
        {team.length === 0 && (
          <span className="text-xs font-bold text-slate-400 italic py-2">No hay empleados en tu sección.</span>
        )}
        {team.map(member => (
          <button 
            key={member.uid}
            onClick={() => setSelectedUid(member.uid)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${selectedUid === member.uid ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}
          >
            <User size={14} />
            <span className="text-xs font-black tracking-wide uppercase">{member.fullName.split(' ')[0]}</span>
            {teamRequests.filter(r => r.uid === member.uid).length > 0 && (
              <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-1">
                {teamRequests.filter(r => r.uid === member.uid).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {selectedUid ? (
        <div className="flex flex-col">
          {/* Read-only calendar */}
          <div className="p-3 grid grid-cols-7 gap-1.5 pointer-events-none opacity-90">
             <WeekdayHeader />
             <MonthGrid 
               targetYear={currentDate.getFullYear()} 
               targetMonth={currentDate.getMonth()} 
               shiftsMap={memberShiftsMap} 
               isSmall={false}
               selectedDates={[]}
               onDayClick={() => {}}
               onDayDoubleClick={() => {}}
               userStore={userStore}
             />
          </div>

          {/* Pending requests */}
          <div className="px-4 pt-4 mt-2 border-t border-slate-100">
             <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Peticiones Pendientes</h4>
             <div className="space-y-3">
                {selectedMemberRequests.length === 0 && (
                  <div className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center">
                    No hay peticiones para este usuario en este momento.
                  </div>
                )}
                {selectedMemberRequests.map(req => {
                  const dObj = new Date(req.date.split('-')[0], req.date.split('-')[1]-1, req.date.split('-')[2]);
                  return (
                    <div key={req.id} className="bg-orange-50/50 border border-orange-200 p-4 rounded-2xl flex items-start justify-between">
                      <div className="flex flex-col pr-4">
                         <span className="text-sm font-black text-slate-800">{dObj.getDate()} {dObj.toLocaleDateString('es-ES', {month: 'long'})}</span>
                         <span className="text-[9px] text-orange-600 uppercase font-black tracking-widest mb-1.5">Solicita día libre</span>
                         {req.note && (
                           <p className="text-xs text-slate-600 italic border-l-2 border-orange-300 pl-2 leading-tight">
                             "{req.note}"
                           </p>
                         )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleApprove(req)} className="bg-emerald-500 hover:bg-emerald-600 text-white p-2.5 rounded-xl shadow-md active:scale-95 transition-all"><CheckCircle size={20}/></button>
                        <button onClick={() => handleReject(req)} className="bg-rose-500 hover:bg-rose-600 text-white p-2.5 rounded-xl shadow-md active:scale-95 transition-all"><XCircle size={20}/></button>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      ) : (
        <div className="p-10 flex flex-col items-center justify-center text-center opacity-50">
          <User size={48} className="text-slate-300 mb-4" />
          <p className="text-sm font-bold text-slate-500">Selecciona un empleado arriba<br/>para ver su cuadrante.</p>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Timer, Trophy, Crown, Gem } from 'lucide-react';
import { CatchTheShiftGame } from './minigames/CatchTheShiftGame';

export function ArenaView({ user }) {
  const [activeTab, setActiveTab] = useState('puntuacion'); // 'clasificacion' or 'puntuacion'
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastScore, setLastScore] = useState(null);
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [gameNumberStr, setGameNumberStr] = useState('');
  const [practiceAttempts, setPracticeAttempts] = useState(1);
  const [playAttempts, setPlayAttempts] = useState(2);

  useEffect(() => {
    // Calculate game number (day of month / total days in month)
    const now = new Date();
    const currentDay = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    setGameNumberStr(`# ${currentDay.toString().padStart(2, '0')}/${totalDays}`);

    // Calculate time until next 05:00 AM
    const updateCountdown = () => {
      const d = new Date();
      let nextReset = new Date(d);
      nextReset.setHours(5, 0, 0, 0);
      
      // If we are past 05:00 AM today, next reset is tomorrow at 05:00 AM
      if (d > nextReset) {
        nextReset.setDate(nextReset.getDate() + 1);
      }
      
      const diff = nextReset - d;
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeftStr(`${h}h ${m}m ${s}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  const mockPlayers = [
    { id: 1, name: 'oscarisen', score: 103, rank: 1, avatar: 'https://i.pravatar.cc/150?u=oscar', color: 'bg-[#e56b6f]', attempts: 1, gems: 60 },
    { id: 2, name: 'Yaiza', score: 99, rank: 2, avatar: 'https://i.pravatar.cc/150?u=yaiza', color: 'bg-[#1b998b]', attempts: 1, gems: 48 },
    { id: 3, name: 'hugo 🏀', score: 96, rank: 3, avatar: null, initials: 'HU', color: 'bg-[#9d8df1]', attempts: null, gems: 36 },
    { id: 4, name: 'miriam', score: 75, rank: 4, avatar: 'https://i.pravatar.cc/150?u=miriam', color: 'bg-[#4a4e69]', attempts: 1, gems: 24 },
    { id: 5, name: 'Alex', score: 43, rank: 5, avatar: null, initials: 'AL', color: 'bg-[#4a4e69]', attempts: 2, gems: 12 },
  ];

  const mockStores = [
    { id: 1, name: 'Supercor Goya', score: 4500, rank: 1, color: 'bg-[#e56b6f]' },
    { id: 2, name: 'Supercor Alcalá', score: 4230, rank: 2, color: 'bg-[#1b998b]' },
    { id: 3, name: 'Supercor Ventas', score: 3980, rank: 3, color: 'bg-[#9d8df1]' },
    { id: 4, name: 'Supercor Retiro', score: 3100, rank: 4, color: 'bg-[#4a4e69]' },
  ];

  return (
    <div className="h-full bg-[#f6f5ef] text-slate-800 overflow-y-auto scrollbar-hide relative font-sans">
      {/* Cabecera */}
      <header className="flex justify-center py-2 sticky top-0 bg-[#f6f5ef]/90 backdrop-blur-md z-50 border-b border-slate-200/50">
         <div className="bg-white rounded-full px-4 py-1.5 font-black text-[13px] flex items-center gap-2 shadow-sm text-slate-800">
           <span className="flex items-center gap-1">384 <Gem size={14} className="text-emerald-500 fill-emerald-500"/></span>
           <span className="text-slate-200 px-1">|</span>
           <span className="flex items-center gap-1">#1 <Trophy size={14} className="text-amber-500 fill-amber-500"/></span>
         </div>
      </header>

      {/* Título Principal */}
      <h1 className="text-center font-black text-5xl uppercase tracking-tighter mt-3 mb-4 text-black" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.1)' }}>HOY</h1>

      {/* Tarjeta del Minijuego */}
      <div 
        onClick={() => setIsPlaying(true)}
        className="mx-6 bg-[#3a0ca3] rounded-[2rem] relative shadow-2xl mb-8 flex flex-col items-center justify-center min-h-[220px] border border-[#2b087a] overflow-hidden cursor-pointer active:scale-95 transition-transform"
      >
        <div className="absolute top-4 left-4 bg-black/40 text-white text-[11px] font-black px-3 py-1.5 rounded-full">{gameNumberStr}</div>
        <div className="absolute top-4 right-4 bg-black/40 text-white text-[11px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5">
          <Timer size={14} className="animate-pulse" /> {timeLeftStr}
        </div>
        
        {/* Gráfico decorativo 3D (Simulado) */}
        <div className="relative mt-4 pointer-events-none">
          <div className="w-32 h-16 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-lg transform rotate-12 -skew-x-12 shadow-xl flex items-center justify-center border-b-8 border-yellow-600">
             <div className="absolute -top-12 w-16 h-16 bg-gradient-to-br from-slate-700 to-black rounded-full shadow-2xl"></div>
             {/* Destellos simulados */}
             <div className="absolute -top-4 -left-4 w-4 h-8 bg-orange-400 rotate-45 rounded-full"></div>
             <div className="absolute -top-8 right-0 w-3 h-10 bg-yellow-300 -rotate-12 rounded-full"></div>
          </div>
        </div>

        <div className="absolute -bottom-5 bg-white text-indigo-900 font-black uppercase tracking-widest px-6 py-2.5 rounded-full border-4 border-[#f6f5ef] shadow-md text-sm hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
          JUGAR: ATRAPA EL TURNO
        </div>
      </div>

      {/* Podio (Top 3) */}
      <div className="flex justify-center items-end gap-5 mb-10 px-4">
        {/* Top 2 */}
        <div className="flex flex-col items-center">
          <img src={mockPlayers[1].avatar} className="w-12 h-12 rounded-full border-2 border-[#f6f5ef] shadow-lg z-10" alt="Rank 2" />
          <span className="text-[10px] font-bold text-slate-500 mt-2">{mockPlayers[1].score} Puntos</span>
        </div>
        {/* Top 1 */}
        <div className="flex flex-col items-center relative -mt-6">
          <Crown size={28} className="text-amber-400 fill-amber-400 absolute -top-7 z-20 drop-shadow-md" />
          <img src={mockPlayers[0].avatar} className="w-16 h-16 rounded-full border-4 border-[#f6f5ef] shadow-lg z-10" alt="Rank 1" />
          <div className="bg-white px-3 py-1 rounded-full shadow-md mt-2 z-20 border border-slate-100">
            <span className="text-[11px] font-black text-black">{mockPlayers[0].score} Puntos</span>
          </div>
        </div>
        {/* Top 3 */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-indigo-200 border-2 border-[#f6f5ef] shadow-lg z-10 flex items-center justify-center">
             <span className="font-bold text-indigo-800 text-sm">{mockPlayers[2].initials}</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 mt-2">{mockPlayers[2].score} Puntos</span>
        </div>
      </div>

      {/* Mejor Jugador */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-4">
          <span className="text-3xl grayscale opacity-50">🌿</span>
          <div className="text-center">
            <span className="text-xs font-bold uppercase text-slate-800 block mb-1">Mejor jugador</span>
            <span className="text-2xl font-black uppercase text-black block tracking-tighter">{mockPlayers[0].name}</span>
            <span className="text-xs font-bold text-slate-500">{mockPlayers[0].score} Puntos</span>
          </div>
          <span className="text-3xl grayscale opacity-50 transform scale-x-[-1]">🌿</span>
        </div>
      </div>

      {/* Tabs Clasificación / Puntuación */}
      <div className="mx-6 bg-[#2a2a2a] rounded-full p-1 flex mb-6 shadow-inner">
        <button 
          onClick={() => setActiveTab('clasificacion')}
          className={`flex-1 py-3 rounded-full text-[13px] font-bold transition-all ${activeTab === 'clasificacion' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
        >
          Clasificación
        </button>
        <button 
          onClick={() => setActiveTab('puntuacion')}
          className={`flex-1 py-3 rounded-full text-[13px] font-bold transition-all ${activeTab === 'puntuacion' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
        >
          Puntuación
        </button>
      </div>

      {/* Lista de Ranking */}
      <div className="flex flex-col gap-3 px-6 pb-6">
        {activeTab === 'puntuacion' ? mockPlayers.map(p => (
          <div key={p.id} className={`${p.color} rounded-[1.25rem] p-4 flex items-center text-white relative shadow-sm hover:scale-[1.02] transition-transform`}>
            <span className="text-xl font-black w-10 opacity-90">#{p.rank}</span>
            {p.avatar ? (
               <img src={p.avatar} className="w-11 h-11 rounded-full border-2 border-white/20 mr-3 shadow-sm" alt={p.name} />
            ) : (
               <div className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/20 mr-3 flex items-center justify-center font-bold shadow-sm">{p.initials}</div>
            )}
            <div className="flex flex-col">
              <span className="font-black text-[15px]">{p.score} Puntos</span>
              <span className="text-sm font-medium opacity-90">{p.name}</span>
            </div>
            
            {p.gems && (
              <div className="absolute -bottom-2.5 right-4 bg-[#1a1a1a] text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 border-[3px] border-[#f6f5ef] shadow-sm">
                {p.attempts && <span className="opacity-80">{p.attempts} <span className="text-[8px]">↺</span></span>}
                <span className="text-emerald-400 flex items-center gap-0.5">+{p.gems} <Gem size={10} className="fill-emerald-400"/></span>
              </div>
            )}
          </div>
        )) : mockStores.map(s => (
           <div key={s.id} className={`${s.color} rounded-[1.25rem] p-4 flex items-center text-white relative shadow-sm hover:scale-[1.02] transition-transform`}>
            <span className="text-xl font-black w-10 opacity-90">#{s.rank}</span>
            <div className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/20 mr-3 flex items-center justify-center font-bold shadow-sm text-lg">🏪</div>
            <div className="flex flex-col">
              <span className="font-black text-[15px]">{s.score} Puntos</span>
              <span className="text-sm font-medium opacity-90">{s.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bonus Box */}
      <div className="mx-6 bg-[#e6e4df] rounded-[2rem] p-6 text-center mb-8 relative border-b-4 border-slate-300/50">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm">
          <Gem size={10} className="fill-white" /> DÍA 5
        </div>
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1 mt-2">BONUS</h4>
        <div className="text-4xl font-black text-black mb-1">+20%</div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Gems en todos los scores</p>
      </div>

      <p className="text-center text-[10px] text-slate-400 font-bold px-12 pb-12 leading-relaxed mb-4">
        Consigue 10 gems por jugar y 10 por cada compañero que superes hoy.
      </p>

      {isPlaying && (
        <CatchTheShiftGame 
          practiceAttempts={practiceAttempts}
          playAttempts={playAttempts}
          onConsumeAttempt={(mode) => {
            if (mode === 'prueba') setPracticeAttempts(p => Math.max(0, p - 1));
            if (mode === 'jugar') setPlayAttempts(p => Math.max(0, p - 1));
          }}
          onCancel={() => setIsPlaying(false)} 
          onFinish={(score, mode) => {
            setLastScore(score);
            setIsPlaying(false);
            // Here we could update firebase in the future
          }} 
        />
      )}

    </div>
  );
}

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={40} className="text-rose-400" />
          </div>
          <h1 className="text-xl font-black text-white mb-2 italic">Algo ha fallado</h1>
          <p className="text-sm text-slate-400 mb-2 max-w-xs leading-relaxed">
            Ha ocurrido un error inesperado. Tus datos están seguros en la nube.
          </p>
          <p className="text-[10px] text-rose-400/60 font-mono mb-8 max-w-xs break-all">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-emerald-600 text-white font-black px-8 py-3.5 rounded-full uppercase text-sm shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <RefreshCw size={16} /> Reiniciar App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

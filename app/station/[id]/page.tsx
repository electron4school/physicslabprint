'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { triggerBrowserPrint } from '../../../lib/print'
import { Printer, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { useParams } from 'next/navigation'

export default function StationPage() {
  const params = useParams()
  const stationId = (params.id as string) || 'printer-1'

  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'printing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handlePrint = async () => {
    if (code.length !== 3) return
    setStatus('checking')
    setMessage('Checking code...')
    try {
      const { data: jobs, error: fetchError } = await supabase.from('print_jobs').select('*').eq('print_code', code).order('created_at', { ascending: false }).limit(1)
      if (fetchError || !jobs || jobs.length === 0) {
        setStatus('error');
        setMessage('Code not found or expired.');
        return;
      }
      const job = jobs[0]
      if (job.status !== 'waiting') {
        setStatus('error');
        setMessage('This code has already been printed!');
        return;
      }
      const { error: updateError } = await supabase.from('print_jobs').update({ status: 'completed', station_id: stationId }).eq('id', job.id).eq('status', 'waiting')
      if (updateError) {
        setStatus('error');
        setMessage('Job was already claimed by another printer.');
        return;
      }
      setStatus('printing')
      setMessage('Sending to printer...')
      await triggerBrowserPrint(job.file_url)
      setTimeout(() => { setStatus('success'); setMessage('Printing Complete!'); }, 1500)
      setTimeout(() => { setCode(''); setStatus('idle'); }, 6000)
    } catch (error) {
      console.error(error);
      setStatus('error');
      setMessage('Error connecting to database.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 sm:p-12 border border-slate-200/80 text-center">
        
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Printer className="w-8 h-8" />
        </div>

        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Physics Lab Print</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-8">
          STATION: {stationId.toUpperCase().replace('-', ' ')}
        </p>

        {status === 'idle' || status === 'error' ? (
          <div className="space-y-6 animate-in fade-in">
            <input
              type="text"
              maxLength={3}
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000"
              autoFocus
              className="w-full text-center text-7xl tracking-[0.2em] font-mono font-bold py-6 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all"
            />

            {status === 'error' && (
              <p className="text-red-600 flex items-center justify-center text-sm bg-red-50 p-3 rounded-xl font-medium">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" /> {message}
              </p>
            )}

            <button
              onClick={handlePrint}
              disabled={code.length !== 3}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xl py-5 rounded-2xl transition-all shadow-lg shadow-indigo-600/20"
            >
              PRINT GRAPH
            </button>
          </div>
        ) : (
          <div className="py-12 space-y-4 animate-in fade-in zoom-in-95">
            {status === 'success' ? (
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            ) : (
              <Loader2 className="w-16 h-16 text-indigo-600 mx-auto animate-spin" />
            )}
            <h2 className="text-2xl font-bold text-slate-900">{message}</h2>
            {status === 'printing' && <p className="text-slate-500 text-sm">Please collect your graph from the tray.</p>}
          </div>
        )}

      </div>
    </div>
  )
}
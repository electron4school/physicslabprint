'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { isValidGraphFile, ACCEPTED_FILE_TYPES_ATTR, triggerBrowserPrint } from '../lib/print'
import { 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Clock, 
  Check,
  RotateCcw,
  Upload,
  ArrowRight
} from 'lucide-react'

export default function PhysicsLabPrintApp() {
  const [activeTab, setActiveTab] = useState<'upload' | 'print'>('upload')

  // --- UPLOAD STATE ---
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // --- PRINT STATE ---
  const [inputCode, setInputCode] = useState('')
  const [printStatus, setPrintStatus] = useState<'idle' | 'checking' | 'printing' | 'success' | 'error'>('idle')
  const [printMessage, setPrintMessage] = useState('')

  const generateRandomCode = () => Math.floor(100 + Math.random() * 900).toString()

  const handleAutoUpload = async (selectedFile: File) => {
    if (!selectedFile || isUploading) return;
    if (!isValidGraphFile(selectedFile)) {
      setUploadError('Please select a valid graph file (PDF, PNG, JPG, SVG, GIF, or WEBP).')
      return
    }
    setFile(selectedFile);
    setIsUploading(true);
    setUploadError(null);
    try {
      const code = generateRandomCode()
      const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `${code}-${cleanFileName}`
      const { error: storageErr } = await supabase.storage.from('graphs').upload(storagePath, selectedFile, { cacheControl: '3600', upsert: false, contentType: selectedFile.type || undefined })
      if (storageErr) throw new Error(`Storage Error: ${storageErr.message}`)
      const { data: publicUrlData } = supabase.storage.from('graphs').getPublicUrl(storagePath)
      const { error: dbErr } = await supabase.from('print_jobs').insert([{ print_code: code, file_name: selectedFile.name, file_url: publicUrlData.publicUrl, status: 'waiting' }])
      if (dbErr) throw new Error(`Database Error: ${dbErr.message}`)
      setGeneratedCode(code)
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Please try again.');
      setFile(null);
    } finally {
      setIsUploading(false)
    }
  }

  const handlePrint = async () => {
    if (inputCode.length !== 3) return
    setPrintStatus('checking');
    setPrintMessage('Verifying code...');
    try {
      const { data: jobs, error: fetchErr } = await supabase.from('print_jobs').select('*').eq('print_code', inputCode).order('created_at', { ascending: false }).limit(1)
      if (fetchErr || !jobs || jobs.length === 0) {
        setPrintStatus('error');
        setPrintMessage('Code not found or expired.');
        return;
      }
      const job = jobs[0]
      if (job.status !== 'waiting') {
        setPrintStatus('error');
        setPrintMessage('This code has already been printed!');
        return;
      }
      const { error: updateErr } = await supabase.from('print_jobs').update({ status: 'completed', station_id: 'local-station' }).eq('id', job.id).eq('status', 'waiting')
      if (updateErr) {
        setPrintStatus('error');
        setPrintMessage('Job was claimed by another printer.');
        return;
      }
      setPrintStatus('printing');
      setPrintMessage('Sending to USB printer...');
      await triggerBrowserPrint(job.file_url)
      setTimeout(() => { setPrintStatus('success'); setPrintMessage('Printed successfully!'); }, 1500)
      setTimeout(() => { setInputCode(''); setPrintStatus('idle'); }, 6000)
    } catch (err) {
      setPrintStatus('error');
      setPrintMessage('Error communicating with database.');
    }
  }

  const resetUpload = () => {
    setGeneratedCode(null);
    setFile(null);
    setUploadError(null);
    setActiveTab('upload');
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 selection:bg-indigo-100 selection:text-indigo-900 flex flex-col font-sans relative overflow-x-hidden">
      
      {/* Custom styles for the flashing dashed border */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flash-border {
          0% { border-color: rgba(99, 102, 241, 0.2); }
          50% { border-color: rgba(99, 102, 241, 1); }
          100% { border-color: rgba(99, 102, 241, 0.2); }
        }
        .flashing-dashed-border {
          animation: flash-border 1.5s ease-in-out infinite;
        }
        .drag-active-border {
          border-color: rgba(99, 102, 241, 1) !important;
          animation: none;
        }
      `}} />

      {/* Dotted Background */}
      <div className="absolute inset-0 h-full w-full bg-white bg-[radial-gradient(#e5e7eb_2px,transparent_2px)] [background-size:32px_32px] pointer-events-none" />

      {/* Header - Tighter Padding */}
      <header className="relative z-20 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <Printer className="w-4 h-4" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight text-slate-900">
              PhysicsLab<span className="text-slate-500 font-medium">Print</span>
            </span>
          </div>
          <div className="hidden sm:flex items-center space-x-2 bg-emerald-50/80 border border-emerald-200/50 px-3 py-1.5 rounded-full text-[12px] font-semibold text-emerald-700 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="tracking-wide">2 Lab printers</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto w-full px-6 flex-grow flex flex-col items-center">
        
        {/* Hero Section - Moved up by removing the badge and reducing top padding */}
        <div className="max-w-2xl mx-auto pt-4 md:pt-6 pb-2 md:pb-4 text-center flex flex-col items-center">

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            Drop your graph.<br/>
            <span className="text-indigo-600">Print in seconds.</span>
          </h1>
          
          <p className="mt-3 text-sm md:text-base text-slate-600 leading-relaxed max-w-lg mx-auto">
            No login required. Drop your file, grab your 3-digit code, and release it at Printer 1 or Printer 2.
          </p>
        </div>

        {/* Floating Toggle Switch - Tighter Margins */}
        <div className="relative z-30 flex bg-white border border-slate-200 shadow-sm p-1 rounded-full mb-4">
          <button
            onClick={() => { setActiveTab('upload'); setUploadError(null); }}
            className={`px-6 py-2 text-sm font-bold rounded-full transition-all flex items-center space-x-2 ${
              activeTab === 'upload' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <span>Upload Graph</span>
          </button>
          <button
            onClick={() => { setActiveTab('print'); setPrintStatus('idle'); }}
            className={`px-6 py-2 text-sm font-bold rounded-full transition-all flex items-center space-x-2 ${
              activeTab === 'print' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <span>Enter Code</span>
          </button>
        </div>

        {/* Central Interaction Area */}
        <div className="relative w-full max-w-2xl mx-auto mb-8 mt-1">
          
          {/* Main Card Container */}
          <div className="relative bg-white rounded-[2rem] p-5 sm:p-8 shadow-[0_10px_50px_-15px_rgba(99,102,241,0.25)] border border-white">
            
            {/* ================= TAB 1: UPLOAD ================= */}
            {activeTab === 'upload' && (
              <div>
                {!generatedCode ? (
                  <>
                    {/* Floating Document Icon - Scaled Down */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-14 bg-white border border-slate-100 shadow-lg rounded-xl flex flex-col items-center justify-start pt-2.5 z-20">
                      <div className="w-6 h-1 bg-indigo-500 rounded-full mb-1"></div>
                      <div className="w-8 h-1 bg-slate-200 rounded-full mb-1"></div>
                      <div className="w-5 h-1 bg-slate-200 rounded-full mb-1"></div>
                      <div className="text-[7px] font-black text-indigo-600 mt-auto mb-1.5">FILE</div>
                    </div>

                    {/* The Flashing Dashed Box */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleAutoUpload(e.dataTransfer.files[0]); }}
                      className={`relative w-full border-[3px] border-dashed rounded-2xl transition-all flex flex-col items-center justify-center pt-8 pb-6 px-6 text-center cursor-pointer group ${
                        isUploading ? 'border-indigo-200 bg-indigo-50/30' :
                        isDragging ? 'drag-active-border bg-indigo-50/50 scale-[0.99]' :
                        'flashing-dashed-border bg-white'
                      }`}
                    >
                      <input type="file" accept={ACCEPTED_FILE_TYPES_ATTR} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => { if (e.target.files?.[0]) handleAutoUpload(e.target.files[0]); }} />
                      
                      {isUploading ? (
                        <div className="flex flex-col items-center py-2 animate-in fade-in">
                          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                          <p className="text-lg font-bold text-slate-800">Uploading {file?.name}...</p>
                          <p className="text-sm text-indigo-600 mt-1">Generating private code...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center pointer-events-none">
                          <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-3">Select or drop graph here</h3>
                          
                          <div className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-full flex items-center space-x-2 group-hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 mb-3">
                            <Upload className="w-4 h-4" />
                            <span>Browse Files</span>
                          </div>

                          <p className="text-sm text-slate-400 font-medium">
                            PDF, PNG, JPG, SVG, or WEBP
                          </p>
                        </div>
                      )}
                    </div>

                    {uploadError && (
                      <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-semibold flex items-center justify-center space-x-2 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}
                  </>
                ) : (
                  /* Success Ticket Screen - Redesigned to fit tightly! */
                  <div className="text-center animate-in fade-in zoom-in-95 flex flex-col items-center">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner mb-3">
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                    
                    <h3 className="font-bold text-slate-900 text-lg mb-1">Upload Complete</h3>
                    <p className="text-sm text-slate-500 max-w-[280px] mx-auto leading-relaxed mb-4">
                      Walk to a lab printer and enter your code to print.
                    </p>

                    <div className="w-full py-4 bg-slate-50 rounded-2xl border border-slate-100 mb-5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Print Code</span>
                      <div className="text-[4.5rem] leading-none font-black font-mono text-slate-900 tracking-tight mt-1 mb-2">
                        {generatedCode}
                      </div>
                      <div className="inline-flex items-center space-x-1.5 text-slate-500 text-xs font-bold">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Expires in 15 minutes</span>
                      </div>
                    </div>
                    
                    <button onClick={resetUpload} className="mx-auto text-indigo-600 font-bold text-sm transition-all flex items-center justify-center space-x-2 hover:text-indigo-800 bg-indigo-50 px-6 py-2.5 rounded-full hover:bg-indigo-100">
                      <RotateCcw className="w-4 h-4" />
                      <span>Upload another</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ================= TAB 2: PRINT ================= */}
            {activeTab === 'print' && (
              <div className="pt-2">
                {printStatus === 'idle' || printStatus === 'error' ? (
                  <div className="animate-in fade-in">
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-bold text-slate-900 mb-1">Enter 3-Digit Code</h3>
                    </div>

                    <input
                      type="text" maxLength={3} inputMode="numeric" value={inputCode} onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="0 0 0" autoFocus
                      className="w-full text-center text-5xl tracking-[0.25em] font-mono font-black py-5 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300 placeholder:tracking-normal text-slate-900 mb-4"
                    />

                    {printStatus === 'error' && (
                      <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold flex items-center justify-center space-x-2 animate-in fade-in">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{printMessage}</span>
                      </div>
                    )}

                    <button 
                      onClick={handlePrint} 
                      disabled={inputCode.length !== 3} 
                      className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4 rounded-2xl text-lg transition-all flex items-center justify-center space-x-2 shadow-lg shadow-slate-900/20 disabled:shadow-none"
                    >
                      <span>Release Print</span>
                      {inputCode.length === 3 && <ArrowRight className="w-5 h-5" />}
                    </button>
                  </div>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95">
                    {printStatus === 'success' ? (
                      <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
                    ) : (
                      <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-4" />
                    )}
                    <div>
                      <h3 className="text-2xl font-extrabold text-slate-900 mb-2">{printMessage}</h3>
                      {printStatus === 'printing' && <p className="text-slate-500 text-sm font-medium">Sending to the connected USB printer...</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Workflow / How it works */}
        <section className="mt-4 pt-10 border-t border-slate-200/60 w-full max-w-6xl mx-auto mb-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold text-slate-900">How it works</h2>
            <p className="text-sm text-slate-500 mt-2 font-medium">A frictionless workflow for the physics laboratory.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
            {/* Desktop connecting line */}
            <div className="hidden md:block absolute top-[28px] left-[15%] right-[15%] h-[2px] bg-slate-100 z-0" />

            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center text-center px-2">
              <div className="w-14 h-14 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-lg mb-5 shadow-sm">
                01
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Upload Graph</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-[320px]">
                Drop your document or image. The system instantly generates a private 3-digit code.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center text-center px-2">
              <div className="w-14 h-14 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-lg mb-5 shadow-sm">
                02
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Walk to Station</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-[320px]">
                Your document is held securely in the cloud. Walk over to Printer 1 or Printer 2.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center text-center px-2">
              <div className="w-14 h-14 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-lg mb-5 shadow-sm">
                03
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Release Print</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-[320px]">
                Enter your code on the printer's screen. The document prints immediately into your hands.
              </p>
            </div>
          </div>
        </section>

      </main>

      <footer className="w-full bg-white border-t border-slate-100 py-6 px-6 text-center mt-auto">
        <p className="font-bold text-slate-400 text-xs">Natuurkunde Practicum • Printing System</p>
      </footer>
    </div>
  )
}
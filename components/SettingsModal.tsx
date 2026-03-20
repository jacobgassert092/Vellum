"use client";

import React from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  setTheme: (t: string) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  workFontSize: number;
  setWorkFontSize: (s: number) => void;
  hlOptions: any;
  setHlOptions: (options: any) => void;
  regexRules: any[];
  setRegexRules: (rules: any) => void;
  onMarkPreviousAsComplete: () => void;
}

export default function SettingsModal({
  isOpen, onClose, theme, setTheme, fontSize, setFontSize,
  workFontSize, setWorkFontSize, hlOptions, setHlOptions,
  regexRules, setRegexRules, onMarkPreviousAsComplete
}: SettingsModalProps) {
  if (!isOpen) return null;

  const updateHl = (key: string, val: any) => setHlOptions((p: any) => ({ ...p, [key]: val }));

  return (
    <div className="absolute top-14 left-4 z-50 bg-[#141417] border border-white/10 shadow-2xl p-6 flex flex-col gap-6 w-[420px] text-white rounded-md max-h-[85vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center border-b border-white/10 pb-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-blue-400">Settings</h2>
        <button onClick={onClose} className="text-xs opacity-50 hover:opacity-100 hover:text-red-400 font-bold">✕</button>
      </div>

      {/* RESTORED: SHORTCUTS CHEATSHEET */}
      <div className="bg-black/40 p-3 rounded-md border border-white/5 space-y-1.5">
        <h3 className="text-[10px] font-bold uppercase opacity-50 mb-2 border-b border-white/10 pb-1">Keybinds (Alt + Key)</h3>
        <div className="flex justify-between text-[10px]"><span className="opacity-70">Toggle Highlight</span><span className="font-mono text-blue-400 bg-white/5 px-1 rounded text-[9px]">H</span></div>
        <div className="flex justify-between text-[10px]"><span className="opacity-70">Shift Offset</span><span className="font-mono text-blue-400 bg-white/5 px-1 rounded text-[9px]">↑ / ↓</span></div>
        <div className="flex justify-between text-[10px]"><span className="opacity-70">Prev/Next Chapter</span><span className="font-mono text-blue-400 bg-white/5 px-1 rounded text-[9px]">← / →</span></div>
        <div className="flex justify-between text-[10px]"><span className="opacity-70">Run Auto-Regex</span><span className="font-mono text-purple-400 bg-white/5 px-1 rounded text-[9px]">R</span></div>
      </div>

      <div className="space-y-6">
        {/* ACTIVE SENTENCE SETTINGS */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold uppercase text-blue-400">Active Highlight</label>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-[9px] uppercase opacity-50">Underline</span>
                <input type="checkbox" checked={hlOptions.underlineActive} onChange={e => updateHl("underlineActive", e.target.checked)} />
              </label>
              <input type="checkbox" checked={hlOptions.enabled} onChange={e => updateHl("enabled", e.target.checked)} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 bg-black/40 p-3 rounded border border-white/5">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase opacity-40">Bg Color</span>
              <input type="color" value={hlOptions.color} onChange={e => updateHl("color", e.target.value)} className="w-full h-8 bg-transparent border border-white/10 rounded cursor-pointer" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase opacity-40">Opacity: {Math.round(hlOptions.opacity * 100)}%</span>
              <input type="range" min="0" max="1" step="0.01" value={hlOptions.opacity} onChange={e => updateHl("opacity", parseFloat(e.target.value))} className="accent-blue-500" />
            </div>
          </div>

          {hlOptions.underlineActive && (
            <div className="grid grid-cols-2 gap-4 bg-black/40 p-3 rounded border border-white/5">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase opacity-40">Line Color</span>
                <input type="color" value={hlOptions.underlineColor} onChange={e => updateHl("underlineColor", e.target.value)} className="w-full h-8 bg-transparent border border-white/10 rounded cursor-pointer" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase opacity-40">Thickness: {hlOptions.underlineThickness}px</span>
                <input type="range" min="1" max="6" step="1" value={hlOptions.underlineThickness} onChange={e => updateHl("underlineThickness", parseInt(e.target.value))} className="accent-blue-500" />
              </div>
            </div>
          )}
        </section>

        {/* FINISHED PROGRESS SETTINGS */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold uppercase text-green-400">Finished Progress</label>
            <input type="checkbox" checked={hlOptions.showFinished} onChange={e => updateHl("showFinished", e.target.checked)} />
          </div>
          <div className="grid grid-cols-2 gap-4 bg-black/40 p-3 rounded border border-white/5">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase opacity-40">Color</span>
              <input type="color" value={hlOptions.finishedColor} onChange={e => updateHl("finishedColor", e.target.value)} className="w-full h-8 bg-transparent border border-white/10 rounded cursor-pointer" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase opacity-40">Opacity: {Math.round(hlOptions.finishedOpacity * 100)}%</span>
              <input type="range" min="0" max="1" step="0.01" value={hlOptions.finishedOpacity} onChange={e => updateHl("finishedOpacity", parseFloat(e.target.value))} className="accent-green-500" />
            </div>
          </div>
        </section>

        {/* WORKSPACE SYNC */}
        <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase">Workspace Working Line</span>
            <span className="text-[8px] opacity-40 uppercase">Border matches highlight color</span>
          </div>
          <button onClick={() => updateHl("highlightWorkingLine", !hlOptions.highlightWorkingLine)} className={`w-10 h-5 rounded-full relative transition-colors ${hlOptions.highlightWorkingLine ? 'bg-blue-600' : 'bg-white/10'}`}>
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${hlOptions.highlightWorkingLine ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        {/* TYPOGRAPHY & THEME */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase opacity-50">Theme</label>
            <select value={theme} onChange={e => setTheme(e.target.value)} className="bg-black/50 border border-white/10 p-2 text-xs outline-none rounded cursor-pointer">
              <option value="dark">Dark</option><option value="light">Light</option><option value="sepia">Sepia</option>
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <span className="text-[10px] font-bold uppercase opacity-50">EPUB Font ({fontSize}px)</span>
              <input type="range" min="12" max="36" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full accent-blue-500" />
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-[10px] font-bold uppercase opacity-50">Work Font ({workFontSize}px)</span>
              <input type="range" min="12" max="36" value={workFontSize} onChange={e => setWorkFontSize(parseInt(e.target.value))} className="w-full accent-blue-500" />
            </div>
          </div>
        </div>

        {/* REGEX & BULK */}
        <div className="flex flex-col gap-1 pt-4 border-t border-white/5">
          <label className="text-[10px] font-bold uppercase opacity-50">Auto-Regex Rules</label>
          <div className="bg-black/40 p-2 border border-white/10 rounded max-h-40 overflow-y-auto space-y-2 custom-scrollbar">
            {regexRules.map((rule, idx) => (
              <div key={rule.id} className="flex gap-2 items-center">
                <input type="text" value={rule.pattern} onChange={(e) => {
                  const newRules = [...regexRules];
                  newRules[idx].pattern = e.target.value;
                  setRegexRules(newRules);
                }} placeholder="Regex" className="bg-black/50 border border-white/10 p-1.5 rounded text-[10px] w-1/3 outline-none" />
                <span className="text-white/30 text-[10px]">→</span>
                <input type="text" value={rule.replacement} onChange={(e) => {
                  const newRules = [...regexRules];
                  newRules[idx].replacement = e.target.value;
                  setRegexRules(newRules);
                }} placeholder="Replace" className="bg-black/50 border border-white/10 p-1.5 rounded text-[10px] w-1/3 outline-none" />
                <button onClick={() => setRegexRules((r: any[]) => r.filter(x => x.id !== rule.id))} className="text-[10px] text-red-500 ml-auto bg-white/5 px-2 py-1 rounded">✕</button>
              </div>
            ))}
            <button onClick={() => setRegexRules((r: any) => [...r, { id: Date.now(), pattern: '', flags: 'gu', replacement: '' }])} className="text-[10px] text-blue-400 w-full text-left bg-white/5 p-2 rounded border border-white/5 border-dashed mt-1">+ Add New Rule</button>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
          <button onClick={onMarkPreviousAsComplete} className="w-full bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase py-2 rounded transition-all">
            Mark All Previous as Complete
          </button>
        </div>
      </div>
    </div>
  );
}
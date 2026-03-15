"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import Link from "next/link";
import { THEMES, getFontStack } from "@/lib/constants";
import { useTranslation } from "@/hooks/useTranslation";
import { useEpub } from "@/hooks/useEpub";

export default function ReaderClient({ id }: { id: string }) {
  const novelId = parseInt(id);
  const novel = useLiveQuery(() => db.novels.get(novelId), [novelId]);
  const viewerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // UI State
  const [theme, setTheme] = useState("dark");
  const [fontSize, setFontSize] = useState(18);
  const [workFontSize, setWorkFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState("helvetica");
  const [showSettings, setShowSettings] = useState(false);
  
  // Translation & Highlight State
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [hlOptions, setHlOptions] = useState({ 
    enabled: true, color: "#3b82f6", opacity: 0.3, offset: 0 
  });
  
  // Auto Regex State (Loaded from LocalStorage so you don't lose rules)
  const [regexRules, setRegexRules] = useState<{id: number, pattern: string, flags: string, replacement: string}[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('vellum-regex-rules');
    if (saved) {
      setRegexRules(JSON.parse(saved));
    } else {
      setRegexRules([
        { id: 1, pattern: '“', flags: 'g', replacement: '"' },
        { id: 2, pattern: '”', flags: 'g', replacement: '"' }
      ]);
    }
  }, []);

  useEffect(() => {
    if (regexRules.length > 0) {
      localStorage.setItem('vellum-regex-rules', JSON.stringify(regexRules));
    }
  }, [regexRules]);

  const colors = THEMES[theme as keyof typeof THEMES];

  const { rendition, toc, currentChapter } = useEpub(novel, viewerRef, novelId, {
    activeSentenceIdx, 
    hlEnabled: hlOptions.enabled,
    hlColor: hlOptions.color,
    hlOpacity: hlOptions.opacity,
    hlOffset: hlOptions.offset
  });

  const chapterHref = useMemo(() => currentChapter?.href, [currentChapter?.href]);

  const { translation, setTranslation, handleCursorMove, isSaving, isLoaded } = useTranslation(novelId, chapterHref, setActiveSentenceIdx);

  const markAsComplete = async (markPrevious = false) => {
    if (!novel || !currentChapter) return;
    let updatedList = [...(novel.completedChapters || [])];
    if (markPrevious) {
      const currentIndex = toc.findIndex(t => t.href === currentChapter.href);
      const previousHrefs = toc.slice(0, currentIndex + 1).map(t => t.href);
      updatedList = Array.from(new Set([...updatedList, ...previousHrefs]));
    } else {
      if (!updatedList.includes(currentChapter.href)) updatedList.push(currentChapter.href);
    }
    await db.novels.update(novelId, { completedChapters: updatedList });
  };

const markPreviousAsComplete = async () => {
  if (!novel || !currentChapter || !toc.length) return;

 
  const currentIndex = toc.findIndex(item => item.href === currentChapter.href);
  
  if (currentIndex === -1) return;

  const previousHrefs = toc.slice(0, currentIndex + 1).map(item => item.href);

  const existingCompleted = novel.completedChapters || [];
  const updatedCompleted = Array.from(new Set([...existingCompleted, ...previousHrefs]));

  await db.novels.update(novelId, { 
    completedChapters: updatedCompleted 
  });

  
  setShowSettings(false);
};


  const handleExportCurrentChapter = () => {
    if (!translation.trim()) return;
    const blob = new Blob([translation], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentChapter?.title || "Chapter"} - Translation.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyRegexRules = () => {
    if (!translation) return;
    let newText = translation;
    let modified = false;

    regexRules.forEach(rule => {
      if (!rule.pattern) return;
      try {
        const flags = rule.flags.includes('g') ? rule.flags : rule.flags + 'g';
        const regex = new RegExp(rule.pattern, flags);
        if (regex.test(newText)) {
          newText = newText.replace(regex, rule.replacement);
          modified = true;
        }
      } catch (err) {
        console.error("Invalid Regex:", rule.pattern, err);
      }
    });
    
    if (modified) {
      setTranslation(newText);
      textareaRef.current?.focus();
    }
  };

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (!e.altKey && e.key !== 'Escape') return;

    if (e.key === 'Escape') {
      setShowSettings(false);
      return;
    }

    if (e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'h':
          e.preventDefault();
          setHlOptions(p => ({ ...p, enabled: !p.enabled }));
          break;
        case 'arrowup':
          e.preventDefault();
          setHlOptions(p => ({ ...p, offset: p.offset - 1 }));
          break;
        case 'arrowdown':
          e.preventDefault();
          setHlOptions(p => ({ ...p, offset: p.offset + 1 }));
          break;
        case 'r':
          e.preventDefault();
          applyRegexRules();
          break;
        case 'arrowleft':
          e.preventDefault();
          if ((rendition as any)?.manager) rendition?.prev();
          break;
        case 'arrowright':
          e.preventDefault();
          if ((rendition as any)?.manager) rendition?.next();
          break;
      }
    }
  }, [rendition, translation, regexRules]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);

  useEffect(() => {
    if (!rendition) return;
    rendition.themes.register("custom", {
      body: { 
        background: `${colors.bg} !important`, color: `${colors.fg} !important`, 
        "font-family": `${getFontStack(fontFamily)} !important` 
      },
      p: { "font-size": `${fontSize}px !important`, "line-height": "1.7 !important", "margin-bottom": "1.5em !important" }
    });
    rendition.themes.select("custom");
  }, [theme, fontSize, fontFamily, rendition, colors]);

  if (!novel) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden transition-colors duration-300 relative" style={{ backgroundColor: colors.bg, color: colors.fg }}>
      
      {/* HEADER */}
      <header className="h-14 border-b border-white/10 flex items-center px-4 justify-between shrink-0 z-10 shadow-xl" style={{ backgroundColor: colors.panel }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[10px] font-black opacity-50 hover:opacity-100 uppercase tracking-tighter transition-opacity">[ Exit ]</Link>
          <select 
          className="bg-black/40 border border-white/10 text-[9px] font-black uppercase px-2 py-1 outline-none max-w-[140px] cursor-pointer rounded"
          style={{ backgroundColor: colors.panel, color: colors.fg }}
          value={currentChapter?.href || ""} 
          onChange={(e) => rendition?.display(e.target.value)}
        >
          {toc.map((chapter, i) => {
            const isDone = novel.completedChapters?.includes(chapter.href);
            return (
              <option key={i} value={chapter.href} className="bg-[#141417] text-white">
                {isDone ? "✓ " : ""}{chapter.label.trim()}
              </option>
            );
          })}
        </select>
          <button onClick={() => setShowSettings(!showSettings)} className={`text-[9px] font-black uppercase px-3 py-1.5 rounded transition-all shadow-sm ${showSettings ? "bg-blue-600 text-white" : "bg-white/5 border border-white/10 opacity-70 hover:opacity-100 hover:bg-white/10"}`}>
            Settings
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => markAsComplete(false)} className="text-[9px] font-black uppercase px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500 hover:text-white transition-all shadow-sm">Mark Complete</button>
          <div className="flex gap-1">
            <button onClick={() => (rendition as any)?.manager && rendition?.prev()} className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold hover:bg-white/10 transition-colors shadow-sm">PREV</button>
            <button onClick={() => (rendition as any)?.manager && rendition?.next()} className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold hover:bg-white/10 transition-colors shadow-sm">NEXT</button>
          </div>
        </div>
      </header>

      {/* MAIN VIEW */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* SOURCE */}
        <div className="flex-1 border-r border-white/10 relative overflow-hidden flex flex-col">
          <div className="py-2 px-4 text-[8px] opacity-40 font-black uppercase tracking-[0.4em] border-b border-white/10 shrink-0 flex justify-between">
            <span>Source : {currentChapter?.title || "..." }</span>
          </div>
          <div ref={viewerRef} className="flex-1" />
        </div>

        {/* WORKSPACE */}
        <div className="flex-1 flex flex-col relative">
          <div className="py-2 px-4 border-b border-white/10 shrink-0 flex justify-between items-center bg-black/10">
            <div className="flex items-center gap-3">
              <span className="text-[8px] opacity-40 font-black uppercase tracking-[0.4em]">Workspace</span>
              
              {/* Mobile-friendly Offset Controls */}
              <div className="flex items-center bg-black/40 border border-white/10 rounded overflow-hidden">
                <span className="text-[8px] uppercase font-bold text-white/50 px-2">Offset</span>
                <button onClick={() => setHlOptions(p => ({ ...p, offset: p.offset - 1 }))} className="w-6 h-5 flex items-center justify-center bg-white/5 hover:bg-white/20 text-xs transition-colors border-l border-white/10">-</button>
                <span className="text-[10px] w-5 text-center font-mono font-bold">{hlOptions.offset}</span>
                <button onClick={() => setHlOptions(p => ({ ...p, offset: p.offset + 1 }))} className="w-6 h-5 flex items-center justify-center bg-white/5 hover:bg-white/20 text-xs transition-colors border-l border-white/10">+</button>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex gap-2 items-center">
                {/* Clean, Refined Action Buttons */}
                <button onClick={applyRegexRules} className="bg-purple-600/80 hover:bg-purple-500 text-white text-[9px] uppercase font-bold px-3 py-1.5 rounded transition-all shadow-sm border border-purple-400/30">
                  Auto-Format
                </button>
                <button onClick={handleExportCurrentChapter} className="bg-blue-600/80 hover:bg-blue-500 text-white text-[9px] uppercase font-bold px-3 py-1.5 rounded transition-all shadow-sm border border-blue-400/30">
                  Export TXT
                </button>
              </div>
              <div className="flex gap-4 items-center text-[9px] font-black uppercase tracking-wider">
                <span className="text-blue-500">IDX: {activeSentenceIdx}</span>
                <span className={isSaving ? "text-yellow-500" : "text-green-500"}>
                  {isSaving ? "SYNCING..." : "SAVED"}
                </span>
              </div>
            </div>
          </div>

          <textarea 
            ref={textareaRef}
            value={translation} 
            disabled={!isLoaded}
            onSelect={handleCursorMove}
            onKeyUp={handleCursorMove}
            onClick={handleCursorMove}
            onChange={(e) => { setTranslation(e.target.value); handleCursorMove(e); }} 
            autoFocus
            style={{ fontSize: `${workFontSize}px`, fontFamily: getFontStack(fontFamily) }}
            className={`flex-1 p-8 bg-transparent outline-none resize-none leading-relaxed transition-opacity duration-300 ${!isLoaded ? 'opacity-20 cursor-wait' : 'opacity-100'}`}
            placeholder={isLoaded ? "Begin translation..." : "Loading Workspace..."} 
          />
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="absolute top-14 left-4 z-50 bg-[#141417] border border-white/10 shadow-2xl p-6 flex flex-col gap-6 w-[400px] text-white rounded-md">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-blue-400">Settings</h2>
            <button onClick={() => setShowSettings(false)} className="text-xs opacity-50 hover:opacity-100 hover:text-red-400 transition-colors font-bold">✕</button>
          </div>

          {/*  Shortcuts Cheatsheet */}
          <div className="bg-black/40 p-3 rounded-md border border-white/5 space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase opacity-50 mb-2 border-b border-white/10 pb-1">Keybinds (Requires Alt)</h3>
            <div className="flex justify-between text-[10px]"><span className="opacity-70">Toggle Highlight</span><span className="font-mono text-blue-400 bg-white/5 px-1 rounded">Alt + H</span></div>
            <div className="flex justify-between text-[10px]"><span className="opacity-70">Shift Offset Up/Down</span><span className="font-mono text-blue-400 bg-white/5 px-1 rounded">Alt + ↑ / ↓</span></div>
            <div className="flex justify-between text-[10px]"><span className="opacity-70">Prev/Next Chapter</span><span className="font-mono text-blue-400 bg-white/5 px-1 rounded">Alt + ← / →</span></div>
            <div className="flex justify-between text-[10px]"><span className="opacity-70">Run Auto-Regex</span><span className="font-mono text-purple-400 bg-white/5 px-1 rounded">Alt + R</span></div>
            <div className="flex justify-between text-[10px]"><span className="opacity-70">Close Settings</span><span className="font-mono text-white/50 bg-white/5 px-1 rounded">Esc</span></div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase opacity-50">Theme</label>
              <select value={theme} onChange={e => setTheme(e.target.value)} className="bg-black/50 border border-white/10 p-2 text-xs outline-none focus:border-blue-500 rounded cursor-pointer">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="sepia">Sepia</option>
              </select>
            </div>
            
            <div className="flex gap-4">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-bold uppercase opacity-50">EPUB Font Size ({fontSize}px)</label>
                <input type="range" min="12" max="36" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="accent-blue-500 cursor-pointer" />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-bold uppercase opacity-50">Work Font Size ({workFontSize}px)</label>
                <input type="range" min="12" max="36" value={workFontSize} onChange={e => setWorkFontSize(parseInt(e.target.value))} className="accent-blue-500 cursor-pointer" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase opacity-50">Auto-Regex Rules</label>
              <div className="bg-black/40 p-2 border border-white/10 rounded max-h-40 overflow-y-auto space-y-2 custom-scrollbar">
                {regexRules.map((rule, idx) => (
                  <div key={rule.id} className="flex gap-2 items-center">
                    <input type="text" value={rule.pattern} onChange={(e) => {
                      const newRules = [...regexRules];
                      newRules[idx].pattern = e.target.value;
                      setRegexRules(newRules);
                    }} placeholder="Regex (e.g. “)" className="bg-black/50 border border-white/10 p-1.5 rounded text-xs w-1/3 outline-none focus:border-purple-500" />
                    <span className="text-white/30 text-[10px]">→</span>
                    <input type="text" value={rule.replacement} onChange={(e) => {
                      const newRules = [...regexRules];
                      newRules[idx].replacement = e.target.value;
                      setRegexRules(newRules);
                    }} placeholder='Replace (e.g. ")' className="bg-black/50 border border-white/10 p-1.5 rounded text-xs w-1/3 outline-none focus:border-purple-500" />
                    <button onClick={() => setRegexRules(r => r.filter(x => x.id !== rule.id))} className="text-[10px] text-red-500 hover:text-red-400 ml-auto bg-white/5 px-2 py-1 rounded">✕</button>
                  </div>
                ))}
                <button onClick={() => setRegexRules(r => [...r, { id: Date.now(), pattern: '', flags: 'g', replacement: '' }])} className="text-[10px] text-blue-400 hover:text-blue-300 w-full text-left bg-white/5 p-2 rounded border border-white/5 border-dashed border-opacity-50 mt-1">+ Add New Rule</button>
              </div>
              {/* Bulk Actions Section */}
              <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                <label className="text-[10px] font-bold uppercase opacity-50">Bulk Actions</label>
                <button 
                  onClick={markPreviousAsComplete}
                  className="w-full bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase py-2 rounded transition-all shadow-sm"
                >
                  Mark All Previous as Complete
                </button>
                <p className="text-[8px] opacity-40 italic px-1">
                  This will mark the current chapter and every chapter before it as read.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
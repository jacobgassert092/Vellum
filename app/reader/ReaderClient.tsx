"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import Link from "next/link";
import { THEMES, getFontStack } from "@/lib/constants";
import { useTranslation } from "@/hooks/useTranslation";
import { useEpub } from "@/hooks/useEpub";
import SettingsModal from "@/components/SettingsModal";

export default function ReaderClient({ id }: { id: string }) {
  const novelId = parseInt(id);
  const novel = useLiveQuery(() => db.novels.get(novelId), [novelId]);
  const viewerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [theme, setTheme] = useState("dark");
  const [fontSize, setFontSize] = useState(18);
  const [workFontSize, setWorkFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState("helvetica");
  const [showSettings, setShowSettings] = useState(false);
  
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [hlOptions, setHlOptions] = useState({ 
    enabled: true, color: "#3b82f6", opacity: 0.3, 
    underlineActive: true, underlineColor: "#3b82f6", underlineThickness: 2,
    finishedColor: "#3b82f6", finishedOpacity: 0.15, offset: 0, 
    showFinished: true, highlightWorkingLine: true 
  });
  
  const [regexRules, setRegexRules] = useState<{id: number, pattern: string, flags: string, replacement: string}[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('vellum-regex-rules');
    if (saved) setRegexRules(JSON.parse(saved));
  }, []);

  const colors = THEMES[theme as keyof typeof THEMES] || THEMES.dark;

  const epubOptions = useMemo(() => ({
    activeSentenceIdx, 
    hlEnabled: hlOptions.enabled,
    hlColor: hlOptions.color,
    hlOpacity: hlOptions.opacity,
    hlFinishedColor: hlOptions.finishedColor,
    hlFinishedOpacity: hlOptions.finishedOpacity,
    hlOffset: hlOptions.offset,
    hlFinishedEnabled: hlOptions.showFinished,
    underlineActive: hlOptions.underlineActive,
    underlineColor: hlOptions.underlineColor,
    underlineThickness: hlOptions.underlineThickness,
    textColor: colors.fg,
    fontSize
  }), [fontSize, activeSentenceIdx, hlOptions, colors.fg]);

  const { rendition, toc, currentChapter } = useEpub(novel, viewerRef, novelId, epubOptions);
  const { translation, setTranslation, handleCursorMove, isLoaded } = useTranslation(novelId, currentChapter?.href, setActiveSentenceIdx);

  const markPreviousAsComplete = async () => {
    if (!novel || !currentChapter || !toc.length) return;
    const currentIndex = toc.findIndex(item => item.href === currentChapter.href);
    const previousHrefs = toc.slice(0, currentIndex + 1).map(item => item.href);
    const updatedCompleted = Array.from(new Set([...(novel.completedChapters || []), ...previousHrefs]));
    await db.novels.update(novelId, { completedChapters: updatedCompleted });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden transition-colors duration-300 relative" style={{ backgroundColor: colors.bg, color: colors.fg }}>
      <style dangerouslySetInnerHTML={{ __html: `
        #workspace-area {
          color: ${colors.fg} !important;
          caret-color: ${colors.fg} !important;
          background-color: transparent !important;
        }
        #workspace-area::placeholder { color: ${colors.fg}; opacity: 0.2; }
      `}} />

      <header className="h-14 border-b border-white/10 flex items-center px-4 justify-between shrink-0 z-10" style={{ backgroundColor: colors.panel }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[10px] font-black opacity-50 hover:opacity-100 uppercase tracking-tighter">[ Exit ]</Link>
          <button onClick={() => setShowSettings(!showSettings)} className={`text-[9px] font-black uppercase px-3 py-1.5 rounded transition-all ${showSettings ? "bg-blue-600 text-white" : "bg-white/5 border border-white/10 hover:bg-white/10"}`}>Settings</button>
        </div>
        <div className="flex items-center gap-1">
            <button onClick={() => (rendition as any)?.prev()} className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold">PREV</button>
            <button onClick={() => (rendition as any)?.next()} className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold">NEXT</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 border-r border-white/10 relative overflow-hidden">
          <div ref={viewerRef} className="h-full w-full" />
        </div>

        <div className="flex-1 flex flex-col relative">
          
          {/* WORKSPACE SUB-HEADER / OFFSET CONTROLS */}
          <div className="py-2 px-4 border-b border-white/10 shrink-0 flex justify-between items-center bg-black/10">
            <div className="flex items-center gap-3">
              <span className="text-[8px] opacity-40 font-black uppercase tracking-[0.4em]">Workspace</span>
              
              {/* Offset Buttons */}
              <div className="flex items-center bg-black/40 border border-white/10 rounded overflow-hidden">
                <span className="text-[8px] uppercase font-bold text-white/50 px-2">Offset</span>
                <button 
                  onClick={() => setHlOptions(p => ({ ...p, offset: p.offset - 1 }))} 
                  className="w-6 h-5 flex items-center justify-center bg-white/5 hover:bg-white/20 border-l border-white/10"
                >
                  -
                </button>
                <span className="text-[10px] w-5 text-center font-mono font-bold">{hlOptions.offset}</span>
                <button 
                  onClick={() => setHlOptions(p => ({ ...p, offset: p.offset + 1 }))} 
                  className="w-6 h-5 flex items-center justify-center bg-white/5 hover:bg-white/20 border-l border-white/10"
                >
                  +
                </button>
              </div>
            </div>
            
            {/* Active Sentence Tracking */}
            <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-wider text-blue-500">
              IDX: {activeSentenceIdx}
            </div>
          </div>

          <textarea 
            id="workspace-area"
            ref={textareaRef}
            value={translation} 
            disabled={!isLoaded}
            onSelect={handleCursorMove}
            onChange={(e) => { setTranslation(e.target.value); handleCursorMove(e); }} 
            style={{ 
              fontSize: `${workFontSize}px`, 
              fontFamily: getFontStack(fontFamily),
              borderLeft: hlOptions.highlightWorkingLine 
                ? `4px solid ${hlOptions.color}${Math.floor(hlOptions.opacity * 255).toString(16).padStart(2, '0')}` 
                : '4px solid transparent'
            }}
            className="flex-1 p-8 outline-none resize-none leading-relaxed transition-all"
            placeholder="Begin translation..." 
          />
        </div>
      </div>

      <SettingsModal 
        isOpen={showSettings} onClose={() => setShowSettings(false)}
        theme={theme} setTheme={setTheme}
        fontSize={fontSize} setFontSize={setFontSize}
        workFontSize={workFontSize} setWorkFontSize={setWorkFontSize}
        hlOptions={hlOptions} setHlOptions={setHlOptions}
        regexRules={regexRules} setRegexRules={setRegexRules}
        onMarkPreviousAsComplete={markPreviousAsComplete}
      />
    </div>
  );
}
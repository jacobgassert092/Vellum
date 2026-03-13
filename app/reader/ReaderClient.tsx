"use client";

import { useRef, useState, useEffect, useMemo } from "react";
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

  const [theme, setTheme] = useState("dark");
  const [fontSize, setFontSize] = useState(18);
  const [workFontSize, setWorkFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState("helvetica");
  const [showSettings, setShowSettings] = useState(false);
  
  const [hlOptions, setHlOptions] = useState({ 
    enabled: true, 
    color: "#3b82f6", 
    opacity: 0.2, 
    offset: 0 
  });

  const colors = THEMES[theme as keyof typeof THEMES];

  //  Setup EPUB hook first to get the current chapter context
  const { rendition, toc, currentChapter } = useEpub(novel, viewerRef, novelId, {
    activeSentenceIdx: 0, // Initial value, logic handled by useTranslation below
    hlEnabled: hlOptions.enabled,
    hlColor: hlOptions.color,
    hlOpacity: hlOptions.opacity,
    hlOffset: hlOptions.offset
  });

  //  Memoize the href to prevent unnecessary re-renders of the translation hook
  const chapterHref = useMemo(() => currentChapter?.href, [currentChapter?.href]);

 // Initialize translation logic with the stable chapterHref
  const { 
    translation, 
    setTranslation, 
    activeSentenceIdx, 
    handleCursorMove, 
    isSaving, 
    isLoaded 
  } = useTranslation(novelId, chapterHref);

  // Bulk Progress Logic
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

  console.log("ReaderClient rendering for ID:", id);
  console.log("Current Chapter object:", currentChapter);

  // Sync Styles to EPUB
  useEffect(() => {
    if (!rendition) return;
    rendition.themes.register("custom", {
      body: { 
        background: `${colors.bg} !important`, 
        color: `${colors.fg} !important`, 
        "font-family": `${getFontStack(fontFamily)} !important` 
      },
      p: { 
        "font-size": `${fontSize}px !important`, 
        "line-height": "1.7 !important",
        "margin-bottom": "1.5em !important"
      }
    });
    rendition.themes.select("custom");
  }, [theme, fontSize, fontFamily, rendition, colors]);

  if (!novel) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden transition-colors duration-300" style={{ backgroundColor: colors.bg, color: colors.fg }}>
      
      {/* HEADER */}
      <header className="h-14 border-b border-white/10 flex items-center px-4 justify-between shrink-0 z-50 shadow-xl" style={{ backgroundColor: colors.panel }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[10px] font-black opacity-50 hover:opacity-100 uppercase tracking-tighter transition-opacity">[ Exit ]</Link>
          <select 
            className="bg-black/40 border border-white/10 text-[9px] font-black uppercase px-2 py-1 outline-none max-w-[140px] cursor-pointer"
            style={{ backgroundColor: colors.panel, color: colors.fg }}
            value={currentChapter?.href || ""} 
            onChange={(e) => rendition?.display(e.target.value)}
          >
            {toc.map((chapter, i) => (
              <option key={i} value={chapter.href} className="bg-[#141417] text-white">
                {chapter.label.trim()}
              </option>
            ))}
          </select>
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className={`text-[9px] font-black uppercase px-3 py-1 border transition-all ${showSettings ? "bg-blue-600 border-blue-400 text-white" : "bg-black/20 border-white/10 opacity-60"}`}
          >
            Settings
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => markAsComplete(false)} className="text-[9px] font-black uppercase px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500 hover:text-white transition-all">Mark Complete</button>
          <div className="flex gap-1">
            <button onClick={() => (rendition as any)?.manager && rendition?.prev()} className="px-3 py-1 bg-black/20 border border-white/10 text-[9px] font-bold hover:bg-white/5">PREV</button>
            <button onClick={() => (rendition as any)?.manager && rendition?.next()} className="px-3 py-1 bg-black/20 border border-white/10 text-[9px] font-bold hover:bg-white/5">NEXT</button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="absolute top-16 left-4 w-72 border border-white/10 p-6 z-[60] shadow-2xl space-y-6 backdrop-blur-md" style={{ backgroundColor: colors.panel }}>
          <div className="space-y-4">
            <h4 className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] border-b border-white/10 pb-2">Appearance</h4>
            <div className="flex gap-2">
              {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map(t => (
                <button key={t} onClick={() => setTheme(t)} className={`flex-1 h-8 rounded border transition-all ${theme === t ? "border-blue-500 scale-105" : "border-white/10 opacity-50 hover:opacity-100"}`} style={{ backgroundColor: THEMES[t].bg }} />
              ))}
            </div>
          </div>

          {[ 
            { label: "Source", size: fontSize, setSize: setFontSize }, 
            { label: "Workspace", size: workFontSize, setSize: setWorkFontSize } 
          ].map((ctrl) => (
            <div key={ctrl.label} className="space-y-3">
              <h4 className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] border-b border-white/10 pb-2">{ctrl.label} Controls</h4>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span>Font Size</span>
                <div className="flex gap-1">
                  <button onClick={() => ctrl.setSize(s => s - 1)} className="w-8 h-7 bg-black/20 border border-white/10 hover:bg-white/10">-</button>
                  <div className="w-8 h-7 flex items-center justify-center bg-black/40 border border-white/10">{ctrl.size}</div>
                  <button onClick={() => ctrl.setSize(s => s + 1)} className="w-8 h-7 bg-black/20 border border-white/10 hover:bg-white/10">+</button>
                </div>
              </div>
            </div>
          ))}

          <div className="space-y-4">
            <h4 className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] border-b border-white/10 pb-2">Highlight Style</h4>
            <div className="flex justify-between items-center text-[10px] font-bold">
              <span>Color</span>
              <input 
                type="color" 
                value={hlOptions.color}
                onChange={(e) => setHlOptions(p => ({ ...p, color: e.target.value }))}
                className="w-8 h-6 bg-transparent border-none cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold">
                <span>Opacity</span>
                <span>{Math.round(hlOptions.opacity * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.05" max="1" step="0.05"
                value={hlOptions.opacity}
                onChange={(e) => setHlOptions(p => ({ ...p, opacity: parseFloat(e.target.value) }))}
                className="w-full h-1 bg-white/10 appearance-none rounded-full accent-blue-500 cursor-pointer"
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold">
              <span>Highlight Offset</span>
              <div className="flex gap-1">
                <button onClick={() => setHlOptions(p => ({ ...p, offset: p.offset - 1 }))} className="w-8 h-7 bg-black/20 border border-white/10">-</button>
                <div className="w-8 h-7 flex items-center justify-center bg-black/40 border border-white/10">{hlOptions.offset}</div>
                <button onClick={() => setHlOptions(p => ({ ...p, offset: p.offset + 1 }))} className="w-8 h-7 bg-black/20 border border-white/10">+</button>
              </div>
            </div>
          </div>

          <button onClick={() => { if(confirm("Bulk mark previous?")) markAsComplete(true); }} className="w-full py-2 bg-black/20 border border-white/10 text-[9px] font-black uppercase opacity-60 hover:opacity-100 transition-all">Bulk Mark Previous</button>
        </div>
      )}

      {/* MAIN VIEW */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 border-r border-white/10 relative overflow-hidden flex flex-col">
          <div className="py-2 px-4 text-[8px] opacity-40 font-black uppercase tracking-[0.4em] border-b border-white/10 shrink-0 flex justify-between">
            <span>Source : {currentChapter?.title || "..." }</span>
            {novel.completedChapters?.includes(currentChapter?.href || "") && <span className="text-green-500">[ COMPLETED ]</span>}
          </div>
          <div ref={viewerRef} className="flex-1" />
        </div>

        <div className="flex-1 flex flex-col">
          <div className="py-2 px-4 text-[8px] opacity-40 font-black uppercase tracking-[0.4em] border-b border-white/10 shrink-0 flex justify-between items-center">
            <span>Workspace</span>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 px-2 py-0.5 rounded-sm">
                <span className="text-blue-500/70 uppercase">HL Offset: {hlOptions.offset}</span>
                <div className="flex gap-1.5 ml-1">
                  <button onClick={() => setHlOptions(p => ({ ...p, offset: p.offset - 1 }))} className="hover:text-blue-400 transition-colors text-[10px] font-bold">[ - ]</button>
                  <button onClick={() => setHlOptions(p => ({ ...p, offset: p.offset + 1 }))} className="hover:text-blue-400 transition-colors text-[10px] font-bold">[ + ]</button>
                  <button onClick={() => setHlOptions(p => ({ ...p, offset: 0 }))} className="ml-1 opacity-30 hover:opacity-100 transition-opacity">↺</button>
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <button 
                  onClick={handleExportCurrentChapter} 
                  className="text-[9px] font-black uppercase text-white/30 hover:text-blue-400 transition-colors"
                  title="Export current chapter to .txt"
                >
                  [ Export ] 
                </button>
              </div>
              <div className="flex gap-4 items-center">
                <span className="text-blue-500">INDEX: {activeSentenceIdx}</span>
                <span className={isSaving ? "text-yellow-500" : "text-green-500"}>
                  {isSaving ? "SYNCING..." : "SAVED"}
                </span>
              </div>
            </div>
          </div>

          <textarea 
            value={translation} 
            disabled={!isLoaded}
            onSelect={handleCursorMove}
            onKeyUp={handleCursorMove}
            onChange={(e) => {
              setTranslation(e.target.value);
              handleCursorMove(e);
            }} 
            style={{ 
              fontSize: `${workFontSize}px`, 
              fontFamily: getFontStack(fontFamily),
              letterSpacing: fontFamily === "helvetica" ? "-0.02em" : "normal"
            }}
            className={`flex-1 p-8 bg-transparent outline-none resize-none leading-relaxed transition-opacity duration-300 ${!isLoaded ? 'opacity-20 cursor-wait' : 'opacity-100'}`}
            placeholder={isLoaded ? "Begin translation..." : "Loading Workspace..."} 
          />
        </div>
      </div>
    </div>
  );
}
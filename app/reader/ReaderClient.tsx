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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // UI State
  const [theme, setTheme] = useState("dark");
  const [fontSize, setFontSize] = useState(18);
  const [workFontSize, setWorkFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState("helvetica");
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"global" | "chapter" | "source">("global");
  
  // Translation & Highlight State
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [workspaceSelection, setWorkspaceSelection] = useState("");
  
  const [hlOptions, setHlOptions] = useState({ 
    enabled: true, color: "#3b82f6", opacity: 0.3, offset: 0 
  });
  const colors = THEMES[theme as keyof typeof THEMES];

  // Notes Database Queries
  const globalNote = useLiveQuery(() => db.globalNotes.get(novelId), [novelId]);
  const chapterNotes = useLiveQuery(() => 
    db.chapterNotes.where({ novelId }).toArray(), [novelId]
  );
  const sourceHighlights = useLiveQuery(() => 
    db.sourceHighlights.where({ novelId }).toArray(), [novelId]
  );

  // Handlers for Source Custom Highlights
  const handleAddCustomHighlight = async (cfiRange: string, text: string) => {
    if (!currentChapter?.href) return;
    await db.sourceHighlights.put({
      id: cfiRange,
      novelId,
      chapterHref: currentChapter.href,
      cfiRange,
      text,
      color: "#facc15", // Default Yellow
      note: ""
    });
    setShowSidebar(true);
    setSidebarTab("source");
  };

  const { rendition, toc, currentChapter } = useEpub(novel, viewerRef, novelId, {
    activeSentenceIdx, 
    hlEnabled: hlOptions.enabled,
    hlColor: hlOptions.color,
    hlOpacity: hlOptions.opacity,
    hlOffset: hlOptions.offset,
    customHighlights: sourceHighlights?.filter(h => h.chapterHref === currentChapter?.href) || [],
    onAddCustomHighlight: handleAddCustomHighlight
  });

  const chapterHref = useMemo(() => currentChapter?.href, [currentChapter?.href]);

  const { translation, setTranslation, handleCursorMove, isSaving, isLoaded } = useTranslation(novelId, chapterHref, setActiveSentenceIdx);

  // Handlers for Notes
  const saveGlobalNote = (content: string) => {
    db.globalNotes.put({ novelId, content });
  };

  const handleWorkspaceSelect = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    if (start !== end) {
      setWorkspaceSelection(translation.substring(start, end));
    } else {
      setWorkspaceSelection("");
    }
  };

  const createChapterNote = async () => {
    if (!workspaceSelection || !chapterHref) return;
    await db.chapterNotes.add({
      novelId,
      chapterHref,
      quote: workspaceSelection,
      note: "",
      timestamp: Date.now()
    });
    setWorkspaceSelection("");
    setShowSidebar(true);
    setSidebarTab("chapter");
  };

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

  const currentChapterNotes = chapterNotes?.filter(n => n.chapterHref === chapterHref) || [];
  const currentChapterHighlights = sourceHighlights?.filter(h => h.chapterHref === chapterHref) || [];

  return (
    <div className="h-screen flex flex-col overflow-hidden transition-colors duration-300 relative" style={{ backgroundColor: colors.bg, color: colors.fg }}>
      
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
          <button onClick={() => setShowSettings(!showSettings)} className={`text-[9px] font-black uppercase px-3 py-1 border transition-all ${showSettings ? "bg-blue-600 border-blue-400 text-white" : "bg-black/20 border-white/10 opacity-60"}`}>
            Settings
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowSidebar(!showSidebar)} className={`text-[9px] font-black uppercase px-3 py-1 border transition-all ${showSidebar ? "bg-purple-600 border-purple-400 text-white" : "bg-black/20 border-white/10 opacity-60"}`}>
            Notes Panel
          </button>
          <button onClick={() => markAsComplete(false)} className="text-[9px] font-black uppercase px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500 hover:text-white transition-all">Mark Complete</button>
          <div className="flex gap-1">
            <button onClick={() => (rendition as any)?.manager && rendition?.prev()} className="px-3 py-1 bg-black/20 border border-white/10 text-[9px] font-bold hover:bg-white/5">PREV</button>
            <button onClick={() => (rendition as any)?.manager && rendition?.next()} className="px-3 py-1 bg-black/20 border border-white/10 text-[9px] font-bold hover:bg-white/5">NEXT</button>
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
          <div className="py-2 px-4 text-[8px] opacity-40 font-black uppercase tracking-[0.4em] border-b border-white/10 shrink-0 flex justify-between items-center h-8">
            <div className="flex items-center gap-4">
              <span>Workspace</span>
              {/* Contextual Action Button for Selected Text */}
              {workspaceSelection && (
                <button onClick={createChapterNote} className="bg-purple-500 text-white px-2 py-0.5 rounded-sm hover:bg-purple-400 transition-colors flex items-center gap-1">
                  <span>+ Annotate Selection</span>
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex gap-4 items-center">
                <button onClick={handleExportCurrentChapter} className="text-[9px] font-black uppercase text-white/30 hover:text-blue-400 transition-colors" title="Export current chapter to .txt">[ Export ] </button>
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
            ref={textareaRef}
            value={translation} 
            disabled={!isLoaded}
            onSelect={(e) => { handleCursorMove(e); handleWorkspaceSelect(); }}
            onKeyUp={(e) => { handleCursorMove(e); handleWorkspaceSelect(); }}
            onClick={handleWorkspaceSelect}
            onChange={(e) => { setTranslation(e.target.value); handleCursorMove(e); }} 
            style={{ fontSize: `${workFontSize}px`, fontFamily: getFontStack(fontFamily) }}
            className={`flex-1 p-8 bg-transparent outline-none resize-none leading-relaxed transition-opacity duration-300 ${!isLoaded ? 'opacity-20 cursor-wait' : 'opacity-100'}`}
            placeholder={isLoaded ? "Begin translation..." : "Loading Workspace..."} 
          />
        </div>

        {/* NOTES SIDEBAR */}
        {showSidebar && (
          <div className="w-80 border-l border-white/10 flex flex-col bg-black/40 backdrop-blur-md z-40 shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] transition-all duration-300">
            {/* Tabs */}
            <div className="flex border-b border-white/10 text-[9px] font-black uppercase tracking-widest shrink-0">
              <button onClick={() => setSidebarTab("global")} className={`flex-1 py-3 ${sidebarTab === "global" ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-500" : "opacity-50 hover:bg-white/5"}`}>Global</button>
              <button onClick={() => setSidebarTab("chapter")} className={`flex-1 py-3 ${sidebarTab === "chapter" ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-500" : "opacity-50 hover:bg-white/5"}`}>Workspace</button>
              <button onClick={() => setSidebarTab("source")} className={`flex-1 py-3 ${sidebarTab === "source" ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-500" : "opacity-50 hover:bg-white/5"}`}>Source</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
              
              {/* GLOBAL TAB */}
              {sidebarTab === "global" && (
                <div className="flex-1 flex flex-col space-y-2">
                  <div className="text-[10px] font-bold opacity-50 uppercase">Novel Lore & Dictionary</div>
                  <textarea 
                    className="flex-1 bg-black/40 border border-white/10 p-3 outline-none text-sm resize-none rounded-md focus:border-purple-500 transition-colors"
                    placeholder="Names, locations, magic systems, rules..."
                    value={globalNote?.content || ""}
                    onChange={(e) => saveGlobalNote(e.target.value)}
                  />
                </div>
              )}

              {/* WORKSPACE CHAPTER NOTES TAB */}
              {sidebarTab === "chapter" && (
                <div className="space-y-4">
                  <div className="text-[10px] font-bold opacity-50 uppercase">Translation Annotations</div>
                  {currentChapterNotes.length === 0 && <div className="text-xs opacity-40 italic">Highlight text in your workspace to add a note.</div>}
                  {currentChapterNotes.map(note => (
                    <div key={note.id} className="bg-black/40 border border-white/10 p-3 rounded-md space-y-2 relative group">
                      <button onClick={() => db.chapterNotes.delete(note.id!)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 text-xs">✕</button>
                      <div className="text-xs italic opacity-70 border-l-2 border-purple-500 pl-2">"{note.quote}"</div>
                      <textarea 
                        className="w-full bg-transparent border-none outline-none text-sm resize-none"
                        placeholder="Write note here..."
                        value={note.note}
                        onChange={(e) => db.chapterNotes.update(note.id!, { note: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* SOURCE HIGHLIGHTS TAB */}
              {sidebarTab === "source" && (
                <div className="space-y-4">
                  <div className="text-[10px] font-bold opacity-50 uppercase">Original Text Highlights</div>
                  {currentChapterHighlights.length === 0 && <div className="text-xs opacity-40 italic">Select text in the EPUB source to highlight it.</div>}
                  {currentChapterHighlights.map(hl => (
                    <div key={hl.id} className="bg-black/40 border border-white/10 p-3 rounded-md space-y-2 relative group">
                      <button onClick={() => db.sourceHighlights.delete(hl.id!)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 text-xs">✕</button>
                      <div className="text-xs font-serif leading-relaxed" style={{ color: hl.color }}>{hl.text}</div>
                      
                      <div className="flex gap-2 items-center">
                        <input type="color" value={hl.color} onChange={(e) => db.sourceHighlights.update(hl.id!, { color: e.target.value })} className="w-5 h-5 bg-transparent border-none cursor-pointer p-0" />
                        <input type="text" placeholder="Add note..." value={hl.note} onChange={(e) => db.sourceHighlights.update(hl.id!, { note: e.target.value })} className="flex-1 bg-transparent border-b border-white/10 outline-none text-xs pb-1 focus:border-purple-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
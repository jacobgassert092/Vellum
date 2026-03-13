"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import ePub, { Rendition } from "epubjs";

export default function ReaderClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const novelId = parseInt(id);
  const novel = useLiveQuery(() => db.novels.get(novelId), [novelId]);
  const initialLoc = searchParams.get("loc");

  const viewerRef = useRef<HTMLDivElement>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [toc, setToc] = useState<any[]>([]);
  const [currentChapter, setCurrentChapter] = useState<{ title: string, href: string } | null>(null);

  const [showSettings, setShowSettings] = useState(false);

  
  const [fontSize, setFontSize] = useState(18);
  const [workFontSize, setWorkFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState("helvetica");
  const [theme, setTheme] = useState("dark");

  const [translation, setTranslation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const themes = {
    dark: { bg: "#0b0b0e", fg: "#d1d5db", panel: "#141417" },
    light: { bg: "#ffffff", fg: "#1a1a1a", panel: "#f3f4f6" },
    sepia: { bg: "#f4ecd8", fg: "#5b4636", panel: "#e8dfc8" }
  };

  // Standardized Font Stacks
  const getFontStack = (key: string) => {
    switch (key) {
      case "helvetica":
        return "Helvetica, Arial, sans-serif";
      case "serif":
        return "'Georgia', 'Times New Roman', serif";
      case "monospace":
        return "'JetBrains Mono', 'Fira Code', monospace";
      default:
        return "Helvetica, Arial, sans-serif";
    }
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

  useEffect(() => {
    if (!rendition) return;

    rendition.themes.register("custom", {
      body: { 
        background: `${themes[theme as keyof typeof themes].bg} !important`, 
        color: `${themes[theme as keyof typeof themes].fg} !important`,
        "font-family": `${getFontStack(fontFamily)} !important`,
      },
      p: { 
        "font-size": `${fontSize}px !important`, 
        "line-height": "1.7 !important",
        "margin-bottom": "1.5em !important"
      }
    });
    rendition.themes.select("custom");
  }, [fontSize, fontFamily, theme, rendition]);

  useEffect(() => {
    if (!currentChapter || !novelId) return;
    db.translations.get(`${novelId}_${currentChapter.href}`).then(entry => setTranslation(entry?.content || ""));
  }, [currentChapter, novelId]);

  useEffect(() => {
    if (!currentChapter || !novelId) return;
    const timer = setTimeout(async () => {
      setIsSaving(true);
      await db.translations.put({ id: `${novelId}_${currentChapter.href}`, novelId, chapterHref: currentChapter.href, content: translation });
      setIsSaving(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [translation, currentChapter, novelId]);

 
  useEffect(() => {
    let book: any = null;
    if (novel?.fileData && viewerRef.current) {
      viewerRef.current.innerHTML = "";
      book = ePub(novel.fileData);
      book.loaded.navigation.then((nav: any) => setToc(nav.toc));
      const newRendition = book.renderTo(viewerRef.current, { width: "100%", height: "100%", flow: "scrolled", manager: "default" });

      newRendition.on("relocated", async (location: any) => {
        const item = book.spine.get(location.start.href);
        const href = item.href;
        await db.novels.update(novelId, { currentLocation: href });
        const params = new URLSearchParams(window.location.search);
        params.set("loc", href);
        window.history.replaceState(null, "", `?${params.toString()}`);
        book.loaded.navigation.then((nav: any) => {
          const chapter = nav.toc.find((t: any) => t.href.includes(href));
          setCurrentChapter({ title: chapter?.label.trim() || "Section", href });
        });
      });

      newRendition.display(initialLoc || novel.currentLocation || undefined);
      setRendition(newRendition);
      return () => book.destroy();
    }
  }, [novel?.fileData, novelId]);

  if (!novel) return null;

  const currentColors = themes[theme as keyof typeof themes];

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans transition-colors duration-300" style={{ backgroundColor: currentColors.bg, color: currentColors.fg }}>
      <header className="h-14 border-b border-white/10 flex items-center px-4 justify-between shrink-0 z-50 shadow-xl" style={{ backgroundColor: currentColors.panel }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[10px] font-black opacity-50 hover:opacity-100 uppercase tracking-tighter transition-opacity">[ Exit ]</Link>
          <select className="bg-black/40 border border-white/10 text-[9px] font-black uppercase px-2 py-1 outline-none max-w-[140px] appearance-none cursor-pointer hover:border-white/30 transition-colors"
            style={{ 
          backgroundColor: currentColors.panel, 
          color: currentColors.fg,              
  }}
  value={currentChapter?.href || ""} 
  onChange={(e) => rendition?.display(e.target.value)}
>
  {toc.map((chapter, i) => (
    <option 
      key={i} 
      value={chapter.href} 
      className="bg-[#141417] text-white py-2" 
    >
      {chapter.label.trim()}
    </option>
  ))}
</select>
          <button onClick={() => setShowSettings(!showSettings)} className={`text-[9px] font-black uppercase px-3 py-1 border transition-all ${showSettings ? "bg-blue-600 border-blue-400 text-white" : "bg-black/20 border-white/10 opacity-60 hover:opacity-100"}`}>Settings</button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => markAsComplete(false)} className="text-[9px] font-black uppercase px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500 hover:text-white transition-all">Mark Complete</button>
          <div className="flex gap-1">
            <button onClick={() => rendition?.prev()} className="px-3 py-1 bg-black/20 border border-white/10 text-[9px] font-bold hover:bg-white/5">PREV</button>
            <button onClick={() => rendition?.next()} className="px-3 py-1 bg-black/20 border border-white/10 text-[9px] font-bold hover:bg-white/5">NEXT</button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="absolute top-16 left-4 w-72 border border-white/10 p-6 z-[60] shadow-2xl space-y-6 backdrop-blur-md" style={{ backgroundColor: currentColors.panel }}>
          <div className="space-y-4">
            <h4 className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] border-b border-white/10 pb-2">Appearance</h4>
            <div className="flex gap-2">
              {Object.keys(themes).map(t => (
                <button key={t} onClick={() => setTheme(t)} className={`flex-1 h-8 rounded border transition-all ${theme === t ? "border-blue-500 scale-105" : "border-white/10 opacity-50 hover:opacity-100"}`} style={{ backgroundColor: themes[t as keyof typeof themes].bg }} />
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
                  <button onClick={() => ctrl.setSize(s => s - 1)} className="w-8 h-7 bg-black/20 border border-white/10 hover:bg-white/10 transition-colors">-</button>
                  <div className="w-8 h-7 flex items-center justify-center bg-black/40 border border-white/10">{ctrl.size}</div>
                  <button onClick={() => ctrl.setSize(s => s + 1)} className="w-8 h-7 bg-black/20 border border-white/10 hover:bg-white/10 transition-colors">+</button>
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span>Font Family</span>
                <select 
                  value={fontFamily} 
                  onChange={(e) => setFontFamily(e.target.value)} 
                  className="bg-black/20 border border-white/10 p-1 text-[9px] outline-none uppercase font-black"
                >
                  <option value="helvetica">Helvetica</option>
                  <option value="serif">Serif</option>
                  <option value="monospace">Mono</option>
                </select>
              </div>
            </div>
          ))}

          <button onClick={() => { if(confirm("Bulk mark previous?")) markAsComplete(true); }} className="w-full py-2 bg-black/20 border border-white/10 text-[9px] font-black uppercase opacity-60 hover:opacity-100 transition-all">Bulk Mark Previous</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden w-full">
        <div className="flex-[1_1_50%] min-w-0 flex flex-col border-r border-white/10 relative overflow-hidden">
          <div className="py-2 px-4 text-[8px] opacity-40 font-black uppercase tracking-[0.4em] border-b border-white/10 shrink-0 flex justify-between">
            <span>Source : {currentChapter?.title || "..."}</span>
            {novel.completedChapters?.includes(currentChapter?.href || "") && <span className="text-green-500">[ COMPLETED ]</span>}
          </div>
          <div ref={viewerRef} className="flex-1 overflow-hidden" />
        </div>

        <div className="flex-[1_1_50%] min-w-0 flex flex-col overflow-hidden">
          <div className="py-2 px-4 text-[8px] opacity-40 font-black uppercase tracking-[0.4em] border-b border-white/10 shrink-0 flex justify-between">
            <span>Workspace</span>
            <span className="text-blue-500">{isSaving ? "SYNCING" : "SAVED"}</span>
          </div>
          <div className="flex-1 p-8">
            <textarea 
              value={translation} 
              onChange={(e) => setTranslation(e.target.value)} 
              style={{ 
                fontSize: `${workFontSize}px`, 
                fontFamily: getFontStack(fontFamily),
                letterSpacing: fontFamily === "helvetica" ? "-0.02em" : "normal"
              }}
              className="w-full h-full bg-transparent outline-none placeholder-white/5 resize-none leading-relaxed" 
              placeholder="Begin translation..." 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
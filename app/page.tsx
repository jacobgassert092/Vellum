"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db"; 
import { processEpub } from "../lib/epubprocessor";
import Link from "next/link";

export default function LibraryPage() {
  const novels = useLiveQuery(() => db.novels.toArray());
  const [importStatus, setImportStatus] = useState<string>("");

  const handleDelete = async (id?: number) => {
    if (!id || !confirm("Delete this novel and all associated translations?")) return;
    
    await db.novels.delete(id);
    
    await db.translations.where("novelId").equals(id).delete();
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="h-16 bg-panel border-b border-border flex items-center justify-between px-8 sticky top-0 z-10 shadow-xl">
        <h1 className="text-sm font-black uppercase tracking-[0.4em]">VELLUM</h1>
        <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-colors">
          {importStatus || "+ Import EPUB"}
          <input 
            type="file" 
            accept=".epub" 
            className="hidden" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                setImportStatus("Importing...");
                try {
                  const data = await processEpub(file);
                  await db.novels.add({
                    ...data,
                    completedChapters: [] 
                  });
                } catch (err) {
                  console.error("Import failed:", err);
                }
                setImportStatus("");
              }
            }} 
          />
        </label>
      </header>

      <main className="p-8 max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {novels?.map((novel) => {
            const completedCount = novel.completedChapters?.length || 0;
            const totalChapters = novel.totalChapters || 1;
            const progressPercent = Math.round((completedCount / totalChapters) * 100);
            const lastLoc = novel.currentLocation ? `&loc=${encodeURIComponent(novel.currentLocation)}` : "";

            return (
              <div key={novel.id} className="group flex flex-col gap-3">
                <Link 
                  href={`/reader?id=${novel.id}${lastLoc}`}
                  className="relative aspect-[2/3] bg-surface rounded border border-border overflow-hidden group-hover:border-blue-500/50 transition-all shadow-lg"
                >
                  {novel.coverImage ? (
                    <img 
                      src={novel.coverImage} 
                      alt="" 
                      className="object-cover w-full h-full opacity-70 group-hover:opacity-100 transition-opacity" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-black opacity-20 uppercase tracking-tighter">No Cover</div>
                  )}

                  {/* Progress Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/90 backdrop-blur-md border-t border-white/5">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                        {completedCount} / {totalChapters} Chapters
                      </span>
                      <span className="text-[9px] font-black text-white/40">{progressPercent}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500" 
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </Link>

                <div className="flex justify-between items-start gap-2 px-1">
                  <h3 className="text-[10px] font-black uppercase truncate text-gray-500 group-hover:text-foreground transition-colors flex-1">
                    {novel.title}
                  </h3>
                  <button 
                    onClick={() => handleDelete(novel.id)} 
                    className="text-[9px] font-black text-red-900 hover:text-red-500 transition-colors uppercase pt-0.5"
                  >
                    [DEL]
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
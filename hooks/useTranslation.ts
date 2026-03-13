import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/db";

export function useTranslation(novelId: number, chapterHref: string | undefined) {
  const [translation, setTranslation] = useState("");
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const lastFetchedKey = useRef<string | null>(null);
  const currentHrefRef = useRef<string | undefined>(chapterHref);

  //  Load Content Logic
  useEffect(() => {
    if (!novelId || !chapterHref) return;
    
    const key = `${novelId}_${chapterHref}`;
    if (key === lastFetchedKey.current) return; 

    let isMounted = true;
    setIsLoaded(false);
    lastFetchedKey.current = key;
    currentHrefRef.current = chapterHref;

    db.translations.get(key).then(entry => {
      if (isMounted) {
        setTranslation(entry?.content || "");
        setActiveSentenceIdx(0);
        setIsLoaded(true);
      }
    }).catch(err => {
      console.error("DB Load Error:", err);
      if (isMounted) setIsLoaded(true); // Fail-safe to allow typing
    });
    
    return () => { isMounted = false; };
  }, [novelId, chapterHref]);

  //  Auto-save Logic with Href Locking
  useEffect(() => {
    if (!chapterHref || !novelId || !isLoaded || chapterHref !== currentHrefRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        await db.translations.put({ 
          id: `${novelId}_${chapterHref}`, 
          novelId, 
          chapterHref, 
          content: translation 
        });
      } finally {
        setIsSaving(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [translation, chapterHref, novelId, isLoaded]);

  const handleCursorMove = (e: any) => {
    const cursor = e.target.selectionStart;
    const val = e.target.value;
    const textBefore = val.substring(0, cursor); 
    const parts = textBefore.split(/([.!?。！？\n]+)/);
    
    let count = 0;
    for (let i = 0; i < parts.length; i += 2) {
      if (parts[i].trim()) count++;
    }
    let index = Math.max(0, count - 1);
    
    const contentBefore = textBefore.trimEnd();
    const lastChar = contentBefore.slice(-1);
    if (/[.!?。！？\n]/.test(lastChar)) {
      index += 1;
    }
    setActiveSentenceIdx(index);
  };

  return { 
    translation, 
    setTranslation, 
    activeSentenceIdx, 
    handleCursorMove, 
    isSaving, 
    isLoaded 
  };
}
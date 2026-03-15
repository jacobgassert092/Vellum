import { useEffect, useState, MutableRefObject } from "react";
import ePub, { Rendition } from "epubjs";
import { db } from "@/lib/db";

interface EpubOptions {
  activeSentenceIdx: number;
  hlEnabled: boolean;
  hlColor: string;
  hlOpacity: number;
  hlOffset: number;
}

export function useEpub(novel: any, viewerRef: MutableRefObject<HTMLDivElement | null>, novelId: number, options: EpubOptions) {
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [toc, setToc] = useState<any[]>([]);
  const [currentChapter, setCurrentChapter] = useState<{ title: string, href: string } | null>(null);
  const [renderTrigger, setRenderTrigger] = useState(0); 
  
  const hasFileData = !!novel?.fileData;

  useEffect(() => {
    if (!hasFileData || !viewerRef.current) return;

    viewerRef.current.innerHTML = "";
    const book = ePub(novel.fileData);
    const newRendition = book.renderTo(viewerRef.current, { width: "100%", height: "100%", flow: "scrolled" });

    book.loaded.navigation.then(nav => setToc(nav.toc));

    newRendition.on("rendered", (section: unknown, view: any) => {
      setTimeout(() => {
        const doc = view.document;
        if (!doc) return;
        
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
        let node: Node | null;
        let count = 0;
        const nodes: Node[] = [];
        
        while (node = walker.nextNode()) nodes.push(node);

        nodes.forEach(n => {
          const text = n.nodeValue;
          if (!text || !text.trim()) return; 
          
          const fragment = doc.createDocumentFragment();
          
          text.split(/([.!?。！？\n]+)/).forEach((part: string, i: number, arr: string[]) => {
            if (i % 2 === 0) {
              if (part.trim()) {
                const span = doc.createElement("span");
                
                span.setAttribute("data-sent-idx", count++, toString());
                
                span.className = "epubjs-hl v-sent-hl"; 
                span.textContent = part + (arr[i+1] || "");
                fragment.appendChild(span);
              } else {
                const emptyText = part + (arr[i+1] || "");
                if (emptyText) fragment.appendChild(doc.createTextNode(emptyText));
              }
            }
          });
          
          if (n.parentNode) n.parentNode.replaceChild(fragment, n);
        });
        
        setRenderTrigger(prev => prev + 1);
      }, 0);
    });

    let lastHref = "";
    
    newRendition.on("relocated", (location: any) => {
      const href = book.spine.get(location.start.href).href;
      
      if (href === lastHref) return;
      lastHref = href;

      db.novels.update(novelId, { currentLocation: href }).catch(console.error);
      
      const url = new URL(window.location.href);
      url.searchParams.set("loc", href);
      window.history.replaceState(null, "", url.toString());

      book.loaded.navigation.then(nav => {
        const chapter = nav.toc.find((t: any) => t.href.includes(href));
        setCurrentChapter({ title: chapter?.label.trim() || "Section", href });
      });
    });

    const urlParams = new URLSearchParams(window.location.search);
    const initialLoc = urlParams.get("loc") || novel.currentLocation || undefined;
    newRendition.display(initialLoc);
    
    setRendition(newRendition);
    
    return () => {
      book.destroy();
    };
  }, [hasFileData, novelId, viewerRef]); 

  // Sync Highlight Effect
  useEffect(() => {
    if (!rendition || !(rendition as any).manager || !options.hlEnabled) return;
    const targetIdx = Math.max(0, options.activeSentenceIdx + options.hlOffset);
    
    rendition.views().forEach((view: any) => {
      const doc = view.document;
      if (!doc) return;
      
      doc.querySelectorAll(".v-sent-hl").forEach((el: any) => el.style.backgroundColor = "transparent");
      
      const targetEl = doc.querySelector(`span[data-sent-idx="${targetIdx}"]`);
      if (targetEl) {
        const hexAlpha = Math.floor(options.hlOpacity * 255).toString(16).padStart(2, '0');
        targetEl.style.backgroundColor = `${options.hlColor}${hexAlpha}`;
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, [options.activeSentenceIdx, options.hlEnabled, options.hlColor, options.hlOpacity, options.hlOffset, rendition, renderTrigger]);

  return { rendition, toc, currentChapter };
}
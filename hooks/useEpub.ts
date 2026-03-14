import { useEffect, useState, MutableRefObject } from "react";
import ePub, { Rendition } from "epubjs";
import { db } from "@/lib/db";

interface EpubOptions {
  activeSentenceIdx: number;
  hlEnabled: boolean;
  hlColor: string;
  hlOpacity: number;
  hlOffset: number;
  customHighlights?: any[]; 
  onAddCustomHighlight?: (cfiRange: string, text: string) => void;
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
      requestAnimationFrame(() => {
        const doc = view.document;
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
                span.id = `v-sent-${count++}`;
                span.className = "v-hl"; 
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
      });
    });

   
    newRendition.on("selected", (cfiRange: string, contents: any) => {
      book.getRange(cfiRange).then(range => {
        if (!range) { console.warn("EPUB.js could not resolve selection range for:", cfiRange); return;}
        const text = range.toString().trim();
        if (text && options.onAddCustomHighlight) {
          options.onAddCustomHighlight(cfiRange, text);
        }
        contents.window.getSelection().removeAllRanges();
      });
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


  useEffect(() => {
    if (!rendition || !(rendition as any).manager || !options.hlEnabled) return;
    const targetIdx = Math.max(0, options.activeSentenceIdx + options.hlOffset);
    
    rendition.views().forEach((view: any) => {
      const doc = view.document;
      if (!doc) return;
      doc.querySelectorAll(".v-hl").forEach((el: any) => el.style.backgroundColor = "transparent");
      
      const targetEl = doc.getElementById(`v-sent-${targetIdx}`);
      if (targetEl) {
        const hexAlpha = Math.floor(options.hlOpacity * 255).toString(16).padStart(2, '0');
        targetEl.style.backgroundColor = `${options.hlColor}${hexAlpha}`;
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, [options.activeSentenceIdx, options.hlEnabled, options.hlColor, options.hlOpacity, options.hlOffset, rendition, renderTrigger]);

  useEffect(() => {
    if (!rendition || !options.customHighlights) return;
    
    // Clear old custom annotations
    rendition.annotations.remove("highlight", "custom-hl");

    // Apply new ones from DB
    options.customHighlights.forEach(hl => {
      rendition.annotations.highlight(hl.cfiRange, {}, (e: any) => {
      }, "custom-hl", { "fill": hl.color, "fill-opacity": "0.4" });
    });
  }, [rendition, options.customHighlights, renderTrigger]);

  return { rendition, toc, currentChapter };
}
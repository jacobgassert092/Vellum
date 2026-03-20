import { useEffect, useState, MutableRefObject, useRef } from "react";
import ePub, { Rendition } from "epubjs";
import { db } from "@/lib/db";

interface EpubOptions {
  fontSize: number; // Ensure this is present
  activeSentenceIdx: number;
  hlEnabled: boolean;
  hlColor: string;
  hlOpacity: number;
  hlFinishedColor: string;
  hlFinishedOpacity: number;
  hlOffset: number;
  hlFinishedEnabled: boolean;
  underlineActive: boolean;
  underlineColor: string;
  underlineThickness: number;
  textColor: string;
}

export function useEpub(novel: any, viewerRef: MutableRefObject<HTMLDivElement | null>, novelId: number, options: EpubOptions) {
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [toc, setToc] = useState<any[]>([]);
  const [currentChapter, setCurrentChapter] = useState<{ title: string, href: string } | null>(null);
  const [renderTrigger, setRenderTrigger] = useState(0); 
  
  const lastScrolledIdx = useRef<number | null>(null);
  const hasFileData = !!novel?.fileData;

  useEffect(() => {
    if (!hasFileData || !viewerRef.current) return;

    viewerRef.current.innerHTML = "";
    const book = ePub(novel.fileData);
    const newRendition = book.renderTo(viewerRef.current, { 
      width: "100%", 
      height: "100%", 
      flow: "scrolled" 
    });

    newRendition.themes.default({
      body: {
        "color": `${options.textColor} !important`,
        "background": "transparent !important"
      }
    });
    
    
    newRendition.themes.fontSize(`${options.fontSize}px`);

    book.loaded.navigation.then(nav => setToc(nav.toc));

    newRendition.on("rendered", (section: unknown, view: any) => {
      setTimeout(() => {
        const doc = view.document;
        if (!doc) return;
        
        doc.body.style.color = options.textColor;

        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
        let node: Node | null;
        const nodes: Node[] = [];
        while (node = walker.nextNode()) nodes.push(node);

        let count = 0;
        nodes.forEach(n => {
          const text = n.nodeValue;
          if (!text || !text.trim()) return; 
          const fragment = doc.createDocumentFragment();
          text.split(/([.!?。！？\n]+)/).forEach((part: string, i: number, arr: string[]) => {
            if (i % 2 === 0) {
              if (part.trim()) {
                const span = doc.createElement("span");
                span.setAttribute("data-sent-idx", (count++).toString());
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

    newRendition.on("relocated", (location: any) => {
      const href = book.spine.get(location.start.href).href;
      db.novels.update(novelId, { currentLocation: href }).catch(console.error);
      book.loaded.navigation.then(nav => {
        const chapter = nav.toc.find((t: any) => t.href.includes(href));
        setCurrentChapter({ title: chapter?.label.trim() || "Section", href });
      });
    });

    newRendition.display(novel.currentLocation || undefined);
    setRendition(newRendition);
    
    return () => book.destroy();
  }, [hasFileData, novelId, viewerRef]); 

  
  useEffect(() => {
    if (rendition) {
      rendition.themes.fontSize(`${options.fontSize}px`);
    }
  }, [options.fontSize, rendition]);

  useEffect(() => {
    if (!rendition || !(rendition as any).manager || !options.hlEnabled) return;
    
    const targetIdx = Math.max(0, options.activeSentenceIdx + options.hlOffset);
    const shouldScroll = lastScrolledIdx.current !== targetIdx;

    const mainAlpha = Math.floor(options.hlOpacity * 255).toString(16).padStart(2, '0');
    const finishedAlpha = Math.floor(options.hlFinishedOpacity * 255).toString(16).padStart(2, '0');

    rendition.views().forEach((view: any) => {
      const doc = view.document;
      if (!doc) return;
      
      doc.querySelectorAll(".v-sent-hl").forEach((el: any) => {
        const elIdx = parseInt(el.getAttribute("data-sent-idx") || "-1");

        if (elIdx === targetIdx) {
          el.style.backgroundColor = `${options.hlColor}${mainAlpha}`;
          
          if (options.underlineActive) {
            el.style.textDecoration = "underline";
            el.style.textDecorationColor = options.underlineColor;
            el.style.textDecorationThickness = `${options.underlineThickness}px`;
            el.style.textUnderlineOffset = "2px";
          } else {
            el.style.textDecoration = "none";
          }
          
          if (shouldScroll) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            lastScrolledIdx.current = targetIdx;
          }
        } else if (options.hlFinishedEnabled && elIdx < targetIdx) {
          el.style.backgroundColor = `${options.hlFinishedColor}${finishedAlpha}`;
          el.style.textDecoration = "none";
        } else {
          el.style.backgroundColor = "transparent";
          el.style.textDecoration = "none";
        }
      });
    });
  }, [options, rendition, renderTrigger]);

  return { rendition, toc, currentChapter };
}
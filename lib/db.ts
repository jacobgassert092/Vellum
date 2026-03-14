import Dexie, { Table } from 'dexie';

export class VellumDB extends Dexie {
  novels!: Table<any, number>;
  translations!: Table<any, string>;
  
  
  globalNotes!: Table<{ novelId: number, content: string }, number>;
  chapterNotes!: Table<{ id?: number, novelId: number, chapterHref: string, quote: string, note: string, timestamp: number }, number>;
  sourceHighlights!: Table<{ id?: string, novelId: number, chapterHref: string, cfiRange: string, text: string, color: string, note: string }, string>;

  constructor() {
    super('VellumDB');
    
    
   
    this.version(1).stores({
      novels: '++id, title, author, cover, fileData, currentLocation, completedChapters',
      translations: 'id, novelId, chapterHref, content',
      globalNotes: 'novelId',
      chapterNotes: '++id, novelId, chapterHref',
      sourceHighlights: 'id, novelId, chapterHref' 
    });
  }
}

export const db = new VellumDB();
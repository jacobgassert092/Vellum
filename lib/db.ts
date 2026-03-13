import Dexie, { type Table } from 'dexie';

export interface Novel {
  id?: number;
  title: string;
  fileData: ArrayBuffer;
  coverImage?: string;     
  currentChapterHref?: string; 
  totalChapters: number;
  completedChapters: string[];
  currentLocation?: string;
}

export interface Translation {
  id?: string; 
  novelId: number;
  chapterHref: string;
  content: string;
}

export class NovelDatabase extends Dexie {
  novels!: Table<Novel>;
  translations!: Table<Translation>;

  constructor() {
    super('VellumDB');
    this.version(3).stores({
      novels: '++id, title',
      translations: 'id, novelId' 
    });
  }
}

export const db = new NovelDatabase();
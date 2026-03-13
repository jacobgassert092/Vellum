import ePub from "epubjs";

export async function processEpub(file: File) {
  const buffer = await file.arrayBuffer();
  const book = ePub(buffer);
  await book.ready;
  
  const metadata = await book.loaded.metadata;
  const navigation = await book.loaded.navigation;
  
 
  const totalChapters = navigation.toc.length;

  let coverBase64 = "";
  try {
    const coverUrl = await book.coverUrl();
    if (coverUrl) {
      const response = await fetch(coverUrl);
      const blob = await response.blob();
      coverBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) { console.error(e); }

  return {
    title: metadata.title || file.name,
    fileData: buffer,
    coverImage: coverBase64,
    totalChapters: totalChapters || 0,
  };
}
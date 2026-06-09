// Client-side PDF text extraction with pdf.js. Runs entirely in the browser so
// raw statements never leave the user's machine (consistent with self-hosting).
// pdfjs-dist is imported dynamically so it's only loaded when a PDF is uploaded.

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist')
  // Bundled worker (no CDN) — webpack/turbopack resolve this URL at build time.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  let text = ''

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    let lastY: number | null = null
    for (const item of content.items as any[]) {
      if (typeof item.str !== 'string') continue
      const y = item.transform?.[5]
      // New text row → newline, so date-anchored parsing sees line structure.
      if (lastY !== null && typeof y === 'number' && Math.abs(y - lastY) > 2) text += '\n'
      text += item.str + ' '
      if (typeof y === 'number') lastY = y
    }
    text += '\n'
  }
  return text
}

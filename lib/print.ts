// lib/print.ts

export const SUPPORTED_GRAPH_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.gif',
  '.webp',
]

export const SUPPORTED_GRAPH_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/gif',
  'image/webp',
]

export const ACCEPTED_FILE_TYPES_ATTR =
  '.pdf,.png,.jpg,.jpeg,.svg,.gif,.webp,image/*,application/pdf'

/**
 * Checks if the file matches any supported graph extension or MIME type.
 */
export const isValidGraphFile = (file: File): boolean => {
  const name = file.name.toLowerCase()
  const hasValidExt = SUPPORTED_GRAPH_EXTENSIONS.some((ext) => name.endsWith(ext))
  const hasValidMime =
    SUPPORTED_GRAPH_MIME_TYPES.includes(file.type.toLowerCase()) ||
    file.type.startsWith('image/')

  return hasValidExt || hasValidMime
}

/**
 * Determines whether the URL or blob is a PDF document.
 */
export const isPdfFormat = (urlOrName: string, mimeType?: string): boolean => {
  if (mimeType?.toLowerCase().includes('pdf')) return true
  const clean = urlOrName.toLowerCase().split('?')[0]
  return clean.endsWith('.pdf')
}

/**
 * Fetches file as a same-origin blob and triggers printing through a hidden iframe.
 * - PDFs are loaded directly into the native browser PDF viewer.
 * - Images (PNG, JPG, SVG, GIF, WEBP) are styled to fit cleanly on one page.
 */
export const triggerBrowserPrint = async (fileUrl: string): Promise<void> => {
  try {
    const response = await fetch(fileUrl)
    if (!response.ok) throw new Error('Failed to fetch file for printing.')

    const blob = await response.blob()
    const isPdf = isPdfFormat(fileUrl, blob.type)
    const localBlobUrl = URL.createObjectURL(blob)

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const cleanup = () => {
      setTimeout(() => {
        iframe.remove()
        URL.revokeObjectURL(localBlobUrl)
      }, 60000)
    }

    if (isPdf) {
      iframe.src = localBlobUrl
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } catch {
            window.open(localBlobUrl, '_blank')
          } finally {
            cleanup()
          }
        }, 500)
      }
    } else {
      // Formats images cleanly to fit onto one printed page
      iframe.onload = () => {
        const doc = iframe.contentDocument
        const img = doc?.getElementById('print-image') as HTMLImageElement | null

        const executePrint = () => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } catch {
            window.open(localBlobUrl, '_blank')
          } finally {
            cleanup()
          }
        }

        if (img && !img.complete) {
          img.onload = () => setTimeout(executePrint, 250)
          img.onerror = () => executePrint()
        } else {
          setTimeout(executePrint, 250)
        }
      }

      iframe.srcdoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Print Graph</title>
            <style>
              @page {
                size: auto;
                margin: 10mm;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                background: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              img {
                max-width: 100%;
                max-height: 98vh;
                object-fit: contain;
                display: block;
                page-break-inside: avoid;
              }
            </style>
          </head>
          <body>
            <img id="print-image" src="${localBlobUrl}" alt="Graph" />
          </body>
        </html>
      `
    }
  } catch (err) {
    // Fallback if fetch or framing fails
    window.open(fileUrl, '_blank')
  }
}
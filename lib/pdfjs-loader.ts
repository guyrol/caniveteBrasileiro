// Safe client-side script loader for PDF.js to completely bypass Next.js / Turbopack 'canvas' module issues
export async function getPdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be loaded in the browser');
  }

  // If already loaded on window
  if ((window as any).pdfjsLib) {
    const lib = (window as any).pdfjsLib;
    if (!lib.GlobalWorkerOptions?.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    }
    return lib;
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('pdfjs-script') as HTMLScriptElement | null;
    if (existingScript) {
      if ((window as any).pdfjsLib) {
        const lib = (window as any).pdfjsLib;
        lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        resolve(lib);
        return;
      }
      existingScript.addEventListener('load', () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
          resolve(lib);
        } else {
          reject(new Error('pdfjsLib not found on window'));
        }
      });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load /pdf.min.js script')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'pdfjs-script';
    script.src = '/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        resolve(lib);
      } else {
        reject(new Error('pdfjsLib not defined after loading script'));
      }
    };
    script.onerror = (e) => reject(new Error('Error loading /pdf.min.js: ' + e));
    document.head.appendChild(script);
  });
}

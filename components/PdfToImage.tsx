'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import { getPdfJs } from '../lib/pdfjs-loader';

type QualityScale = 1 | 2 | 3 | 4;
type ImageFormat = 'png' | 'jpeg' | 'webp';
type FramingMode = 'full' | 'desktop-fit' | 'desktop-crop' | 'mobile-crop';

interface PageMeta {
  pageNumber: number;
  width: number;
  height: number;
  thumbnailUrl: string;
}

interface RawExtractedImage {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
}

export default function PdfToImage() {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File states
  const [file, setFile] = useState<File | null>(null);
  const [baseName, setBaseName] = useState<string>('');
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState<number>(0);

  // Status & Progress
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadingStatusText, setLoadingStatusText] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Pages metadata and selection
  const [pagesMeta, setPagesMeta] = useState<PageMeta[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [focusedPageNum, setFocusedPageNum] = useState<number>(1);
  const [rangeInput, setRangeInput] = useState<string>('');

  // Wallpaper & Render settings
  const [scale, setScale] = useState<QualityScale>(3); // Default to 3x (Ultra HD 4K)
  const [format, setFormat] = useState<ImageFormat>('png');
  const [framing, setFraming] = useState<FramingMode>('full');
  const [jpegQuality, setJpegQuality] = useState<number>(95);

  // Raw extracted image assets on current focused page
  const [extractedImages, setExtractedImages] = useState<RawExtractedImage[]>([]);
  const [isExtractingImages, setIsExtractingImages] = useState<boolean>(false);

  // Helper to extract file base name
  const extractBaseName = (filename: string): string => {
    return filename.replace(/\.[^/.]+$/, '').trim() || 'document';
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Calculate output resolution for active page
  const activeResolution = useMemo(() => {
    const meta = pagesMeta.find(p => p.pageNumber === focusedPageNum);
    if (!meta) return null;

    if (framing === 'desktop-fit' || framing === 'desktop-crop') {
      // 16:9 Aspect Ratio targets
      const baseW = scale === 1 ? 1920 : scale === 2 ? 2560 : scale === 3 ? 3840 : 5120;
      const baseH = Math.round((baseW * 9) / 16);
      return { width: baseW, height: baseH, label: scale >= 3 ? '4K / 5K UHD' : 'Full HD' };
    } else if (framing === 'mobile-crop') {
      // 9:16 Aspect Ratio targets
      const baseW = scale === 1 ? 1080 : scale === 2 ? 1440 : scale === 3 ? 2160 : 2880;
      const baseH = Math.round((baseW * 16) / 9);
      return { width: baseW, height: baseH, label: 'Phone Wallpaper' };
    } else {
      // Full page native uncropped
      const w = Math.round(meta.width * scale);
      const h = Math.round(meta.height * scale);
      return { width: w, height: h, label: scale >= 3 ? 'Ultra HD' : 'Standard HD' };
    }
  }, [pagesMeta, focusedPageNum, scale, framing]);

  // Handle PDF upload
  const handlePdfUpload = async (uploadedFile: File) => {
    if (uploadedFile.type !== 'application/pdf' && !uploadedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage(i18n.language === 'pt' ? 'Por favor selecione um arquivo PDF válido.' : 'Please select a valid PDF file.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsLoadingPdf(true);
    setLoadingStatusText(i18n.language === 'pt' ? 'Carregando motor PDF.js...' : 'Initializing PDF engine...');
    setPagesMeta([]);
    setSelectedPages(new Set());
    setExtractedImages([]);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const pdfjsLib = await getPdfJs();

      setLoadingStatusText(i18n.language === 'pt' ? 'Lendo páginas do documento...' : 'Parsing document pages...');
      const loadingTask = pdfjsLib.getDocument({
        data: buffer,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true
      });

      const loadedDoc = await loadingTask.promise;
      const pagesCount = loadedDoc.numPages;

      if (pagesCount === 0) {
        throw new Error(i18n.language === 'pt' ? 'O PDF não possui páginas válidas.' : 'PDF contains no valid pages.');
      }

      setPdfDoc(loadedDoc);
      setFile(uploadedFile);
      setBaseName(extractBaseName(uploadedFile.name));
      setPdfArrayBuffer(buffer);
      setTotalPages(pagesCount);

      // Default: select first page and focus it
      setFocusedPageNum(1);
      setSelectedPages(new Set([1]));

      // Render fast thumbnails progressively
      const metas: PageMeta[] = [];
      for (let i = 1; i <= pagesCount; i++) {
        setLoadingStatusText(
          i18n.language === 'pt'
            ? `Gerando miniaturas (${i} de ${pagesCount})...`
            : `Generating thumbnails (${i} of ${pagesCount})...`
        );

        const page = await loadedDoc.getPage(i);
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        // Small thumbnail scale for snappy UI
        const thumbScale = Math.min(220 / unscaledViewport.width, 280 / unscaledViewport.height);
        const thumbViewport = page.getViewport({ scale: thumbScale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(thumbViewport.width);
        canvas.height = Math.floor(thumbViewport.height);
        const ctx = canvas.getContext('2d');

        if (ctx) {
          await page.render({
            canvasContext: ctx,
            viewport: thumbViewport
          }).promise;
          const thumbUrl = canvas.toDataURL('image/jpeg', 0.85);

          metas.push({
            pageNumber: i,
            width: unscaledViewport.width,
            height: unscaledViewport.height,
            thumbnailUrl: thumbUrl
          });
        }
      }

      setPagesMeta(metas);
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      setErrorMessage(
        err.message || (i18n.language === 'pt' ? 'Erro ao carregar o PDF.' : 'Failed to load PDF.')
      );
      setFile(null);
      setTotalPages(0);
    } finally {
      setIsLoadingPdf(false);
      setLoadingStatusText('');
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePdfUpload(e.dataTransfer.files[0]);
    }
  };

  // Reset file
  const handleClearFile = () => {
    setFile(null);
    setBaseName('');
    setPdfArrayBuffer(null);
    setPdfDoc(null);
    setTotalPages(0);
    setPagesMeta([]);
    setSelectedPages(new Set());
    setFocusedPageNum(1);
    setExtractedImages([]);
    setErrorMessage('');
    setSuccessMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Page selection helpers
  const togglePageSelection = (pageNum: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  };

  const selectAllPages = () => {
    const all = new Set<number>();
    for (let i = 1; i <= totalPages; i++) all.add(i);
    setSelectedPages(all);
  };

  const clearSelection = () => {
    setSelectedPages(new Set());
  };

  const applyRangeInput = (rangeStr: string) => {
    setRangeInput(rangeStr);
    const parts = rangeStr.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    const newSelected = new Set<number>();

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const from = parseInt(startStr, 10);
        const to = parseInt(endStr, 10);
        if (!isNaN(from) && !isNaN(to)) {
          const minP = Math.max(1, Math.min(from, to));
          const maxP = Math.min(totalPages, Math.max(from, to));
          for (let p = minP; p <= maxP; p++) newSelected.add(p);
        }
      } else {
        const single = parseInt(part, 10);
        if (!isNaN(single) && single >= 1 && single <= totalPages) {
          newSelected.add(single);
        }
      }
    }

    if (newSelected.size > 0) {
      setSelectedPages(newSelected);
    }
  };

  // Scan & extract native embedded raw images on focused page
  const scanPageEmbeddedImages = async (pageNum: number) => {
    if (!pdfDoc) return;
    setIsExtractingImages(true);
    setExtractedImages([]);

    try {
      const page = await pdfDoc.getPage(pageNum);
      const ops = await page.getOperatorList();
      const pdfjsLib = await getPdfJs();
      const found: RawExtractedImage[] = [];

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
          const objId = ops.argsArray[i][0];
          try {
            const imgObj = await new Promise<any>((resolve) => {
              page.objs.get(objId, (img: any) => resolve(img));
            });

            if (imgObj && imgObj.data && imgObj.width && imgObj.height) {
              const canvas = document.createElement('canvas');
              canvas.width = imgObj.width;
              canvas.height = imgObj.height;
              const ctx = canvas.getContext('2d');

              if (ctx) {
                const imgData = ctx.createImageData(imgObj.width, imgObj.height);
                // Transfer pixel buffer
                if (imgObj.kind === 1) { // Grayscale
                  let srcIdx = 0;
                  let dstIdx = 0;
                  for (let p = 0; p < imgObj.width * imgObj.height; p++) {
                    const gray = imgObj.data[srcIdx++];
                    imgData.data[dstIdx++] = gray;
                    imgData.data[dstIdx++] = gray;
                    imgData.data[dstIdx++] = gray;
                    imgData.data[dstIdx++] = 255;
                  }
                } else if (imgObj.kind === 2 || imgObj.kind === 3) { // RGB / RGBA
                  let srcIdx = 0;
                  let dstIdx = 0;
                  for (let p = 0; p < imgObj.width * imgObj.height; p++) {
                    imgData.data[dstIdx++] = imgObj.data[srcIdx++];
                    imgData.data[dstIdx++] = imgObj.data[srcIdx++];
                    imgData.data[dstIdx++] = imgObj.data[srcIdx++];
                    imgData.data[dstIdx++] = (imgObj.kind === 3 && imgObj.data[srcIdx] !== undefined) ? imgObj.data[srcIdx++] : 255;
                  }
                } else {
                  // Direct copy if matching RGBA length
                  if (imgData.data.length === imgObj.data.length) {
                    imgData.data.set(imgObj.data);
                  }
                }
                ctx.putImageData(imgData, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                found.push({
                  id: `${pageNum}-${objId}-${i}`,
                  dataUrl,
                  width: imgObj.width,
                  height: imgObj.height
                });
              }
            }
          } catch (e) {
            // Ignore single image extraction failure
          }
        }
      }

      setExtractedImages(found);
    } catch (e) {
      console.warn('Image scan failed for page', pageNum, e);
    } finally {
      setIsExtractingImages(false);
    }
  };

  // Whenever focused page changes, scan for embedded assets
  useEffect(() => {
    if (pdfDoc && focusedPageNum >= 1 && focusedPageNum <= totalPages) {
      scanPageEmbeddedImages(focusedPageNum);
    }
  }, [focusedPageNum, pdfDoc]);

  // Core Render Engine: Renders a page to high-definition Canvas with chosen wallpaper framing & scale
  const renderPageToCanvas = async (pageNum: number): Promise<HTMLCanvasElement> => {
    if (!pdfDoc) throw new Error('No PDF document loaded');

    const page = await pdfDoc.getPage(pageNum);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    // Step 1: Render the native page at the selected scale multiplier
    const renderScale = scale; // 1x, 2x, 3x, 4x
    const pageViewport = page.getViewport({ scale: renderScale });

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.floor(pageViewport.width);
    pageCanvas.height = Math.floor(pageViewport.height);
    const pageCtx = pageCanvas.getContext('2d', { alpha: false });

    if (!pageCtx) throw new Error('Failed to get 2D canvas context');
    pageCtx.fillStyle = '#ffffff';
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    await page.render({
      canvasContext: pageCtx,
      viewport: pageViewport
    }).promise;

    // Step 2: If "full" mode, return the rendered page canvas directly
    if (framing === 'full') {
      return pageCanvas;
    }

    // Step 3: Handle Wallpaper Framing Modes (16:9 Desktop or 9:16 Mobile)
    let targetWidth = 3840;
    let targetHeight = 2160;

    if (framing === 'desktop-fit' || framing === 'desktop-crop') {
      targetWidth = scale === 1 ? 1920 : scale === 2 ? 2560 : scale === 3 ? 3840 : 5120;
      targetHeight = Math.round((targetWidth * 9) / 16);
    } else if (framing === 'mobile-crop') {
      targetWidth = scale === 1 ? 1080 : scale === 2 ? 1440 : scale === 3 ? 2160 : 2880;
      targetHeight = Math.round((targetWidth * 16) / 9);
    }

    const wallpaperCanvas = document.createElement('canvas');
    wallpaperCanvas.width = targetWidth;
    wallpaperCanvas.height = targetHeight;
    const ctx = wallpaperCanvas.getContext('2d');
    if (!ctx) return pageCanvas;

    if (framing === 'desktop-fit') {
      // 16:9 Fit with blurred background:
      // Draw zoomed blurred backdrop from the page content
      ctx.save();
      ctx.filter = 'blur(40px) brightness(0.4)';
      ctx.drawImage(pageCanvas, -50, -50, targetWidth + 100, targetHeight + 100);
      ctx.restore();

      // Fit the original page centered without cropping any content
      const scaleFit = Math.min(
        (targetWidth * 0.94) / pageCanvas.width,
        (targetHeight * 0.94) / pageCanvas.height
      );
      const drawW = Math.round(pageCanvas.width * scaleFit);
      const drawH = Math.round(pageCanvas.height * scaleFit);
      const drawX = Math.round((targetWidth - drawW) / 2);
      const drawY = Math.round((targetHeight - drawH) / 2);

      // Subtle shadow behind the centered artwork
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      ctx.drawImage(pageCanvas, drawX, drawY, drawW, drawH);
      ctx.restore();

    } else if (framing === 'desktop-crop' || framing === 'mobile-crop') {
      // Fill & Crop: Cover the entire wallpaper screen
      const scaleCover = Math.max(
        targetWidth / pageCanvas.width,
        targetHeight / pageCanvas.height
      );
      const drawW = Math.round(pageCanvas.width * scaleCover);
      const drawH = Math.round(pageCanvas.height * scaleCover);
      const drawX = Math.round((targetWidth - drawW) / 2);
      const drawY = Math.round((targetHeight - drawH) / 2);

      ctx.drawImage(pageCanvas, drawX, drawY, drawW, drawH);
    }

    return wallpaperCanvas;
  };

  // Convert canvas to Blob based on chosen format & quality
  const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const mimeType = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
      const quality = format === 'png' ? 1.0 : jpegQuality / 100;
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas conversion to blob failed'));
      }, mimeType, quality);
    });
  };

  // Export single page image
  const handleExportSinglePage = async (pageNum: number) => {
    setIsExporting(true);
    setErrorMessage('');
    setSuccessMessage('');
    setExportProgress(20);

    try {
      const canvas = await renderPageToCanvas(pageNum);
      setExportProgress(75);
      const blob = await canvasToBlob(canvas);
      setExportProgress(95);

      const url = URL.createObjectURL(blob);
      const ext = format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpg';
      const cleanName = baseName || 'document';
      const filename = `${cleanName}-page${pageNum}-${framing}-${scale}x.${ext}`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setSuccessMessage(
        i18n.language === 'pt'
          ? `Página ${pageNum} exportada com sucesso em alta resolução!`
          : `Page ${pageNum} successfully exported in high resolution!`
      );
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMessage(err.message || 'Error exporting image');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy rendered image to Clipboard
  const handleCopyClipboard = async (pageNum: number) => {
    setIsExporting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const canvas = await renderPageToCanvas(pageNum);
      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard && (window as any).ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setSuccessMessage(t('PdfToImgCopied'));
        } else {
          setErrorMessage(i18n.language === 'pt' ? 'Área de transferência não suportada neste navegador.' : 'Clipboard not supported in this browser.');
        }
        setIsExporting(false);
      }, 'image/png');
    } catch (err: any) {
      console.error('Clipboard copy error:', err);
      setErrorMessage(err.message || 'Failed to copy image');
      setIsExporting(false);
    }
  };

  // Export all selected pages into a ZIP archive
  const handleExportSelectedZip = async () => {
    const pagesArray = Array.from(selectedPages).sort((a, b) => a - b);
    if (pagesArray.length === 0) {
      setErrorMessage(t('PdfToImgNoPagesSelected'));
      return;
    }

    setIsExporting(true);
    setErrorMessage('');
    setSuccessMessage('');
    setExportProgress(5);

    try {
      const zip = new JSZip();
      const ext = format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpg';
      const cleanName = baseName || 'document';

      for (let i = 0; i < pagesArray.length; i++) {
        const pageNum = pagesArray[i];
        const pct = 5 + Math.round((i / pagesArray.length) * 80);
        setExportProgress(pct);

        const canvas = await renderPageToCanvas(pageNum);
        const blob = await canvasToBlob(canvas);
        const filename = `${cleanName}-page${pageNum}-${scale}x.${ext}`;
        zip.file(filename, blob);
      }

      setExportProgress(88);
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
        setExportProgress(88 + Math.round(meta.percent * 0.11));
      });

      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `${cleanName}-wallpapers-${scale}x.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);

      setExportProgress(100);
      setSuccessMessage(
        i18n.language === 'pt'
          ? `${pagesArray.length} página(s) exportada(s) no arquivo ZIP!`
          : `${pagesArray.length} page(s) successfully packaged into ZIP!`
      );
    } catch (err: any) {
      console.error('Batch export error:', err);
      setErrorMessage(err.message || 'Failed to package images into ZIP.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header card with gradient badge */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(99, 102, 241, 0.08))',
        borderLeft: '4px solid var(--accent)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent), #3b82f6)',
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
            color: 'white'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('PdfToImgTitle')}
              </h2>
              <span style={{
                fontSize: '10.5px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent), #10b981)',
                color: 'white',
                fontWeight: 700,
                letterSpacing: '0.5px'
              }}>
                ULTRA HD
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>
              {t('PdfToImgDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Error & Success alerts */}
      {errorMessage && (
        <div className="glass-card animate-fade-in" style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderRadius: 'var(--border-radius-sm)',
          fontSize: '13.5px'
        }}>
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="glass-card animate-fade-in" style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid var(--accent)',
          color: 'var(--accent)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderRadius: 'var(--border-radius-sm)',
          fontSize: '13.5px'
        }}>
          <span>✨</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Progress Bar (when rendering / exporting) */}
      {isExporting && (
        <div className="glass-card animate-fade-in" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '14px',
                height: '14px',
                border: '2px solid var(--accent)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              {t('PdfToImgExporting')}
            </span>
            <span style={{ color: 'var(--accent)' }}>{exportProgress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'var(--input-bg)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${exportProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent), var(--primary))',
              transition: 'width 0.2s ease'
            }} />
          </div>
        </div>
      )}

      {/* Upload Zone (shown when no file loaded) */}
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="glass-card"
          style={{
            border: isDragging ? '2px dashed var(--accent)' : '2px dashed var(--card-border)',
            background: isDragging ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.01)',
            padding: '52px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            transition: 'all var(--transition-normal)'
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="application/pdf,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handlePdfUpload(e.target.files[0]);
              }
            }}
          />

          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(99, 102, 241, 0.15))',
            width: '68px',
            height: '68px',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)'
          }}>
            {isLoadingPdf ? (
              <div style={{
                width: '28px',
                height: '28px',
                border: '3px solid var(--accent)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              {isDragging ? t('PdfDragOver') : t('PdfDropzoneTitle')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
              {loadingStatusText || t('PdfDropzoneSubtitle')}
            </p>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--border-radius-sm)',
              border: 'none',
              background: 'linear-gradient(135deg, var(--accent), #059669)',
              color: 'white',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            {t('PdfSelectFile')}
          </button>
        </div>
      ) : (
        /* Document Loaded Workspace */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* File bar info */}
          <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--accent)',
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 800,
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                IMG
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {file.name}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--accent)',
                    fontWeight: 600
                  }}>
                    {totalPages} {t('PdfPages')}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {formatBytes(file.size)} • {t('PdfToImgSelectedCount', { count: selectedPages.size, total: totalPages })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handlePdfUpload(e.target.files[0]);
                  }
                }}
              />
              <button
                type="button"
                id="pdf-to-img-change-file"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 500
                }}
              >
                {t('PdfChangeFile')}
              </button>
              <button
                type="button"
                id="pdf-to-img-clear-file"
                onClick={handleClearFile}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 500
                }}
              >
                ✕ {t('Delete')}
              </button>
            </div>
          </div>

          {/* Studio Control Center: Settings & Live Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Left Box: Wallpaper & Image Configuration */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
                ⚙️ {t('PdfToImgResolution')} & {t('PdfToImgWallpaperPreset')}
              </h3>

              {/* Resolution / DPI scale selector */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {t('PdfToImgResolution')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { val: 1, label: t('PdfToImgScaleStandard'), tag: '72 DPI' },
                    { val: 2, label: t('PdfToImgScaleHD'), tag: '150 DPI' },
                    { val: 3, label: t('PdfToImgScale4K'), tag: '300 DPI / 4K' },
                    { val: 4, label: t('PdfToImgScale8K'), tag: '400 DPI / 8K' }
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      id={`scale-btn-${opt.val}`}
                      onClick={() => setScale(opt.val as QualityScale)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--border-radius-sm)',
                        border: scale === opt.val ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                        background: scale === opt.val ? 'rgba(16, 185, 129, 0.12)' : 'var(--input-bg)',
                        color: scale === opt.val ? 'var(--text-primary)' : 'var(--text-secondary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: scale === opt.val ? 700 : 500 }}>
                        {opt.tag}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {opt.val === 3 ? '★ Recommended' : `${opt.val}x Multiplier`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallpaper Framing Presets */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {t('PdfToImgWallpaperPreset')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { id: 'full', title: t('PdfToImgFitFullPage'), desc: 'Export full PDF page uncropped (ideal for documents & prints)' },
                    { id: 'desktop-fit', title: t('PdfToImgFitDesktop169'), desc: '16:9 monitor wallpaper with ambient blurred page background' },
                    { id: 'desktop-crop', title: t('PdfToImgFitDesktopCrop'), desc: '16:9 full-screen fill & centered crop for widescreen monitors' },
                    { id: 'mobile-crop', title: t('PdfToImgFitMobile916'), desc: '9:16 vertical fill & crop for smartphones and lock screens' }
                  ].map((opt) => (
                    <div
                      key={opt.id}
                      id={`framing-opt-${opt.id}`}
                      onClick={() => setFraming(opt.id as FramingMode)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--border-radius-sm)',
                        border: framing === opt.id ? '1px solid var(--primary)' : '1px solid var(--input-border)',
                        background: framing === opt.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--input-bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <input
                        type="radio"
                        name="framing-mode"
                        checked={framing === opt.id}
                        onChange={() => setFraming(opt.id as FramingMode)}
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {opt.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {opt.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format Selection (PNG / JPG / WebP) */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {t('PdfToImgFormat')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { id: 'png', label: 'PNG (Lossless / Wallpaper)', badge: 'Sharpest' },
                    { id: 'jpeg', label: 'JPEG (Compact)', badge: 'Fast' },
                    { id: 'webp', label: 'WebP', badge: 'Modern' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      id={`format-btn-${f.id}`}
                      onClick={() => setFormat(f.id as ImageFormat)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 'var(--border-radius-sm)',
                        border: format === f.id ? '1px solid var(--accent)' : '1px solid var(--input-border)',
                        background: format === f.id ? 'rgba(16, 185, 129, 0.12)' : 'var(--input-bg)',
                        color: format === f.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {f.id.toUpperCase()}
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
                        {f.badge}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Resolution info tag */}
              {activeResolution && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px'
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Calculated Output Size:</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    {activeResolution.width} × {activeResolution.height} px ({activeResolution.label})
                  </span>
                </div>
              )}

              {/* Global Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '10px' }}>
                <button
                  type="button"
                  id="pdf-to-img-export-single-btn"
                  disabled={isExporting}
                  onClick={() => handleExportSinglePage(focusedPageNum)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--accent), #059669)',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isExporting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {t('PdfToImgExportSingle', { page: focusedPageNum })}
                </button>

                <button
                  type="button"
                  id="pdf-to-img-copy-btn"
                  disabled={isExporting}
                  onClick={() => handleCopyClipboard(focusedPageNum)}
                  title={t('PdfToImgCopyClipboard')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    cursor: isExporting ? 'not-allowed' : 'pointer'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>

            </div>

            {/* Right Box: Live Focused Page Preview & Raw Asset Inspector */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🖼️</span>
                  {t('PdfToImgPreviewPage')} #{focusedPageNum}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {activeResolution ? `${activeResolution.width} × ${activeResolution.height} px` : ''}
                </span>
              </div>

              {/* Visual preview box simulating wallpaper frame */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '280px',
                maxHeight: '380px',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid var(--card-border)'
              }}>
                {pagesMeta.find(p => p.pageNumber === focusedPageNum) ? (
                  <div style={{
                    width: framing === 'desktop-fit' || framing === 'desktop-crop' ? '100%' : 'auto',
                    aspectRatio: framing === 'desktop-fit' || framing === 'desktop-crop' ? '16/9' : framing === 'mobile-crop' ? '9/16' : 'auto',
                    maxHeight: '340px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                  }}>
                    {/* Blurred backdrop preview for desktop-fit */}
                    {framing === 'desktop-fit' && (
                      <img
                        src={pagesMeta.find(p => p.pageNumber === focusedPageNum)?.thumbnailUrl}
                        alt="Backdrop"
                        style={{
                          position: 'absolute',
                          width: '120%',
                          height: '120%',
                          objectFit: 'cover',
                          filter: 'blur(16px) brightness(0.4)',
                          zIndex: 1
                        }}
                      />
                    )}

                    <img
                      src={pagesMeta.find(p => p.pageNumber === focusedPageNum)?.thumbnailUrl}
                      alt={`Page ${focusedPageNum}`}
                      style={{
                        position: 'relative',
                        zIndex: 2,
                        width: framing === 'desktop-crop' || framing === 'mobile-crop' ? '100%' : 'auto',
                        height: framing === 'desktop-crop' || framing === 'mobile-crop' ? '100%' : 'auto',
                        maxHeight: '320px',
                        objectFit: framing === 'desktop-crop' || framing === 'mobile-crop' ? 'cover' : 'contain',
                        borderRadius: framing === 'desktop-fit' ? '4px' : '0px',
                        boxShadow: framing === 'desktop-fit' ? '0 4px 16px rgba(0,0,0,0.6)' : 'none'
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Loading preview...
                  </div>
                )}
              </div>

              {/* Embedded Raw Native Photos section if found */}
              {extractedImages.length > 0 && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 'var(--border-radius-sm)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📷</span>
                      {t('PdfToImgExtractRaw')} ({extractedImages.length})
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Original Native Resolution
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {extractedImages.map((img, idx) => (
                      <div
                        key={img.id}
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid var(--card-border)',
                          borderRadius: '8px',
                          padding: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          alignItems: 'center',
                          minWidth: '100px'
                        }}
                      >
                        <img
                          src={img.dataUrl}
                          alt="Extracted"
                          style={{ width: '80px', height: '60px', objectFit: 'contain', borderRadius: '4px' }}
                        />
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {img.width} × {img.height} px
                        </span>
                        <a
                          href={img.dataUrl}
                          download={`${baseName}-page${focusedPageNum}-photo${idx + 1}.png`}
                          style={{
                            fontSize: '10.5px',
                            color: 'var(--accent)',
                            fontWeight: 600,
                            textDecoration: 'none',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(16, 185, 129, 0.15)'
                          }}
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Multi-page ZIP download card */}
              <div style={{
                marginTop: 'auto',
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--border-radius-sm)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t('PdfToImgSelectedCount', { count: selectedPages.size, total: totalPages })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Export all checked pages at {scale}x in one bundle
                  </div>
                </div>

                <button
                  type="button"
                  id="pdf-to-img-export-zip-btn"
                  disabled={isExporting || selectedPages.size === 0}
                  onClick={handleExportSelectedZip}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: 'none',
                    background: selectedPages.size === 0 ? 'var(--input-border)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    color: 'white',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: selectedPages.size === 0 || isExporting ? 'not-allowed' : 'pointer',
                    boxShadow: selectedPages.size > 0 ? '0 4px 12px var(--primary-glow)' : 'none'
                  }}
                >
                  {t('PdfToImgExportSelected', { count: selectedPages.size })}
                </button>
              </div>

            </div>

          </div>

          {/* Page Selector Gallery & Thumbnails Grid */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Gallery Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t('PdfToImgSelectPages')}
                </h3>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary)',
                  fontWeight: 600
                }}>
                  {selectedPages.size} / {totalPages}
                </span>
              </div>

              {/* Selection Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id="pdf-select-all-pages"
                  onClick={selectAllPages}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {t('PdfToImgSelectAll')}
                </button>

                <button
                  type="button"
                  id="pdf-deselect-all-pages"
                  onClick={clearSelection}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {t('PdfToImgDeselectAll')}
                </button>

                <input
                  type="text"
                  id="pdf-range-selector-input"
                  value={rangeInput}
                  placeholder={t('PdfToImgPageRange')}
                  onChange={(e) => applyRangeInput(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    width: '150px'
                  }}
                />
              </div>
            </div>

            {/* Thumbnail Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '14px',
              maxHeight: '480px',
              overflowY: 'auto',
              padding: '4px'
            }}>
              {pagesMeta.map((meta) => {
                const isSelected = selectedPages.has(meta.pageNumber);
                const isFocused = focusedPageNum === meta.pageNumber;

                return (
                  <div
                    key={meta.pageNumber}
                    id={`page-thumbnail-card-${meta.pageNumber}`}
                    onClick={() => setFocusedPageNum(meta.pageNumber)}
                    style={{
                      position: 'relative',
                      borderRadius: '10px',
                      border: isFocused
                        ? '2px solid var(--accent)'
                        : isSelected
                        ? '2px solid var(--primary)'
                        : '1px solid var(--card-border)',
                      background: isFocused
                        ? 'rgba(16, 185, 129, 0.08)'
                        : isSelected
                        ? 'rgba(99, 102, 241, 0.06)'
                        : 'var(--input-bg)',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      boxShadow: isFocused ? '0 0 14px rgba(16, 185, 129, 0.3)' : 'none'
                    }}
                  >
                    {/* Top row: Checkbox and page number */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        id={`page-checkbox-${meta.pageNumber}`}
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          togglePageSelection(meta.pageNumber);
                        }}
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isFocused ? 'var(--accent)' : 'var(--text-primary)' }}>
                        #{meta.pageNumber}
                      </span>
                    </div>

                    {/* Thumbnail Image */}
                    <div style={{
                      width: '100%',
                      height: '140px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '6px',
                      overflow: 'hidden'
                    }}>
                      <img
                        src={meta.thumbnailUrl}
                        alt={`Thumb ${meta.pageNumber}`}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    </div>

                    {/* Bottom action button */}
                    <button
                      type="button"
                      id={`export-single-page-btn-${meta.pageNumber}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusedPageNum(meta.pageNumber);
                        handleExportSinglePage(meta.pageNumber);
                      }}
                      style={{
                        padding: '4px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--input-border)',
                        background: isFocused ? 'rgba(16, 185, 129, 0.2)' : 'var(--input-bg)',
                        color: isFocused ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Exportar
                    </button>
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

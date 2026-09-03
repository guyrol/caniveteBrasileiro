'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

type SplitMode = 'chunks' | 'ranges' | 'size';

interface PageRangeRow {
  id: string;
  from: number;
  to: number;
}

interface ChunkPreview {
  index: number;
  name: string;
  pages: number[]; // 0-indexed page numbers
  pageRangeText: string;
  estimatedBytes: number;
  exactBytes?: number;
  blobUrl?: string;
  blob?: Blob;
}

export default function PdfSplitter() {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [baseName, setBaseName] = useState<string>('');
  const [fileArrayBuffer, setFileArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Drag & drop state
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Splitting Mode
  const [mode, setMode] = useState<SplitMode>('chunks');

  // Mode 1: Number of chunks
  const [chunkCount, setChunkCount] = useState<number>(2);

  // Mode 2: Custom ranges
  const [rangesText, setRangesText] = useState<string>('1-2, 3-4');
  const [rangeRows, setRangeRows] = useState<PageRangeRow[]>([
    { id: '1', from: 1, to: 1 }
  ]);
  const [rangeInputMode, setRangeInputMode] = useState<'text' | 'visual'>('text');

  // Mode 3: Max size per chunk
  const [maxSizeValue, setMaxSizeValue] = useState<number>(5);
  const [maxSizeUnit, setMaxSizeUnit] = useState<'MB' | 'KB'>('MB');

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [generatedChunks, setGeneratedChunks] = useState<ChunkPreview[]>([]);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Clean file name
  const extractBaseName = (filename: string): string => {
    return filename.replace(/\.[^/.]+$/, '').trim() || 'document';
  };

  // Load PDF file
  const handlePdfUpload = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage(i18n.language === 'pt' ? 'Por favor selecione um arquivo PDF válido.' : 'Please select a valid PDF file.');
      return;
    }

    setErrorMessage('');
    setIsPdfLoading(true);
    setGeneratedChunks([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pagesCount = pdfDoc.getPageCount();

      if (pagesCount === 0) {
        throw new Error(i18n.language === 'pt' ? 'O PDF não contém páginas válidas.' : 'PDF contains no valid pages.');
      }

      const name = extractBaseName(selectedFile.name);
      setFile(selectedFile);
      setBaseName(name);
      setFileArrayBuffer(buffer);
      setTotalPages(pagesCount);

      // Default chunk counts & ranges based on total pages
      const defaultChunks = Math.min(2, pagesCount);
      setChunkCount(defaultChunks);

      // Default ranges
      if (pagesCount === 1) {
        setRangesText('1');
        setRangeRows([{ id: '1', from: 1, to: 1 }]);
      } else {
        const mid = Math.ceil(pagesCount / 2);
        setRangesText(`1-${mid}, ${mid + 1}-${pagesCount}`);
        setRangeRows([
          { id: '1', from: 1, to: mid },
          { id: '2', from: mid + 1, to: pagesCount }
        ]);
      }

      // Default target size heuristic
      const fileMB = selectedFile.size / (1024 * 1024);
      if (fileMB > 2) {
        setMaxSizeValue(Math.max(1, Math.round(fileMB / 2)));
        setMaxSizeUnit('MB');
      } else {
        setMaxSizeValue(Math.max(100, Math.round((selectedFile.size / 1024) / 2)));
        setMaxSizeUnit('KB');
      }

    } catch (err: any) {
      console.error('PDF load error:', err);
      setErrorMessage(
        err.message || (i18n.language === 'pt' ? 'Erro ao carregar e analisar o PDF.' : 'Failed to load and parse the PDF.')
      );
      setFile(null);
      setTotalPages(0);
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Drag and Drop handlers
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handlePdfUpload(e.dataTransfer.files[0]);
    }
  };

  // Clear current PDF
  const handleClearFile = () => {
    // Revoke object URLs to prevent memory leaks
    generatedChunks.forEach((chunk) => {
      if (chunk.blobUrl) URL.revokeObjectURL(chunk.blobUrl);
    });

    setFile(null);
    setBaseName('');
    setFileArrayBuffer(null);
    setTotalPages(0);
    setGeneratedChunks([]);
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calculate Chunks Preview dynamically
  const previewChunks: ChunkPreview[] = useMemo(() => {
    if (!file || totalPages === 0) return [];

    const avgPageBytes = file.size / totalPages;
    const cleanName = baseName || 'document';
    const result: ChunkPreview[] = [];

    if (mode === 'chunks') {
      // Split evenly into chunkCount parts
      const validChunks = Math.max(1, Math.min(chunkCount, totalPages));
      const baseChunkSize = Math.floor(totalPages / validChunks);
      const remainder = totalPages % validChunks;

      let currentPageIndex = 0;
      for (let i = 0; i < validChunks; i++) {
        const pagesInThisChunk = baseChunkSize + (i < remainder ? 1 : 0);
        if (pagesInThisChunk <= 0) continue;

        const pageIndices: number[] = [];
        for (let p = 0; p < pagesInThisChunk; p++) {
          pageIndices.push(currentPageIndex + p);
        }

        const startPageNum = currentPageIndex + 1;
        const endPageNum = currentPageIndex + pagesInThisChunk;
        currentPageIndex += pagesInThisChunk;

        const pageRangeText = startPageNum === endPageNum 
          ? (i18n.language === 'pt' ? `Página ${startPageNum}` : `Page ${startPageNum}`)
          : (i18n.language === 'pt' ? `Páginas ${startPageNum}–${endPageNum} (${pagesInThisChunk} págs)` : `Pages ${startPageNum}–${endPageNum} (${pagesInThisChunk} pages)`);

        result.push({
          index: i + 1,
          name: `${cleanName}-pt${i + 1}.pdf`,
          pages: pageIndices,
          pageRangeText,
          estimatedBytes: Math.round(pagesInThisChunk * avgPageBytes)
        });
      }
    } else if (mode === 'ranges') {
      // Custom Page Ranges
      let parsedRanges: { from: number; to: number }[] = [];

      if (rangeInputMode === 'text') {
        // Parse string like "1-5, 6-10, 12"
        const parts = rangesText.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        for (const part of parts) {
          if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            const from = parseInt(startStr.trim(), 10);
            const to = parseInt(endStr.trim(), 10);
            if (!isNaN(from) && !isNaN(to) && from >= 1 && to >= from) {
              parsedRanges.push({ from: Math.min(from, totalPages), to: Math.min(to, totalPages) });
            }
          } else {
            const single = parseInt(part, 10);
            if (!isNaN(single) && single >= 1 && single <= totalPages) {
              parsedRanges.push({ from: single, to: single });
            }
          }
        }
      } else {
        // Use visual range rows
        parsedRanges = rangeRows
          .filter(r => r.from >= 1 && r.to >= r.from)
          .map(r => ({ from: Math.min(r.from, totalPages), to: Math.min(r.to, totalPages) }));
      }

      parsedRanges.forEach((range, idx) => {
        const pageIndices: number[] = [];
        for (let p = range.from - 1; p <= range.to - 1; p++) {
          if (p >= 0 && p < totalPages) {
            pageIndices.push(p);
          }
        }

        if (pageIndices.length > 0) {
          const count = pageIndices.length;
          const rangeText = range.from === range.to 
            ? (i18n.language === 'pt' ? `Página ${range.from}` : `Page ${range.from}`)
            : (i18n.language === 'pt' ? `Páginas ${range.from}–${range.to} (${count} págs)` : `Pages ${range.from}–${range.to} (${count} pages)`);

          result.push({
            index: idx + 1,
            name: `${cleanName}-pt${idx + 1}.pdf`,
            pages: pageIndices,
            pageRangeText: rangeText,
            estimatedBytes: Math.round(count * avgPageBytes)
          });
        }
      });
    } else if (mode === 'size') {
      // Split by maximum file size
      const targetMaxBytes = maxSizeValue * (maxSizeUnit === 'MB' ? 1024 * 1024 : 1024);
      const safeTargetBytes = Math.max(targetMaxBytes, 1024); // at least 1KB

      let currentPages: number[] = [];
      let currentEstimatedBytes = 0;
      let chunkIdx = 1;

      for (let p = 0; p < totalPages; p++) {
        // If adding next page would exceed limit and we already have at least 1 page in current chunk
        if (currentPages.length > 0 && (currentEstimatedBytes + avgPageBytes > safeTargetBytes)) {
          const startNum = currentPages[0] + 1;
          const endNum = currentPages[currentPages.length - 1] + 1;
          const text = startNum === endNum
            ? (i18n.language === 'pt' ? `Página ${startNum}` : `Page ${startNum}`)
            : (i18n.language === 'pt' ? `Páginas ${startNum}–${endNum} (${currentPages.length} págs)` : `Pages ${startNum}–${endNum} (${currentPages.length} pages)`);

          result.push({
            index: chunkIdx,
            name: `${cleanName}-pt${chunkIdx}.pdf`,
            pages: [...currentPages],
            pageRangeText: text,
            estimatedBytes: currentEstimatedBytes
          });

          chunkIdx++;
          currentPages = [p];
          currentEstimatedBytes = Math.round(avgPageBytes);
        } else {
          currentPages.push(p);
          currentEstimatedBytes += Math.round(avgPageBytes);
        }
      }

      if (currentPages.length > 0) {
        const startNum = currentPages[0] + 1;
        const endNum = currentPages[currentPages.length - 1] + 1;
        const text = startNum === endNum
          ? (i18n.language === 'pt' ? `Página ${startNum}` : `Page ${startNum}`)
          : (i18n.language === 'pt' ? `Páginas ${startNum}–${endNum} (${currentPages.length} págs)` : `Pages ${startNum}–${endNum} (${currentPages.length} pages)`);

        result.push({
          index: chunkIdx,
          name: `${cleanName}-pt${chunkIdx}.pdf`,
          pages: [...currentPages],
          pageRangeText: text,
          estimatedBytes: currentEstimatedBytes
        });
      }
    }

    return result;
  }, [file, totalPages, baseName, mode, chunkCount, rangesText, rangeRows, rangeInputMode, maxSizeValue, maxSizeUnit, i18n.language]);

  // Clean up old generated blob URLs whenever preview chunks change
  useEffect(() => {
    setGeneratedChunks([]);
  }, [mode, chunkCount, rangesText, rangeRows, maxSizeValue, maxSizeUnit]);

  // Process & Split PDF
  const handleProcessPdf = async () => {
    if (!fileArrayBuffer || previewChunks.length === 0) return;

    setIsProcessing(true);
    setProgressPercent(0);
    setProgressStatus(i18n.language === 'pt' ? 'Iniciando separação...' : 'Starting PDF split...');

    try {
      const sourceDoc = await PDFDocument.load(fileArrayBuffer, { ignoreEncryption: true });
      const completed: ChunkPreview[] = [];

      for (let i = 0; i < previewChunks.length; i++) {
        const chunk = previewChunks[i];
        const pct = Math.round(((i) / previewChunks.length) * 100);
        setProgressPercent(pct);
        setProgressStatus(
          i18n.language === 'pt'
            ? `Gerando pedaço ${i + 1} de ${previewChunks.length}: ${chunk.name}...`
            : `Generating chunk ${i + 1} of ${previewChunks.length}: ${chunk.name}...`
        );

        // Small yield to let UI render progress
        await new Promise(r => setTimeout(r, 10));

        const subDoc = await PDFDocument.create();
        const copiedPages = await subDoc.copyPages(sourceDoc, chunk.pages);
        copiedPages.forEach(p => subDoc.addPage(p));

        const subPdfBytes = await subDoc.save();
        const blob = new Blob([subPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);

        completed.push({
          ...chunk,
          exactBytes: subPdfBytes.byteLength,
          blobUrl,
          blob
        });
      }

      setProgressPercent(100);
      setProgressStatus(i18n.language === 'pt' ? 'Todos os pedaços foram gerados!' : 'All chunks successfully created!');
      setGeneratedChunks(completed);

    } catch (err: any) {
      console.error('Split error:', err);
      setErrorMessage(err.message || (i18n.language === 'pt' ? 'Erro ao fatiar o PDF.' : 'Error splitting PDF.'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Individual Chunk
  const handleDownloadChunk = (chunk: ChunkPreview) => {
    if (chunk.blobUrl) {
      const a = document.createElement('a');
      a.href = chunk.blobUrl;
      a.download = chunk.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // If not yet generated, generate just this chunk on the fly
      handleProcessPdf();
    }
  };

  // Download All as ZIP
  const handleDownloadAllZip = async () => {
    if (!fileArrayBuffer || previewChunks.length === 0) return;

    let chunksToZip = generatedChunks;

    // If not yet generated, generate them first
    if (chunksToZip.length === 0 || chunksToZip.length !== previewChunks.length) {
      setIsProcessing(true);
      setProgressPercent(10);
      setProgressStatus(i18n.language === 'pt' ? 'Processando PDFs para compactar...' : 'Processing PDFs for zip bundle...');

      try {
        const sourceDoc = await PDFDocument.load(fileArrayBuffer, { ignoreEncryption: true });
        const created: ChunkPreview[] = [];

        for (let i = 0; i < previewChunks.length; i++) {
          const chunk = previewChunks[i];
          const subDoc = await PDFDocument.create();
          const copiedPages = await subDoc.copyPages(sourceDoc, chunk.pages);
          copiedPages.forEach(p => subDoc.addPage(p));

          const bytes = await subDoc.save();
          const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);

          created.push({
            ...chunk,
            exactBytes: bytes.byteLength,
            blobUrl,
            blob
          });
        }

        chunksToZip = created;
        setGeneratedChunks(created);
      } catch (err: any) {
        console.error('Error generating chunks for ZIP:', err);
        setErrorMessage(i18n.language === 'pt' ? 'Falha ao gerar os pedaços para download.' : 'Failed to generate chunks for download.');
        setIsProcessing(false);
        return;
      }
    }

    // Now build ZIP
    setIsProcessing(true);
    setProgressPercent(85);
    setProgressStatus(i18n.language === 'pt' ? 'Compactando arquivos em arquivo .ZIP...' : 'Packaging files into .ZIP archive...');

    try {
      const zip = new JSZip();
      for (const chunk of chunksToZip) {
        if (chunk.blob) {
          zip.file(chunk.name, chunk.blob);
        }
      }

      const zipContent = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setProgressPercent(85 + Math.round(metadata.percent * 0.14));
      });

      const zipUrl = URL.createObjectURL(zipContent);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `${baseName || 'document'}-chunks.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);

      setProgressPercent(100);
      setProgressStatus(i18n.language === 'pt' ? 'Download do ZIP concluído!' : 'ZIP download complete!');
    } catch (err: any) {
      console.error('Zip creation error:', err);
      setErrorMessage(i18n.language === 'pt' ? 'Erro ao criar arquivo ZIP compactado.' : 'Failed to create ZIP bundle.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Presets helper for Mode 2
  const applyPresetRanges = (type: 'halves' | 'single' | 'every2' | 'every5') => {
    if (totalPages === 0) return;

    if (type === 'halves') {
      const mid = Math.ceil(totalPages / 2);
      const text = totalPages === 1 ? '1' : `1-${mid}, ${mid + 1}-${totalPages}`;
      setRangesText(text);
      setRangeRows(
        totalPages === 1 
          ? [{ id: '1', from: 1, to: 1 }] 
          : [{ id: '1', from: 1, to: mid }, { id: '2', from: mid + 1, to: totalPages }]
      );
    } else if (type === 'single') {
      const items: string[] = [];
      const rows: PageRangeRow[] = [];
      for (let i = 1; i <= totalPages; i++) {
        items.push(`${i}`);
        rows.push({ id: String(i), from: i, to: i });
      }
      setRangesText(items.join(', '));
      setRangeRows(rows);
    } else if (type === 'every2') {
      const items: string[] = [];
      const rows: PageRangeRow[] = [];
      let rowId = 1;
      for (let i = 1; i <= totalPages; i += 2) {
        const end = Math.min(i + 1, totalPages);
        items.push(i === end ? `${i}` : `${i}-${end}`);
        rows.push({ id: String(rowId++), from: i, to: end });
      }
      setRangesText(items.join(', '));
      setRangeRows(rows);
    } else if (type === 'every5') {
      const items: string[] = [];
      const rows: PageRangeRow[] = [];
      let rowId = 1;
      for (let i = 1; i <= totalPages; i += 5) {
        const end = Math.min(i + 4, totalPages);
        items.push(i === end ? `${i}` : `${i}-${end}`);
        rows.push({ id: String(rowId++), from: i, to: end });
      }
      setRangesText(items.join(', '));
      setRangeRows(rows);
    }
  };

  // Add range row
  const handleAddRangeRow = () => {
    const lastRow = rangeRows[rangeRows.length - 1];
    const nextStart = lastRow ? Math.min(lastRow.to + 1, totalPages) : 1;
    const nextEnd = Math.min(nextStart + 1, totalPages);
    const newRows = [...rangeRows, { id: String(Date.now()), from: nextStart, to: nextEnd }];
    setRangeRows(newRows);
    
    // Sync text
    const text = newRows.map(r => r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`).join(', ');
    setRangesText(text);
  };

  // Remove range row
  const handleRemoveRangeRow = (id: string) => {
    const newRows = rangeRows.filter(r => r.id !== id);
    setRangeRows(newRows);
    const text = newRows.map(r => r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`).join(', ');
    setRangesText(text);
  };

  // Update range row
  const handleUpdateRangeRow = (id: string, field: 'from' | 'to', value: number) => {
    const newRows = rangeRows.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    });
    setRangeRows(newRows);
    const text = newRows.map(r => r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`).join(', ');
    setRangesText(text);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Info */}
      <div className="glass-card" style={{ 
        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(99, 102, 241, 0.08))',
        borderLeft: '4px solid var(--secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--secondary), #f43f5e)',
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px var(--secondary-glow)',
            color: 'white'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" strokeDasharray="2 2" />
              <circle cx="6" cy="13" r="2" />
              <circle cx="18" cy="13" r="2" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {t('PdfSplitterTitle')}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {t('PdfSplitterDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Error notification if any */}
      {errorMessage && (
        <div className="glass-card animate-fade-in" style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderRadius: 'var(--border-radius-sm)'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontSize: '13.5px', fontWeight: 500 }}>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Upload or Selected File Status */}
      {!file ? (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="glass-card"
          style={{
            border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--card-border)',
            background: isDragging ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.01)',
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all var(--transition-normal)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px'
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
            background: isDragging ? 'rgba(99, 102, 241, 0.2)' : 'rgba(236, 72, 153, 0.1)',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDragging ? 'var(--primary)' : 'var(--secondary)',
            transition: 'all var(--transition-fast)'
          }}>
            {isPdfLoading ? (
              <div style={{
                width: '28px',
                height: '28px',
                border: '3px solid var(--secondary)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              {isDragging ? t('PdfDragOver') : t('PdfDropzoneTitle')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
              {t('PdfDropzoneSubtitle')}
            </p>
          </div>

          <button 
            type="button"
            className="btn-primary"
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--border-radius-sm)',
              border: 'none',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: 'white',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px var(--primary-glow)'
            }}
          >
            {t('PdfSelectFile')}
          </button>
        </div>
      ) : (
        /* File Active Card */
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--danger)',
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 800,
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                PDF
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {file.name}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary)',
                    fontWeight: 600
                  }}>
                    {totalPages} {t('PdfPages')}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {t('PdfOriginalSize')}: <strong>{formatBytes(file.size)}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
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
                id="pdf-change-file-btn"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  transition: 'all var(--transition-fast)'
                }}
              >
                {t('PdfChangeFile')}
              </button>
              <button
                type="button"
                id="pdf-remove-file-btn"
                onClick={handleClearFile}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  transition: 'all var(--transition-fast)'
                }}
              >
                ✕ {t('Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Modes & Configuration (Only if file is loaded) */}
      {file && totalPages > 0 && (
        <>
          {/* Mode Selector Tabs */}
          <div className="glass-card" style={{ padding: '8px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              
              {/* Option 1: Number of Chunks */}
              <button
                type="button"
                id="mode-btn-chunks"
                onClick={() => setMode('chunks')}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid',
                  borderColor: mode === 'chunks' ? 'var(--primary)' : 'transparent',
                  background: mode === 'chunks' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                  color: mode === 'chunks' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: mode === 'chunks' ? 'var(--primary)' : 'var(--input-bg)',
                  color: mode === 'chunks' ? 'white' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px'
                }}>
                  #
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{t('PdfModeChunks')}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('PdfModeChunksDesc')}</div>
                </div>
              </button>

              {/* Option 2: Page Spread / Ranges */}
              <button
                type="button"
                id="mode-btn-ranges"
                onClick={() => setMode('ranges')}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid',
                  borderColor: mode === 'ranges' ? 'var(--secondary)' : 'transparent',
                  background: mode === 'ranges' ? 'rgba(236, 72, 153, 0.12)' : 'transparent',
                  color: mode === 'ranges' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: mode === 'ranges' ? 'var(--secondary)' : 'var(--input-bg)',
                  color: mode === 'ranges' ? 'white' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px'
                }}>
                  ⇄
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{t('PdfModeRanges')}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('PdfModeRangesDesc')}</div>
                </div>
              </button>

              {/* Option 3: Max Size per Chunk */}
              <button
                type="button"
                id="mode-btn-size"
                onClick={() => setMode('size')}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid',
                  borderColor: mode === 'size' ? 'var(--accent)' : 'transparent',
                  background: mode === 'size' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  color: mode === 'size' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: mode === 'size' ? 'var(--accent)' : 'var(--input-bg)',
                  color: mode === 'size' ? 'white' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px'
                }}>
                  MB
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{t('PdfModeSize')}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('PdfModeSizeDesc')}</div>
                </div>
              </button>

            </div>
          </div>

          {/* Mode Configuration Form */}
          <div className="glass-card animate-fade-in">
            {/* MODE 1: Number of Chunks */}
            {mode === 'chunks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label htmlFor="chunk-count-input" style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {t('PdfChunksCountLabel')}: <span style={{ color: 'var(--primary)', fontSize: '16px' }}>{chunkCount}</span>
                  </label>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    {i18n.language === 'pt' 
                      ? `O documento de ${totalPages} páginas será dividido igualmente em ${chunkCount} arquivos.` 
                      : `The ${totalPages}-page document will be divided evenly into ${chunkCount} separate files.`}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '500px' }}>
                    <input 
                      id="chunk-count-slider"
                      type="range" 
                      min={2} 
                      max={Math.max(2, totalPages)} 
                      value={chunkCount} 
                      onChange={(e) => setChunkCount(parseInt(e.target.value, 10))}
                      style={{ flexGrow: 1 }}
                    />
                    <input 
                      id="chunk-count-input"
                      type="number" 
                      min={2} 
                      max={totalPages} 
                      value={chunkCount} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setChunkCount(Math.max(2, Math.min(val, totalPages)));
                        }
                      }}
                      style={{ width: '80px', textAlign: 'center', fontWeight: 700 }}
                    />
                  </div>
                </div>

                {/* Quick chunk shortcuts */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('Presets')}:</span>
                  {[2, 3, 4, 5, 10].filter(n => n <= totalPages).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setChunkCount(n)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: chunkCount === n ? 'var(--primary)' : 'var(--input-border)',
                        background: chunkCount === n ? 'rgba(99, 102, 241, 0.15)' : 'var(--input-bg)',
                        color: chunkCount === n ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {n} {i18n.language === 'pt' ? 'partes' : 'parts'}
                    </button>
                  ))}
                  {totalPages > 1 && (
                    <button
                      type="button"
                      onClick={() => setChunkCount(totalPages)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: chunkCount === totalPages ? 'var(--primary)' : 'var(--input-border)',
                        background: chunkCount === totalPages ? 'rgba(99, 102, 241, 0.15)' : 'var(--input-bg)',
                        color: chunkCount === totalPages ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      1 {i18n.language === 'pt' ? 'pág/arquivo' : 'page/file'} ({totalPages})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* MODE 2: Page Ranges */}
            {mode === 'ranges' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <label htmlFor="custom-ranges-input" style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {t('PdfCustomRangesLabel')}
                    </label>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {t('PdfCustomRangesHelp')} ({t('PdfTotalPages')}: {totalPages})
                    </p>
                  </div>

                  {/* Mode switcher (Text vs Visual List) */}
                  <div style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: '6px', padding: '2px', border: '1px solid var(--input-border)' }}>
                    <button
                      type="button"
                      onClick={() => setRangeInputMode('text')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        background: rangeInputMode === 'text' ? 'var(--bg-color)' : 'transparent',
                        color: rangeInputMode === 'text' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {i18n.language === 'pt' ? 'Texto' : 'Text'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangeInputMode('visual')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        background: rangeInputMode === 'visual' ? 'var(--bg-color)' : 'transparent',
                        color: rangeInputMode === 'visual' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {i18n.language === 'pt' ? 'Lista Visual' : 'Visual Builder'}
                    </button>
                  </div>
                </div>

                {/* Text input */}
                {rangeInputMode === 'text' ? (
                  <div>
                    <input 
                      id="custom-ranges-input"
                      type="text" 
                      value={rangesText} 
                      onChange={(e) => setRangesText(e.target.value)}
                      placeholder={t('PdfCustomRangesPlaceholder')}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}
                    />
                  </div>
                ) : (
                  /* Visual Builder */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {rangeRows.map((row, idx) => (
                      <div 
                        key={row.id} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '8px 12px',
                          borderRadius: 'var(--border-radius-sm)',
                          border: '1px solid var(--input-border)',
                          flexWrap: 'wrap'
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary)', minWidth: '70px' }}>
                          Chunk #{idx + 1}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('PdfFromPage')}:</span>
                          <input 
                            type="number" 
                            min={1} 
                            max={totalPages} 
                            value={row.from} 
                            onChange={(e) => handleUpdateRangeRow(row.id, 'from', parseInt(e.target.value, 10) || 1)}
                            style={{ width: '70px', padding: '6px 8px', textAlign: 'center' }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('PdfToPage')}:</span>
                          <input 
                            type="number" 
                            min={row.from} 
                            max={totalPages} 
                            value={row.to} 
                            onChange={(e) => handleUpdateRangeRow(row.id, 'to', parseInt(e.target.value, 10) || row.from)}
                            style={{ width: '70px', padding: '6px 8px', textAlign: 'center' }}
                          />
                        </div>

                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          ({Math.max(1, row.to - row.from + 1)} {t('PdfPages')})
                        </span>

                        {rangeRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRangeRow(row.id)}
                            style={{
                              marginLeft: 'auto',
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger)',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            ✕ {t('PdfRemoveRange')}
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddRangeRow}
                      style={{
                        padding: '8px 16px',
                        alignSelf: 'flex-start',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px dashed var(--secondary)',
                        background: 'rgba(236, 72, 153, 0.05)',
                        color: 'var(--secondary)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      + {t('PdfAddRange')}
                    </button>
                  </div>
                )}

                {/* Presets */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('Presets')}:</span>
                  <button
                    type="button"
                    onClick={() => applyPresetRanges('halves')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--input-border)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {t('PdfPresetHalves')}
                  </button>
                  {totalPages > 2 && (
                    <button
                      type="button"
                      onClick={() => applyPresetRanges('every2')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--input-border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {t('PdfPresetEvery2')}
                    </button>
                  )}
                  {totalPages > 5 && (
                    <button
                      type="button"
                      onClick={() => applyPresetRanges('every5')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--input-border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {t('PdfPresetEvery5')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => applyPresetRanges('single')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--input-border)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {t('PdfPresetSinglePages')}
                  </button>
                </div>
              </div>
            )}

            {/* MODE 3: Max Size per Chunk */}
            {mode === 'size' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="max-size-input" style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {t('PdfMaxSizeLabel')}
                  </label>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    {i18n.language === 'pt'
                      ? `As páginas serão agrupadas sequencialmente para que cada pedaço não ultrapasse o limite de ${maxSizeValue} ${maxSizeUnit}.`
                      : `Pages will be bundled sequentially so that each chunk does not exceed the ${maxSizeValue} ${maxSizeUnit} target.`}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '360px' }}>
                    <input 
                      id="max-size-input"
                      type="number" 
                      min={1} 
                      step={maxSizeUnit === 'MB' ? '0.5' : '50'}
                      value={maxSizeValue} 
                      onChange={(e) => setMaxSizeValue(Math.max(0.1, parseFloat(e.target.value) || 1))}
                      style={{ flexGrow: 1, fontWeight: 700 }}
                    />
                    <select
                      id="max-size-unit-select"
                      value={maxSizeUnit}
                      onChange={(e) => setMaxSizeUnit(e.target.value as 'MB' | 'KB')}
                      style={{ width: '100px', fontWeight: 600 }}
                    >
                      <option value="MB">MB</option>
                      <option value="KB">KB</option>
                    </select>
                  </div>
                </div>

                {/* Common Size Limits Shortcuts */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('Presets')}:</span>
                  {[
                    { label: '2 MB (Email/Gov)', val: 2, unit: 'MB' as const },
                    { label: '5 MB (Web Standard)', val: 5, unit: 'MB' as const },
                    { label: '10 MB (Discord/Slack)', val: 10, unit: 'MB' as const },
                    { label: '25 MB (Gmail limit)', val: 25, unit: 'MB' as const }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setMaxSizeValue(preset.val);
                        setMaxSizeUnit(preset.unit);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: (maxSizeValue === preset.val && maxSizeUnit === preset.unit) ? 'var(--accent)' : 'var(--input-border)',
                        background: (maxSizeValue === preset.val && maxSizeUnit === preset.unit) ? 'rgba(16, 185, 129, 0.15)' : 'var(--input-bg)',
                        color: (maxSizeValue === preset.val && maxSizeUnit === preset.unit) ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: Result Preview & Action Bar */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Action Bar Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--card-border)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {t('PdfPreviewTitle')}
                  <span style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary)',
                    fontWeight: 600
                  }}>
                    {previewChunks.length} {previewChunks.length === 1 ? 'PDF' : 'PDFs'}
                  </span>
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {t('PdfPreviewSubtitle')} &bull; Naming pattern: <code style={{ color: 'var(--secondary)' }}>[name]-pt[#].pdf</code>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id="pdf-split-process-btn"
                  onClick={handleProcessPdf}
                  disabled={isProcessing || previewChunks.length === 0}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--primary)',
                    background: 'rgba(99, 102, 241, 0.12)',
                    color: 'var(--text-primary)',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t('PdfProcessSplit')}
                </button>

                <button
                  type="button"
                  id="pdf-download-all-zip-btn"
                  onClick={handleDownloadAllZip}
                  disabled={isProcessing || previewChunks.length === 0}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    color: 'white',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    boxShadow: '0 2px 10px var(--primary-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {t('PdfDownloadAll')}
                </button>
              </div>
            </div>

            {/* Progress Bar when processing */}
            {isProcessing && (
              <div className="animate-fade-in" style={{ padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <span>{progressStatus}</span>
                  <span style={{ fontWeight: 700 }}>{progressPercent}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--input-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                    transition: 'width 0.2s ease'
                  }} />
                </div>
              </div>
            )}

            {/* Chunks Preview Grid */}
            {previewChunks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                {t('PdfErrorInvalidRange')}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '14px'
              }}>
                {previewChunks.map((chunk) => {
                  const genChunk = generatedChunks.find(g => g.index === chunk.index);
                  const displayBytes = genChunk?.exactBytes ?? chunk.estimatedBytes;
                  const isReady = !!genChunk?.blobUrl;

                  return (
                    <div 
                      key={chunk.name}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid',
                        borderColor: isReady ? 'rgba(16, 185, 129, 0.3)' : 'var(--input-border)',
                        borderRadius: 'var(--border-radius-sm)',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                        position: 'relative'
                      }}
                    >
                      {/* Top Info */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: 'var(--primary)'
                          }}>
                            Part {chunk.index} of {previewChunks.length}
                          </span>

                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: isReady ? 'var(--accent)' : 'var(--text-muted)'
                          }}>
                            {isReady ? '✓ Pronto' : `~${formatBytes(displayBytes)}`}
                          </span>
                        </div>

                        {/* File Name */}
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          wordBreak: 'break-all',
                          marginBottom: '4px'
                        }}>
                          {chunk.name}
                        </div>

                        {/* Page coverage */}
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {chunk.pageRangeText}
                        </div>
                      </div>

                      {/* Bottom action button */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          id={`download-chunk-${chunk.index}`}
                          onClick={() => handleDownloadChunk(genChunk || chunk)}
                          style={{
                            flexGrow: 1,
                            padding: '7px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--input-border)',
                            background: isReady ? 'rgba(16, 185, 129, 0.12)' : 'var(--input-bg)',
                            color: isReady ? 'var(--accent)' : 'var(--text-primary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          {isReady ? `${t('PdfDownloadChunk')} (${formatBytes(displayBytes)})` : `${t('PdfDownloadChunk')} (~${formatBytes(displayBytes)})`}
                        </button>

                        {/* Preview in tab if blobUrl exists */}
                        {genChunk?.blobUrl && (
                          <a
                            href={genChunk.blobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--input-border)',
                              background: 'var(--input-bg)',
                              color: 'var(--text-secondary)',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title={i18n.language === 'pt' ? 'Visualizar no navegador' : 'Preview in browser'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </>
      )}

    </div>
  );
}

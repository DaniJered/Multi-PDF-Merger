import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Setup pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export function PageThumbnail({ file, pageIndex, rotation, isSelected, onToggle, onRotate, width = 180 }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    let renderTask = null;
    
    const renderPage = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(pageIndex + 1); // 1-based
        
        const viewport = page.getViewport({ scale: 1.0, rotation });
        const scale = width / viewport.width;
        const scaledViewport = page.getViewport({ scale, rotation });
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport
        };
        
        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Error rendering page", err);
        }
      }
    };
    
    renderPage();
    
    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [file, pageIndex, rotation, width]);
  
  return (
    <div className={`page-card ${isSelected ? 'selected' : ''}`}>
      <div 
        className={`selection-toggle ${isSelected ? 'active' : ''}`}
        onClick={onToggle}
      >
        {isSelected && <span>✓</span>}
      </div>
      <canvas ref={canvasRef} />
      <div className="page-controls">
        <span className="text-muted text-sm">Pg {pageIndex + 1}</span>
        <button className="icon-btn" onClick={onRotate} title="Rotate 90°">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

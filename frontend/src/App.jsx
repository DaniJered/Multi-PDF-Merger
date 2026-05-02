import React, { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import * as pdfjsLib from 'pdfjs-dist';
import { PageThumbnail } from './components/PageThumbnail';
import './App.css';

function App() {
  const [files, setFiles] = useState([]); // { id, file, numPages }
  const [pages, setPages] = useState([]); // all pages across files: { id, fileId, file, pageIndex, rotation, selected }
  const [globalSettings, setGlobalSettings] = useState({ pageNumbers: 'none' });
  const [isMerging, setIsMerging] = useState(false);

  const handleFileUpload = async (event) => {
    const uploadedFiles = Array.from(event.target.files);

    for (const file of uploadedFiles) {
      if (file.type !== 'application/pdf') continue;

      const fileId = Math.random().toString(36).substring(7);

      // Get number of pages
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      const newFileObj = { id: fileId, file, name: file.name, numPages };
      setFiles(prev => [...prev, newFileObj]);

      const newPages = Array.from({ length: numPages }).map((_, i) => ({
        id: `${fileId}-${i}`,
        fileId,
        file,
        pageIndex: i,
        rotation: 0,
        selected: true
      }));

      setPages(prev => [...prev, ...newPages]);
    }
  };

  const togglePageSelection = (pageId) => {
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, selected: !p.selected } : p));
  };

  const rotatePage = (pageId) => {
    setPages(prev => prev.map(p =>
      p.id === pageId ? { ...p, rotation: (p.rotation + 90) % 360 } : p
    ));
  };

  const onFileDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(files);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setFiles(items);
  };

  const handleMerge = async () => {
    setIsMerging(true);
    try {
      const formData = new FormData();

      // Append unique files used in the sequence
      const sequencePages = [];
      files.forEach(fileObj => {
        const filePages = pages.filter(p => p.fileId === fileObj.id && p.selected);
        sequencePages.push(...filePages);
      });
      const usedFileIds = [...new Set(sequencePages.map(p => p.fileId))];

      const fileMapping = {};
      usedFileIds.forEach(fid => {
        const fileObj = files.find(f => f.id === fid);
        formData.append('files', fileObj.file, fileObj.name);
        fileMapping[fid] = fileObj.name;
      });

      // Build instructions
      const instructions = {
        global: globalSettings,
        pages: sequencePages.map(p => ({
          fileId: fileMapping[p.fileId],
          pageIndex: p.pageIndex,
          rotation: p.rotation
        }))
      };

      formData.append('instructions', JSON.stringify(instructions));

      const response = await fetch('https://multi-pdf-backend.onrender.com/api/merge', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Merge failed');

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Merged_Document.pdf';
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error(error);
      alert('Failed to merge PDFs');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Advanced PDF Merger</h1>
        <p className="text-muted">Combine, reorder, and edit pages with precision.</p>
      </header>

      <main className="main-workspace">
        <label className="drop-zone">
          <svg className="icon-large" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <h3>Upload PDF Files</h3>
          <p className="text-muted">Drag & drop or click to browse</p>
          <input type="file" multiple accept="application/pdf" onChange={handleFileUpload} />
        </label>

        {files.length > 0 && (
          <div className="document-section">
            <h2 className="document-header">Imported Documents</h2>
            {files.map(fileObj => (
              <div key={fileObj.id} style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>{fileObj.name}</h3>
                <div className="page-grid">
                  {pages.filter(p => p.fileId === fileObj.id).map(page => (
                    <PageThumbnail
                      key={page.id}
                      file={page.file}
                      pageIndex={page.pageIndex}
                      rotation={page.rotation}
                      isSelected={page.selected}
                      onToggle={() => togglePageSelection(page.id)}
                      onRotate={() => rotatePage(page.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <aside className="sidebar">
        <h2 style={{ marginBottom: '1.5rem' }}>File Order</h2>

        {files.length === 0 ? (
          <p className="text-muted">No files uploaded.</p>
        ) : (
          <DragDropContext onDragEnd={onFileDragEnd}>
            <Droppable droppableId="file-board" direction="vertical">
              {(provided) => (
                <div
                  className="sequence-board"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}
                >
                  {files.map((fileObj, index) => {
                    const selectedCount = pages.filter(p => p.fileId === fileObj.id && p.selected).length;
                    return (
                      <Draggable key={fileObj.id} draggableId={fileObj.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              background: 'var(--surface-light)',
                              padding: '1rem',
                              borderRadius: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <span style={{ fontWeight: 'bold', width: '20px' }}>{index + 1}.</span>
                            <span className="text-muted" style={{ flex: 1, marginLeft: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {fileObj.name}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedCount}/{fileObj.numPages} pgs</span>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Output Settings</h3>
          <div className="settings-group">
            <label>Page Numbers</label>
            <select
              value={globalSettings.pageNumbers}
              onChange={(e) => setGlobalSettings(prev => ({ ...prev, pageNumbers: e.target.value }))}
            >
              <option value="none">None</option>
              <option value="top-left">Top Left</option>
              <option value="top-center">Top Center</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-center">Bottom Center</option>
              <option value="bottom-right">Bottom Right</option>
            </select>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleMerge}
          disabled={files.length === 0 || isMerging}
        >
          {isMerging ? 'Merging...' : `Merge Files`}
        </button>
      </aside>
    </div>
  );
}

export default App;

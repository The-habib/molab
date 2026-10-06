import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FileText,
  Upload,
  FolderPlus,
  FilePlus,
  Download,
  Trash2,
  Edit2,
  RefreshCw,
  ArrowUp,
  X,
  Save,
  Search,
  ChevronRight,
  FileCode,
  FileJson,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { api } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

export const FilesPage: React.FC = () => {
  const { showToast } = useToast();
  const [currentPath, setCurrentPath] = useState('/marimo');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor Modal State
  const [editorFile, setEditorFile] = useState<{ path: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Rename & Delete state
  const [renameTarget, setRenameTarget] = useState<any | null>(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.listFiles(path);
      setCurrentPath(res.current_path);
      setParentPath(res.parent_path);
      setEntries(res.entries || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(currentPath);
  }, []);

  const handleOpenEntry = (entry: any) => {
    if (entry.is_dir) {
      fetchFiles(entry.path);
    } else {
      handleReadFile(entry.path);
    }
  };

  const handleReadFile = async (path: string) => {
    try {
      setLoading(true);
      const res = await api.readFile(path);
      setEditorFile({ path: res.path, content: res.content });
    } catch (err: any) {
      showToast(`Cannot open file: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!editorFile) return;
    try {
      setSaving(true);
      await api.writeFile(editorFile.path, editorFile.content);
      showToast('File saved successfully', 'success');
      fetchFiles(currentPath);
    } catch (err: any) {
      showToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S inside editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && editorFile) {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorFile]);

  const handleCreateFolder = async () => {
    const name = prompt('Enter new directory name:');
    if (!name) return;
    try {
      const target = `${currentPath.replace(/\/$/, '')}/${name}`;
      await api.mkdir(target);
      showToast(`Directory '${name}' created`, 'success');
      fetchFiles(currentPath);
    } catch (err: any) {
      showToast(`Error creating directory: ${err.message}`, 'error');
    }
  };

  const handleCreateFile = async () => {
    const name = prompt('Enter new file name:');
    if (!name) return;
    try {
      const target = `${currentPath.replace(/\/$/, '')}/${name}`;
      await api.writeFile(target, '');
      showToast(`File '${name}' created`, 'success');
      fetchFiles(currentPath);
      handleReadFile(target);
    } catch (err: any) {
      showToast(`Error creating file: ${err.message}`, 'error');
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameNewName) return;
    try {
      const dir = currentPath.replace(/\/$/, '');
      const dst = `${dir}/${renameNewName}`;
      await api.renameFile(renameTarget.path, dst);
      showToast(`Renamed to '${renameNewName}'`, 'success');
      setRenameTarget(null);
      setRenameNewName('');
      fetchFiles(currentPath);
    } catch (err: any) {
      showToast(`Rename failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteFile(deleteTarget);
      showToast('Item deleted successfully', 'success');
      setDeleteTarget(null);
      fetchFiles(currentPath);
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleUploadFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      setLoading(true);
      await api.uploadFile(currentPath, files[0]);
      showToast(`Uploaded '${files[0].name}' successfully`, 'success');
      fetchFiles(currentPath);
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Breadcrumbs parsing
  const pathParts = currentPath.split('/').filter(Boolean);

  const getFileIcon = (entry: any) => {
    if (entry.is_dir) return <Folder size={18} color="#38bdf8" />;
    const n = entry.name.toLowerCase();
    if (n.endsWith('.py') || n.endsWith('.pyw')) return <FileCode size={18} color="#76b900" />;
    if (n.endsWith('.json') || n.endsWith('.yaml') || n.endsWith('.yml')) return <FileJson size={18} color="#f59e0b" />;
    if (n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.svg')) return <ImageIcon size={18} color="#a855f7" />;
    return <FileText size={18} color="#94a3b8" />;
  };

  const filteredEntries = entries.filter((e) =>
    e.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      
      {/* Action Strip & Breadcrumbs */}
      <div className="card" style={{
        padding: '0.85rem 1.25rem',
        backgroundColor: '#0c1424',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Clickable Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto', flex: 1 }}>
          <button
            onClick={() => fetchFiles('/')}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.3rem 0.6rem' }}
          >
            Root
          </button>
          {pathParts.map((part, idx) => {
            const partPath = '/' + pathParts.slice(0, idx + 1).join('/');
            const isLast = idx === pathParts.length - 1;
            return (
              <React.Fragment key={idx}>
                <ChevronRight size={14} color="#64748b" />
                <button
                  onClick={() => fetchFiles(partPath)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isLast ? '#38bdf8' : '#94a3b8',
                    fontWeight: isLast ? 700 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#162238')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Toolbar Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {parentPath && (
            <button className="btn btn-secondary btn-sm" onClick={() => fetchFiles(parentPath)} title="Go to parent directory">
              <ArrowUp size={14} /> Up
            </button>
          )}

          <button className="btn btn-secondary btn-sm" onClick={handleCreateFolder}>
            <FolderPlus size={14} /> New Folder
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handleCreateFile}>
            <FilePlus size={14} /> New File
          </button>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleUploadFileChange}
          />
          <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> Upload
          </button>

          <button className="btn btn-secondary btn-sm" onClick={() => fetchFiles(currentPath)} title="Refresh directory">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search Filter & Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '32px' }}
            placeholder="Filter files in directory..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Showing {filteredEntries.length} of {entries.length} items
        </div>
      </div>

      {/* Files Table View */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Size</th>
              <th>Permissions</th>
              <th>Last Modified</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  Loading pod filesystem...
                </td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  {searchFilter ? 'No files match your search filter' : 'This directory is empty'}
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry, idx) => (
                <tr key={idx} style={{ cursor: entry.is_dir ? 'pointer' : 'default' }}>
                  <td onClick={() => handleOpenEntry(entry)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {getFileIcon(entry)}
                      <span style={{ fontWeight: entry.is_dir ? 600 : 400, color: entry.is_dir ? '#f8fafc' : '#cbd5e1' }}>
                        {entry.name}
                      </span>
                    </div>
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {entry.size !== null && entry.size !== undefined
                      ? entry.size > 1024 * 1024
                        ? `${(entry.size / (1024 * 1024)).toFixed(2)} MB`
                        : `${(entry.size / 1024).toFixed(1)} KB`
                      : '—'}
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {entry.permissions || '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {entry.modified ? new Date(entry.modified * 1000).toLocaleString() : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                      {!entry.is_dir && (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.25rem 0.5rem' }}
                            onClick={() => handleReadFile(entry.path)}
                            title="Edit file in editor"
                          >
                            <Edit2 size={13} />
                          </button>
                          <a
                            href={`/api/files/download?path=${encodeURIComponent(entry.path)}`}
                            download
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.25rem 0.5rem', textDecoration: 'none' }}
                            title="Download file"
                          >
                            <Download size={13} />
                          </a>
                        </>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.5rem' }}
                        onClick={() => {
                          setRenameTarget(entry);
                          setRenameNewName(entry.name);
                        }}
                        title="Rename file"
                      >
                        Rename
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0.25rem 0.5rem' }}
                        onClick={() => setDeleteTarget(entry.path)}
                        title="Delete file"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Code Editor Modal */}
      {editorFile && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#0a101d'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                  {editorFile.path}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Press <kbd style={{ padding: '1px 4px', background: '#1e293b', borderRadius: '3px' }}>Ctrl+S</kbd> to save changes
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveFile}
                  disabled={saving}
                >
                  <Save size={14} /> {saving ? 'Saving...' : 'Save File'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditorFile(null)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Editor Body */}
            <textarea
              style={{
                flex: 1,
                width: '100%',
                backgroundColor: '#070b14',
                color: '#f8fafc',
                border: 'none',
                padding: '1rem',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.5
              }}
              value={editorFile.content}
              onChange={(e) => setEditorFile({ ...editorFile, content: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.75rem' }}>
              Rename Item
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Renaming <code className="font-mono" style={{ color: '#38bdf8' }}>{renameTarget.name}</code>
            </p>
            <input
              type="text"
              className="input"
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value)}
              style={{ marginBottom: '1.25rem' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setRenameTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleRename}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Item Permanently?"
        message={`Are you sure you want to delete ${deleteTarget}? This action cannot be undone.`}
        confirmText="Delete"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>
  );
};

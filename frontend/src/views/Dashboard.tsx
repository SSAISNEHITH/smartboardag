import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, LogOut, User, Folder as FolderIcon, Plus, FileText, 
  Download, Trash2, Star, Edit2, Search, ExternalLink 
} from 'lucide-react';
import styles from './Dashboard.module.css';
import { useToast } from '../contexts/ToastContext';
import API_BASE from '../config/api';

const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
    <div style={{ background: '#ffffff', borderRadius: '6px', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src="/logo.png" alt="Smart Teach Logo" style={{ height: '36px', objectFit: 'contain' }} />
    </div>
    <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary-color)' }}>Thrisual Smart Teach</span>
  </div>
);

interface FolderItem {
  id: number;
  name: string;
  isImportant?: boolean;
}

interface FileItem {
  id: number;
  name: string;
  fileType?: string;
  folderId?: number | null;
  folder?: { id: number };
  isImportant?: boolean;
  content?: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const email = localStorage.getItem('email') || 'teacher@example.com';
  const isViewOnly = localStorage.getItem('isViewOnly') === 'true';

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog Modals State
  const [modalType, setModalType] = useState<'createFolder' | 'createBoard' | 'rename' | 'delete' | null>(null);
  const [dialogInput, setDialogInput] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<{ type: 'folder' | 'file'; id: number; name: string } | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'folder' | 'file';
    item: any;
  }>({ visible: false, x: 0, y: 0, type: 'folder', item: null });

  const hideContextMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    const handleClick = () => hideContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Fetch Folders from Backend scoped to current user email
  const loadFolders = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/folders?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        const userFolders = Array.isArray(data) ? data : [];
        setFolders(userFolders);
        if (userFolders.length > 0) {
          setActiveFolderId(prev => (prev && userFolders.some(f => f.id === prev)) ? prev : userFolders[0].id);
        } else {
          setActiveFolderId(null);
          setFiles([]);
        }
        return;
      }
    } catch {
      // Offline fallback: load from user-isolated key
      const savedFolders = localStorage.getItem(`folders_${email}`);
      if (savedFolders) {
        const parsed = JSON.parse(savedFolders);
        setFolders(parsed);
        if (parsed.length > 0) setActiveFolderId(parsed[0].id);
      } else {
        setFolders([]);
        setActiveFolderId(null);
      }
    }
  };

  // Fetch Files for Active Folder
  const loadFiles = async (fId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/files/${fId}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(Array.isArray(data) ? data : []);
        return;
      }
    } catch {
      const savedFiles = localStorage.getItem(`files_${email}_${fId}`);
      if (savedFiles) {
        setFiles(JSON.parse(savedFiles));
      } else {
        setFiles([]);
      }
    }
  };

  useEffect(() => {
    loadFolders();
  }, [email]);

  useEffect(() => {
    if (activeFolderId) {
      loadFiles(activeFolderId);
    } else {
      setFiles([]);
    }
  }, [activeFolderId]);

  const handleContextMenu = (e: React.MouseEvent, type: 'folder' | 'file', item: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 200),
      type,
      item
    });
  };

  // Open Create Folder Dialog
  const openCreateFolderDialog = () => {
    setDialogInput(`Folder ${folders.length + 1}`);
    setModalType('createFolder');
  };

  // Open Create Board Dialog
  const openCreateBoardDialog = () => {
    setDialogInput(`Topic Board ${files.length + 1}`);
    setModalType('createBoard');
  };

  // Open Rename Dialog
  const openRenameDialog = (type: 'folder' | 'file', item: any) => {
    hideContextMenu();
    setSelectedTarget({ type, id: item.id, name: item.name });
    setDialogInput(item.name);
    setModalType('rename');
  };

  // Open Delete Confirmation Dialog
  const openDeleteDialog = (type: 'folder' | 'file', item: any) => {
    hideContextMenu();
    setSelectedTarget({ type, id: item.id, name: item.name });
    setModalType('delete');
  };

  // Submit Dialog Action
  const handleDialogSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = dialogInput.trim();

    if (modalType === 'createFolder') {
      const folderName = trimmed || `New Folder ${folders.length + 1}`;
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/folders?email=${encodeURIComponent(email)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folderName })
        });
        if (res.ok) {
          const newFolder = await res.json();
          setFolders(prev => [...prev, newFolder]);
          setActiveFolderId(newFolder.id);
        } else {
          throw new Error();
        }
      } catch {
        const localId = Date.now();
        const newFolder = { id: localId, name: folderName, isImportant: false };
        setFolders(prev => [...prev, newFolder]);
        setActiveFolderId(localId);
      }
      showToast(`Folder "${folderName}" created`, 'success');
    } 
    else if (modalType === 'createBoard') {
      const boardName = trimmed || `New Topic Board ${files.length + 1}`;
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: boardName,
            fileType: 'board',
            folder: { id: activeFolderId }
          })
        });
        if (res.ok) {
          const newFile = await res.json();
          setFiles(prev => [...prev, newFile]);
        } else {
          throw new Error();
        }
      } catch {
        const localFile = {
          id: Date.now(),
          name: boardName,
          fileType: 'board',
          folderId: activeFolderId,
          isImportant: false
        };
        setFiles(prev => [...prev, localFile]);
      }
      showToast(`Topic Board "${boardName}" created`, 'success');
    }
    else if (modalType === 'rename' && selectedTarget) {
      const newName = trimmed || selectedTarget.name;
      if (selectedTarget.type === 'folder') {
        try {
          await fetch(`${API_BASE}/api/dashboard/folders/${selectedTarget.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
          });
        } catch {}
        setFolders(prev => prev.map(f => f.id === selectedTarget.id ? { ...f, name: newName } : f));
        showToast(`Folder renamed to "${newName}"`, 'success');
      } else {
        try {
          await fetch(`${API_BASE}/api/dashboard/files/${selectedTarget.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
          });
        } catch {}
        setFiles(prev => prev.map(f => f.id === selectedTarget.id ? { ...f, name: newName } : f));
        showToast(`Topic Board renamed to "${newName}"`, 'success');
      }
    }
    else if (modalType === 'delete' && selectedTarget) {
      if (selectedTarget.type === 'folder') {
        try {
          await fetch(`${API_BASE}/api/dashboard/folders/${selectedTarget.id}`, {
            method: 'DELETE'
          });
        } catch {}
        setFolders(prev => prev.filter(f => f.id !== selectedTarget.id));
        setFiles(prev => prev.filter(f => (f.folderId || f.folder?.id) !== selectedTarget.id));
        showToast(`Folder "${selectedTarget.name}" deleted`, 'success');
      } else {
        try {
          await fetch(`${API_BASE}/api/dashboard/files/${selectedTarget.id}`, {
            method: 'DELETE'
          });
        } catch {}
        setFiles(prev => prev.filter(f => f.id !== selectedTarget.id));
        showToast(`Topic Board "${selectedTarget.name}" deleted`, 'success');
      }
    }

    setModalType(null);
    setSelectedTarget(null);
  };

  // Toggle Important
  const handleToggleImportant = async (type: 'folder' | 'file', item: any) => {
    hideContextMenu();
    if (type === 'folder') {
      try {
        await fetch(`${API_BASE}/api/dashboard/folders/${item.id}/important`, {
          method: 'PATCH'
        });
      } catch {}
      setFolders(prev => prev.map(f => f.id === item.id ? { ...f, isImportant: !f.isImportant } : f));
      showToast(`${item.isImportant ? 'Unmarked' : 'Marked'} "${item.name}" as Important`, 'info');
    } else {
      try {
        await fetch(`${API_BASE}/api/dashboard/files/${item.id}/important`, {
          method: 'PATCH'
        });
      } catch {}
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, isImportant: !f.isImportant } : f));
      showToast(`${item.isImportant ? 'Unmarked' : 'Marked'} "${item.name}" as Important`, 'info');
    }
  };

  // Real Download / Export
  const handleDownload = (item: any) => {
    hideContextMenu();
    const exportData = {
      title: item.name,
      fileType: item.fileType || 'board',
      exportedAt: new Date().toISOString(),
      owner: email,
      content: item.content || 'Thrisual Smart Teach Board Content'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported "${item.name}" successfully`, 'success');
  };

  const handleOpenItem = (item: any) => {
    hideContextMenu();
    if (item.fileType === 'board' || !item.fileType) {
      navigate(`/board/${item.id}`);
    } else {
      showToast(`Opening file: ${item.name}`, 'info');
    }
  };

  const activeFolder = folders.find(f => f.id === activeFolderId) || folders[0];
  const filteredFiles = files
    .filter(f => (f.folderId || f.folder?.id) === activeFolderId || (!f.folderId && !f.folder))
    .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <Logo />
        <div className={styles.headerRight}>
          <div className={styles.storage}>
            <span>Storage: <strong>{(files.length * 2.5).toFixed(1)} GB</strong> / 1 TB</span>
            <div className={styles.storageBar}>
              <div 
                className={styles.storageFill} 
                style={{ width: `${Math.max(5, (files.length * 2.5 / 1000) * 100)}%` }}
              />
            </div>
          </div>
          <button 
            className={styles.iconBtn} 
            title="User Profile" 
            onClick={() => showToast(`User: ${email}`, 'info')}
          >
            <User size={20} />
          </button>
          <button 
            className={styles.iconBtn} 
            title="Logout" 
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('email');
              localStorage.removeItem('isViewOnly');
              showToast('Logged out successfully', 'success');
              navigate('/login');
            }}
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* View-Only Mode Banner */}
      {isViewOnly && (
        <div style={{
          background: '#FEF3C7', borderBottom: '1px solid #FDE68A',
          padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center',
          gap: '0.6rem', fontSize: '0.88rem', fontWeight: 600, color: '#92400E'
        }}>
          <span style={{ fontSize: '1rem' }}>🔒</span>
          <span>View-Only Mode — You can browse and open boards but cannot create, rename, delete, or make any changes.</span>
        </div>
      )}

      {/* Sidebar: Folders */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarActions}>
          {!isViewOnly && (
            <button 
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}
              onClick={openCreateFolderDialog}
            >
              <Plus size={18} /> Create new folder
            </button>
          )}
        </div>

        <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>
          My Folders ({folders.length})
        </h3>
        
        <div className={styles.folderList}>
          {folders.map(folder => (
            <div 
              key={folder.id} 
              className={`${styles.folderItem} ${activeFolderId === folder.id ? styles.active : ''}`}
              onClick={() => setActiveFolderId(folder.id)}
              onDoubleClick={() => setActiveFolderId(folder.id)}
              onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
            >
              <div className={styles.folderItemLeft}>
                <FolderIcon 
                  size={18} 
                  fill={activeFolderId === folder.id ? "var(--primary-color)" : "transparent"} 
                  color={activeFolderId === folder.id ? "var(--primary-color)" : "#64748B"} 
                />
                <span>{folder.name}</span>
              </div>
              {folder.isImportant && <Star size={14} fill="#F59E0B" color="#F59E0B" />}
            </div>
          ))}

          {folders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: '#94A3B8', fontSize: '0.85rem' }}>
              No folders yet.<br />Click "+ New Folder" to start.
            </div>
          )}
        </div>
      </div>

      {/* Main Area: Files & Topic Boards */}
      <div className={styles.mainArea}>
        <div className={styles.mainHeader}>
          <div className={styles.mainHeaderLeft}>
            <h2>{activeFolder ? activeFolder.name : (folders.length === 0 ? 'My Workspace' : 'All Topic Boards')}</h2>
            {activeFolder?.isImportant && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#FEF3C7', color: '#B45309', padding: '0.25rem 0.6rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>
                <Star size={12} fill="#B45309" /> Important
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className={styles.searchBar}>
              <Search size={16} color="#94A3B8" />
              <input 
                type="text" 
                placeholder="Search topic boards..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            {!isViewOnly && folders.length > 0 && (
              <button 
                className="btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }} 
                onClick={openCreateBoardDialog}
              >
                <Plus size={18} /> Create new topic board
              </button>
            )}
          </div>
        </div>

        <div className={styles.fileGrid}>
          {filteredFiles.map(file => (
            <div 
              key={file.id} 
              className={styles.fileItem}
              onDoubleClick={() => handleOpenItem(file)}
              onContextMenu={(e) => handleContextMenu(e, 'file', file)}
            >
              {file.isImportant && (
                <div className={styles.starBadge}>
                  <Star size={16} fill="#F59E0B" color="#F59E0B" />
                </div>
              )}
              {file.fileType === 'board' || !file.fileType ? (
                <FileText size={48} color="#2563EB" />
              ) : (
                <BookOpen size={48} color="#0D9488" />
              )}
              <span>{file.name}</span>
            </div>
          ))}

          {folders.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-light)', marginTop: '4rem', padding: '3rem 2rem', border: '2px dashed #CBD5E1', borderRadius: '1rem', background: '#F8FAFC' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <FolderIcon size={32} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>Your File Explorer is Empty</h3>
              <p style={{ fontSize: '0.95rem', maxWidth: '420px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
                Create your first folder to organize your smartboards and lessons.
              </p>
              <button 
                className="btn-primary" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.4rem', fontSize: '0.95rem' }} 
                onClick={openCreateFolderDialog}
              >
                <Plus size={18} /> Create First Folder
              </button>
            </div>
          )}

          {folders.length > 0 && filteredFiles.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-light)', marginTop: '3.5rem', padding: '3rem 2rem', border: '2px dashed #E2E8F0', borderRadius: '1rem', background: '#FAFAFA' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <FileText size={28} color="#64748B" />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.4rem' }}>
                There is no smartboard files created in this folder
              </h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', color: '#64748B' }}>
                Click below to create your first smartboard in <strong>{activeFolder?.name || 'this folder'}</strong>.
              </p>
              <button 
                className="btn-primary" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem' }} 
                onClick={openCreateBoardDialog}
              >
                <Plus size={18} /> Create New Smartboard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Windows Context Menu */}
      {contextMenu.visible && contextMenu.item && (
        <div 
          className={styles.contextMenu} 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.menuItem} onClick={() => handleOpenItem(contextMenu.item)}>
            <ExternalLink size={15} /> Open
          </div>
          {!isViewOnly && (
            <>
              <div className={styles.menuItem} onClick={() => openRenameDialog(contextMenu.type, contextMenu.item)}>
                <Edit2 size={15} /> Rename
              </div>
              <div className={styles.menuItem} onClick={() => handleToggleImportant(contextMenu.type, contextMenu.item)}>
                <Star size={15} fill={contextMenu.item.isImportant ? "#F59E0B" : "none"} color={contextMenu.item.isImportant ? "#F59E0B" : "currentColor"} /> 
                {contextMenu.item.isImportant ? 'Unmark Important' : 'Mark as Important'}
              </div>
              <div className={styles.menuItem} onClick={() => handleDownload(contextMenu.item)}>
                <Download size={15} /> Download / Export
              </div>
              <div className={styles.menuDivider} />
              <div className={`${styles.menuItem} ${styles.danger}`} onClick={() => openDeleteDialog(contextMenu.type, contextMenu.item)}>
                <Trash2 size={15} /> Delete
              </div>
            </>
          )}
        </div>
      )}

      {/* Windows Style Dialog Modal */}
      {modalType && (
        <div className={styles.modalOverlay}>
          <div className={styles.dialogBox}>
            {modalType === 'createFolder' && (
              <form onSubmit={handleDialogSubmit}>
                <h3>New Folder</h3>
                <p>Enter a name for your new folder:</p>
                <input 
                  type="text" 
                  autoFocus
                  className={styles.dialogInput}
                  value={dialogInput}
                  onChange={e => setDialogInput(e.target.value)}
                  placeholder="Folder Name"
                />
                <div className={styles.dialogButtons}>
                  <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                  <button type="submit" className="btn-primary">Create Folder</button>
                </div>
              </form>
            )}

            {modalType === 'createBoard' && (
              <form onSubmit={handleDialogSubmit}>
                <h3>New Topic Board</h3>
                <p>Enter a title for your smartboard session:</p>
                <input 
                  type="text" 
                  autoFocus
                  className={styles.dialogInput}
                  value={dialogInput}
                  onChange={e => setDialogInput(e.target.value)}
                  placeholder="Topic Board Title"
                />
                <div className={styles.dialogButtons}>
                  <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                  <button type="submit" className="btn-primary">Create Board</button>
                </div>
              </form>
            )}

            {modalType === 'rename' && (
              <form onSubmit={handleDialogSubmit}>
                <h3>Rename {selectedTarget?.type === 'folder' ? 'Folder' : 'Topic Board'}</h3>
                <p>Enter a new name for "{selectedTarget?.name}":</p>
                <input 
                  type="text" 
                  autoFocus
                  className={styles.dialogInput}
                  value={dialogInput}
                  onChange={e => setDialogInput(e.target.value)}
                />
                <div className={styles.dialogButtons}>
                  <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                  <button type="submit" className="btn-primary">Save Name</button>
                </div>
              </form>
            )}

            {modalType === 'delete' && (
              <div>
                <h3 style={{ color: 'var(--error)' }}>Delete {selectedTarget?.type === 'folder' ? 'Folder' : 'Topic Board'}</h3>
                <p>Are you sure you want to delete <strong>"{selectedTarget?.name}"</strong>? {selectedTarget?.type === 'folder' && 'All topic boards inside will also be removed.'}</p>
                <div className={styles.dialogButtons}>
                  <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                  <button type="button" className="btn-primary" style={{ backgroundColor: 'var(--error)' }} onClick={() => handleDialogSubmit()}>
                    Delete Permanently
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

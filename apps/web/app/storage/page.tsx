'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { TableSkeletonRows } from '@/components/page-skeleton';
import type { DocumentRecordDto, DocumentEntityType } from '@mystore/contracts';
import {
  FolderArchive,
  Upload,
  HardDrive,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Trash2,
  Download,
  Copy,
  ExternalLink,
  CheckCircle2,
  X,
  Plus,
  Filter,
} from 'lucide-react';

export default function StoragePage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Filter State
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>('ALL');

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadEntityType, setUploadEntityType] = useState<DocumentEntityType>('OTHER');
  const [uploadEntityId, setUploadEntityId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['storageStats'],
    queryFn: () => api.getStorageStats(token!),
    enabled: Boolean(token),
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['storageDocuments', selectedEntityFilter],
    queryFn: () =>
      api.listDocuments(token!, {
        entityType: selectedEntityFilter !== 'ALL' ? (selectedEntityFilter as DocumentEntityType) : undefined,
      }),
    enabled: Boolean(token),
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storageDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['storageStats'] });
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to delete document');
    },
  });

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !token) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      await api.uploadFile(token, selectedFile, uploadEntityType, uploadEntityId || undefined);
      queryClient.invalidateQueries({ queryKey: ['storageDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['storageStats'] });
      setIsUploadOpen(false);
      setSelectedFile(null);
      setUploadEntityId('');
    } catch (err: any) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopySuccessId(id);
    setTimeout(() => setCopySuccessId(null), 2000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getMimeIcon = (mime: string) => {
    if (mime.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-emerald-400" />;
    if (mime.includes('pdf')) return <FileText className="w-4 h-4 text-rose-400" />;
    if (mime.includes('csv') || mime.includes('spreadsheet') || mime.includes('excel')) {
      return <FileSpreadsheet className="w-4 h-4 text-amber-400" />;
    }
    return <File className="w-4 h-4 text-blue-400" />;
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <FolderArchive className="w-6 h-6 text-primary" />
              Documents & Storage Platform
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Centralized S3-compatible document storage, presigned upload pipeline & entity attachments
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              setUploadError(null);
              setIsUploadOpen(true);
            }}
            className="btn flex items-center gap-2 text-sm shadow-md"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Stored Files</p>
                <p className="text-xl font-bold text-foreground font-mono">{stats?.totalFiles ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Storage Used</p>
                <p className="text-xl font-bold text-emerald-400 font-mono">
                  {formatBytes(stats?.totalBytes ?? 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <FolderArchive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Storage Engine</p>
                <p className="text-sm font-bold text-amber-400 font-mono">
                  {stats?.activeStorageDriver || 'LOCAL_FILESYSTEM'}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Max Upload Cap</p>
                <p className="text-xl font-bold text-blue-400 font-mono">25 MB</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter by Entity:
          </span>
          {['ALL', 'PRODUCT', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'CUSTOMER', 'OTHER'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedEntityFilter(cat)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                selectedEntityFilter === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-muted-foreground hover:bg-muted/30'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Documents Table */}
        <div className="card border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">MIME Type</th>
                  <th className="py-3 px-4">Linked Entity</th>
                  <th className="py-3 px-4">Uploaded Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <TableSkeletonRows rows={5} cols={6} />
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No documents found in storage. Click "Upload Document" to add files.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded bg-muted/30 border border-border">
                            {getMimeIcon(doc.mimeType)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground truncate max-w-xs">{doc.filename}</p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-xs">
                              {doc.key}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-foreground font-semibold">
                        {formatBytes(doc.byteSize)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted/40 border border-border text-foreground">
                          {doc.mimeType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {doc.entityType ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {doc.entityType} {doc.entityId ? `#${doc.entityId.slice(-6)}` : ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-muted/30 rounded text-muted-foreground hover:text-foreground"
                            title="Download or View File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(doc.url, doc.id)}
                            className="p-1.5 hover:bg-muted/30 rounded text-muted-foreground hover:text-foreground"
                            title="Copy Direct Link"
                          >
                            {copySuccessId === doc.id ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete document "${doc.filename}" permanently?`)) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            className="p-1.5 hover:bg-rose-500/20 rounded text-rose-400"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upload Document Modal */}
        {isUploadOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="card max-w-md w-full p-6 border-border shadow-2xl bg-card">
              <div className="flex justify-between items-center pb-3 border-b border-border mb-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">Upload Document / Media</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="p-1 hover:bg-muted/30 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {uploadError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                  {uploadError}
                </div>
              )}

              <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
                {/* File picker */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Select File (Images, PDFs, CSV, Spreadsheets max 25MB)
                  </label>
                  <input
                    type="file"
                    required
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="input w-full file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary cursor-pointer text-xs"
                  />
                  {selectedFile && (
                    <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                      Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                    </p>
                  )}
                </div>

                {/* Entity link */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Associate with Business Entity
                  </label>
                  <select
                    value={uploadEntityType}
                    onChange={(e) => setUploadEntityType(e.target.value as DocumentEntityType)}
                    className="input w-full text-xs"
                  >
                    <option value="OTHER">General Document / Media</option>
                    <option value="PRODUCT">Product Catalog Media</option>
                    <option value="PURCHASE_ORDER">Purchase Order Attachment</option>
                    <option value="GOODS_RECEIPT">Goods Receipt Note (GRN)</option>
                    <option value="CUSTOMER">Customer Document / Tax Certificate</option>
                    <option value="SALE_RECEIPT">Sales Invoice / Receipt</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Entity Identifier (Optional ID)
                  </label>
                  <input
                    type="text"
                    value={uploadEntityId}
                    onChange={(e) => setUploadEntityId(e.target.value)}
                    placeholder="e.g. cuid_prod_123 or PO-0004"
                    className="input w-full text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border mt-5">
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedFile || isUploading}
                    className="btn px-4 py-1.5 text-xs font-bold"
                  >
                    {isUploading ? 'Uploading...' : 'Start Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </EnterpriseShell>
  );
}

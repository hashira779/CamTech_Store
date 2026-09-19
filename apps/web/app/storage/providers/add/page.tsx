'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { HardDrive, Cloud, ArrowLeft, Save } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AddProviderPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [type, setType] = useState('LOCAL_S3');
  const [isDefault, setIsDefault] = useState(false);
  const [bucket, setBucket] = useState('default');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  
  // Google Drive
  const [folderId, setFolderId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createStorageProvider(token!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storageProviders'] });
      navigate('/storage/providers');
    },
    onError: (err: any) => {
      alert(err instanceof ApiClientError ? err.message : 'Failed to create provider');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let configuration: any = {};
    let credentialsReference = null;
    
    if (type === 'LOCAL_S3') {
      configuration = { bucket, endpoint_url: endpointUrl, region, access_key: accessKey, secret_key: secretKey };
    } else if (type === 'GOOGLE_DRIVE') {
      configuration = { folder_id: folderId };
      credentialsReference = JSON.stringify({ access_token: accessToken, refresh_token: refreshToken });
    }
    
    createMutation.mutate({
      name,
      type,
      isDefault,
      configuration,
      credentialsReference
    });
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/storage/providers" className="p-2 hover:bg-muted/30 rounded-lg text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              Connect Storage Provider
            </h1>
          </div>
        </div>

        <div className="card p-6 border-border bg-card">
          <form onSubmit={handleSubmit} className="space-y-6 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Provider Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. MinIO Backup or Primary GDrive"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setType('LOCAL_S3')}
                    className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 border transition-colors ${
                      type === 'LOCAL_S3' ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-muted/10 border-border text-muted-foreground'
                    }`}
                  >
                    <HardDrive className="w-4 h-4" /> S3
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('GOOGLE_DRIVE')}
                    className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 border transition-colors ${
                      type === 'GOOGLE_DRIVE' ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' : 'bg-muted/10 border-border text-muted-foreground'
                    }`}
                  >
                    <Cloud className="w-4 h-4" /> GDrive
                  </button>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-border bg-muted/30 text-primary" 
              />
              <span className="text-xs font-semibold text-foreground">Set as default storage provider for new uploads</span>
            </label>

            <hr className="border-border" />

            {type === 'LOCAL_S3' && (
              <div className="space-y-4">
                <h3 className="font-bold text-foreground">S3 Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Bucket Name</label>
                    <input type="text" value={bucket} onChange={e => setBucket(e.target.value)} required className="input w-full" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Region</label>
                    <input type="text" value={region} onChange={e => setRegion(e.target.value)} required className="input w-full" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Endpoint URL (For LocalStack/MinIO)</label>
                  <input type="url" value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} placeholder="http://localhost:9000" className="input w-full" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Access Key</label>
                    <input type="password" value={accessKey} onChange={e => setAccessKey(e.target.value)} className="input w-full" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Secret Key</label>
                    <input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} className="input w-full" />
                  </div>
                </div>
              </div>
            )}

            {type === 'GOOGLE_DRIVE' && (
              <div className="space-y-4">
                <h3 className="font-bold text-foreground">Google Drive Configuration</h3>
                <p className="text-xs text-muted-foreground">For demo purposes, manually input your OAuth tokens. In production, this would use a secure OAuth flow.</p>
                
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Target Folder ID (Optional)</label>
                  <input type="text" value={folderId} onChange={e => setFolderId(e.target.value)} placeholder="e.g. 1a2b3c4d5e6f" className="input w-full" />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Access Token</label>
                  <textarea value={accessToken} onChange={e => setAccessToken(e.target.value)} required className="input w-full h-20 font-mono text-[10px]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Refresh Token</label>
                  <textarea value={refreshToken} onChange={e => setRefreshToken(e.target.value)} className="input w-full h-20 font-mono text-[10px]" />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button 
                type="submit" 
                disabled={createMutation.isPending}
                className="btn flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {createMutation.isPending ? 'Connecting...' : 'Connect Provider'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </EnterpriseShell>
  );
}

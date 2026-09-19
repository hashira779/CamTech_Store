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
  const [type, setType] = useState('CLOUDFLARE_R2');
  const [isDefault, setIsDefault] = useState(false);
  const [bucket, setBucket] = useState('default');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  
  // Google Drive
  const [folderId, setFolderId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');

  // Cloudflare R2
  const [r2AccountId, setR2AccountId] = useState('');
  const [r2Bucket, setR2Bucket] = useState('camtech-images');
  const [r2PublicDomain, setR2PublicDomain] = useState('https://images.camtech.cam');
  const [r2AccessKeyId, setR2AccessKeyId] = useState('');
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState('');

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
    let providerType = type;
    
    if (type === 'CLOUDFLARE_R2') {
      providerType = 'LOCAL_S3'; // Maps to native Postgres ENUM
      configuration = {
        provider_subtype: 'CLOUDFLARE_R2',
        account_id: r2AccountId.trim(),
        bucket: r2Bucket.trim(),
        public_domain: r2PublicDomain.trim(),
        endpoint_url: `https://${r2AccountId.trim()}.r2.cloudflarestorage.com`,
        region: 'auto'
      };
      credentialsReference = JSON.stringify({
        access_key_id: r2AccessKeyId.trim(),
        secret_access_key: r2SecretAccessKey.trim()
      });
    } else if (type === 'LOCAL_S3') {
      configuration = { bucket, endpoint_url: endpointUrl, region, access_key: accessKey, secret_key: secretKey };
    } else if (type === 'GOOGLE_DRIVE') {
      configuration = { folder_id: folderId.trim() };
      credentialsReference = JSON.stringify({ 
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        access_token: accessToken.trim(), 
        refresh_token: refreshToken.trim() 
      });
    }
    
    createMutation.mutate({
      name: name.trim() || (type === 'CLOUDFLARE_R2' ? 'Cloudflare R2 Storage' : type),
      type: providerType,
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
                    onClick={() => setType('CLOUDFLARE_R2')}
                    className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                      type === 'CLOUDFLARE_R2' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-muted/10 border-border text-muted-foreground'
                    }`}
                  >
                    <Cloud className="w-3.5 h-3.5" /> R2 CDN
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('GOOGLE_DRIVE')}
                    className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                      type === 'GOOGLE_DRIVE' ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' : 'bg-muted/10 border-border text-muted-foreground'
                    }`}
                  >
                    <Cloud className="w-3.5 h-3.5" /> GDrive
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('LOCAL_S3')}
                    className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                      type === 'LOCAL_S3' ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-muted/10 border-border text-muted-foreground'
                    }`}
                  >
                    <HardDrive className="w-3.5 h-3.5" /> S3
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

            {type === 'CLOUDFLARE_R2' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground">Cloudflare R2 Configuration</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">Production Image CDN</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Connect your Cloudflare R2 bucket. The sync worker will automatically optimize and push WebP variants directly to R2 and Cloudflare CDN.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Cloudflare Account ID</label>
                    <input
                      type="text"
                      required
                      value={r2AccountId}
                      onChange={e => setR2AccountId(e.target.value)}
                      placeholder="e.g. 7f8a9b2c3d4e..."
                      className="input w-full font-mono text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">Found in Cloudflare Dashboard &gt; R2 &gt; Account Details</span>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">R2 Bucket Name</label>
                    <input
                      type="text"
                      required
                      value={r2Bucket}
                      onChange={e => setR2Bucket(e.target.value)}
                      placeholder="e.g. camtech-images"
                      className="input w-full font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Public CDN Domain</label>
                  <input
                    type="url"
                    required
                    value={r2PublicDomain}
                    onChange={e => setR2PublicDomain(e.target.value)}
                    placeholder="https://images.camtech.cam"
                    className="input w-full font-mono text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">Custom domain attached to your R2 bucket (or public r2.dev URL)</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">R2 Access Key ID</label>
                    <input
                      type="password"
                      required
                      value={r2AccessKeyId}
                      onChange={e => setR2AccessKeyId(e.target.value)}
                      placeholder="Access Key ID from R2 API Token"
                      className="input w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">R2 Secret Access Key</label>
                    <input
                      type="password"
                      required
                      value={r2SecretAccessKey}
                      onChange={e => setR2SecretAccessKey(e.target.value)}
                      placeholder="Secret Access Key"
                      className="input w-full font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

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
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Client ID</label>
                    <input type="text" value={clientId} onChange={e => setClientId(e.target.value)} required className="input w-full font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Client Secret</label>
                    <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} required className="input w-full font-mono text-xs" />
                  </div>
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

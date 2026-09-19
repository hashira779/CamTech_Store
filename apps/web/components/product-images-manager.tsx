'use client';

import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiClient, ApiClientError } from '@/lib/api-client';
import { type ProductDto, type ProductImageDto } from '@mystore/contracts';
import { Button } from '@/components/ui/button';
import { Upload, X, Star, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ProductImagesManagerProps {
  token: string;
  product: ProductDto;
}

export function ProductImagesManager({ token, product }: ProductImagesManagerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const images = product.images || [];
  const primaryImage = images.find((img) => img.isPrimary) || images[0];
  const otherImages = images.filter((img) => img.id !== primaryImage?.id);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be less than 25MB');
      return;
    }

    try {
      setIsUploading(true);

      // 1. Get upload intent
      const intentRes = await apiClient.post<any>('/storage/upload-intent', {
        fileName: file.name,
        mimeType: file.type,
        byteSize: file.size,
        entityType: 'PRODUCT',
        entityId: product.id,
      }, { token });

      // 2. Upload file
      const uploadRes = await fetch(intentRes.uploadUrl, {
        method: intentRes.method,
        headers: intentRes.headers,
        body: file,
      });

      if (!uploadRes.ok) throw new Error('Upload to storage failed');

      // 3. Confirm upload
      await apiClient.post('/storage/confirm-upload', { objectId: intentRes.objectId }, { token });

      // 4. Link to Product
      await api.addProductImage(token, product.id, {
        storageObjectId: intentRes.objectId,
        isPrimary: images.length === 0, // First image is primary automatically
        altText: file.name
      });

      toast.success('Image uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      await api.setPrimaryProductImage(token, product.id, imageId);
      toast.success('Primary image updated');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      toast.error('Failed to set primary image');
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!window.confirm('Are you sure you want to remove this image?')) return;
    try {
      await api.deleteProductImage(token, product.id, imageId);
      toast.success('Image removed');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      toast.error('Failed to delete image');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Product Images
        </h4>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <span className="animate-pulse">Uploading...</span>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Image
              </>
            )}
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-center text-muted-foreground bg-muted/10">
          <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm font-medium">No images uploaded</p>
          <p className="text-xs">Click upload to add the first product image</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Primary Image Slot */}
          {primaryImage && (
            <div className="relative group rounded-lg overflow-hidden border border-border aspect-video bg-muted/30">
              <img
                src={`${apiClient.baseUrl}${primaryImage.url}?token=${token}&width=800&height=800`}
                alt={primaryImage.altText || 'Primary Product Image'}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1 shadow-sm font-medium">
                <Star className="w-3 h-3 fill-current" />
                Primary
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDelete(primaryImage.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Thumbnail Grid */}
          {otherImages.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {otherImages.map((img) => (
                <div key={img.id} className="relative group rounded-md overflow-hidden border border-border aspect-square bg-muted/20">
                  <img
                    src={`${apiClient.baseUrl}${img.url}?token=${token}&width=300&height=300`}
                    alt={img.altText || 'Product Image'}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <Button variant="secondary" size="sm" className="h-7 text-xs w-24" onClick={() => handleSetPrimary(img.id)}>
                      Make Primary
                    </Button>
                    <Button variant="destructive" size="sm" className="h-7 text-xs w-24" onClick={() => handleDelete(img.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

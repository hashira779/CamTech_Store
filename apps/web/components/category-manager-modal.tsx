'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CategoryDto,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@mystore/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, FolderTree, Check, X, Layers } from 'lucide-react';

export function CategoryManagerModal({
  token,
  isOpen,
  onClose,
  onChanged,
}: {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.listCategories(token),
    enabled: isOpen,
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setParentId('');
    setEditingId(null);
    setIsCreating(false);
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.createCategory(token, {
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: parentId || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      resetForm();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.updateCategory(token, id, {
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: parentId || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      resetForm();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`Are you sure you want to delete category "${catName}"?`)) return;
    setError(null);
    try {
      await api.deleteCategory(token, id);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (onChanged) onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete category');
    }
  };

  const startEdit = (cat: CategoryDto) => {
    setEditingId(cat.id);
    setIsCreating(false);
    setName(cat.name);
    setDescription(cat.description ?? '');
    setParentId(cat.parentId ?? '');
    setError(null);
  };

  // Build parent map
  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-primary" />
            Product Categories & Hierarchy
          </DialogTitle>
          <DialogDescription>
            Organize products into world-standard categories and sub-categories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
              {error}
            </div>
          )}

          {/* Action Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Configured Categories ({categories?.length ?? 0})
            </span>
            {!isCreating && !editingId && (
              <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add Category
              </Button>
            )}
          </div>

          {/* Create or Edit Form */}
          {(isCreating || editingId) && (
            <form
              onSubmit={isCreating ? handleCreate : (e) => { e.preventDefault(); if (editingId) handleUpdate(editingId); }}
              className="p-4 rounded-lg border border-border bg-muted/20 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {isCreating ? 'Create New Category' : 'Edit Category'}
                </h4>
                <Button variant="ghost" size="sm" onClick={resetForm} className="h-6 w-6 p-0">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Category Name *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Specialty Coffee"
                    className="input w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Parent Category (Optional)</label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="input w-full text-xs"
                  >
                    <option value="">(None - Top-level Root)</option>
                    {(categories ?? [])
                      .filter((c) => c.id !== editingId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">Description (Optional)</label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of items in this category"
                    className="input w-full text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? 'Saving…' : isCreating ? 'Create Category' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}

          {/* Categories List */}
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Loading categories...</div>
            ) : (categories?.length ?? 0) === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Layers className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-semibold text-foreground">No categories defined yet</p>
                <p className="text-xs text-muted-foreground">
                  Create your first product category to organize your catalog.
                </p>
              </div>
            ) : (
              (categories ?? []).map((cat) => {
                const parent = cat.parentId ? categoryMap.get(cat.parentId) : null;
                return (
                  <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{cat.name}</span>
                        {parent && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            ↳ Under: {parent.name}
                          </Badge>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(cat)}
                        className="h-7 w-7 p-0 hover:bg-muted"
                        title="Edit Category"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="h-7 w-7 p-0 hover:bg-rose-500/10 text-rose-400"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

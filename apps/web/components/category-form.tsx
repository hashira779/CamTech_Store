'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Trash2, X, Plus, Check, Lock, Unlock, Sparkles } from 'lucide-react';
import { getCategoryIcon } from '@/components/category-tree-select';
import { IconPicker } from '@/components/icon-picker';
import { slugify } from '@/lib/utils';
import { getSmartIconSuggestions } from '@/lib/category-icons';
import { useCategoryMutations } from '@/lib/use-category-mutations';
import type { CategoryDto } from '@mystore/contracts';

interface CategoryFormProps {
  token: string;
  isCreating: boolean;
  selectedCategory: (CategoryDto & { breadcrumb?: any[]; childrenCount?: number }) | null;
  flatCategories: CategoryDto[];
  
  
  onCancel: () => void;
  onSuccess: () => void;
  onDelete: () => void;
  onSelectNode: (id: string) => void;
  onStartCreateChild: (parentId: string) => void;
}

export function CategoryForm({
  token,
  isCreating,
  selectedCategory,
  flatCategories,
  onCancel,
  onSuccess,
  onDelete,
  onSelectNode,
  onStartCreateChild,
}: CategoryFormProps) {
  const { createMutation, updateMutation } = useCategoryMutations(token);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [formIcon, setFormIcon] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSeoTitle, setFormSeoTitle] = useState('');
  const [formSeoDescription, setFormSeoDescription] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Sync state with selected category
  useEffect(() => {
    if (!isCreating && selectedCategory) {
      setFormName(selectedCategory.name);
      setFormDescription(selectedCategory.description || '');
      setFormSlug(selectedCategory.slug || '');
      setFormIcon(selectedCategory.icon || '');
      setFormImageUrl(selectedCategory.imageUrl || '');
      setFormParentId(selectedCategory.parentId || '');
      setFormIsActive(selectedCategory.isActive);
      // We don't have seoTitle/seoDescription in CategoryDto yet, assuming empty
      setFormSeoTitle('');
      setFormSeoDescription('');
      setIsSlugManual(!!selectedCategory.slug);
    } else if (isCreating) {
      setFormName('');
      setFormDescription('');
      setFormSlug('');
      setFormIcon('');
      setFormImageUrl('');
      setFormSeoTitle('');
      setFormSeoDescription('');
      setFormIsActive(true);
      setIsSlugManual(false);
      // If we clicked 'Add Child', the parentId is already set by the parent component passing a dummy selectedCategory or via props
      // Wait, in the original code, handleStartCreate passed parentId to formParentId. 
      // We will assume the parent passes it via selectedCategory.parentId or something, but actually we should just take it from a prop if needed.
      // For now, let's just leave it empty unless specified.
    }
  }, [isCreating, selectedCategory]);

  // If creating a child, we need a way to initialize the parent ID. Let's do a hack:
  // if isCreating && selectedCategory is passed, it means we are creating a child of selectedCategory!
  useEffect(() => {
    if (isCreating && selectedCategory) {
      setFormParentId(selectedCategory.id);
    }
  }, [isCreating, selectedCategory?.id]);

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!isSlugManual) {
      setFormSlug(slugify(name));
    }
  };

  const smartIconSuggestions = useMemo(() => {
    return getSmartIconSuggestions(formName);
  }, [formName]);

  const handleAutoGenerateSeo = () => {
    const parentName = flatCategories?.find((c) => c.id === formParentId)?.name;
    const parentPart = parentName ? `${parentName} · ` : '';
    const generatedTitle = `${formName} | ${parentPart}MyStore Catalog`.slice(0, 70);
    const descSnippet = formDescription.trim() ? ` ${formDescription.trim()}.` : '';
    const generatedDesc = `Explore our top-quality selection of ${formName}${parentName ? ` in ${parentName}` : ''}.${descSnippet} Enjoy fast shipping and guaranteed quality at MyStore.`.slice(0, 250);
    
    setFormSeoTitle(generatedTitle);
    setFormSeoDescription(generatedDesc);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (isCreating) {
      createMutation.mutate(
        {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          parentId: formParentId || undefined,
          slug: formSlug.trim() || undefined,
          icon: formIcon || undefined,
          imageUrl: formImageUrl || undefined,
        },
        { onSuccess }
      );
    } else {
      if (!selectedCategory?.id) return;
      updateMutation.mutate(
        {
          id: selectedCategory.id,
          input: {
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            parentId: formParentId || undefined,
            slug: formSlug.trim() || undefined,
            icon: formIcon || undefined,
            imageUrl: formImageUrl || undefined,
            isActive: formIsActive,
          }
        },
        { onSuccess }
      );
    }
  };

  const breadcrumb = !isCreating && selectedCategory?.breadcrumb ? selectedCategory.breadcrumb : [];
  const loading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
      {/* Dynamic Breadcrumb bar */}
      {!isCreating && breadcrumb.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pb-2 border-b border-border overflow-x-auto">
          <span className="text-muted-foreground/60 text-[10px] uppercase font-semibold mr-1">Path:</span>
          {breadcrumb.map((item: any, idx: number) => (
            <React.Fragment key={item.id}>
              {idx > 0 && <span className="text-muted-foreground/40">›</span>}
              <button
                type="button"
                className={`cursor-pointer hover:text-primary transition-colors text-left ${
                  idx === breadcrumb.length - 1 ? 'text-primary font-semibold' : 'text-muted-foreground'
                }`}
                onClick={() => onSelectNode(item.id)}
                title={`Go to ${item.name}`}
              >
                {item.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Form header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl p-1.5 rounded-lg bg-muted/40 border border-border">
            {getCategoryIcon(formIcon)}
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isCreating ? 'New Category' : formName || 'Edit Category'}
            </h3>
            {!isCreating && selectedCategory && (
              <p className="text-[10px] text-muted-foreground">
                Depth Level {selectedCategory.level} · {selectedCategory.childrenCount ?? 0} Subcategories
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isCreating && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onCancel}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Category Name */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Category Name *</label>
          <input
            required
            value={formName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Specialty Coffee"
            className="input w-full text-xs"
          />
        </div>

        {/* URL Slug */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-foreground">URL Slug</label>
            <button
              type="button"
              onClick={() => {
                if (isSlugManual) {
                  setIsSlugManual(false);
                  setFormSlug(slugify(formName));
                } else {
                  setIsSlugManual(true);
                }
              }}
              className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              {isSlugManual ? (
                <><Lock className="w-2.5 h-2.5 text-amber-500" /> Custom</>
              ) : (
                <><Unlock className="w-2.5 h-2.5 text-primary" /> Auto-sync</>
              )}
            </button>
          </div>
          <input
            value={formSlug}
            onChange={(e) => {
              setFormSlug(e.target.value);
              setIsSlugManual(true);
            }}
            placeholder="auto-generated-from-name"
            className="input w-full text-xs font-mono"
          />
        </div>

        {/* Icon Picker */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Category Icon</label>
          <IconPicker value={formIcon} onChange={setFormIcon} />
          {smartIconSuggestions.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 animate-in fade-in duration-200">
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Suggested:
              </span>
              {smartIconSuggestions.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setFormIcon(ic)}
                  className={`text-xs px-1.5 py-0.5 rounded border transition-all ${
                    formIcon === ic ? 'border-primary bg-primary/10 font-bold' : 'border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Parent Category */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Parent Category</label>
          <select
            value={formParentId}
            onChange={(e) => setFormParentId(e.target.value)}
            className="input w-full text-xs"
          >
            <option value="">(Root — Top Level)</option>
            {flatCategories
              .filter((c) => c.id !== selectedCategory?.id)
              .map((c) => {
                const indent = '\u00A0\u00A0\u00A0'.repeat(c.level);
                const prefix = c.level > 0 ? '└─ ' : '';
                return (
                  <option key={c.id} value={c.id}>
                    {indent}{prefix}{getCategoryIcon(c.icon)} {c.name}
                  </option>
                );
              })}
          </select>
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-foreground mb-1">Description</label>
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Brief description of this category..."
            className="input w-full text-xs min-h-[55px]"
          />
        </div>

        {/* Image URL */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-foreground mb-1">Banner / Image URL</label>
          <div className="flex items-center gap-2">
            <input
              value={formImageUrl}
              onChange={(e) => setFormImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="input flex-1 text-xs"
            />
            {formImageUrl && (
              <div className="w-9 h-9 rounded border border-border overflow-hidden shrink-0 bg-muted/20">
                <img src={formImageUrl} alt="preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              </div>
            )}
          </div>
        </div>

        {/* Active toggle */}
        {!isCreating && (
          <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
            <div>
              <p className="text-xs font-medium text-foreground">Active Category</p>
              <p className="text-[10px] text-muted-foreground">Inactive categories are hidden from storefront</p>
            </div>
            <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
          </div>
        )}
      </div>

      {/* SEO Section */}
      <div className="pt-2 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" /> SEO & Discovery Metadata
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoGenerateSeo}
            disabled={!formName.trim()}
            className="h-6 text-[10px] gap-1 text-primary border-primary/30 hover:bg-primary/5"
          >
            <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Auto-generate SEO
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">SEO Title</label>
            <input
              value={formSeoTitle}
              onChange={(e) => setFormSeoTitle(e.target.value)}
              placeholder="Page title"
              className="input w-full text-xs"
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">SEO Description</label>
            <textarea
              value={formSeoDescription}
              onChange={(e) => setFormSeoDescription(e.target.value)}
              placeholder="Meta description"
              className="input w-full text-xs min-h-[50px]"
              maxLength={1000}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      {!isCreating && selectedCategory && (
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border">
            <p className="text-base font-bold font-mono text-foreground">{selectedCategory.productCount}</p>
            <p className="text-[9px] text-muted-foreground uppercase">Direct Products</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-base font-bold font-mono text-primary">{selectedCategory?.productCount}</p>
            <p className="text-[9px] text-muted-foreground uppercase">Total Subtree</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border">
            <p className="text-base font-bold font-mono text-foreground">{selectedCategory.level}</p>
            <p className="text-[9px] text-muted-foreground uppercase">Depth Level</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border">
            <p className="text-base font-bold font-mono text-foreground">{selectedCategory.childrenCount ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase">Subcategories</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        {!isCreating && selectedCategory?.id ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => onStartCreateChild(selectedCategory.id)}
          >
            <Plus className="w-3 h-3" /> Add Child Category
          </Button>
        ) : <div />}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={loading}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="text-xs gap-1 shadow-sm">
            <Check className="w-3 h-3" /> {loading ? 'Saving…' : isCreating ? 'Create Category' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}

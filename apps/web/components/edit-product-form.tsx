'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  updateProductSchema,
  CURRENCIES,
  UNITS,
  PRODUCT_TYPES,
  type ProductDto,
  type UpdateProductInput,
} from '@mystore/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export function EditProductForm({
  token,
  product,
  onUpdated,
  onCancel,
}: {
  token: string;
  product: ProductDto;
  onUpdated: () => void;
  onCancel?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.listCategories(token),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProductInput>({
    resolver: zodResolver(updateProductSchema),
    defaultValues: {
      name: product.name,
      type: product.type as any,
      description: product.description ?? '',
      categoryId: product.categoryId ?? '',
      isActive: product.isActive,
      variants: (product.variants || []).map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name ?? '',
        barcode: v.barcode ?? '',
        unit: v.unit,
        currency: v.currency,
        costPrice: v.costPrice,
        sellPrice: v.sellPrice,
        taxRatePct: v.taxRatePct,
        isActive: v.isActive,
      })),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setOk(null);
    try {
      await api.updateProduct(token, product.id, values);
      setOk('Product updated successfully!');
      onUpdated();
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : 'Failed to update product');
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* Master Information */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-1.5">
          Master Information
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Product Name" error={errors.name?.message}>
            <input className="input" {...register('name')} placeholder="Product name" />
          </Field>
          <Field label="Product Type" error={errors.type?.message}>
            <select className="input" {...register('type')}>
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select className="input" {...register('categoryId')}>
              <option value="">(No Category / General)</option>
              {(categories ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className="input"
              {...register('isActive', {
                setValueAs: (v) => v === true || v === 'true',
              })}
            >
              <option value="true">Active (Visible in POS & Storefront)</option>
              <option value="false">Inactive (Archived)</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description (Optional)" error={errors.description?.message}>
              <textarea
                className="input min-h-[70px]"
                {...register('description')}
                placeholder="Item details, specifications..."
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Variants Data */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-1.5">
          Variant Pricing & Attributes
        </h4>
        {(product.variants || []).map((variant, idx) => (
          <div key={variant.id} className="p-3 rounded-lg border border-border bg-muted/10 space-y-3">
            <input type="hidden" {...register(`variants.${idx}.id` as const)} value={variant.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="SKU" error={errors.variants?.[idx]?.sku?.message}>
                <input className="input font-mono" {...register(`variants.${idx}.sku` as const)} />
              </Field>
              <Field label="Variant Name (Optional)">
                <input className="input" {...register(`variants.${idx}.name` as const)} placeholder="Regular / Size M" />
              </Field>
              <Field label="Cost Price ($)" error={errors.variants?.[idx]?.costPrice?.message}>
                <input
                  className="input font-mono"
                  type="number"
                  step="0.01"
                  {...register(`variants.${idx}.costPrice` as const, { valueAsNumber: true })}
                />
              </Field>
              <Field label="Retail Price ($)" error={errors.variants?.[idx]?.sellPrice?.message}>
                <input
                  className="input font-mono font-bold"
                  type="number"
                  step="0.01"
                  {...register(`variants.${idx}.sellPrice` as const, { valueAsNumber: true })}
                />
              </Field>
              <Field label="Unit">
                <select className="input" {...register(`variants.${idx}.unit` as const)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <select className="input" {...register(`variants.${idx}.currency` as const)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tax Rate (%)">
                <input
                  className="input"
                  type="number"
                  step="1"
                  {...register(`variants.${idx}.taxRatePct` as const, { valueAsNumber: true })}
                />
              </Field>
              <Field label="Barcode (Optional)">
                <input className="input font-mono" {...register(`variants.${idx}.barcode` as const)} />
              </Field>
            </div>
          </div>
        ))}
      </div>

      {serverError && <p className="text-xs text-rose-500 font-medium">{serverError}</p>}
      {ok && <p className="text-xs text-emerald-500 font-medium">{ok}</p>}

      <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Saving Changes…' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </label>
  );
}

'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProductSchema,
  CURRENCIES,
  UNITS,
  PRODUCT_TYPES,
  type CreateProductInput,
} from '@mystore/contracts';
import { api, ApiClientError } from '@/lib/api-client';

export function CreateProductForm({
  token,
  onCreated,
}: {
  token: string;
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { 
      type: 'PHYSICAL',
      isActive: true,
      variants: [{ unit: 'piece', currency: 'USD', taxRatePct: 0, isActive: true }] 
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setOk(null);
    try {
      const created = await api.createProduct(token, values);
      setOk(`Created "${created.name}" with ${created.variants.length} variant(s)`);
      reset({ type: 'PHYSICAL', variants: [{ unit: 'piece', currency: 'USD', taxRatePct: 0 }] });
      onCreated();
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : 'Failed to create product');
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Master Information</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Master Product Name" error={errors.name?.message}>
            <input className="input" {...register('name')} placeholder="Mocha" />
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
          <div className="sm:col-span-2">
            <Field label="Description (Optional)" error={errors.description?.message}>
              <textarea className="input min-h-[80px]" {...register('description')} placeholder="Delicious mocha coffee..." />
            </Field>
          </div>
        </div>
      </div>

      <div className="space-y-4 mt-2">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Variant Data</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="SKU" error={errors.variants?.[0]?.sku?.message}>
            <input className="input" {...register('variants.0.sku')} placeholder="COF-MOC-REG" />
          </Field>
          <Field label="Variant Name (Optional)" error={errors.variants?.[0]?.name?.message}>
            <input className="input" {...register('variants.0.name')} placeholder="Regular / Hot" />
          </Field>
          <Field label="Unit">
            <select className="input" {...register('variants.0.unit')}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Currency">
            <select className="input" {...register('variants.0.currency')}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cost price" error={errors.variants?.[0]?.costPrice?.message}>
            <input
              className="input"
              type="number"
              step="0.01"
              {...register('variants.0.costPrice', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Sell price" error={errors.variants?.[0]?.sellPrice?.message}>
            <input
              className="input"
              type="number"
              step="0.01"
              {...register('variants.0.sellPrice', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Tax %" error={errors.variants?.[0]?.taxRatePct?.message}>
            <input
              className="input"
              type="number"
              step="1"
              {...register('variants.0.taxRatePct', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Barcode (Optional)">
            <input className="input" {...register('variants.0.barcode')} />
          </Field>
        </div>
      </div>

      {serverError && <p className="text-sm text-red-500">{serverError}</p>}
      {ok && <p className="text-sm text-green-600">{ok}</p>}

      <div className="flex justify-end pt-4 border-t border-border mt-4">
        <button className="btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Create Product'}
        </button>
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}

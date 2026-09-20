'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { PERMISSIONS, type ProductDto, type ProductVariantDto } from '@mystore/contracts';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EnterpriseShell } from '@/components/enterprise-shell';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter';
import { CreateProductForm } from '@/components/create-product-form';
import { EditProductForm } from '@/components/edit-product-form';
import { CategoryManagerModal } from '@/components/category-manager-modal';
import { ProductImagesManager } from '@/components/product-images-manager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/empty-state';
import {
  Plus,
  Package,
  MoreHorizontal,
  Download,
  Eye,
  Boxes,
  Tag,
  ArrowUpRight,
  Edit,
  Trash2,
  FolderTree,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FlattenedProductRow {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  type: string;
  categoryName: string | null;
  categoryId: string | null;
  variantName: string | null;
  unit: string;
  costPrice: number;
  price: number;
  marginPct: number;
  taxRatePct: number;
  isActive: boolean;
  rawProduct: ProductDto;
}

export function ProductsPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductDto | null>(null);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<FlattenedProductRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canWrite = hasPermission(PERMISSIONS.PRODUCTS_WRITE);

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.listProducts(token!, { limit: 200 }),
    enabled: Boolean(token),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.listCategories(token!),
    enabled: Boolean(token),
  });

  // Flatten products -> variants for enterprise table display
  const tableData: FlattenedProductRow[] = useMemo(() => {
    if (!data?.items) return [];
    return data.items.flatMap((product) =>
      (product.variants || []).map((v) => {
        const cost = v.costPrice ?? 0;
        const price = v.sellPrice ?? 0;
        const marginPct = v.marginPct ?? (price > 0 ? ((price - cost) / price) * 100 : 0);

        return {
          productId: product.id,
          variantId: v.id,
          sku: v.sku,
          name: product.name,
          type: product.type,
          categoryName: product.categoryName || null,
          categoryId: product.categoryId || null,
          variantName: v.name,
          unit: v.unit,
          costPrice: cost,
          price: price,
          marginPct: Math.round(marginPct * 10) / 10,
          taxRatePct: v.taxRatePct ?? 0,
          isActive: v.isActive && product.isActive,
          rawProduct: product,
        };
      })
    );
  }, [data]);

  const categoryFilterOptions = useMemo(() => {
    if (!categoriesData) return [];
    return categoriesData.map((c) => ({
      label: c.name,
      value: c.name,
    }));
  }, [categoriesData]);

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteProduct(token!, deletingProduct.id);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (selectedRow?.productId === deletingProduct.id) {
        setSelectedRow(null);
      }
      setDeletingProduct(null);
      if (res.archived) {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<FlattenedProductRow>[] = useMemo(
    () => [
      {
        id: 'image',
        header: 'Image',
        cell: ({ row }) => {
          const raw = row.original.rawProduct;
          const rawThumbUrl = raw.thumbnailUrl || raw.images?.find((i: any) => i.isPrimary)?.thumbnailUrl || raw.images?.[0]?.thumbnailUrl;
          const rawImgUrl = raw.imageUrl || raw.images?.find((i: any) => i.isPrimary)?.url || raw.images?.[0]?.url;
          const imgUrl = rawThumbUrl || (rawImgUrl ? `${rawImgUrl}${rawImgUrl.includes('?') ? '&' : '?'}thumb=1` : null);
          return (
            <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt={raw.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center ${imgUrl ? 'hidden' : 'flex'}`}>
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'sku',
        header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border text-foreground">
            {row.getValue('sku')}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Product Name" />,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div>
              <div className="font-medium text-foreground flex items-center gap-2">
                <span>{item.name}</span>
                {item.variantName && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                    {item.variantName}
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">{item.unit}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'categoryName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
        cell: ({ row }) => {
          const cat = row.getValue('categoryName') as string | null;
          return cat ? (
            <Badge variant="outline" className="text-[10px] font-medium border-primary/30 text-primary bg-primary/5">
              {cat}
            </Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground italic">Uncategorized</span>
          );
        },
        filterFn: (row, id, value) => {
          const val = row.getValue(id) as string | null;
          return value.includes(val || 'Uncategorized');
        },
      },
      {
        accessorKey: 'type',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => {
          const type = row.getValue('type') as string;
          return (
            <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wider">
              {type}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: 'costPrice',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cost Price" />,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground text-xs">
            ${(row.getValue('costPrice') as number).toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: 'price',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Retail Price" />,
        cell: ({ row }) => (
          <span className="font-mono font-bold text-foreground text-xs">
            ${(row.getValue('price') as number).toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: 'marginPct',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Margin" />,
        cell: ({ row }) => {
          const margin = row.getValue('marginPct') as number;
          const isHigh = margin >= 30;
          const isMid = margin >= 15 && margin < 30;
          return (
            <Badge
              variant={isHigh ? 'success' : isMid ? 'default' : 'warning'}
              className="text-[11px] font-mono px-2 py-0.5"
            >
              {margin}%
            </Badge>
          );
        },
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const active = row.getValue('isActive') as boolean;
          return (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
              />
              <span className={active ? 'text-foreground' : 'text-muted-foreground'}>
                {active ? 'Active' : 'Inactive'}
              </span>
            </span>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSelectedRow(item)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {canWrite && (
                  <DropdownMenuItem onClick={() => setEditingProduct(item.rawProduct)}>
                    <Edit className="mr-2 h-4 w-4 text-primary" />
                    Edit Product Info
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate('/inventory')}>
                  <Boxes className="mr-2 h-4 w-4" />
                  Adjust Stock
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/pricing')}>
                  <Tag className="mr-2 h-4 w-4" />
                  Edit Pricing Matrix
                </DropdownMenuItem>
                {canWrite && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeletingProduct(item.rawProduct)}
                      className="text-rose-500 focus:text-rose-400"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Product
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [navigate, canWrite]
  );

  const exportCsv = () => {
    if (!tableData.length) return;
    const headers = ['SKU', 'Name', 'Category', 'Type', 'Variant', 'Unit', 'Cost Price', 'Retail Price', 'Margin %', 'Status'];
    const rows = tableData.map((r) => [
      r.sku,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${(r.categoryName || 'Uncategorized').replace(/"/g, '""')}"`,
      r.type,
      `"${(r.variantName || '').replace(/"/g, '""')}"`,
      r.unit,
      r.costPrice,
      r.price,
      r.marginPct,
      r.isActive ? 'ACTIVE' : 'INACTIVE',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mystore_products_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!token) return null;

  return (
    <EnterpriseShell>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Master Data & Products"
          description="Enterprise product catalog, variants, categories, multi-unit measures, and gross margin controls."
          badge={
            <Badge variant="secondary" className="font-mono text-xs">
              {tableData.length} Variants
            </Badge>
          }
        >
          <Button variant="outline" size="sm" onClick={() => setIsCategoriesOpen(true)} className="gap-2">
            <FolderTree className="h-4 w-4 text-primary" />
            Manage Categories
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              New Product
            </Button>
          )}
        </PageHeader>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          onRowClick={(row) => setSelectedRow(row)}
          toolbar={(table) => (
            <DataTableToolbar
              table={table}
              searchKey="name"
              searchPlaceholder="Filter by product name..."
            >
              {table.getColumn('categoryName') && categoryFilterOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={table.getColumn('categoryName')}
                  title="Category"
                  options={categoryFilterOptions}
                />
              )}
              {table.getColumn('type') && (
                <DataTableFacetedFilter
                  column={table.getColumn('type')}
                  title="Product Type"
                  options={[
                    { label: 'Physical Goods', value: 'PHYSICAL' },
                    { label: 'Service / Labor', value: 'SERVICE' },
                    { label: 'Combo / Bundle', value: 'COMBO' },
                  ]}
                />
              )}
            </DataTableToolbar>
          )}
          emptyState={
            <EmptyState
              icon={Package}
              title="No products cataloged"
              description="Start building your enterprise catalog by adding your first product or variant."
              actionLabel={canWrite ? 'Create Product' : undefined}
              onAction={() => setIsCreateOpen(true)}
            />
          }
        />

        {/* Create Product Slide-over Drawer */}
        <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add New Product</SheetTitle>
              <SheetDescription>
                Define master item data, category, units of measurement, cost prices, and variants.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              <CreateProductForm
                token={token}
                onCreated={() => {
                  setIsCreateOpen(false);
                  queryClient.invalidateQueries({ queryKey: ['products'] });
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Edit Product Slide-over Drawer */}
        <Sheet open={Boolean(editingProduct)} onOpenChange={(open) => !open && setEditingProduct(null)}>
          <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Edit Product: {editingProduct?.name}</SheetTitle>
              <SheetDescription>
                Update master product info, category, description, and variant pricing.
              </SheetDescription>
            </SheetHeader>
            {editingProduct && (
              <div className="py-4">
                <EditProductForm
                  token={token}
                  product={editingProduct}
                  onUpdated={() => {
                    setEditingProduct(null);
                    queryClient.invalidateQueries({ queryKey: ['products'] });
                  }}
                  onCancel={() => setEditingProduct(null)}
                />
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Product Details Drawer */}
        <Sheet open={Boolean(selectedRow)} onOpenChange={(open) => !open && setSelectedRow(null)}>
          <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Product Details</SheetTitle>
              <SheetDescription>Variant breakdown and pricing analysis</SheetDescription>
            </SheetHeader>
            {selectedRow && (
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{selectedRow.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground font-mono font-semibold">
                        SKU: {selectedRow.sku}
                      </span>
                      {selectedRow.categoryName && (
                        <Badge variant="outline" className="text-[10px] text-primary">
                          {selectedRow.categoryName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge variant={selectedRow.isActive ? 'success' : 'secondary'}>
                    {selectedRow.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Retail Price</p>
                    <p className="text-xl font-bold font-mono text-foreground mt-1">
                      ${selectedRow.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Cost Price</p>
                    <p className="text-xl font-bold font-mono text-muted-foreground mt-1">
                      ${selectedRow.costPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Gross Profit Margin</p>
                    <p className="text-xl font-bold font-mono text-emerald-500 mt-1">
                      {selectedRow.marginPct}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Tax Rate</p>
                    <p className="text-xl font-bold font-mono text-foreground mt-1">
                      {selectedRow.taxRatePct}%
                    </p>
                  </div>
                </div>

                {/* Actions inside Details */}
                {canWrite && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 flex-1"
                      onClick={() => {
                        const raw = selectedRow.rawProduct;
                        setSelectedRow(null);
                        setEditingProduct(raw);
                      }}
                    >
                      <Edit className="w-3.5 h-3.5 text-primary" />
                      Edit Product Info
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400"
                      onClick={() => {
                        const raw = selectedRow.rawProduct;
                        setDeletingProduct(raw);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </Button>
                  </div>
                )}

                {/* Product Images Manager */}
                <div className="pt-4 border-t border-border">
                  <ProductImagesManager token={token} product={selectedRow.rawProduct} />
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Navigation
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="justify-between"
                      onClick={() => navigate('/inventory')}
                    >
                      <span>Check Stock in Inventory Ledger</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-between"
                      onClick={() => navigate('/pricing')}
                    >
                      <span>Configure Customer Tier Pricing</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Delete Product Confirmation Dialog */}
        <Dialog open={Boolean(deletingProduct)} onOpenChange={(open) => !open && setDeletingProduct(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-500">
                <Trash2 className="w-5 h-5" />
                Delete Product
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete product <strong>"{deletingProduct?.name}"</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 text-xs text-muted-foreground space-y-2">
              <p>
                If this product has historical sales, purchase orders, or stock ledger records, it will be automatically <strong>archived (deactivated)</strong> to preserve legal and accounting audit trails.
              </p>
              <p>
                If it has no transaction history, it will be permanently deleted from the database.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setDeletingProduct(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                className="gap-1.5"
              >
                {isDeleting ? 'Deleting…' : 'Confirm Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Manager Modal */}
        <CategoryManagerModal
          token={token}
          isOpen={isCategoriesOpen}
          onClose={() => setIsCategoriesOpen(false)}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
          }}
        />
      </div>
    </EnterpriseShell>
  );
}

export default ProductsPage;


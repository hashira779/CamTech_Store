import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';
import type { CreateCategoryInput, UpdateCategoryInput } from '@mystore/contracts';

export function useCategoryMutations(token: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['categories-tree'] });
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateCategoryInput) => api.createCategory(token, input),
    onSuccess: () => {
      toast.success('Category created successfully');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to create category');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) => api.updateCategory(token, id, input),
    onSuccess: () => {
      toast.success('Category updated successfully');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to update category');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCategory(token, id),
    onSuccess: () => {
      toast.success('Category deleted successfully');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to delete category');
    },
  });

  const updateOrdersMutation = useMutation({
    mutationFn: (updates: { id: string; sortOrder: number }[]) => api.reorderCategories(token, updates),
    onSuccess: () => invalidate(),
    onError: (err: any) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to reorder categories');
    },
  });

  return { createMutation, updateMutation, deleteMutation, updateOrdersMutation };
}

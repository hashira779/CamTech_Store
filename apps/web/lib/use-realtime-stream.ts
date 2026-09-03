import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from './auth-store';

/**
 * 2026-2030 Standard Real-time Event Streaming Client Hook (SSE).
 * Automatically subscribes to live enterprise events (sales, deliveries, approvals)
 * and dispatches UI notifications and query cache invalidations.
 */
export function useRealtimeStream() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token || !user) return;

    const BASE_URL =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
      'http://localhost:4000';

    // SSE connection with Bearer token passed via query param or header
    // In browsers standard EventSource doesn't support headers, so we pass token in URL
    const streamUrl = `${BASE_URL}/api/v1/events/stream?token=${encodeURIComponent(token)}`;

    // Custom or native EventSource fallback
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const type = payload.event;
          const data = payload.data;

          if (type === 'HEARTBEAT' || type === 'STREAM_CONNECTED') {
            return;
          }

          // Handle Domain Events in Real-Time
          if (type === 'SALE_COMPLETED') {
            toast.success(`💰 New Sale #${data.saleNumber || 'ORD'}`, {
              description: `Total: $${Number(data.totalAmount || 0).toFixed(2)}`,
            });
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['reports'] });
          } else if (type === 'DELIVERY_DISPATCHED') {
            toast.info(`🚚 Courier Dispatched (${data.trackingNumber})`, {
              description: `Order assigned to courier for delivery.`,
            });
            queryClient.invalidateQueries({ queryKey: ['delivery'] });
          } else if (type === 'APPROVAL_REQUIRED') {
            toast.warning(`✍️ Approval Request Pending`, {
              description: data.title || 'New approval requires review.',
            });
            queryClient.invalidateQueries({ queryKey: ['approvals'] });
          } else if (type === 'LOW_STOCK_ALERT') {
            toast.error(`⚠️ Low Stock Alert: ${data.variantName || 'Item'}`, {
              description: `Remaining: ${data.stock} units (Threshold: ${data.threshold})`,
            });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
          }
        } catch {
          // Non-JSON frame (e.g. heartbeat)
        }
      };

      eventSource.onerror = () => {
        // SSE handles reconnection automatically
      };
    } catch {
      // Graceful fallback if SSE is blocked by proxy
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [token, user, queryClient]);
}

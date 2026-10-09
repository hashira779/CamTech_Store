import { useState, useCallback } from 'react';
import type { TelegramBotTestResult } from '@mystore/contracts';

/**
 * Reusable hook for testing a Telegram bot token against the Telegram getMe API.
 * Eliminates duplicated token verification logic across Add/Edit bot modals.
 */
export function useTelegramTokenTest() {
  const [testResult, setTestResult] = useState<TelegramBotTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const testToken = useCallback(async (token: string) => {
    if (!token.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          success: true,
          status: 'OK',
          botName: data.result.first_name,
          botUsername: data.result.username,
          canJoinGroups: data.result.can_join_groups !== false,
          canReadAllGroupMessages: data.result.can_read_all_group_messages !== false,
        });
      } else {
        setTestResult({
          success: false,
          status: 'ERROR',
          botName: 'Failed: ' + data.description,
        });
      }
    } catch {
      setTestResult({
        success: false,
        status: 'ERROR',
        botName: 'Network Error',
      });
    } finally {
      setIsTesting(false);
    }
  }, []);

  const resetResult = useCallback(() => setTestResult(null), []);

  return { testResult, isTesting, testToken, resetResult };
}

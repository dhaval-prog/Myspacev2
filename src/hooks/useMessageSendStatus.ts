import { useEffect, useState } from 'react';
import type { SendStatus } from '../components/chat/sendStatus';

interface SendStatusMessage {
  id: string;
  senderId: string;
  createdAt: string;
}

/**
 * Arms a client-side-only Thrown -> Landed -> Read status progression for a message the viewer
 * just sent — never for history loaded on open (the recency check keeps old messages a static
 * "Read" via the fallback below, instead of replaying the animation every time the thread opens).
 * Deliberately not persisted anywhere: this app has no message-status schema, and adding one is a
 * bigger decision than any single screen's scope.
 */
export function useMessageSendStatus(messages: SendStatusMessage[], myUserId: string | undefined, reduceMotion: boolean) {
  const [statusByMsgId, setStatusByMsgId] = useState<Record<string, SendStatus>>({});

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.senderId !== myUserId || last.id in statusByMsgId) return;
    if (Date.now() - new Date(last.createdAt).getTime() > 5000) return;
    setStatusByMsgId((m) => ({ ...m, [last.id]: 'thrown' }));
    const landedMs = reduceMotion ? 300 : 1300;
    const readMs = reduceMotion ? 600 : 2300;
    const t1 = setTimeout(() => setStatusByMsgId((m) => ({ ...m, [last.id]: 'landed' })), landedMs);
    const t2 = setTimeout(() => setStatusByMsgId((m) => ({ ...m, [last.id]: 'read' })), readMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const statusFor = (messageId: string, senderId: string): SendStatus | null => (senderId === myUserId ? (statusByMsgId[messageId] ?? 'read') : null);

  return { statusFor };
}

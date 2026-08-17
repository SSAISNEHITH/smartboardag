import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_BASE } from '../config/api';

export interface LiveMessage {
  type: string;
  boardId?: string;
  count?: number;
  stroke?: any;
  point?: { x: number; y: number };
  lineNum?: number;
  textData?: any;
  diagrams?: any[];
  fileEmbeds?: any[];
  revealedStep?: number;
  totalRecordedSteps?: number;
  data?: any;
  senderId?: string;
}

export const useBoardSync = (
  boardId: string | undefined,
  onMessageReceived?: (msg: LiveMessage) => void
) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const myClientId = useRef<string>(`client_${Math.random().toString(36).substring(2, 9)}`);

  const currentBoardId = boardId || 'demo';

  const sendMessage = useCallback((payload: Partial<LiveMessage> & { type: string }) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const msg: LiveMessage = {
        boardId: currentBoardId,
        senderId: myClientId.current,
        ...payload
      };
      try {
        socketRef.current.send(JSON.stringify(msg));
      } catch (err) {
        console.warn('Failed to send WS message:', err);
      }
    }
  }, [currentBoardId]);

  useEffect(() => {
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      
      const wsUrl = `${WS_BASE}/ws/board`;
      console.log('Connecting to WebSocket:', wsUrl);

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
          console.log('WebSocket connected to board room:', currentBoardId);
          setIsConnected(true);
          ws.send(JSON.stringify({
            type: 'JOIN',
            boardId: currentBoardId,
            senderId: myClientId.current
          }));
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          try {
            const data: LiveMessage = JSON.parse(event.data);
            
            if (data.senderId && data.senderId === myClientId.current) {
              return;
            }

            if (data.type === 'PEER_COUNT' && typeof data.count === 'number') {
              setPeerCount(data.count);
            }

            if (onMessageReceived) {
              onMessageReceived(data);
            }
          } catch (err) {
            console.error('Error parsing WS message:', err);
          }
        };

        ws.onclose = () => {
          if (unmounted) return;
          console.log('WebSocket closed, reconnecting in 2s...');
          setIsConnected(false);
          reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
        };

        ws.onerror = (err) => {
          console.warn('WebSocket error:', err);
          ws.close();
        };
      } catch (e) {
        console.warn('WebSocket connection attempt failed:', e);
        reconnectTimeoutRef.current = window.setTimeout(connect, 2500);
      }
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [currentBoardId, onMessageReceived]);

  return {
    isConnected,
    peerCount,
    sendMessage
  };
};

export default useBoardSync;

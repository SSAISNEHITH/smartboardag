package com.thrisual.backend.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class BoardWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Map of boardId -> Set of active WebSocketSessions
    private final Map<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();
    
    // Map of session -> boardId for quick reverse lookup on disconnect
    private final Map<WebSocketSession, String> sessionBoardMap = new ConcurrentHashMap<>();

    // In-memory cache of latest board content for instant sync when new client connects
    private final Map<String, String> boardStateCache = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // Connected, waiting for JOIN message with boardId
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            String payload = message.getPayload();
            JsonNode root = objectMapper.readTree(payload);
            String type = root.path("type").asText();
            String boardId = root.path("boardId").asText("demo");

            if ("JOIN".equals(type)) {
                // Register session in room
                roomSessions.computeIfAbsent(boardId, k -> new CopyOnWriteArraySet<>()).add(session);
                sessionBoardMap.put(session, boardId);

                // Broadcast updated peer count to room
                broadcastPeerCount(boardId);

                // Send latest cached board state to the new joiner if available
                String cached = boardStateCache.get(boardId);
                if (cached != null) {
                    Map<String, Object> syncMsg = new HashMap<>();
                    syncMsg.put("type", "BOARD_SYNC");
                    syncMsg.put("boardId", boardId);
                    syncMsg.put("data", objectMapper.readTree(cached));
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(syncMsg)));
                }
            } else if ("BOARD_SYNC".equals(type) || "FULL_STATE".equals(type)) {
                // Update in-memory cache
                JsonNode data = root.path("data");
                if (!data.isMissingNode()) {
                    boardStateCache.put(boardId, data.toString());
                }
                // Broadcast to other sessions in room
                broadcastToRoom(boardId, session, payload);
            } else {
                // Broadcast live events (STROKE_START, STROKE_DRAW, STROKE_END, TEXT_CHANGE, DIAGRAM_UPDATE, FILES_UPDATE, REVEAL_UPDATE, CLEAR)
                broadcastToRoom(boardId, session, payload);
            }
        } catch (Exception e) {
            System.err.println("Error handling WebSocket message: " + e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String boardId = sessionBoardMap.remove(session);
        if (boardId != null) {
            Set<WebSocketSession> sessions = roomSessions.get(boardId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    roomSessions.remove(boardId);
                } else {
                    broadcastPeerCount(boardId);
                }
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        try {
            session.close(CloseStatus.SERVER_ERROR);
        } catch (IOException ignored) {}
    }

    private void broadcastToRoom(String boardId, WebSocketSession sender, String payload) {
        Set<WebSocketSession> sessions = roomSessions.get(boardId);
        if (sessions == null || sessions.isEmpty()) return;

        TextMessage message = new TextMessage(payload);
        for (WebSocketSession s : sessions) {
            if (s.isOpen() && !s.getId().equals(sender.getId())) {
                try {
                    synchronized (s) {
                        s.sendMessage(message);
                    }
                } catch (IOException e) {
                    System.err.println("Failed to send WS message to session " + s.getId() + ": " + e.getMessage());
                }
            }
        }
    }

    private void broadcastPeerCount(String boardId) {
        Set<WebSocketSession> sessions = roomSessions.get(boardId);
        int count = (sessions != null) ? sessions.size() : 0;

        try {
            Map<String, Object> msg = new HashMap<>();
            msg.put("type", "PEER_COUNT");
            msg.put("boardId", boardId);
            msg.put("count", count);
            String json = objectMapper.writeValueAsString(msg);
            TextMessage textMsg = new TextMessage(json);

            if (sessions != null) {
                for (WebSocketSession s : sessions) {
                    if (s.isOpen()) {
                        synchronized (s) {
                            s.sendMessage(textMsg);
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error broadcasting peer count: " + e.getMessage());
        }
    }
}

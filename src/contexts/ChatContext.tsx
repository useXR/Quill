'use client';

import { createContext, useContext, useReducer, ReactNode } from 'react';

/**
 * Tool activity represents a single tool call or result during chat.
 */
export interface ToolActivity {
  toolId: string;
  toolName: string;
  type: 'call' | 'result';
  input?: unknown;
  success?: boolean;
  message?: string;
  timestamp: Date;
}

/**
 * Stats from CLI execution.
 */
export interface ChatStats {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  status: 'sending' | 'sent' | 'streaming' | 'error';
  mode?: 'discussion' | 'global_edit' | 'research';
  /** Claude's reasoning/thinking process (from extended thinking) */
  thinking?: string;
  /** Tool calls and results during this message */
  toolActivity?: ToolActivity[];
  /** Completion stats (tokens, duration) */
  stats?: ChatStats;
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  documentId: string | null;
  projectId: string | null;
  streamingMessageId: string | null;
  error: string | null;
}

type ChatAction =
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; id: string; content: string }
  | { type: 'SET_MESSAGE_STATUS'; id: string; status: ChatMessage['status'] }
  | { type: 'APPEND_TO_STREAMING'; id: string; chunk: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'OPEN_SIDEBAR' }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'SET_DOCUMENT'; documentId: string; projectId: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'LOAD_MESSAGES'; messages: ChatMessage[] }
  | { type: 'SET_THINKING'; id: string; thinking: string }
  | { type: 'ADD_TOOL_ACTIVITY'; id: string; activity: ToolActivity }
  | { type: 'SET_STATS'; id: string; stats: ChatStats };

const initialState: ChatState = {
  messages: [],
  isOpen: false,
  isLoading: false,
  documentId: null,
  projectId: null,
  streamingMessageId: null,
  error: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR':
      return { ...state, isOpen: !state.isOpen };
    case 'OPEN_SIDEBAR':
      return { ...state, isOpen: true };
    case 'CLOSE_SIDEBAR':
      return { ...state, isOpen: false };
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
        streamingMessageId: action.message.status === 'streaming' ? action.message.id : state.streamingMessageId,
      };
    case 'APPEND_TO_STREAMING':
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, content: m.content + action.chunk } : m)),
      };
    case 'SET_MESSAGE_STATUS':
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, status: action.status } : m)),
        streamingMessageId:
          action.status !== 'streaming' && state.streamingMessageId === action.id ? null : state.streamingMessageId,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_DOCUMENT':
      return {
        ...state,
        documentId: action.documentId,
        projectId: action.projectId,
        messages: [],
      };
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'LOAD_MESSAGES':
      return { ...state, messages: action.messages };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, content: action.content } : m)),
      };
    case 'SET_THINKING':
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, thinking: action.thinking } : m)),
      };
    case 'ADD_TOOL_ACTIVITY':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, toolActivity: [...(m.toolActivity || []), action.activity] } : m
        ),
      };
    case 'SET_STATS':
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, stats: action.stats } : m)),
      };
    default:
      return state;
  }
}

const ChatContext = createContext<{
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
} | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  return <ChatContext value={{ state, dispatch }}>{children}</ChatContext>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
}

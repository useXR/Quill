'use client';

import { createContext, useContext, useReducer, ReactNode } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  status: 'sending' | 'sent' | 'streaming' | 'error';
  mode?: 'discussion' | 'global_edit' | 'research';
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
  | { type: 'LOAD_MESSAGES'; messages: ChatMessage[] };

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

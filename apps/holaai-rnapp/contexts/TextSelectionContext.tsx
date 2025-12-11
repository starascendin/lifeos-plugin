import React, { createContext, useContext, useState, useCallback } from 'react';

export interface TextSelectionState {
  selectedText: string;
  sourceLanguage: 'es' | 'en' | 'auto';
}

interface TextSelectionContextValue {
  selection: TextSelectionState | null;
  setSelection: (selection: TextSelectionState | null) => void;
  clearSelection: () => void;
  showTranslationModal: boolean;
  setShowTranslationModal: (show: boolean) => void;
}

const TextSelectionContext = createContext<TextSelectionContextValue | null>(null);

export function TextSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelectionState] = useState<TextSelectionState | null>(null);
  const [showTranslationModal, setShowTranslationModal] = useState(false);

  const setSelection = useCallback((newSelection: TextSelectionState | null) => {
    setSelectionState(newSelection);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionState(null);
    setShowTranslationModal(false);
  }, []);

  return (
    <TextSelectionContext.Provider
      value={{
        selection,
        setSelection,
        clearSelection,
        showTranslationModal,
        setShowTranslationModal,
      }}
    >
      {children}
    </TextSelectionContext.Provider>
  );
}

export function useTextSelectionContext() {
  const context = useContext(TextSelectionContext);
  if (!context) {
    throw new Error('useTextSelectionContext must be used within TextSelectionProvider');
  }
  return context;
}

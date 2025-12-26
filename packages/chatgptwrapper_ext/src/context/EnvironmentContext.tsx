import { createContext, useContext, type ReactNode } from 'react';

export type Environment = 'extension' | 'server';

const EnvironmentContext = createContext<Environment>('extension');

interface EnvironmentProviderProps {
  mode: Environment;
  children: ReactNode;
}

export function EnvironmentProvider({ mode, children }: EnvironmentProviderProps) {
  return (
    <EnvironmentContext.Provider value={mode}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment(): Environment {
  return useContext(EnvironmentContext);
}

export function useIsServerMode(): boolean {
  return useContext(EnvironmentContext) === 'server';
}

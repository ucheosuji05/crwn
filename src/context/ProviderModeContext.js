import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ProviderModeContext = createContext({ isProviderMode: true, toggleMode: () => {} });

export function ProviderModeProvider({ children }) {
  const [isProviderMode, setIsProviderMode] = useState(true); // default to provider for stylists

  useEffect(() => {
    AsyncStorage.getItem('crwn_provider_mode').then(val => {
      if (val !== null) setIsProviderMode(val === 'true');
    });
  }, []);

  const toggleMode = async () => {
    const next = !isProviderMode;
    setIsProviderMode(next);
    await AsyncStorage.setItem('crwn_provider_mode', String(next));
  };

  return (
    <ProviderModeContext.Provider value={{ isProviderMode, toggleMode }}>
      {children}
    </ProviderModeContext.Provider>
  );
}

export const useProviderMode = () => useContext(ProviderModeContext);

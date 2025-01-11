// Helper function with detailed logging
export const getEnvVar = (key: string, defaultValue: string) => {
  console.log('🔍 LOOK HERE - Environment Check:', {
    key,
    importMetaValue: import.meta.env[key],
    // @ts-ignore
    processValue: typeof process !== 'undefined' ? process.env[key] : 'process not defined',
    defaultValue
  });

  if (import.meta.env[key]) {
    return import.meta.env[key];
  }
  // @ts-ignore - process.env might exist in some environments
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    // @ts-ignore
    return process.env[key];
  }
  return defaultValue;
};

export const API_URL = getEnvVar('VITE_API_URL', 'http://localhost:3000/api');
export const WS_URL = getEnvVar('VITE_WS_URL', 'ws://localhost:3001'); 
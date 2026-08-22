// Global Logger and Console Catcher for mobile diagnostics
import { useState, useEffect } from 'react';

type LogListener = (logs: string[]) => void;

let logsList: string[] = [];
const listeners = new Set<LogListener>();

const maxLogs = 500;

export const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  logsList.push(logEntry);
  if (logsList.length > maxLogs) {
    logsList.shift();
  }
  listeners.forEach(listener => listener([...logsList]));
};

export const clearLogs = () => {
  logsList = [];
  listeners.forEach(listener => listener([]));
};

export const getLogs = () => [...logsList];

// Hook to subscribe to logs in components
export const useLogs = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    setLogs([...logsList]);
    const listener: LogListener = (newLogs) => {
      setLogs(newLogs);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { logs, clearLogs };
};

// Intercept original console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args: any[]) => {
  originalLog(...args);
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  addLog(`[INFO] ${msg}`);
};

console.warn = (...args: any[]) => {
  originalWarn(...args);
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  addLog(`[WARN] ${msg}`);
};

console.error = (...args: any[]) => {
  originalError(...args);
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  addLog(`[ERROR] ${msg}`);
};

// Catch unhandled promise rejections
if (typeof global !== 'undefined' && (global as any).Promise) {
  const Promise = (global as any).Promise;
  if (Promise.onUnhandled) {
    Promise.onUnhandled = (id: any, rejection: any) => {
      console.error('Unhandled Promise Rejection:', rejection);
    };
  }
}

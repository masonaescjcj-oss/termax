import { useState, useEffect } from 'react';

export interface TradingAccount {
    id: string;
    broker: string;
    type: 'LIVE' | 'DEMO';
    balance: number;
    currency: string;
    leverage: string;
    createdAt: string;
}

// Default placeholder — balance is 0 until server data arrives.
// This prevents false margin calculations that could trigger stop-outs.
const defaultAccounts: TradingAccount[] = [
    { id: 'default_demo', broker: 'TradeHub', type: 'DEMO', balance: 0, currency: 'USD', leverage: '1:200', createdAt: new Date().toISOString() },
];

let globalAccounts: TradingAccount[] = [...defaultAccounts];
let globalSelectedAccount: TradingAccount = globalAccounts[0];
let globalIsInitialized = false;  // TRUE only after first successful server sync
let listeners: any[] = [];
let accountListListeners: any[] = [];
let initListeners: any[] = [];

const notifyAll = () => {
    listeners.forEach(l => l(globalSelectedAccount));
    accountListListeners.forEach(l => l([...globalAccounts]));
    initListeners.forEach(l => l(globalIsInitialized));
};

export const useAccountStore = () => {
    const [selectedAccount, setAcc] = useState(globalSelectedAccount);
    const [mockAccounts, setAccounts] = useState(globalAccounts);
    const [isInitialized, setIsInit] = useState(globalIsInitialized);
    
    useEffect(() => {
        listeners.push(setAcc);
        accountListListeners.push(setAccounts);
        initListeners.push(setIsInit);
        return () => {
            listeners = listeners.filter(l => l !== setAcc);
            accountListListeners = accountListListeners.filter(l => l !== setAccounts);
            initListeners = initListeners.filter(l => l !== setIsInit);
        };
    }, []);

    const setSelectedAccount = (acc: TradingAccount) => {
        globalSelectedAccount = acc;
        notifyAll();
    };

    const addDemoAccount = (account: TradingAccount) => {
        globalAccounts = [...globalAccounts, account];
        globalSelectedAccount = account;
        notifyAll();
    };

    const removeDemoAccount = (accountId: string) => {
        globalAccounts = globalAccounts.filter(a => a.id !== accountId);
        if (globalSelectedAccount.id === accountId) {
            globalSelectedAccount = globalAccounts[0];
        }
        notifyAll();
    };

    // Sync accounts from server — this is the ONLY source of truth for balances.
    // After this call, isInitialized becomes true and the app can safely calculate margin.
    const syncFromServer = (accounts: TradingAccount[]) => {
        // Ensure all server accounts have a type field (default to LIVE)
        const serverAccounts = accounts.map(a => ({
            ...a,
            type: (a.type || (a as any).accountType || 'LIVE') as 'LIVE' | 'DEMO',
            broker: a.broker || 'cTrader',
            balance: a.balance || 0,
            currency: a.currency || 'USD',
            leverage: a.leverage || '1:100',
            createdAt: a.createdAt || new Date().toISOString()
        }));

        // Server accounts are the SOLE source of truth — don't keep stale local demos
        // that might have wrong balances. Only keep local demos if the server doesn't
        // have an account with that ID.
        const existingDemos = globalAccounts.filter(a => a.type === 'DEMO' && !serverAccounts.find(s => s.id === a.id));
        globalAccounts = [...serverAccounts, ...existingDemos];

        // If current selection still exists in the new list, UPDATE its data (especially balance)
        const updatedCurrent = globalAccounts.find(a => a.id === globalSelectedAccount.id);
        if (updatedCurrent) {
            globalSelectedAccount = updatedCurrent;
        } else {
            // Select first account if current selection is gone
            globalSelectedAccount = globalAccounts[0] || defaultAccounts[0];
        }

        // Mark as initialized — safe to calculate margin now
        globalIsInitialized = true;
        notifyAll();
    };

    const updateAccountData = (partialData: Partial<TradingAccount>) => {
        // Only allow balance updates if we've been initialized from the server
        if (!globalIsInitialized && partialData.balance !== undefined) {
            return; // Ignore stale balance updates before server sync
        }
        globalSelectedAccount = { ...globalSelectedAccount, ...partialData };
        // Also update it in the globalAccounts list
        globalAccounts = globalAccounts.map(a => a.id === globalSelectedAccount.id ? globalSelectedAccount : a);
        notifyAll();
    };

    return { selectedAccount, setSelectedAccount, mockAccounts, addDemoAccount, removeDemoAccount, syncFromServer, updateAccountData, isInitialized };
};

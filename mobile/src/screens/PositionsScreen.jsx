import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Linking, Modal, PanResponder } from 'react-native';
import { Text, TextInput } from '../components/Typography';
import * as SvgModule from 'react-native-svg';
import * as AxiosModule from 'axios';
import io from 'socket.io-client';
import * as StorageModule from '../utils/storage';
import * as NavigationModule from '@react-navigation/native';
import * as LucideModule from 'lucide-react-native';
import * as ThemeModule from '../theme/ThemeContext';
import GlassToast from '../components/GlassToast';
import AccountSwitcher from '../components/AccountSwitcher';
import * as AccountStoreModule from '../store/accountStore';
import GlassView from '../components/GlassView';
import * as ConfigModule from '../config';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { jsxDEV as _jsxDEV } from 'react/jsx-dev-runtime';

// Fallback mocks for React Refresh functions in production mode
const $RefreshSig$ = () => () => {};
const $RefreshReg$ = () => {};

// Setup require wrapper
const wrapDefault = (val) => {
  if (!val) return { default: {}, __esModule: true };
  const obj = Object.create(val);
  Object.defineProperty(obj, 'default', { value: val, writable: true, configurable: true, enumerable: true });
  Object.defineProperty(obj, '__esModule', { value: true, writable: true, configurable: true, enumerable: true });
  return obj;
};

const wrapNamespace = (val) => {
  if (!val) return { __esModule: true };
  const obj = { ...val };
  obj.default = val.default || val;
  obj.__esModule = true;
  return obj;
};

const requireMock = (index) => {
  switch (index) {
    case 0: return React;
    case 1: return wrapDefault(View);
    case 2: return wrapDefault(require('../components/Typography').Text);
    case 3: return wrapDefault(StyleSheet);
    case 4: return wrapDefault(FlatList);
    case 5: return wrapDefault(TouchableOpacity);
    case 6: return wrapDefault(Platform);
    case 7: return wrapDefault(ActivityIndicator);
    case 8: return wrapDefault(Linking);
    case 9: return wrapDefault(require('../components/Typography').TextInput);
    case 10: return wrapDefault(Modal);
    case 11: return wrapDefault(PanResponder);
    case 12: return wrapNamespace(SvgModule);
    case 13: return wrapNamespace(AxiosModule);
    case 14: return wrapDefault(io);
    case 15: return wrapNamespace(StorageModule);
    case 16: return wrapNamespace(NavigationModule);
    case 17: return wrapNamespace(LucideModule);
    case 18: return wrapNamespace(ThemeModule);
    case 19: return wrapDefault(GlassToast);
    case 20: return wrapNamespace(AccountStoreModule);
    case 21: return wrapDefault(GlassView);
    case 22: return wrapNamespace(ConfigModule);
    case 23: return { jsx: _jsx, jsxs: _jsxs, jsxDEV: _jsxDEV || _jsx, __esModule: true };
    case 24: return wrapDefault(AccountSwitcher);
    default: return undefined;
  }
};

function runPositionsModule(global, require, _$_IMPORT_DEFAULT, _$_IMPORT_ALL, module, exports, _dependencyMap) {

  "use strict";

  var _jsxFileName = "C:\\Users\\asiac\\OneDrive\\Desktop\\trade (2)\\trade\\mobile\\src\\screens\\PositionsScreen.tsx",
    _s = $RefreshSig$(); // Safe base64 decode for React Native
  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  function _interopDefault(e) {
    return e && e.__esModule ? e : {
      default: e
    };
  }
  Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function () {
      return PositionsScreen;
    }
  });
  var _react = require(_dependencyMap[0], "react");
  var _reactNativeWebDistExportsView = require(_dependencyMap[1], "react-native-web/dist/exports/View");
  var View = _interopDefault(_reactNativeWebDistExportsView);
  var _reactNativeWebDistExportsText = require(_dependencyMap[2], "react-native-web/dist/exports/Text");
  var Text = _interopDefault(_reactNativeWebDistExportsText);
  var _reactNativeWebDistExportsStyleSheet = require(_dependencyMap[3], "react-native-web/dist/exports/StyleSheet");
  var StyleSheet = _interopDefault(_reactNativeWebDistExportsStyleSheet);
  var _reactNativeWebDistExportsFlatList = require(_dependencyMap[4], "react-native-web/dist/exports/FlatList");
  var FlatList = _interopDefault(_reactNativeWebDistExportsFlatList);
  var _reactNativeWebDistExportsTouchableOpacity = require(_dependencyMap[5], "react-native-web/dist/exports/TouchableOpacity");
  var TouchableOpacity = _interopDefault(_reactNativeWebDistExportsTouchableOpacity);
  var _reactNativeWebDistExportsPlatform = require(_dependencyMap[6], "react-native-web/dist/exports/Platform");
  var Platform = _interopDefault(_reactNativeWebDistExportsPlatform);
  var _reactNativeWebDistExportsActivityIndicator = require(_dependencyMap[7], "react-native-web/dist/exports/ActivityIndicator");
  var ActivityIndicator = _interopDefault(_reactNativeWebDistExportsActivityIndicator);
  var _reactNativeWebDistExportsLinking = require(_dependencyMap[8], "react-native-web/dist/exports/Linking");
  var Linking = _interopDefault(_reactNativeWebDistExportsLinking);
  var _reactNativeWebDistExportsTextInput = require(_dependencyMap[9], "react-native-web/dist/exports/TextInput");
  var TextInput = _interopDefault(_reactNativeWebDistExportsTextInput);
  var _reactNativeWebDistExportsModal = require(_dependencyMap[10], "react-native-web/dist/exports/Modal");
  var Modal = _interopDefault(_reactNativeWebDistExportsModal);
  var _reactNativeWebDistExportsPanResponder = require(_dependencyMap[11], "react-native-web/dist/exports/PanResponder");
  var PanResponder = _interopDefault(_reactNativeWebDistExportsPanResponder);
  var _reactNativeSvg = require(_dependencyMap[12], "react-native-svg");
  var Svg = _interopDefault(_reactNativeSvg);
  var _axios = require(_dependencyMap[13], "axios");
  var axios = _interopDefault(_axios);
  var _socketIoClient = require(_dependencyMap[14], "socket.io-client");
  var io = _interopDefault(_socketIoClient);
  var _utilsStorage = require(_dependencyMap[15], "../utils/storage");
  var _reactNavigationNative = require(_dependencyMap[16], "@react-navigation/native");
  var _lucideReactNative = require(_dependencyMap[17], "lucide-react-native");
  var _themeThemeContext = require(_dependencyMap[18], "../theme/ThemeContext");
  var _componentsGlassToast = require(_dependencyMap[19], "../components/GlassToast");
  var GlassToast = _interopDefault(_componentsGlassToast);
  var _storeAccountStore = require(_dependencyMap[20], "../store/accountStore");
  var _componentsGlassView = require(_dependencyMap[21], "../components/GlassView");
  var BlurView = _interopDefault(_componentsGlassView);
  var _AccountSwitcher = require(_dependencyMap[24], "../components/AccountSwitcher");
  var AccountSwitcher = _interopDefault(_AccountSwitcher);
  var _config = require(_dependencyMap[22], "../config");
  var _reactJsxDevRuntime = require(_dependencyMap[23], "react/jsx-dev-runtime");
  const decodeBase64 = str => {
    try {
      if (typeof atob === 'function') return atob(str);
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let output = '';
      str = String(str).replace(/=+$/, '');
      for (let bc = 0, bs = 0, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
      }
      return output;
    } catch (e) {
      return '';
    }
  };
  function PositionsScreen() {
    _s();
    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const navigation = (0, _reactNavigationNative.useNavigation)();
    const {
      colors,
      isDark
    } = (0, _themeThemeContext.useTheme)();
    const styles = (0, _react.useMemo)(() => createStyles(colors), [colors]);
    const [positions, setPositions] = (0, _react.useState)([]);
    const socketRef = (0, _react.useRef)(null);
    const subscribedSymbolsRef = (0, _react.useRef)([]);
    const {
      selectedAccount,
      updateAccountData,
      syncFromServer,
      isInitialized
    } = (0, _storeAccountStore.useAccountStore)();
    const [account, setAccount] = (0, _react.useState)(selectedAccount);
    const [loading, setLoading] = (0, _react.useState)(false);
    const liveAccountMetrics = (0, _react.useMemo)(() => {
      const balance = (account && account.balance !== undefined) ? account.balance : (selectedAccount?.balance || 10000);
      let totalPnL = 0;
      let totalMargin = 0;
      const LEVERAGE = 200;

      const contractSizes = {
        'BTC/USDT': 1, 'ETH/USDT': 1, 'BNB/USDT': 1, 'SOL/USDT': 1,
        'XRP/USDT': 1, 'ADA/USDT': 1, 'DOGE/USDT': 1, 'AVAX/USDT': 1,
        'LINK/USDT': 1, 'DOT/USDT': 1, 'MATIC/USDT': 1, 'SHIB/USDT': 1,
        'LTC/USDT': 1, 'TRX/USDT': 1, 'UNI/USDT': 1,
        'GOLD': 100, 'SILVER': 5000, 'USOIL': 1000,
        'SPX': 1, 'NDQ': 1, 'DJI': 1, 'VIX': 1, 'DXY': 1,
        'AAPL': 1, 'MSFT': 1, 'NVDA': 1, 'GOOGL': 1, 'AMZN': 1, 'TSLA': 1, 'NFLX': 1
      };

      positions.forEach(p => {
        if (p.status === 'OPEN' || p.status === 'PENDING') {
          totalPnL += (p.unrealizedPnL || 0);
          const cs = contractSizes[p.symbol] || 1;
          const entryPrice = p.entryPrice || 0;
          totalMargin += (p.volume * cs * entryPrice) / LEVERAGE;
        }
      });

      const equity = balance + totalPnL;
      const freeMargin = equity - totalMargin;
      const marginLevel = totalMargin > 0 ? (equity / totalMargin) * 100 : 9999;

      return {
        balance,
        equity: isNaN(equity) ? balance : equity,
        margin: totalMargin,
        freeMargin: isNaN(freeMargin) ? balance : freeMargin,
        marginLevel: isNaN(marginLevel) ? 9999 : marginLevel
      };
    }, [account, selectedAccount?.balance, positions]);
    const [activeTab, setActiveTab] = (0, _react.useState)('POSITIONS');
    const [historyFilter, setHistoryFilter] = (0, _react.useState)('Today');

    // One-Click Close state
    const [oneClickClose, setOneClickClose] = (0, _react.useState)(false);

    // Close Modal State
    const [isCloseModalOpen, setIsCloseModalOpen] = (0, _react.useState)(false);
    const [selectedPositionForClose, setSelectedPositionForClose] = (0, _react.useState)(null);
    const [volumeToClose, setVolumeToClose] = (0, _react.useState)('');
    const [isEditingVolume, setIsEditingVolume] = (0, _react.useState)(false);

    // Modify Modal State
    const [isModifyModalOpen, setIsModifyModalOpen] = (0, _react.useState)(false);
    const [selectedPositionForModify, setSelectedPositionForModify] = (0, _react.useState)(null);
    const [takeProfitVal, setTakeProfitVal] = (0, _react.useState)('');
    const [stopLossVal, setStopLossVal] = (0, _react.useState)('');
    const [trailingStopVal, setTrailingStopVal] = (0, _react.useState)('');
    const [modifyMode, setModifyMode] = (0, _react.useState)('TP');
    const [dialAngle, setDialAngle] = (0, _react.useState)(0);
    const [isEditingValueManually, setIsEditingValueManually] = (0, _react.useState)(false);
    (0, _react.useEffect)(() => {
      const loadOneClick = async () => {
        try {
          const val = await (0, _utilsStorage.getItemAsync)('oneClickClose');
          if (val === 'true') setOneClickClose(true);
        } catch (e) {}
      };
      loadOneClick();
    }, []);
    const toggleOneClickClose = async () => {
      try {
        const nextVal = !oneClickClose;
        setOneClickClose(nextVal);
        await (0, _utilsStorage.setItemAsync)('oneClickClose', nextVal ? 'true' : 'false');
      } catch (e) {}
    };

    // Toast State
    const [toastVisible, setToastVisible] = (0, _react.useState)(false);
    const [toastMessage, setToastMessage] = (0, _react.useState)('');
    const [toastType, setToastType] = (0, _react.useState)('success');
    const [isAddAccountModalOpen, setIsAddAccountModalOpen] = (0, _react.useState)(false);
    const showToast = (msg, type = 'success') => {
      setToastMessage(msg);
      setToastType(type);
      setToastVisible(true);
    };

    // When selectedAccount changes, update the displayed account info
    (0, _react.useEffect)(() => {
      if (!isInitialized) return;
      setAccount(prev => {
        const balance = selectedAccount.balance;
        if (!prev || prev.id !== selectedAccount.id) {
          return {
            id: selectedAccount.id,
            balance,
            equity: balance,
            margin: 0,
            freeMargin: balance,
            marginLevel: 9999
          };
        }
        const margin = (prev.margin !== undefined && !isNaN(prev.margin)) ? prev.margin : 0;
        const prevEquity = (prev.equity !== undefined && !isNaN(prev.equity)) ? prev.equity : balance;
        const prevBalance = (prev.balance !== undefined && !isNaN(prev.balance)) ? prev.balance : balance;
        const equity = balance + (prevEquity - prevBalance);
        const freeMargin = equity - margin;
        const marginLevel = margin > 0 ? (equity / margin) * 100 : 9999;
        return {
          ...prev,
          id: selectedAccount.id,
          balance,
          equity: isNaN(equity) ? balance : equity,
          margin,
          freeMargin: isNaN(freeMargin) ? balance : freeMargin,
          marginLevel: isNaN(marginLevel) ? 9999 : marginLevel
        };
      });
      // Re-fetch positions for the new account
      fetchPositions();
    }, [selectedAccount.id, selectedAccount.balance, isInitialized]);
    const connectBroker = async () => {
      try {
        const res = await axios.default.get(`${_config.BACKEND_URL}/api/v1/trade/auth`);
        if (res.data.success && res.data.url) {
          Linking.default.openURL(res.data.url);
        }
      } catch (err) {
        showToast('Failed to connect broker', 'error');
      }
    };
    const fetchPositions = async () => {
      setLoading(true);
      try {
        const token = await (0, _utilsStorage.getItemAsync)('accessToken');
        const res = await axios.default.get(`${_config.BACKEND_URL}/api/v1/trade/positions?accountId=${selectedAccount.id}&t=${Date.now()}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.data.success) {
          setPositions(res.data.data.positions || res.data.data);
          if (res.data.data.account) {
            setAccount({
              ...res.data.data.account,
              id: res.data.data.account.id || res.data.data.account.accountId
            });
            updateAccountData({
              balance: res.data.data.account.balance
            });
          }
          if (res.data.data.accounts) {
            syncFromServer(res.data.data.accounts);
          }
        }
      } catch (err) {
        console.error('Failed to fetch positions', err);
      } finally {
        setLoading(false);
      }
    };
    (0, _react.useEffect)(() => {
      fetchPositions();
    }, []);

    // Re-fetch positions every time this screen comes into focus
    (0, _reactNavigationNative.useFocusEffect)((0, _react.useCallback)(() => {
      fetchPositions();
    }, [selectedAccount.id]));

    // Dynamic socket subscription helper
    const subscribeToSymbols = (positionsData) => {
      if (!socketRef.current) return;
      const openSymbols = Array.from(new Set(positionsData.filter(p => p.status === 'OPEN').map(p => p.symbol)));
      // Unsubscribe from old symbols
      subscribedSymbolsRef.current.forEach(sym => {
        if (!openSymbols.includes(sym)) socketRef.current.emit('unsubscribe', sym);
      });
      // Subscribe to new symbols
      openSymbols.forEach(sym => {
        if (!subscribedSymbolsRef.current.includes(sym)) socketRef.current.emit('subscribe', sym);
      });
      subscribedSymbolsRef.current = openSymbols;
    };

    // Auto-subscribe/unsubscribe when positions state changes
    (0, _react.useEffect)(() => {
      if (socketRef.current && positions.length > 0) {
        subscribeToSymbols(positions);
      }
    }, [positions]);

    // Socket connection for real-time updates
    (0, _react.useEffect)(() => {
      // Single socket connection for everything
      const socket = (0, io.default)(_config.BACKEND_URL, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', async () => {
        // Join user-specific room for real-time position updates
        const token = await (0, _utilsStorage.getItemAsync)('accessToken');
        if (token) {
          try {
            // Decode userId from JWT (safe base64 decode)
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payloadStr = decodeBase64(base64);
            if (payloadStr) {
              const payload = JSON.parse(payloadStr);
              const userId = payload.sub || payload.id;
              if (userId) {
                socket.emit('joinUserRoom', userId);
              }
            }
          } catch (e) {
            console.error('Failed to decode token for socket room', e);
          }
        }
        // Subscribe to current positions on connect
        subscribeToSymbols(positions);
      });

      // Real-time: new position opened (from any screen)
      socket.on('positionOpened', data => {
        if (data.position && data.position.accountId === selectedAccount.id) {
          setPositions(prev => {
            const exists = prev.find(p => p.id === data.position.id || p._id === data.position._id);
            if (exists) {
              return prev.map(p => (p.id === data.position.id || p._id === data.position._id) ? {
                ...data.position,
                id: data.position.id || data.position._id
              } : p);
            }
            return [data.position, ...prev];
          });
          subscribeToSymbols([data.position]);
        }
        if (data.account && data.account.accountId === selectedAccount.id) {
          setAccount({
            ...data.account,
            id: data.account.id || data.account.accountId
          });
          updateAccountData({
            balance: data.account.balance
          });
        }
      });

      // Real-time: position closed
      socket.on('positionClosed', data => {
        if (data.position && data.position.accountId === selectedAccount.id) {
          setPositions(prev => prev.map(p => p.id === data.position.id || p._id === data.position._id ? {
            ...data.position,
            id: data.position.id || data.position._id
          } : p));
        }
        if (data.account && data.account.accountId === selectedAccount.id) {
          setAccount({
            ...data.account,
            id: data.account.id || data.account.accountId
          });
          updateAccountData({
            balance: data.account.balance
          });
        }
      });

      // Real-time: stop-out happened
      socket.on('stopOut', data => {
        if (data.account) {
          setAccount({
            ...data.account,
            id: data.account.id || data.account.accountId
          });
          updateAccountData({
            balance: data.account.balance
          });
        }
        // Refresh all positions
        fetchPositions();
      });

      // Live price updates for PnL calculation
      socket.on('priceUpdate', data => {
        setPositions(prev => {
          let changed = false;
          const newPos = prev.map(p => {
            if ((p.status === 'OPEN' || p.status === 'PENDING') && p.symbol === data.symbol) {
              const pnlMultipliers = {
                'BTC/USDT': 1,
                'ETH/USDT': 1,
                'BNB/USDT': 1,
                'SOL/USDT': 1,
                'GOLD': 100,
                'SILVER': 5000,
                'USOIL': 1000,
                'SPX': 1,
                'NDQ': 1,
                'DJI': 1,
                'VIX': 1,
                'DXY': 1,
                'AAPL': 1,
                'MSFT': 1,
                'NVDA': 1,
                'GOOGL': 1,
                'AMZN': 1,
                'TSLA': 1,
                'NFLX': 1
              };
              const mult = pnlMultipliers[p.symbol] || 1;
              const diff = p.side === 'BUY' ? data.price - p.entryPrice : p.entryPrice - data.price;
              const newPnl = diff * p.volume * mult - (p.commission || 0);
              if (Math.abs((p.unrealizedPnL || 0) - newPnl) > 0.01) {
                changed = true;
                return {
                  ...p,
                  unrealizedPnL: newPnl,
                  currentPrice: data.price
                };
              }
            }
            return p;
          });
          if (changed) {
            return newPos;
          }
          return prev;
        });
      });

      // After initial fetch, subscribe to symbols
      const initialFetch = async () => {
        try {
          const token = await (0, _utilsStorage.getItemAsync)('accessToken');
          const res = await axios.default.get(`${_config.BACKEND_URL}/api/v1/trade/positions?accountId=${selectedAccount.id}&t=${Date.now()}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (res.data.success) {
            const posData = res.data.data.positions || res.data.data;
            subscribeToSymbols(posData);
          }
        } catch (e) {}
      };
      const fetchTimer = setTimeout(initialFetch, 1000);
      return () => {
        clearTimeout(fetchTimer);
        socket.disconnect();
      };
    }, [selectedAccount.id]);
    const closePosition = async (id, vol, currentPrice) => {
      // Optimistic update
      const originalPositions = [...positions];
      setPositions(prev => prev.map(p => {
        if (p.id === id || p._id === id) {
          if (vol && vol < p.volume) {
            // Partial close
            return { ...p, volume: Math.round((p.volume - vol) * 100) / 100 };
          } else {
            // Full close
            return { ...p, status: 'CLOSED' };
          }
        }
        return p;
      }).filter(p => p.status !== 'CLOSED'));

      try {
        const token = await (0, _utilsStorage.getItemAsync)('accessToken');
        const res = await axios.default.post(`${_config.BACKEND_URL}/api/v1/trade/close`, {
          positionId: id,
          volume: vol,
          currentPrice: currentPrice
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.data.success) {
          fetchPositions();
          showToast(vol ? `Closed ${vol} lots successfully` : 'Position closed successfully', 'success');
        } else {
          // Revert on failure
          setPositions(originalPositions);
        }
      } catch (err) {
        // Revert on error
        setPositions(originalPositions);
        const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to close position';
        showToast(errorMsg, 'error');
      }
    };
    const closeAllPositions = async () => {
      const openPos = positions.filter(p => p.status === 'OPEN');
      if (openPos.length === 0) return;
      
      // Optimistic update
      const originalPositions = [...positions];
      setPositions(prev => prev.filter(p => p.status !== 'OPEN'));

      setLoading(true);
      try {
        const token = await (0, _utilsStorage.getItemAsync)('accessToken');
        await Promise.all(openPos.map(p => axios.default.post(`${_config.BACKEND_URL}/api/v1/trade/close`, {
          positionId: p.id || p._id,
          currentPrice: p.currentPrice
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })));
        fetchPositions();
        showToast('All positions closed successfully', 'success');
      } catch (err) {
        setPositions(originalPositions);
        showToast('Failed to close some positions', 'error');
      } finally {
        setLoading(false);
      }
    };
    const lastDx = (0, _react.useRef)(0);
    const getPriceStep = sym => {
      const symbolConfigs = {
        'BTC/USDT': {
          decimals: 2,
          step: 2.0
        },
        'ETH/USDT': {
          decimals: 2,
          step: 0.2
        },
        'BNB/USDT': {
          decimals: 2,
          step: 0.05
        },
        'SOL/USDT': {
          decimals: 3,
          step: 0.02
        },
        'GOLD': {
          decimals: 2,
          step: 0.1
        },
        'SILVER': {
          decimals: 3,
          step: 0.005
        },
        'USOIL': {
          decimals: 3,
          step: 0.005
        },
        'SPX': {
          decimals: 2,
          step: 0.2
        },
        'NDQ': {
          decimals: 2,
          step: 0.5
        },
        'AAPL': {
          decimals: 2,
          step: 0.05
        },
        'TSLA': {
          decimals: 2,
          step: 0.05
        }
      };
      return symbolConfigs[sym] || {
        decimals: 2,
        step: 0.1
      };
    };
    const modifyModeRef = (0, _react.useRef)(modifyMode);
    const selectedPositionForModifyRef = (0, _react.useRef)(selectedPositionForModify);
    const takeProfitValRef = (0, _react.useRef)(takeProfitVal);
    const stopLossValRef = (0, _react.useRef)(stopLossVal);
    const trailingStopValRef = (0, _react.useRef)(trailingStopVal);
    (0, _react.useEffect)(() => {
      modifyModeRef.current = modifyMode;
    }, [modifyMode]);
    (0, _react.useEffect)(() => {
      selectedPositionForModifyRef.current = selectedPositionForModify;
    }, [selectedPositionForModify]);
    (0, _react.useEffect)(() => {
      takeProfitValRef.current = takeProfitVal;
    }, [takeProfitVal]);
    (0, _react.useEffect)(() => {
      stopLossValRef.current = stopLossVal;
    }, [stopLossVal]);
    (0, _react.useEffect)(() => {
      trailingStopValRef.current = trailingStopVal;
    }, [trailingStopVal]);
    const panResponder = (0, _react.useMemo)(() => PanResponder.default.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastDx.current = 0;
      },
      onPanResponderMove: (evt, gestureState) => {
        const deltaX = gestureState.dx - lastDx.current;
        lastDx.current = gestureState.dx;
        const angleChange = deltaX * 0.015;
        setDialAngle(prev => prev + angleChange);
        const pos = selectedPositionForModifyRef.current;
        if (!pos) return;
        const symbol = pos.symbol || 'BTC/USDT';
        const entryPrice = pos.entryPrice || 0;
        const config = getPriceStep(symbol);
        const mode = modifyModeRef.current;
        if (mode === 'TP') {
          const currentVal = parseFloat(takeProfitValRef.current) || entryPrice;
          const nextVal = Math.max(0, currentVal + deltaX * config.step * 0.5);
          setTakeProfitVal(nextVal.toFixed(config.decimals));
        } else if (mode === 'SL') {
          const currentVal = parseFloat(stopLossValRef.current) || entryPrice;
          const nextVal = Math.max(0, currentVal + deltaX * config.step * 0.5);
          setStopLossVal(nextVal.toFixed(config.decimals));
        } else if (mode === 'TS') {
          const currentVal = parseFloat(trailingStopValRef.current) || 0;
          const nextVal = Math.max(0, currentVal + deltaX * 0.5);
          setTrailingStopVal(Math.round(nextVal).toString());
        }
      }
    }), []);
    const adjustValue = direction => {
      const pos = selectedPositionForModify;
      if (!pos) return;
      const symbol = pos.symbol || 'BTC/USDT';
      const entryPrice = pos.entryPrice || 0;
      const config = getPriceStep(symbol);
      const sign = direction === 'up' ? 1 : -1;
      if (modifyMode === 'TP') {
        const current = parseFloat(takeProfitVal) || entryPrice;
        const next = Math.max(0, current + sign * config.step);
        setTakeProfitVal(next.toFixed(config.decimals));
      } else if (modifyMode === 'SL') {
        const current = parseFloat(stopLossVal) || entryPrice;
        const next = Math.max(0, current + sign * config.step);
        setStopLossVal(next.toFixed(config.decimals));
      } else if (modifyMode === 'TS') {
        const current = parseFloat(trailingStopVal) || 0;
        const next = Math.max(0, current + sign * 1);
        setTrailingStopVal(Math.round(next).toString());
      }
    };
    const getPnlDisplay = () => {
      const pos = selectedPositionForModify;
      if (!pos) return null;
      const entryPrice = pos.entryPrice || 0;
      const pnlMultipliers = {
        'BTC/USDT': 1,
        'ETH/USDT': 1,
        'BNB/USDT': 1,
        'SOL/USDT': 1,
        'GOLD': 100,
        'SILVER': 5000,
        'USOIL': 1000,
        'SPX': 1,
        'NDQ': 1,
        'DJI': 1,
        'VIX': 1,
        'DXY': 1,
        'AAPL': 1,
        'MSFT': 1,
        'NVDA': 1,
        'GOOGL': 1,
        'AMZN': 1,
        'TSLA': 1,
        'NFLX': 1
      };
      const mult = pnlMultipliers[pos.symbol] || 1;
      if (modifyMode === 'TP') {
        const tp = parseFloat(takeProfitVal);
        if (isNaN(tp) || tp <= 0) return {
          text: 'No Profit Target Set',
          color: colors.textMuted
        };
        const diff = pos.side === 'BUY' ? tp - entryPrice : entryPrice - tp;
        const estPnl = diff * pos.volume * mult - (pos.commission || 0);
        const estPnlPct = diff / entryPrice * 100 * (pos.side === 'BUY' ? 1 : -1);
        return {
          text: `${estPnl >= 0 ? '+' : ''}$${estPnl.toFixed(2)} (${estPnl >= 0 ? '+' : ''}${estPnlPct.toFixed(2)}%)`,
          color: estPnl >= 0 ? colors.success : colors.danger
        };
      } else if (modifyMode === 'SL') {
        const sl = parseFloat(stopLossVal);
        if (isNaN(sl) || sl <= 0) return {
          text: 'No Risk Target Set',
          color: colors.textMuted
        };
        const diff = pos.side === 'BUY' ? sl - entryPrice : entryPrice - sl;
        const estPnl = diff * pos.volume * mult - (pos.commission || 0);
        const estPnlPct = diff / entryPrice * 100 * (pos.side === 'BUY' ? 1 : -1);
        return {
          text: `${estPnl >= 0 ? '+' : ''}$${estPnl.toFixed(2)} (${estPnl >= 0 ? '+' : ''}${estPnlPct.toFixed(2)}%)`,
          color: estPnl >= 0 ? colors.success : colors.danger
        };
      } else {
        const ts = parseFloat(trailingStopVal);
        if (isNaN(ts) || ts <= 0) return {
          text: 'Trailing Stop Disabled',
          color: colors.textMuted
        };
        return {
          text: `Trailing Stop: ${ts} Points`,
          color: '#3B82F6'
        };
      }
    };
    const pnlDisplay = getPnlDisplay();
    const openModifyModal = pos => {
      setSelectedPositionForModify(pos);
      setTakeProfitVal(pos.takeProfit ? pos.takeProfit.toString() : '');
      setStopLossVal(pos.stopLoss ? pos.stopLoss.toString() : '');
      setTrailingStopVal(pos.trailingStopDistance ? pos.trailingStopDistance.toString() : '');
      setModifyMode('TP');
      setDialAngle(0);
      setIsEditingValueManually(false);
      setIsModifyModalOpen(true);
    };
    const handleModifyPosition = async () => {
      if (!selectedPositionForModify) return;
      setIsModifyModalOpen(false);
      setLoading(true);
      try {
        const token = await (0, _utilsStorage.getItemAsync)('accessToken');
        const res = await axios.default.post(`${_config.BACKEND_URL}/api/v1/trade/modify`, {
          positionId: selectedPositionForModify.id || selectedPositionForModify._id,
          takeProfit: takeProfitVal ? parseFloat(takeProfitVal) : null,
          stopLoss: stopLossVal ? parseFloat(stopLossVal) : null,
          trailingStopDistance: trailingStopVal ? parseFloat(trailingStopVal) : 0
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.data.success) {
          fetchPositions();
          showToast('Position modified successfully', 'success');
        }
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to modify position';
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    };
    const renderItem = ({
      item
    }) => {
      if (item.isHeader) {
        return /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: [styles.recentHeaderContainer, {
            borderBottomColor: colors.glassBorder
          }],
          children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
            style: [styles.recentHeaderText, {
              color: colors.textMuted
            }],
            children: item.title
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 490,
            columnNumber: 11
          }, this)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 489,
          columnNumber: 9
        }, this);
      }
      const isBuy = item.side === 'BUY';
      const sideColor = isBuy ? colors.success : colors.danger;
      const isClosed = item.status === 'CLOSED';
      return /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
        style: [styles.card, isClosed && {
          opacity: 0.8
        }, {
          backgroundColor: colors.glassCard,
          borderColor: colors.glassCardBorder
        }],
        children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: styles.cardHeader,
          children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: {
              flexDirection: 'row',
              alignItems: 'center'
            },
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
              style: [styles.sideTag, {
                backgroundColor: isBuy ? isDark ? 'rgba(8, 153, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)' : isDark ? 'rgba(242, 54, 69, 0.2)' : 'rgba(239, 68, 68, 0.15)'
              }],
              children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.sideTagText, {
                  color: sideColor
                }],
                children: item.side
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 504,
                columnNumber: 15
              }, this)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 503,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.symbolText, {
                color: colors.text
              }],
              children: item.symbol
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 506,
              columnNumber: 13
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 502,
            columnNumber: 11
          }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
            style: [styles.statusText, {
              color: isClosed ? colors.textMuted : colors.primary
            }],
            children: item.status
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 508,
            columnNumber: 11
          }, this)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 501,
          columnNumber: 9
        }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: styles.detailsRow,
          children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: styles.detailBox,
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailLabel, {
                color: colors.textSubtle
              }],
              children: "Volume"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 515,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailValue, {
                color: colors.text
              }],
              children: [item.volume, " Lots"]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 516,
              columnNumber: 13
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 514,
            columnNumber: 11
          }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: styles.detailBox,
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailLabel, {
                color: colors.textSubtle
              }],
              children: "Entry Price"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 519,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailValue, {
                color: colors.text
              }],
              children: item.entryPrice
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 520,
              columnNumber: 13
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 518,
            columnNumber: 11
          }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: styles.detailBox,
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailLabel, {
                color: colors.textSubtle
              }],
              children: isClosed ? 'Close Price' : 'PnL'
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 523,
              columnNumber: 13
            }, this), isClosed ? /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailValue, {
                color: colors.text
              }],
              children: item.closePrice || '-'
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 525,
              columnNumber: 15
            }, this) : /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailValue, {
                color: (item.unrealizedPnL ?? item.profit ?? 0) >= 0 ? colors.success : colors.danger
              }],
              children: ["$", (item.unrealizedPnL ?? item.profit ?? 0).toFixed(2)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 527,
              columnNumber: 15
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 522,
            columnNumber: 11
          }, this)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 513,
          columnNumber: 9
        }, this), isClosed && /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: [styles.closedDetailsContainer, {
            borderTopColor: colors.glassBorder
          }],
          children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: styles.closedDetailsRow,
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailLabel, {
                color: colors.textSubtle
              }],
              children: "Swap"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 537,
              columnNumber: 15
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailValueSmall, {
                color: colors.text
              }],
              children: ["$", item.swap?.toFixed(2) || '0.00']
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 538,
              columnNumber: 15
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 536,
            columnNumber: 13
          }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: styles.closedDetailsRow,
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailLabel, {
                color: colors.textSubtle
              }],
              children: "Commission"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 541,
              columnNumber: 15
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailValueSmall, {
                color: colors.text
              }],
              children: ["$", item.commission?.toFixed(2) || '0.00']
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 542,
              columnNumber: 15
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 540,
            columnNumber: 13
          }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: styles.closedDetailsRow,
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailLabel, {
                color: colors.textSubtle
              }],
              children: "Open Time"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 545,
              columnNumber: 15
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailValueSmall, {
                color: colors.text
              }],
              children: formatDate(item.openTime)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 546,
              columnNumber: 15
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 544,
            columnNumber: 13
          }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: styles.closedDetailsRow,
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailLabel, {
                color: colors.textSubtle
              }],
              children: "Close Time"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 549,
              columnNumber: 15
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailValueSmall, {
                color: colors.text
              }],
              children: formatDate(item.closeTime)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 550,
              columnNumber: 15
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 548,
            columnNumber: 13
          }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: styles.closedDetailsRow,
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailLabel, {
                color: colors.textSubtle
              }],
              children: "Final Profit"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 553,
              columnNumber: 15
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailValueSmall, {
                color: item.finalProfit >= 0 ? colors.success : colors.danger,
                fontWeight: 'bold'
              }],
              children: ["$", item.finalProfit?.toFixed(2) || '0.00']
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 554,
              columnNumber: 15
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 552,
            columnNumber: 13
          }, this)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 535,
          columnNumber: 11
        }, this), !isClosed && /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: [styles.closedDetailsContainer, {
            borderTopColor: colors.glassBorder,
            marginBottom: 8
          }],
          children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: styles.closedDetailsRow,
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailLabel, {
                color: colors.textSubtle
              }],
              children: "Open Time"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 558,
              columnNumber: 15
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.detailValueSmall, {
                color: colors.text
              }],
              children: formatDate(item.openTime)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 559,
              columnNumber: 15
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 557,
            columnNumber: 13
          }, this)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 556,
          columnNumber: 11
        }, this), !isClosed && /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: styles.cardButtonsRow,
          children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
            style: [styles.rowBtn, {
              backgroundColor: '#3B82F6',
              marginRight: 8
            }],
            onPress: () => openModifyModal(item),
            children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: styles.rowBtnText,
              children: "Modify"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 559,
              columnNumber: 15
            }, this)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 555,
            columnNumber: 13
          }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
            style: [styles.rowBtn, {
              backgroundColor: colors.danger,
              marginLeft: 8
            }],
            onPress: () => {
              if (oneClickClose) {
                closePosition(item.id || item._id, null, item.currentPrice);
              } else {
                setSelectedPositionForClose(item);
                setVolumeToClose(item.volume.toString());
                setIsEditingVolume(false);
                setIsCloseModalOpen(true);
              }
            },
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_lucideReactNative.X, {
              color: "#FFF",
              size: 16,
              style: {
                marginRight: 4
              }
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 574,
              columnNumber: 15
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: styles.rowBtnText,
              children: "Close"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 575,
              columnNumber: 15
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 562,
            columnNumber: 13
          }, this)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 554,
          columnNumber: 11
        }, this)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 500,
        columnNumber: 7
      }, this);
    };
    const getDisplayData = () => {
      if (activeTab === 'HISTORY') {
        const closed = positions.filter(p => p.status === 'CLOSED');
        const now = new Date();
        return closed.filter(p => {
          if (!p.closeTime) return false;
          const closeDate = new Date(p.closeTime);
          const diffTime = now.getTime() - closeDate.getTime();
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          if (historyFilter === 'Today') {
            return diffDays <= 1;
          }
          if (historyFilter === '3 Days') {
            return diffDays <= 3;
          }
          if (historyFilter === '1 Week') {
            return diffDays <= 7;
          }
          if (historyFilter === '1 Month') {
            return diffDays <= 30;
          }
          return true;
        });
      } else {
        const open = positions.filter(p => p.status === 'OPEN' || p.status === 'PENDING');
        const closed = positions.filter(p => p.status === 'CLOSED').sort((a, b) => new Date(b.closeTime || 0).getTime() - new Date(a.closeTime || 0).getTime()).slice(0, 2);
        if (closed.length > 0) {
          return [...open, {
            id: 'recently_closed_header',
            isHeader: true,
            title: 'Recently Closed'
          }, ...closed];
        }
        return open;
      }
    };
    const displayData = getDisplayData();
    return /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
      style: [styles.safeArea, {
        backgroundColor: colors.background
      }],
      children: [isDark && /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
        style: [StyleSheet.default.absoluteFillObject, {
          overflow: 'hidden'
        }],
        pointerEvents: "none",
        children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: [styles.glowOrb, {
            backgroundColor: colors.glowBlue,
            top: -60,
            left: -60,
            opacity: isDark ? 0.25 : 0.4
          }]
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 604,
          columnNumber: 11
        }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: [styles.glowOrb, {
            backgroundColor: colors.glowPurple,
            bottom: 80,
            right: -120,
            opacity: isDark ? 0.2 : 0.35
          }]
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 605,
          columnNumber: 11
        }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: [styles.glowOrb, {
            backgroundColor: colors.glowGreen,
            top: '40%',
            left: '60%',
            opacity: isDark ? 0.15 : 0.25
          }]
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 606,
          columnNumber: 11
        }, this)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 603,
        columnNumber: 9
      }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(GlassToast.default, {
        visible: toastVisible,
        message: toastMessage,
        type: toastType,
        onHide: () => setToastVisible(false)
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 610,
        columnNumber: 7
      }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
        style: [styles.header, {
          borderBottomColor: colors.glassBorder
        }],
        children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: [styles.tabSwitcher, {
            backgroundColor: colors.glassPillBg
          }],
          children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
            style: [styles.tabBtn, activeTab === 'POSITIONS' && {
              backgroundColor: colors.primary
            }],
            onPress: () => setActiveTab('POSITIONS'),
            children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.tabBtnText, {
                color: activeTab === 'POSITIONS' ? '#FFF' : colors.textMuted
              }],
              children: "Positions"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 617,
              columnNumber: 13
            }, this)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 613,
            columnNumber: 11
          }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
            style: [styles.tabBtn, activeTab === 'HISTORY' && {
              backgroundColor: colors.primary
            }],
            onPress: () => setActiveTab('HISTORY'),
            children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.tabBtnText, {
                color: activeTab === 'HISTORY' ? '#FFF' : colors.textMuted
              }],
              children: "History"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 623,
              columnNumber: 13
            }, this)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 619,
            columnNumber: 11
          }, this)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 612,
          columnNumber: 9
        }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: {
            flexDirection: 'row',
            alignItems: 'center'
          },
          children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: {
              marginRight: 8
            },
            children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(AccountSwitcher.default, {}, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 626,
              columnNumber: 13
            }, this)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 625,
            columnNumber: 11
          }, this)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 626,
          columnNumber: 9
        }, this)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 611,
        columnNumber: 7
      }, this), activeTab === 'HISTORY' && /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
        style: styles.historyFilters,
        children: ['Today', '3 Days', '1 Week', '1 Month'].map(filter => /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
          style: [styles.filterBtn, {
            backgroundColor: historyFilter === filter ? isDark ? 'rgba(41, 98, 255, 0.1)' : 'rgba(37, 99, 235, 0.1)' : colors.glassButtonBg,
            borderColor: historyFilter === filter ? colors.primary : colors.glassBorder
          }],
          onPress: () => setHistoryFilter(filter),
          children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
            style: [styles.filterBtnText, {
              color: historyFilter === filter ? colors.primary : colors.textSubtle,
              fontWeight: historyFilter === filter ? 'bold' : 'normal'
            }],
            children: filter
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 644,
            columnNumber: 15
          }, this)
        }, filter, false, {
          fileName: _jsxFileName,
          lineNumber: 639,
          columnNumber: 13
        }, this))
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 637,
        columnNumber: 9
      }, this), loading && positions.length === 0 ? /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
        style: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center'
        },
        children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(ActivityIndicator.default, {
          size: "large",
          color: colors.primary
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 652,
          columnNumber: 11
        }, this)
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 651,
        columnNumber: 9
      }, this) : /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(FlatList.default, {
        data: displayData,
        keyExtractor: item => item.id,
        renderItem: renderItem,
        contentContainerStyle: {
          padding: 16
        },
        ListHeaderComponent: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          children: [account ? /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: [styles.accountSummaryCard, {
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.03)',
              borderColor: colors.glassCardBorder
            }],
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
              style: styles.accountSummaryRow,
              children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.accountSummaryLabel, {
                  color: colors.textSubtle
                }],
                children: "Balance:"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 665,
                columnNumber: 21
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.accountSummaryValue, {
                  color: colors.text
                }],
                children: ["$", (liveAccountMetrics.balance || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 666,
                columnNumber: 21
              }, this)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 664,
              columnNumber: 19
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
              style: styles.accountSummaryRow,
              children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.accountSummaryLabel, {
                  color: colors.textSubtle
                }],
                children: "Equity:"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 669,
                columnNumber: 21
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.accountSummaryValue, {
                  color: colors.text
                }],
                children: ["$", (liveAccountMetrics.equity || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 670,
                columnNumber: 21
              }, this)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 668,
              columnNumber: 19
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
              style: styles.accountSummaryRow,
              children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.accountSummaryLabel, {
                  color: colors.textSubtle
                }],
                children: "Margin:"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 673,
                columnNumber: 21
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.accountSummaryValue, {
                  color: colors.text
                }],
                children: ["$", (liveAccountMetrics.margin || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 674,
                columnNumber: 21
              }, this)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 672,
              columnNumber: 19
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
              style: styles.accountSummaryRow,
              children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.accountSummaryLabel, {
                  color: colors.textSubtle
                }],
                children: "Free Margin:"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 677,
                columnNumber: 21
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.accountSummaryValue, {
                  color: liveAccountMetrics.freeMargin < 0 ? colors.danger : colors.text
                }],
                children: ["$", (liveAccountMetrics.freeMargin || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 678,
                columnNumber: 21
              }, this)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 676,
              columnNumber: 19
            }, this), activeTab === 'POSITIONS' && /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
              style: styles.accountSummaryRow,
              children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.accountSummaryLabel, {
                  color: colors.textSubtle
                }],
                children: "Margin Level:"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 682,
                columnNumber: 23
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.accountSummaryValue, {
                  color: liveAccountMetrics.marginLevel < 100 ? colors.danger : colors.success
                }],
                children: liveAccountMetrics.marginLevel === 9999 ? '∞' : `${(liveAccountMetrics.marginLevel || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}%`
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 683,
                columnNumber: 23
              }, this)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 681,
              columnNumber: 21
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 663,
            columnNumber: 17
          }, this) : null, activeTab === 'POSITIONS' && positions.filter(p => p.status === 'OPEN').length > 0 && /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
            style: styles.actionHeaderRow,
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
              onPress: toggleOneClickClose,
              style: [styles.actionHeaderBtn, oneClickClose ? {
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                borderColor: '#EAB308',
                borderWidth: 1
              } : {
                backgroundColor: colors.glassCard,
                borderColor: colors.glassBorder,
                borderWidth: 1
              }],
              children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: {
                  color: oneClickClose ? '#EAB308' : colors.text,
                  fontSize: 13,
                  fontWeight: '700'
                },
                children: "\u26A1 One-Click Close"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 702,
                columnNumber: 21
              }, this)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 693,
              columnNumber: 19
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
              onPress: closeAllPositions,
              style: [styles.actionHeaderBtn, {
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                borderWidth: 1
              }],
              children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: {
                  color: '#F87171',
                  fontSize: 13,
                  fontWeight: '700'
                },
                children: "Close All Positions"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 711,
                columnNumber: 21
              }, this)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 707,
              columnNumber: 19
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 692,
            columnNumber: 17
          }, this)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 661,
          columnNumber: 13
        }, this),
        ListEmptyComponent: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: styles.emptyBox,
          children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
            style: [styles.emptyText, {
              color: colors.textMuted
            }],
            children: ["No ", activeTab === 'POSITIONS' ? 'open positions' : 'history records', " found."]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 721,
            columnNumber: 15
          }, this)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 720,
          columnNumber: 13
        }, this)
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 655,
        columnNumber: 9
      }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Modal.default, {
        visible: isCloseModalOpen,
        animationType: "slide",
        transparent: true,
        onRequestClose: () => setIsCloseModalOpen(false),
        children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: styles.modalOverlay,
          children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(BlurView.default, {
            experimentalBlurMethod: "regular",
            intensity: 100,
            tint: colors.blurTint,
            style: [styles.modalContent, {
              backgroundColor: isDark ? 'rgba(10, 14, 23, 0.18)' : 'rgba(255, 255, 255, 0.25)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.45)'
            }],
            ...Platform.default.select({
              web: {
                className: 'premium-glass-heavy'
              },
              default: {}
            }),
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.modalTitle, {
                color: colors.text
              }],
              children: "Close Position"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 744,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: {
                color: colors.textMuted,
                textAlign: 'center',
                marginBottom: 16
              },
              children: [selectedPositionForClose?.symbol, " \u2022 ", selectedPositionForClose?.side, " \u2022 ", selectedPositionForClose?.volume, " Lots"]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 745,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.modalInputLabel, {
                color: colors.text
              }],
              children: "Volume to Close (Lots)"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 749,
              columnNumber: 13
            }, this), !isEditingVolume ? /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
              onPress: () => setIsEditingVolume(true),
              style: [styles.modalInput, {
                borderColor: colors.border,
                backgroundColor: colors.glassCard,
                marginBottom: 8,
                justifyContent: 'center',
                alignItems: 'center',
                height: 48,
                borderWidth: 1,
                borderRadius: 8
              }],
              children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: {
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: '700'
                },
                children: [volumeToClose, " Lots (Tap to edit)"]
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 750,
                columnNumber: 15
              }, this)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 750,
              columnNumber: 13
            }, this) : /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TextInput.default, {
              style: [styles.modalInput, {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.glassCard,
                marginBottom: 8,
                textAlign: 'center',
                ...Platform.default.select({
                  web: {
                    outlineStyle: 'none'
                  }
                })
              }],
              value: volumeToClose,
              onChangeText: text => {
                const clean = text.replace(/[^0-9.]/g, '');
                const val = parseFloat(clean);
                if (selectedPositionForClose && val > selectedPositionForClose.volume) {
                  setVolumeToClose(selectedPositionForClose.volume.toString());
                } else {
                  setVolumeToClose(clean);
                }
              },
              keyboardType: "numeric",
              placeholder: "e.g. 0.02",
              placeholderTextColor: colors.textMuted,
              autoFocus: true,
              onBlur: () => setIsEditingVolume(false),
              onSubmitEditing: () => setIsEditingVolume(false)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 750,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: {
                color: colors.textMuted,
                fontSize: 11,
                fontWeight: '700',
                marginBottom: 16
              },
              children: ["Maximum Closeable: ", selectedPositionForClose?.volume, " Lots"]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 767,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
              style: styles.quickSelectRow,
              children: ['0.01', '0.02', '0.05', '50%', '100%'].filter(opt => {
                if (opt.endsWith('%')) return true;
                const val = parseFloat(opt);
                return selectedPositionForClose ? val <= selectedPositionForClose.volume : true;
              }).map(opt => /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
                onPress: () => {
                  if (!selectedPositionForClose) return;
                  if (opt.endsWith('%')) {
                    const pct = parseFloat(opt) / 100;
                    let vol = Math.round(selectedPositionForClose.volume * pct * 100) / 100;
                    if (vol < 0.01) vol = 0.01;
                    if (vol > selectedPositionForClose.volume) vol = selectedPositionForClose.volume;
                    setVolumeToClose(vol.toString());
                  } else {
                    setVolumeToClose(opt);
                  }
                },
                style: [styles.quickSelectBtn, {
                  backgroundColor: colors.glassPillBg,
                  borderColor: colors.glassBorder
                }],
                children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                  style: {
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: '700'
                  },
                  children: opt
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 793,
                  columnNumber: 19
                }, this)
              }, opt, false, {
                fileName: _jsxFileName,
                lineNumber: 777,
                columnNumber: 17
              }, this))
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 771,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
              style: [styles.modalExecuteBtn, {
                backgroundColor: colors.danger,
                marginTop: 20
              }],
              onPress: () => {
                if (!selectedPositionForClose) return;
                const vol = parseFloat(volumeToClose);
                if (isNaN(vol) || vol <= 0 || vol > selectedPositionForClose.volume) {
                  showToast('Invalid volume to close', 'error');
                  return;
                }
                setIsCloseModalOpen(false);
                closePosition(selectedPositionForClose.id || selectedPositionForClose._id, vol, selectedPositionForClose.currentPrice);
              },
              children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: styles.modalExecuteBtnText,
                children: ["Close ", volumeToClose ? `${volumeToClose} Lots` : 'Position']
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 811,
                columnNumber: 15
              }, this)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 798,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
              onPress: () => setIsCloseModalOpen(false),
              style: {
                marginTop: 16,
                alignSelf: 'center',
                padding: 8
              },
              children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: {
                  color: colors.textMuted,
                  fontWeight: 'bold'
                },
                children: "Cancel"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 817,
                columnNumber: 15
              }, this)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 816,
              columnNumber: 13
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 730,
            columnNumber: 11
          }, this)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 729,
          columnNumber: 9
        }, this)
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 728,
        columnNumber: 7
      }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Modal.default, {
        visible: isModifyModalOpen,
        animationType: "slide",
        transparent: true,
        onRequestClose: () => setIsModifyModalOpen(false),
        children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: styles.modalOverlay,
          children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(BlurView.default, {
            experimentalBlurMethod: "regular",
            intensity: 100,
            tint: colors.blurTint,
            style: [styles.modalContent, {
              backgroundColor: isDark ? 'rgba(10, 14, 23, 0.18)' : 'rgba(255, 255, 255, 0.25)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.45)'
            }],
            ...Platform.default.select({
              web: {
                className: 'premium-glass-heavy'
              },
              default: {}
            }),
            children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: [styles.modalTitle, {
                color: colors.text,
                marginBottom: 4
              }],
              children: "Modify Position"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 840,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
              style: {
                color: colors.textMuted,
                textAlign: 'center',
                marginBottom: 16
              },
              children: [selectedPositionForModify?.symbol, " \u2022 ", selectedPositionForModify?.side, " \u2022 Entry: ", selectedPositionForModify?.entryPrice]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 841,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
              style: {
                flexDirection: 'row',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 12,
                padding: 4,
                marginBottom: 20
              },
              children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
                onPress: () => {
                  setModifyMode('TP');
                },
                style: {
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: modifyMode === 'TP' ? colors.primary : 'transparent',
                  borderRadius: 8
                },
                children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                  style: {
                    color: '#FFF',
                    fontWeight: '700',
                    fontSize: 13
                  },
                  children: "Take Profit"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 848,
                  columnNumber: 17
                }, this)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 847,
                columnNumber: 15
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
                onPress: () => {
                  setModifyMode('SL');
                },
                style: {
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: modifyMode === 'SL' ? colors.primary : 'transparent',
                  borderRadius: 8
                },
                children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                  style: {
                    color: '#FFF',
                    fontWeight: '700',
                    fontSize: 13
                  },
                  children: "Stop Loss"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 851,
                  columnNumber: 17
                }, this)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 850,
                columnNumber: 15
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
                onPress: () => {
                  setModifyMode('TS');
                },
                style: {
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: modifyMode === 'TS' ? colors.primary : 'transparent',
                  borderRadius: 8
                },
                children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                  style: {
                    color: '#FFF',
                    fontWeight: '700',
                    fontSize: 13
                  },
                  children: "Trailing Stop"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 854,
                  columnNumber: 17
                }, this)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 853,
                columnNumber: 15
              }, this)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 846,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
              style: {
                alignItems: 'center',
                marginVertical: 10
              },
              children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
                style: {
                  width: 220,
                  height: 220,
                  justifyContent: 'center',
                  alignItems: 'center'
                },
                ...panResponder.panHandlers,
                children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
                  style: {
                    width: 200,
                    height: 200,
                    position: 'absolute',
                    transform: [{
                      rotate: `${dialAngle}rad`
                    }]
                  },
                  children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Svg.default, {
                    width: "200",
                    height: "200",
                    viewBox: "0 0 100 100",
                    children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_reactNativeSvg.Circle, {
                      cx: "50",
                      cy: "50",
                      r: "44",
                      stroke: "rgba(255, 255, 255, 0.15)",
                      strokeWidth: "3",
                      strokeDasharray: "1, 4",
                      fill: "none"
                    }, void 0, false, {
                      fileName: _jsxFileName,
                      lineNumber: 874,
                      columnNumber: 21
                    }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_reactNativeSvg.Circle, {
                      cx: "50",
                      cy: "6",
                      r: "5",
                      fill: colors.primary
                    }, void 0, false, {
                      fileName: _jsxFileName,
                      lineNumber: 883,
                      columnNumber: 21
                    }, this)]
                  }, void 0, true, {
                    fileName: _jsxFileName,
                    lineNumber: 873,
                    columnNumber: 19
                  }, this)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 865,
                  columnNumber: 17
                }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
                  style: {
                    width: 154,
                    height: 154,
                    borderRadius: 77,
                    backgroundColor: colors.glassCard,
                    borderWidth: 1,
                    borderColor: colors.glassBorder,
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 10,
                    shadowColor: '#000',
                    shadowOffset: {
                      width: 0,
                      height: 4
                    },
                    shadowOpacity: 0.1,
                    shadowRadius: 8
                  },
                  children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                    style: {
                      color: colors.textMuted,
                      fontSize: 10,
                      fontWeight: '700',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      marginBottom: 4
                    },
                    children: modifyMode === 'TP' ? 'Take Profit' : modifyMode === 'SL' ? 'Stop Loss' : 'Trailing Stop'
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 908,
                    columnNumber: 19
                  }, this), isEditingValueManually ? /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TextInput.default, {
                    style: {
                      color: colors.text,
                      fontSize: 20,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      width: 140,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.primary,
                      paddingVertical: 2
                    },
                    value: modifyMode === 'TP' ? takeProfitVal : modifyMode === 'SL' ? stopLossVal : trailingStopVal,
                    onChangeText: val => {
                      if (modifyMode === 'TP') setTakeProfitVal(val);else if (modifyMode === 'SL') setStopLossVal(val);else if (modifyMode === 'TS') setTrailingStopVal(val);
                    },
                    keyboardType: "numeric",
                    autoFocus: true,
                    onBlur: () => setIsEditingValueManually(false),
                    onSubmitEditing: () => setIsEditingValueManually(false)
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 913,
                    columnNumber: 21
                  }, this) : /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
                    onPress: () => setIsEditingValueManually(true),
                    style: {
                      paddingHorizontal: 10,
                      paddingVertical: 4
                    },
                    children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                      style: {
                        color: colors.text,
                        fontSize: 20,
                        fontWeight: 'bold',
                        textAlign: 'center'
                      },
                      numberOfLines: 1,
                      adjustsFontSizeToFit: true,
                      children: modifyMode === 'TP' ? takeProfitVal || 'Not Set' : modifyMode === 'SL' ? stopLossVal || 'Not Set' : trailingStopVal === '0' || !trailingStopVal ? 'Disabled' : trailingStopVal
                    }, void 0, false, {
                      fileName: _jsxFileName,
                      lineNumber: 942,
                      columnNumber: 23
                    }, this)
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 941,
                    columnNumber: 21
                  }, this), pnlDisplay && /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                    style: {
                      color: pnlDisplay.color,
                      fontSize: 11,
                      fontWeight: '700',
                      marginTop: 6,
                      textAlign: 'center',
                      paddingHorizontal: 4
                    },
                    children: pnlDisplay.text
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 954,
                    columnNumber: 21
                  }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                    style: {
                      color: colors.textMuted,
                      fontSize: 8,
                      marginTop: 8,
                      letterSpacing: 0.5
                    },
                    children: "Drag to Rotate Dial"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 959,
                    columnNumber: 19
                  }, this)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 893,
                  columnNumber: 17
                }, this)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 860,
                columnNumber: 15
              }, this)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 859,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
              style: {
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
                marginTop: 12
              },
              children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
                onPress: () => adjustValue('down'),
                style: {
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                  justifyContent: 'center',
                  alignItems: 'center'
                },
                children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                  style: {
                    color: colors.text,
                    fontSize: 20,
                    fontWeight: 'bold'
                  },
                  children: "-"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 972,
                  columnNumber: 17
                }, this)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 968,
                columnNumber: 15
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
                onPress: () => {
                  if (modifyMode === 'TP') setTakeProfitVal('');else if (modifyMode === 'SL') setStopLossVal('');else if (modifyMode === 'TS') setTrailingStopVal('');
                },
                style: {
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderWidth: 1,
                  borderColor: colors.glassBorder
                },
                children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                  style: {
                    color: colors.textMuted,
                    fontSize: 12,
                    fontWeight: 'bold'
                  },
                  children: modifyMode === 'TS' ? 'Disable TS' : 'Clear Target'
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 983,
                  columnNumber: 17
                }, this)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 975,
                columnNumber: 15
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
                onPress: () => adjustValue('up'),
                style: {
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                  justifyContent: 'center',
                  alignItems: 'center'
                },
                children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                  style: {
                    color: colors.text,
                    fontSize: 20,
                    fontWeight: 'bold'
                  },
                  children: "+"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 992,
                  columnNumber: 17
                }, this)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 988,
                columnNumber: 15
              }, this)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 967,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
              style: [styles.modalExecuteBtn, {
                backgroundColor: colors.primary,
                marginTop: 24
              }],
              onPress: handleModifyPosition,
              children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: styles.modalExecuteBtnText,
                children: "Modify Position"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1001,
                columnNumber: 15
              }, this)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 997,
              columnNumber: 13
            }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
              onPress: () => setIsModifyModalOpen(false),
              style: {
                marginTop: 16,
                alignSelf: 'center',
                padding: 8
              },
              children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: {
                  color: colors.textMuted,
                  fontWeight: 'bold'
                },
                children: "Cancel"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1005,
                columnNumber: 15
              }, this)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1004,
              columnNumber: 13
            }, this)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 826,
            columnNumber: 11
          }, this)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 825,
          columnNumber: 9
        }, this)
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 824,
        columnNumber: 7
      }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Modal.default, {
        visible: isAddAccountModalOpen,
        animationType: "slide",
        transparent: true,
        onRequestClose: () => setIsAddAccountModalOpen(false),
        children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
          activeOpacity: 1,
          style: styles.bottomSheetOverlay,
          onPress: () => setIsAddAccountModalOpen(false),
          children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
            activeOpacity: 1,
            style: {
              width: '100%'
            },
            children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(BlurView.default, {
              experimentalBlurMethod: "regular",
              intensity: 100,
              tint: colors.blurTint,
              style: [styles.bottomSheetContent, {
                backgroundColor: Platform.default.OS === 'web' ? (isDark ? 'rgba(10, 14, 23, 0.7)' : 'rgba(255, 255, 255, 0.75)') : (isDark ? '#000000' : '#FFFFFF'),
                borderWidth: 1,
                borderColor: Platform.default.OS === 'web' ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)') : (isDark ? '#222222' : '#dddddd')
              }],
              ...Platform.default.select({
                web: {
                  className: 'premium-glass-heavy'
                },
                default: {}
              }),
              children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
                style: styles.bottomSheetHandle
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1010,
                columnNumber: 15
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                style: [styles.bottomSheetTitle, {
                  color: colors.text
                }],
                children: "Add Account"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1011,
                columnNumber: 15
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
                onPress: () => {
                  setIsAddAccountModalOpen(false);
                  navigation.navigate('ToolsHub', {
                    subScreen: 'demo_account',
                    referrer: 'Positions'
                  });
                },
                style: [styles.bottomSheetOption, {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'
                }],
                children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
                  style: [styles.bottomSheetIconContainer, {
                    backgroundColor: 'rgba(245, 158, 11, 0.15)'
                  }],
                  children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_lucideReactNative.UserPlus, {
                    color: "#F59E0B",
                    size: 24
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1013,
                    columnNumber: 19
                  }, this)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 1012,
                  columnNumber: 17
                }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
                  style: {
                    flex: 1,
                    alignItems: 'flex-start',
                    paddingLeft: 16
                  },
                  children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                    style: [styles.bottomSheetOptionText, {
                      color: colors.text
                    }],
                    children: "Add Demo Account"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1015,
                    columnNumber: 19
                  }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                    style: {
                      color: colors.textMuted,
                      fontSize: 12,
                      marginTop: 2
                    },
                    children: "Practice trading with virtual funds"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1016,
                    columnNumber: 19
                  }, this)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 1014,
                  columnNumber: 18
                }, this)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 1012,
                columnNumber: 16
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(TouchableOpacity.default, {
                onPress: () => {
                  setIsAddAccountModalOpen(false);
                  connectBroker();
                },
                style: [styles.bottomSheetOption, {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'
                }],
                children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
                  style: [styles.bottomSheetIconContainer, {
                    backgroundColor: 'rgba(59, 130, 246, 0.15)'
                  }],
                  children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_lucideReactNative.Link, {
                    color: "#3B82F6",
                    size: 24
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1020,
                    columnNumber: 19
                  }, this)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 1019,
                  columnNumber: 17
                }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
                  style: {
                    flex: 1,
                    alignItems: 'flex-start',
                    paddingLeft: 16
                  },
                  children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                    style: [styles.bottomSheetOptionText, {
                      color: colors.text
                    }],
                    children: "Add Real Account"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1022,
                    columnNumber: 19
                  }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Text.default, {
                    style: {
                      color: colors.textMuted,
                      fontSize: 12,
                      marginTop: 2
                    },
                    children: "Connect your live trading broker account"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 1023,
                    columnNumber: 19
                  }, this)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 1021,
                  columnNumber: 18
                }, this)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 1018,
                columnNumber: 16
              }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
                style: {
                  height: Platform.default.OS === 'ios' ? 40 : 20
                }
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1033,
                columnNumber: 15
              }, this)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 1009,
              columnNumber: 35
            }, this)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 1008,
            columnNumber: 11
          }, this)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 1007,
          columnNumber: 9
        }, this)
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 1006,
        columnNumber: 7
      }, this)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 600,
      columnNumber: 5
    }, this);
  }
  _s(PositionsScreen, "AfrW4OB54u649KggA5+PlrRFd4s=", false, function () {
    return [_themeThemeContext.useTheme, _storeAccountStore.useAccountStore, _reactNavigationNative.useFocusEffect];
  });
  _c = PositionsScreen;
  const createStyles = colors => StyleSheet.default.create({
    safeArea: {
      flex: 1,
      paddingTop: Platform.OS === 'ios' && !ConfigModule.isTelegram ? 47 : (0, _config.getTgSafeAreaTop)()
    },
    glowOrb: {
      display: 'none',
      width: 0,
      height: 0,
      opacity: 0,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold'
    },
    refreshBtn: {
      padding: 8,
      borderRadius: 12
    },
    card: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16
    },
    sideTag: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
      marginRight: 12
    },
    sideTagText: {
      fontWeight: 'bold',
      fontSize: 14
    },
    symbolText: {
      fontSize: 18,
      fontWeight: 'bold'
    },
    statusText: {
      fontSize: 14,
      fontWeight: 'bold'
    },
    detailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16
    },
    detailBox: {
      alignItems: 'flex-start'
    },
    detailLabel: {
      fontSize: 12,
      marginBottom: 4
    },
    detailValue: {
      fontSize: 16,
      fontWeight: 'bold'
    },
    closeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10
    },
    closeBtnText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: 'bold'
    },
    emptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60
    },
    emptyText: {
      fontSize: 16
    },
    recentHeaderContainer: {
      paddingVertical: 12,
      marginTop: 8,
      marginBottom: 8,
      borderBottomWidth: 1
    },
    recentHeaderText: {
      fontSize: 14,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1
    },
    // New MT4 Styles
    closedDetailsContainer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      gap: 8
    },
    closedDetailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    detailValueSmall: {
      fontSize: 14
    },
    accountSummaryCard: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1
    },
    accountSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4
    },
    accountSummaryLabel: {
      fontSize: 14,
      fontWeight: '500'
    },
    accountSummaryValue: {
      fontSize: 15,
      fontWeight: 'bold'
    },
    // Tab and Filter Styles
    tabSwitcher: {
      flexDirection: 'row',
      borderRadius: 12,
      padding: 4
    },
    tabBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8
    },
    tabBtnText: {
      fontSize: 14,
      fontWeight: 'bold'
    },
    historyFilters: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8
    },
    filterBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1
    },
    filterBtnText: {
      fontSize: 13
    },
    // Upgraded Positions system styles
    actionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 16,
      gap: 12
    },
    actionHeaderBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center'
    },
    cardButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8
    },
    rowBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row'
    },
    rowBtnText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: 'bold'
    },
    // Bottom Sheet Styles
    bottomSheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end'
    },
    bottomSheetContent: {
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      paddingTop: 12,
      width: '100%',
      overflow: 'hidden'
    },
    bottomSheetHandle: {
      width: 40,
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 20
    },
    bottomSheetTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 24
    },
    bottomSheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)'
    },
    bottomSheetIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center'
    },
    bottomSheetOptionText: {
      fontSize: 16,
      fontWeight: '700'
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center'
    },
    modalContent: {
      alignSelf: 'center',
      width: '90%',
      maxHeight: '80%',
      padding: 24,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden'
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '900',
      textAlign: 'center',
      marginBottom: 8
    },
    modalInputLabel: {
      fontSize: 12,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6
    },
    modalInput: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      marginBottom: 16,
      width: '100%'
    },
    quickSelectRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
      marginBottom: 8,
      width: '100%'
    },
    quickSelectBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1
    },
    modalExecuteBtn: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center'
    },
    modalExecuteBtnText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '900'
    }
  });
  var _c;
  $RefreshReg$(_c, "PositionsScreen");
}

const exportsMock = {};
const moduleMock = { exports: exportsMock };

runPositionsModule(
  global,
  requireMock,
  (x) => x && x.__esModule ? x.default : x,
  (x) => x,
  moduleMock,
  exportsMock,
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
);

export default exportsMock.default;

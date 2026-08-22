// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, SectionList, TouchableOpacity, SafeAreaView, Platform, Image, Modal, ScrollView, FlatList, Animated, NativeScrollEvent, NativeSyntheticEvent, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { Text, TextInput } from '../components/Typography';
;
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { ChevronDown, Plus, AlignLeft, TrendingUp, TrendingDown, Search, X, Trash2, Edit3, Star, Moon, Sun, Palette, Gift, User, Settings, ArrowRight, Newspaper, Lock } from 'lucide-react-native';
import io from 'socket.io-client';
// expo-blur removed: native module crashes on Android SDK 54
import BlurView from '../components/GlassView';
import CustomBlurModal from '../components/CustomBlurModal';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useTheme } from '../theme/ThemeContext';
import { BACKEND_URL, isTelegram, getTgSafeAreaTop } from '../config';
import AccountSwitcher from '../components/AccountSwitcher';
import { SvgXml } from 'react-native-svg';
import { SVG_ICONS } from '../components/SvgIcons';
import { getItemAsync, setItemAsync } from '../utils/storage';
import ToolsHubScreen from './ToolsHubScreen';
import LottieView from 'lottie-react-native';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

function cleanSvgXml(xml: string): string {
    if (!xml) return '';
    const svgStartCloseIndex = xml.indexOf('>');
    if (svgStartCloseIndex === -1) return xml;
    
    let svgTag = xml.substring(0, svgStartCloseIndex + 1);
    const rest = xml.substring(svgStartCloseIndex + 1);
    
    if (!svgTag.includes('viewBox=')) {
        const wMatch = svgTag.match(/width="(\d+)"/);
        const hMatch = svgTag.match(/height="(\d+)"/);
        const w = wMatch ? wMatch[1] : '56';
        const h = hMatch ? hMatch[1] : '56';
        svgTag = svgTag.replace('<svg', `<svg viewBox="0 0 ${w} ${h}"`);
    }
    
    svgTag = svgTag.replace(/width="[^"]+"/, 'width="100%"');
    svgTag = svgTag.replace(/height="[^"]+"/, 'height="100%"');
    
    return svgTag + rest;
}

function AssetLogo({ symbol, logoColor, logoBadge, size = 28 }: { symbol: string; logoColor?: string; logoBadge?: string; size?: number }) {
    const s = symbol.toUpperCase();
    
    // 1. Forex overlapping flag icons
    if (s.includes('/') && !s.endsWith('/USDT') && !s.endsWith('/BTC')) {
        const parts = s.split('/');
        const first = parts[0];
        const second = parts[1];
        
        const currencyMap: Record<string, string> = {
            EUR: 'eu', USD: 'us', GBP: 'gb', JPY: 'jp', CAD: 'ca', CHF: 'ch', AUD: 'au', NZD: 'nz'
        };
        
        const code1 = currencyMap[first] || first.substring(0, 2).toLowerCase();
        const code2 = currencyMap[second] || second.substring(0, 2).toLowerCase();
        
        const uri1 = `https://flagcdn.com/w80/${code1}.png`;
        const uri2 = `https://flagcdn.com/w80/${code2}.png`;
        
        return (
            <View style={{ width: size + 6, height: size, position: 'relative', marginRight: 8 }}>
                <Image source={{ uri: uri1 }} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, position: 'absolute', left: 0, top: 2, zIndex: 2, borderWidth: 1.5, borderColor: '#000000' }} />
                <Image source={{ uri: uri2 }} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, position: 'absolute', right: 0, bottom: 2, zIndex: 1, borderWidth: 1.5, borderColor: '#000000' }} />
            </View>
        );
    }
    
    // 2. Crypto logos from CoinGecko / GitHub raw CDN
    const cryptoUris: Record<string, string> = {
        'BTC/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png',
        'ETH/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png',
        'SOL/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/sol.png',
        'BNB/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/bnb.png',
        'XRP/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/xrp.png',
        'ADA/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/ada.png',
        'DOGE/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/doge.png',
        'AVAX/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/avax.png',
        'LINK/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/link.png',
        'DOT/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/dot.png',
        'MATIC/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/matic.png',
        'SHIB/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/shib.png',
        'LTC/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/ltc.png',
        'TRX/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/trx.png',
        'UNI/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/uni.png',
        'TON/USDT': 'https://assets.coingecko.com/coins/images/17980/large/ton_token_blue.png',
        'NOT/USDT': 'https://assets.coingecko.com/coins/images/37859/large/notcoin.png',
        'PEPE/USDT': 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.png'
    };
    
    if (cryptoUris[s]) {
        const uri = cryptoUris[s];
        return (
            <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1E222D', overflow: 'hidden', marginRight: 8, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            </View>
        );
    }
    
    // 3. Traditional stock/index/future SVGs from local SvgIcons.ts
    const svgMap: Record<string, string> = {
        'SPX': 's-and-p-500',
        'NDQ': 'nasdaq-100',
        'DJI': 'dow-30',
        'VIX': 'volatility-s-and-p-500',
        'DXY': 'US',
        
        'AAPL': 'apple',
        'MSFT': 'microsoft',
        'NVDA': 'nvidia',
        'GOOGL': 'alphabet',
        'AMZN': 'amazon',
        'TSLA': 'tesla',
        'NFLX': 'apple', // fallback
        'META': 'meta-platforms',
        'AMD': 'advanced-micro-devices',
        'INTC': 'intel',
        
        'USOIL': 'crude-oil',
        'GOLD': 'gold',
        'SILVER': 'silver',
        'HG=F': 'copper',
        'NG=F': 'natural-gas',
        'PL=F': 'platinum'
    };
    
    const iconName = svgMap[s];
    if (iconName && SVG_ICONS[iconName]) {
        const xml = cleanSvgXml(SVG_ICONS[iconName]);
        return (
            <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', marginRight: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E222D' }}>
                <SvgXml xml={xml} width="100%" height="100%" />
            </View>
        );
    }
    
    return (
        <View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: logoColor || '#3B82F6',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 8
        }}>
            <Text style={{ color: '#FFFFFF', fontSize: size * 0.45, fontWeight: 'bold' }}>
                {logoBadge || s.substring(0, 2)}
            </Text>
        </View>
    );
}

const INITIAL_WATCHLIST_DATA = [
    {
        title: 'Metals',
        data: [
            { id: '10', symbol: 'GOLD', name: 'CFDs on Gold (US$ / OZ)', price: '...', change: '...', changePct: '...', logoBadge: 'Au', logoColor: '#B68925' },
            { id: '30', symbol: 'SILVER', name: 'CFDs on Silver (US$ / OZ)', price: '...', change: '...', changePct: '...', logoBadge: 'Ag', logoColor: '#C0C0C0' },
            { id: '9', symbol: 'USOIL', name: 'CFDs on WTI Crude Oil', price: '...', change: '...', changePct: '...', logoBadge: '🛢', logoColor: '#1A1D24' },
            { id: '31', symbol: 'HG=F', name: 'CFDs on Copper', price: '...', change: '...', changePct: '...', logoBadge: 'Cu', logoColor: '#B87333' },
            { id: '33', symbol: 'PL=F', name: 'CFDs on Platinum', price: '...', change: '...', changePct: '...', logoBadge: 'Pt', logoColor: '#E5E4E2' },
            { id: '34', symbol: 'PA=F', name: 'CFDs on Palladium', price: '...', change: '...', changePct: '...', logoBadge: 'Pd', logoColor: '#A9B0B7' },
            { id: '32', symbol: 'NG=F', name: 'CFDs on Natural Gas', price: '...', change: '...', changePct: '...', logoBadge: 'NG', logoColor: '#303030' },
        ]
    },
    {
        title: 'Crypto',
        data: [
            { id: '11', symbol: 'BTC/USDT', name: 'Bitcoin', price: '...', change: '...', changePct: '...', logoBadge: '?', logoColor: '#F7931A' },
            { id: '12', symbol: 'ETH/USDT', name: 'Ethereum', price: '...', change: '...', changePct: '...', logoBadge: '?', logoColor: '#627EEA' },
            { id: '13', symbol: 'SOL/USDT', name: 'Solana', price: '...', change: '...', changePct: '...', logoBadge: 'S', logoColor: '#14F195' },
            { id: '14', symbol: 'BNB/USDT', name: 'BNB', price: '...', change: '...', changePct: '...', logoBadge: 'B', logoColor: '#F3BA2F' },
            { id: '15', symbol: 'XRP/USDT', name: 'XRP', price: '...', change: '...', changePct: '...', logoBadge: 'X', logoColor: '#23292F' },
            { id: '16', symbol: 'ADA/USDT', name: 'Cardano', price: '...', change: '...', changePct: '...', logoBadge: 'A', logoColor: '#0033AD' },
            { id: '17', symbol: 'DOGE/USDT', name: 'Dogecoin', price: '...', change: '...', changePct: '...', logoBadge: 'Ð', logoColor: '#C2A633' },
            { id: '18', symbol: 'AVAX/USDT', name: 'Avalanche', price: '...', change: '...', changePct: '...', logoBadge: 'A', logoColor: '#E84142' },
            { id: '19', symbol: 'LINK/USDT', name: 'Chainlink', price: '...', change: '...', changePct: '...', logoBadge: 'L', logoColor: '#2A5ADA' },
            { id: '20', symbol: 'DOT/USDT', name: 'Polkadot', price: '...', change: '...', changePct: '...', logoBadge: 'P', logoColor: '#E6007A' },
            { id: '21', symbol: 'MATIC/USDT', name: 'Polygon', price: '...', change: '...', changePct: '...', logoBadge: 'M', logoColor: '#8247E5' },
            { id: '22', symbol: 'SHIB/USDT', name: 'Shiba Inu', price: '...', change: '...', changePct: '...', logoBadge: 'S', logoColor: '#E1B303' },
            { id: '23', symbol: 'LTC/USDT', name: 'Litecoin', price: '...', change: '...', changePct: '...', logoBadge: 'L', logoColor: '#345D9D' },
            { id: '24', symbol: 'TRX/USDT', name: 'TRON', price: '...', change: '...', changePct: '...', logoBadge: 'T', logoColor: '#FF6431' },
            { id: '25', symbol: 'UNI/USDT', name: 'Uniswap', price: '...', change: '...', changePct: '...', logoBadge: 'U', logoColor: '#FF007A' },
            { id: '251', symbol: 'TON/USDT', name: 'Toncoin', price: '...', change: '...', changePct: '...', logoBadge: 'T', logoColor: '#0088CC' },
            { id: '252', symbol: 'NOT/USDT', name: 'Notcoin', price: '...', change: '...', changePct: '...', logoBadge: 'N', logoColor: '#000000' },
            { id: '253', symbol: 'PEPE/USDT', name: 'Pepe', price: '...', change: '...', changePct: '...', logoBadge: 'P', logoColor: '#00FF00' },
        ]
    },
    {
        title: 'Forex',
        data: [
            { id: 'f1', symbol: 'EUR/USD', name: 'Euro / US Dollar', price: '...', change: '...', changePct: '...', logoBadge: 'EU', logoColor: '#0052B4' },
            { id: 'f2', symbol: 'GBP/USD', name: 'Great Britain Pound / US Dollar', price: '...', change: '...', changePct: '...', logoBadge: 'GB', logoColor: '#00247D' },
            { id: 'f3', symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', price: '...', change: '...', changePct: '...', logoBadge: 'JP', logoColor: '#BC002D' },
            { id: 'f4', symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', price: '...', change: '...', changePct: '...', logoBadge: 'CA', logoColor: '#FF0000' },
            { id: 'f5', symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', price: '...', change: '...', changePct: '...', logoBadge: 'CH', logoColor: '#D52B1E' },
            { id: 'f6', symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', price: '...', change: '...', changePct: '...', logoBadge: 'AU', logoColor: '#00008B' },
            { id: 'f7', symbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar', price: '...', change: '...', changePct: '...', logoBadge: 'NZ', logoColor: '#00247D' },
            { id: 'f8', symbol: 'EUR/GBP', name: 'Euro / Great Britain Pound', price: '...', change: '...', changePct: '...', logoBadge: 'EG', logoColor: '#0052B4' },
            { id: 'f9', symbol: 'EUR/JPY', name: 'Euro / Japanese Yen', price: '...', change: '...', changePct: '...', logoBadge: 'EJ', logoColor: '#0052B4' },
            { id: 'f10', symbol: 'GBP/JPY', name: 'Great Britain Pound / Japanese Yen', price: '...', change: '...', changePct: '...', logoBadge: 'GJ', logoColor: '#00247D' },
        ]
    },
    {
        title: 'Indices',
        data: [
            { id: '1', symbol: 'SPX', name: 'S&P 500 Index', price: '...', change: '...', changePct: '...', logoBadge: '500', logoColor: '#1A1D24' },
            { id: '2', symbol: 'NDQ', name: 'US 100 Index', price: '...', change: '...', changePct: '...', logoBadge: '100', logoColor: '#1A1D24' },
            { id: '3', symbol: 'DJI', name: 'Dow Jones Industrial Average Index', price: '...', change: '...', changePct: '...', logoBadge: '30', logoColor: '#1A1D24' },
            { id: '4', symbol: 'VIX', name: 'Volatility S&P 500 Index', price: '...', change: '...', changePct: '...', logoBadge: 'V', logoColor: '#1A1D24', tag: 'D' },
            { id: '5', symbol: 'DXY', name: 'U.S. Dollar Currency Index', price: '...', change: '...', changePct: '...', logoBadge: '$', logoColor: '#22C55E' },
            { id: 'idx_dax', symbol: 'DAX', name: 'German DAX Index', price: '...', change: '...', changePct: '...', logoBadge: 'DAX', logoColor: '#1A1D24' },
            { id: 'idx_ftse', symbol: 'FTSE', name: 'UK FTSE 100 Index', price: '...', change: '...', changePct: '...', logoBadge: 'FTSE', logoColor: '#1A1D24' },
            { id: 'idx_n225', symbol: 'N225', name: 'Japan Nikkei 225 Index', price: '...', change: '...', changePct: '...', logoBadge: 'N225', logoColor: '#1A1D24' },
        ]
    },
    {
        title: 'Stocks',
        data: [
            { id: '6', symbol: 'AAPL', name: 'Apple Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'A', logoColor: '#3B82F6' },
            { id: '26', symbol: 'MSFT', name: 'Microsoft Corp.', price: '...', change: '...', changePct: '...', logoBadge: 'M', logoColor: '#22C55E' },
            { id: '27', symbol: 'NVDA', name: 'NVIDIA Corp.', price: '...', change: '...', changePct: '...', logoBadge: 'N', logoColor: '#22C55E' },
            { id: '28', symbol: 'GOOGL', name: 'Alphabet Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'G', logoColor: '#EF4444' },
            { id: '29', symbol: 'AMZN', name: 'Amazon.com Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'a', logoColor: '#1A1D24' },
            { id: '7', symbol: 'TSLA', name: 'Tesla, Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'T', logoColor: '#EF4444' },
            { id: '8', symbol: 'NFLX', name: 'Netflix, Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'N', logoColor: '#EF4444' },
            { id: '81', symbol: 'META', name: 'Meta Platforms, Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'M', logoColor: '#0668E1' },
            { id: '82', symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'A', logoColor: '#000000' },
            { id: '83', symbol: 'INTC', name: 'Intel Corporation', price: '...', change: '...', changePct: '...', logoBadge: 'I', logoColor: '#0071C5' },
            { id: '84', symbol: 'COIN', name: 'Coinbase Global, Inc.', price: '...', change: '...', changePct: '...', logoBadge: 'C', logoColor: '#0052FF' },
            { id: '85', symbol: 'BABA', name: 'Alibaba Group Holding Ltd.', price: '...', change: '...', changePct: '...', logoBadge: 'B', logoColor: '#FF6A00' },
        ]
    }
];

const MASTER_ASSETS = [
    {
        title: 'Metals',
        data: [
            { id: '10', symbol: 'GOLD', name: 'Gold (US$ / OZ)', logoBadge: 'Au', logoColor: '#B68925' },
            { id: '30', symbol: 'SILVER', name: 'Silver (US$ / OZ)', logoBadge: 'Ag', logoColor: '#C0C0C0' },
            { id: '9', symbol: 'USOIL', name: 'WTI Crude Oil', logoBadge: '🛢', logoColor: '#1A1D24' },
            { id: '31', symbol: 'HG=F', name: 'Copper', logoBadge: 'Cu', logoColor: '#B87333' },
            { id: '33', symbol: 'PL=F', name: 'Platinum', logoBadge: 'Pt', logoColor: '#E5E4E2' },
            { id: '34', symbol: 'PA=F', name: 'Palladium', logoBadge: 'Pd', logoColor: '#A9B0B7' },
            { id: '32', symbol: 'NG=F', name: 'Natural Gas', logoBadge: 'NG', logoColor: '#303030' },
        ]
    },
    {
        title: 'Crypto',
        data: [
            { id: '11', symbol: 'BTC/USDT', name: 'Bitcoin', logoBadge: '?', logoColor: '#F7931A' },
            { id: '12', symbol: 'ETH/USDT', name: 'Ethereum', logoBadge: '?', logoColor: '#627EEA' },
            { id: '13', symbol: 'SOL/USDT', name: 'Solana', logoBadge: 'S', logoColor: '#14F195' },
            { id: '14', symbol: 'BNB/USDT', name: 'BNB', logoBadge: 'B', logoColor: '#F3BA2F' },
            { id: '15', symbol: 'XRP/USDT', name: 'XRP', logoBadge: 'X', logoColor: '#23292F' },
            { id: '16', symbol: 'ADA/USDT', name: 'Cardano', logoBadge: 'A', logoColor: '#0033AD' },
            { id: '17', symbol: 'DOGE/USDT', name: 'Dogecoin', logoBadge: 'Ð', logoColor: '#C2A633' },
            { id: '18', symbol: 'AVAX/USDT', name: 'Avalanche', logoBadge: 'A', logoColor: '#E84142' },
            { id: '19', symbol: 'LINK/USDT', name: 'Chainlink', logoBadge: 'L', logoColor: '#2A5ADA' },
            { id: '20', symbol: 'DOT/USDT', name: 'Polkadot', logoBadge: 'P', logoColor: '#E6007A' },
            { id: '21', symbol: 'MATIC/USDT', name: 'Polygon', logoBadge: 'M', logoColor: '#8247E5' },
            { id: '22', symbol: 'SHIB/USDT', name: 'Shiba Inu', logoBadge: 'S', logoColor: '#E1B303' },
            { id: '23', symbol: 'LTC/USDT', name: 'Litecoin', logoBadge: 'L', logoColor: '#345D9D' },
            { id: '24', symbol: 'TRX/USDT', name: 'TRON', logoBadge: 'T', logoColor: '#FF6431' },
            { id: '25', symbol: 'UNI/USDT', name: 'Uniswap', logoBadge: 'U', logoColor: '#FF007A' },
            { id: '251', symbol: 'TON/USDT', name: 'Toncoin', logoBadge: 'T', logoColor: '#0088CC' },
            { id: '252', symbol: 'NOT/USDT', name: 'Notcoin', logoBadge: 'N', logoColor: '#000000' },
            { id: '253', symbol: 'PEPE/USDT', name: 'Pepe', logoBadge: 'P', logoColor: '#00FF00' },
        ]
    },
    {
        title: 'Forex',
        data: [
            { id: 'f1', symbol: 'EUR/USD', name: 'Euro / US Dollar', logoBadge: 'EU', logoColor: '#0052B4' },
            { id: 'f2', symbol: 'GBP/USD', name: 'Great Britain Pound / US Dollar', logoBadge: 'GB', logoColor: '#00247D' },
            { id: 'f3', symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', logoBadge: 'JP', logoColor: '#BC002D' },
            { id: 'f4', symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', logoBadge: 'CA', logoColor: '#FF0000' },
            { id: 'f5', symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', logoBadge: 'CH', logoColor: '#D52B1E' },
            { id: 'f6', symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', logoBadge: 'AU', logoColor: '#00008B' },
            { id: 'f7', symbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar', logoBadge: 'NZ', logoColor: '#00247D' },
            { id: 'f8', symbol: 'EUR/GBP', name: 'Euro / Great Britain Pound', logoBadge: 'EG', logoColor: '#0052B4' },
            { id: 'f9', symbol: 'EUR/JPY', name: 'Euro / Japanese Yen', logoBadge: 'EJ', logoColor: '#0052B4' },
            { id: 'f10', symbol: 'GBP/JPY', name: 'Great Britain Pound / Japanese Yen', logoBadge: 'GJ', logoColor: '#00247D' },
        ]
    },
    {
        title: 'Indices',
        data: [
            { id: '1', symbol: 'SPX', name: 'S&P 500 Index', logoBadge: '500', logoColor: '#1A1D24' },
            { id: '2', symbol: 'NDQ', name: 'US 100 Index', logoBadge: '100', logoColor: '#1A1D24' },
            { id: '3', symbol: 'DJI', name: 'Dow Jones Industrial Average Index', logoBadge: '30', logoColor: '#1A1D24' },
            { id: '4', symbol: 'VIX', name: 'Volatility S&P 500 Index', logoBadge: 'V', logoColor: '#1A1D24', tag: 'D' },
            { id: '5', symbol: 'DXY', name: 'U.S. Dollar Currency Index', logoBadge: '$', logoColor: '#22C55E' },
            { id: 'idx_dax', symbol: 'DAX', name: 'German DAX Index', logoBadge: 'DAX', logoColor: '#1A1D24' },
            { id: 'idx_ftse', symbol: 'FTSE', name: 'UK FTSE 100 Index', logoBadge: 'FTSE', logoColor: '#1A1D24' },
            { id: 'idx_n225', symbol: 'N225', name: 'Japan Nikkei 225 Index', logoBadge: 'N225', logoColor: '#1A1D24' },
        ]
    },
    {
        title: 'Stocks',
        data: [
            { id: '6', symbol: 'AAPL', name: 'Apple Inc.', logoBadge: 'A', logoColor: '#3B82F6' },
            { id: '26', symbol: 'MSFT', name: 'Microsoft Corp.', logoBadge: 'M', logoColor: '#22C55E' },
            { id: '27', symbol: 'NVDA', name: 'NVIDIA Corp.', logoBadge: 'N', logoColor: '#22C55E' },
            { id: '28', symbol: 'GOOGL', name: 'Alphabet Inc.', logoBadge: 'G', logoColor: '#EF4444' },
            { id: '29', symbol: 'AMZN', name: 'Amazon.com Inc.', logoBadge: 'a', logoColor: '#1A1D24' },
            { id: '7', symbol: 'TSLA', name: 'Tesla, Inc.', logoBadge: 'T', logoColor: '#EF4444' },
            { id: '8', symbol: 'NFLX', name: 'Netflix, Inc.', logoBadge: 'N', logoColor: '#EF4444' },
            { id: '81', symbol: 'META', name: 'Meta Platforms, Inc.', logoBadge: 'M', logoColor: '#0668E1' },
            { id: '82', symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', logoBadge: 'A', logoColor: '#000000' },
            { id: '83', symbol: 'INTC', name: 'Intel Corporation', logoBadge: 'I', logoColor: '#0071C5' },
            { id: '84', symbol: 'COIN', name: 'Coinbase Global, Inc.', logoBadge: 'C', logoColor: '#0052FF' },
            { id: '85', symbol: 'BABA', name: 'Alibaba Group Holding Ltd.', logoBadge: 'B', logoColor: '#FF6A00' },
        ]
    }
];

const avatars = {
    default: require('../../assets/avatars/default.png'),
    dbz_trunks_01: require('../../assets/avatars/dbz-trunks-pfp-01.jpg'),
    dbz_trunks_02: require('../../assets/avatars/dbz-trunks-pfp-02.jpg'),
    dbz_trunks_03: require('../../assets/avatars/dbz-trunks-pfp-03.jpg'),
    dbz_trunks_08: require('../../assets/avatars/dbz-trunks-pfp-08.jpg'),
    dbz_trunks_10: require('../../assets/avatars/dbz-trunks-pfp-10.jpg'),
    dbz_trunks_11: require('../../assets/avatars/dbz-trunks-pfp-11.jpg'),
    dbz_trunks_12: require('../../assets/avatars/dbz-trunks-pfp-12.jpg'),
    dbz_trunks_19: require('../../assets/avatars/dbz-trunks-pfp-19.jpg'),
    dbz_trunks_21: require('../../assets/avatars/dbz-trunks-pfp-21.jpg'),
    dbz_trunks_26: require('../../assets/avatars/dbz-trunks-pfp-26.jpg'),
    dbz_trunks_35: require('../../assets/avatars/dbz-trunks-pfp-35.jpg'),
    dbz_trunks_38: require('../../assets/avatars/dbz-trunks-pfp-38.jpg'),
    dbz_trunks_45: require('../../assets/avatars/dbz-trunks-pfp-45.jpg'),
    dbz_trunks_48: require('../../assets/avatars/dbz-trunks-pfp-48.jpg'),
    gwenpool_01: require('../../assets/avatars/gwenpool-pfp-01.jpg'),
    gwenpool_02: require('../../assets/avatars/gwenpool-pfp-02.jpg'),
    gwenpool_03: require('../../assets/avatars/gwenpool-pfp-03.jpg'),
    gwenpool_05: require('../../assets/avatars/gwenpool-pfp-05.jpg'),
    gwenpool_08: require('../../assets/avatars/gwenpool-pfp-08.jpg'),
    gwenpool_10: require('../../assets/avatars/gwenpool-pfp-10.jpg'),
    gwenpool_11: require('../../assets/avatars/gwenpool-pfp-11.jpg'),
    gwenpool_12: require('../../assets/avatars/gwenpool-pfp-12.jpg'),
    gwenpool_16: require('../../assets/avatars/gwenpool-pfp-16.jpg'),
    gwenpool_17: require('../../assets/avatars/gwenpool-pfp-17.jpg'),
    gwenpool_18: require('../../assets/avatars/gwenpool-pfp-18.jpg'),
    gwenpool_19: require('../../assets/avatars/gwenpool-pfp-19.jpg'),
    gwenpool_23: require('../../assets/avatars/gwenpool-pfp-23.jpg'),
    gwenpool_24: require('../../assets/avatars/gwenpool-pfp-24.jpg'),
    gwenpool_25: require('../../assets/avatars/gwenpool-pfp-25.jpg'),
    gwenpool_27: require('../../assets/avatars/gwenpool-pfp-27.jpg'),
    gwenpool_29: require('../../assets/avatars/gwenpool-pfp-29.jpg'),
    gwenpool_35: require('../../assets/avatars/gwenpool-pfp-35.jpg')
};

const getAvatarSource = (avatarUrl: string | null) => {
    if (!avatarUrl || avatarUrl === 'default') return avatars.default;
    if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        return { uri: avatarUrl };
    }
    return avatars[avatarUrl as keyof typeof avatars] || avatars.default;
};

const MOCK_NEWS_EVENTS = [
    { id: 1, event: 'Core Retail Sales m/m', country: 'USD', impact: 'HIGH', time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), forecast: '0.2%', previous: '0.1%' },
    { id: 2, event: 'CPI m/m', country: 'EUR', impact: 'HIGH', time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), forecast: '2.4%', previous: '2.6%' },
    { id: 3, event: 'FOMC Press Conference', country: 'USD', impact: 'HIGH', time: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), forecast: '—', previous: '—' },
    { id: 4, event: 'GDP m/m', country: 'GBP', impact: 'MEDIUM', time: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), forecast: '0.1%', previous: '0.0%' },
    { id: 5, event: 'Unemployment Claims', country: 'USD', impact: 'MEDIUM', time: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(), forecast: '215K', previous: '218K' }
];

const formatEventTime = (timeStr: string) => {
    try {
        const date = new Date(timeStr);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        if (diffMs < 0) return 'Passed';
        
        const diffMins = Math.floor(diffMs / (60 * 1000));
        if (diffMins < 60) return `in ${diffMins}m`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `in ${diffHours}h`;
        
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return '—';
    }
};

// All available symbols for search
const ALL_SYMBOLS = INITIAL_WATCHLIST_DATA.flatMap(s => s.data);

export default function WatchlistScreen() {
    const { colors, isDark, toggleTheme } = useTheme();
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const [watchlistData, setWatchlistData] = useState(INITIAL_WATCHLIST_DATA);
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const [headerTab, setHeaderTab] = useState<'watchlist' | 'community'>('watchlist');
    const [isChatActive, setIsChatActive] = useState(false);


    // Add Asset state
    const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
    const [addAssetSearchQuery, setAddAssetSearchQuery] = useState('');
    const [activeSymbols, setActiveSymbols] = useState<string[]>(() => {
        return [
            // Metals
            'GOLD', 'SILVER', 'HG=F', 'PL=F', 'USOIL',
            // Crypto
            'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'TON/USDT', 'DOGE/USDT',
            // Forex
            'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'EUR/GBP', 'GBP/JPY',
            // Indices
            'SPX', 'NDQ', 'DJI', 'DXY', 'DAX', 'FTSE',
            // Stocks
            'AAPL', 'TSLA', 'MSFT', 'NVDA', 'GOOGL', 'META'
        ];
    });
    const [collapsedAddAssetSections, setCollapsedAddAssetSections] = useState<Record<string, boolean>>({});
    const activeSymbolsRef = useRef(activeSymbols);
    const prevActiveSymbolsRef = useRef<string[]>([]);
    const socketRef = useRef<any>(null);

    const [userProfile, setUserProfile] = useState<any>(null);
    const [newsEvents, setNewsEvents] = useState<any[]>([]);

    const loadUserProfile = async () => {
        try {
            const cached = await getItemAsync('tg_cached_profile');
            if (cached) {
                setUserProfile(JSON.parse(cached));
            }
            const token = await getItemAsync('accessToken');
            if (token) {
                const res = await axios.get(`${BACKEND_URL}/api/v1/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data?.success && res.data.data) {
                    setUserProfile(res.data.data);
                    await setItemAsync('tg_cached_profile', JSON.stringify(res.data.data));
                }
            }
        } catch (err) {
            console.log('Failed to load user profile in WatchlistScreen', err);
        }
    };

    const loadNewsEvents = async () => {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/v1/tools/calendar`);
            if (res.data?.success && res.data.data && res.data.data.length > 0) {
                setNewsEvents(res.data.data.slice(0, 5));
            } else {
                setNewsEvents(MOCK_NEWS_EVENTS);
            }
        } catch (err) {
            console.log('Failed to load news events, using fallback', err);
            setNewsEvents(MOCK_NEWS_EVENTS);
        }
    };

    useEffect(() => {
        if (isFocused) {
            loadUserProfile();
        }
    }, [isFocused]);

    useEffect(() => {
        loadNewsEvents();
    }, []);

    useEffect(() => {
        activeSymbolsRef.current = activeSymbols;
    }, [activeSymbols]);

    useEffect(() => {
        const loadActiveSymbols = async () => {
            try {
                const saved = await getItemAsync('active_symbols');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setActiveSymbols(parsed);
                    }
                }
            } catch (err) {
                console.log('Failed to load active symbols', err);
            }
        };
        loadActiveSymbols();
    }, []);

    const saveActiveSymbols = async (symbols: string[]) => {
        try {
            await setItemAsync('active_symbols', JSON.stringify(symbols));
        } catch (err) {
            console.log('Failed to save active symbols', err);
        }
    };

    const toggleAssetActive = (symbol: string) => {
        setActiveSymbols(prev => {
            let next;
            if (prev.includes(symbol)) {
                next = prev.filter(s => s !== symbol);
            } else {
                next = [...prev, symbol];
            }
            saveActiveSymbols(next);
            return next;
        });
    };

    const toggleAddAssetSection = (title: string) => {
        setCollapsedAddAssetSections(prev => ({ ...prev, [title]: !prev[title] }));
    };

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isHeaderHidden, setIsHeaderHidden] = useState(false);
    
    // Drawer state
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const drawerWidth = Math.min(280, Dimensions.get('window').width * 0.55);
    const drawerAnim = useRef(new Animated.Value(-drawerWidth)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const openDrawer = () => {
        setIsDrawerOpen(true);
        loadUserProfile();
        loadNewsEvents();
        Animated.parallel([
            Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true })
        ]).start();
    };

    const closeDrawer = () => {
        Animated.parallel([
            Animated.timing(drawerAnim, { toValue: -drawerWidth, duration: 250, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
        ]).start(() => setIsDrawerOpen(false));
    };
    const scrollYRef = useRef(0);
    const headerAnim = useRef(new Animated.Value(0)).current;
    const scrollY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(headerAnim, {
            toValue: isHeaderHidden ? -60 : 0,
            duration: 250,
            useNativeDriver: Platform.OS !== 'web'
        }).start();
    }, [isHeaderHidden]);

    const handleScroll = useMemo(() => {
        if (Platform.OS === 'web') {
            // On web, use a simple scroll handler since Animated.event with useNativeDriver is not supported
            return (e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const y = e.nativeEvent.contentOffset.y;
                scrollY.setValue(y);
                if (y < 50) {
                    setIsHeaderHidden(false);
                } else if (y > scrollYRef.current + 15) {
                    setIsHeaderHidden(true);
                } else if (y < scrollYRef.current - 15) {
                    setIsHeaderHidden(false);
                }
                scrollYRef.current = y;
            };
        }
        return Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { 
                useNativeDriver: true,
                listener: (e: any) => {
                    const y = e.nativeEvent.contentOffset.y;
                    if (y < 50) {
                        setIsHeaderHidden(prev => prev ? false : prev);
                    } else if (y > scrollYRef.current + 15) {
                        setIsHeaderHidden(prev => !prev ? true : prev);
                    } else if (y < scrollYRef.current - 15) {
                        setIsHeaderHidden(prev => prev ? false : prev);
                    }
                    scrollYRef.current = y;
                }
            }
        );
    }, [scrollY]);

    const headerOpacity = headerAnim.interpolate({
        inputRange: [-60, 0],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    // Animate the glassy background opacity based on scroll position
    const headerBgOpacity = scrollY.interpolate({
        inputRange: [0, 30],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    // Multi-list state
    const [customLists, setCustomLists] = useState<{name: string, symbols: string[]}[]>([
        { name: 'List 1', symbols: [] },
    ]);
    const [activeList, setActiveList] = useState<string | null>(null); // null = default "All"
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [showManageLists, setShowManageLists] = useState(false);

    const createList = () => {
        if (!newListName.trim()) return;
        setCustomLists(prev => [...prev, { name: newListName.trim(), symbols: [] }]);
        setActiveList(newListName.trim());
        setNewListName('');
        setShowCreateModal(false);
    };

    const deleteList = (name: string) => {
        setCustomLists(prev => prev.filter(l => l.name !== name));
        if (activeList === name) setActiveList(null);
    };

    const toggleSymbolInList = (listName: string, symbolId: string) => {
        setCustomLists(prev => prev.map(l => {
            if (l.name !== listName) return l;
            const has = l.symbols.includes(symbolId);
            return { ...l, symbols: has ? l.symbols.filter(s => s !== symbolId) : [...l.symbols, symbolId] };
        }));
    };

    const isInActiveList = (symbolId: string) => {
        if (!activeList) return true;
        const list = customLists.find(l => l.name === activeList);
        return list ? list.symbols.includes(symbolId) : true;
    };

    // Filtered data based on search + active list
    const getFilteredData = () => {
        // Filter by activeSymbols or if it's promoted
        let data = watchlistData.map(section => ({
            ...section,
            data: section.data.filter(item => item.isPromoted || activeSymbols.includes(item.symbol))
        })).filter(section => section.data.length > 0);
        
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.map(section => ({
                ...section,
                data: section.data.filter(item => item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))
            })).filter(section => section.data.length > 0);
        } else if (activeList) {
            // If not searching, just show active list contents
            const list = customLists.find(l => l.name === activeList);
            if (list) {
                data = data.map(section => ({
                    ...section,
                    data: section.data.filter(item => list.symbols.includes(item.symbol))
                })).filter(section => section.data.length > 0);
            }
        }
        return data;
    };

    const getFilteredAddAssetData = () => {
        let data = MASTER_ASSETS;
        if (addAssetSearchQuery.trim()) {
            const q = addAssetSearchQuery.toLowerCase();
            data = data.map(section => ({
                ...section,
                data: section.data.filter(item => item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))
            })).filter(section => section.data.length > 0);
        }
        return data;
    };

    useEffect(() => {
        if (Platform.OS === 'web') {
            const styleId = 'google-font-montserrat';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
                    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap');
                    body, html, #root {
                        font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                        font-size: 100% !important;
                    }
                    * {
                        font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                    }
                `;
                document.head.appendChild(style);
            }
        }

        const fetchPromoted = async () => {
            try {
                const res = await axios.get(`${BACKEND_URL}/api/v1/market/promoted`);
                if (res.data?.data && res.data.data.length > 0) {
                    const promotedData = res.data.data.map((s: any) => ({
                        id: `promo_${s._id}`,
                        symbol: s.symbol,
                        name: s.name,
                        price: s.price.toString(),
                        high: s.high ? s.high.toString() : undefined,
                        low: s.low ? s.low.toString() : undefined,
                        change: s.changePct ? s.changePct.replace('%', '') : '0.00',
                        changePct: s.changePct || '0.00%',
                        logoBadge: s.logoBadge,
                        logoColor: s.logoColor,
                        imageUrl: s.imageUrl,
                        isPromoted: true,
                        isPinned: s.isPinned,
                        showMetrics: s.showMetrics,
                        brokerUrl: s.brokerUrl,
                        description: s.description
                    }));

                    setWatchlistData(prev => {
                        const existing = prev.filter(p => p.title !== '⭐ Featured / Promoted');
                        return [{ title: '⭐ Featured / Promoted', data: promotedData }, ...existing];
                    });
                }
            } catch (err) {
                console.log('Failed to fetch promoted symbols');
            }
        };

        fetchPromoted();

        const socket = io(BACKEND_URL, { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Watchlist connected to WebSocket');
            // Subscribe to all active symbols
            activeSymbolsRef.current.forEach(symbol => {
                socket.emit('subscribe', symbol);
            });
            prevActiveSymbolsRef.current = activeSymbolsRef.current;
        });

        socket.on('priceUpdate', (data) => {
            // Generate MT5 style mock data based on the real price update
            const p = data.price;
            const spreadPip = Math.floor(Math.random() * 8) + 2; // Spread 2 to 9
            const spreadValue = p < 10 ? spreadPip * 0.0001 : spreadPip * 0.01;
            const ask = p + spreadValue;
            
            const low = p * (1 - (Math.random() * 0.005 + 0.001));
            const high = p * (1 + (Math.random() * 0.005 + 0.001));
            
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

            setWatchlistData(prevData => {
                const newData = [...prevData];
                for (let i = 0; i < newData.length; i++) {
                    const section = { ...newData[i], data: [...newData[i].data] };
                    let updated = false;
                    for (let j = 0; j < section.data.length; j++) {
                        if (section.data[j].symbol === data.symbol) {
                            section.data[j] = {
                                ...section.data[j],
                                price: p.toFixed(p < 10 ? 5 : 2),
                                bid: p.toFixed(p < 10 ? 5 : 2),
                                ask: ask.toFixed(p < 10 ? 5 : 2),
                                spread: spreadPip,
                                low: low.toFixed(p < 10 ? 5 : 2),
                                high: high.toFixed(p < 10 ? 5 : 2),
                                time: timeStr,
                                changePct: data.change ? `${data.change > 0 ? '+' : ''}${data.change.toFixed(2)}%` : '...',
                                change: data.change || 0
                            };
                            updated = true;
                            break;
                        }
                    }
                    if (updated) {
                        newData[i] = section;
                        break;
                    }
                }
                return newData;
            });
        });

        return () => {
            activeSymbolsRef.current.forEach(symbol => {
                socket.emit('unsubscribe', symbol);
            });
            socket.disconnect();
        };
    }, []);

    // Watch for dynamic additions/removals of symbols to update subscriptions
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) return;

        const prevSymbols = prevActiveSymbolsRef.current;

        // Unsubscribe from symbols that were removed
        prevSymbols.forEach(sym => {
            if (!activeSymbols.includes(sym)) {
                socket.emit('unsubscribe', sym);
            }
        });

        // Subscribe to symbols that are new
        activeSymbols.forEach(sym => {
            if (!prevSymbols.includes(sym)) {
                socket.emit('subscribe', sym);
            }
        });

        prevActiveSymbolsRef.current = activeSymbols;
    }, [activeSymbols]);

    const toggleSection = (title: string) => {
        setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }));
    };

    const renderSectionHeader = ({ section: { title } }: any) => (
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(title)} activeOpacity={0.7}>
            <ChevronDown
                color={colors.textMuted}
                size={16}
                style={{ transform: [{ rotate: collapsedSections[title] ? '-90deg' : '0deg' }] }}
            />
            <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>{title}</Text>
        </TouchableOpacity>
    );

    return (
        <LinearGradient
            colors={isDark ? ['#000000', '#000000'] : ['#FFFFFF', '#FFFFFF']}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            {/* Ambient background glowing orbs for premium glassmorphism depth */}
            {isDark && (
                <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
                    <View style={[styles.glowOrb, { backgroundColor: colors.glowBlue, top: 150, left: -100, opacity: 0.45 }]} />
                    <View style={[styles.glowOrb, { backgroundColor: colors.glowPurple, bottom: 60, right: -100, opacity: 0.4 }]} />
                    <View style={[styles.glowOrb, { backgroundColor: '#FF007F', top: '35%', left: '-20%', width: 280, height: 280, opacity: 0.25 }]} />
                    <View style={[styles.glowOrb, { backgroundColor: colors.glowGreen, top: '15%', right: '-10%', width: 300, height: 300, opacity: 0.25 }]} />
                </View>
            )}

            <View style={[styles.safeArea, { paddingTop: Platform.OS === 'ios' && !isTelegram ? 47 : getTgSafeAreaTop() }]}>
                {/* Animated Watchlist Header (Glassy background fades in on scroll, slides up on scroll down) */}
                {!isChatActive && (
                    <Animated.View style={{ position: 'absolute', top: Platform.OS === 'ios' && !isTelegram ? 47 : getTgSafeAreaTop(), left: 0, right: 0, zIndex: 10, transform: [{ translateY: headerAnim }] }}>
                        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: headerBgOpacity }]}>
                            <BlurView intensity={isDark ? 40 : 80} tint={colors.blurTint} style={[StyleSheet.absoluteFillObject, { borderWidth: 0, borderBottomWidth: 1, borderBottomColor: colors.glassBorder }]} />
                        </Animated.View>
                        <View style={{ borderBottomWidth: 0 }}>
                            {/* Top Header */}
                            <Animated.View style={[styles.header, { justifyContent: 'space-between', opacity: headerOpacity }]}>
                                <View style={{ width: 40 }}>
                                    <TouchableOpacity style={styles.menuButton} onPress={openDrawer}>
                                        <AlignLeft color={colors.text} size={24} />
                                    </TouchableOpacity>
                                </View>

                                <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }}>
                                    <LinearGradient
                                        colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <BlurView 
                                            intensity={isDark ? 30 : 80} 
                                            tint={colors.blurTint} 
                                            style={{
                                                flexDirection: 'row',
                                                padding: 2,
                                                alignItems: 'center',
                                                borderWidth: 0
                                            }}
                                        >
                                            <TouchableOpacity
                                                onPress={() => setHeaderTab('watchlist')}
                                                style={{
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 6,
                                                    borderRadius: 18,
                                                    backgroundColor: headerTab === 'watchlist' ? (isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(37,99,235,0.15)') : 'transparent'
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={{
                                                    color: headerTab === 'watchlist' ? colors.primaryLight : colors.textMuted,
                                                    fontSize: 13,
                                                    fontWeight: '800'
                                                }}>Watchlist</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => setHeaderTab('community')}
                                                style={{
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 6,
                                                    borderRadius: 18,
                                                    backgroundColor: headerTab === 'community' ? (isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(37,99,235,0.15)') : 'transparent'
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={{
                                                    color: headerTab === 'community' ? colors.primaryLight : colors.textMuted,
                                                    fontSize: 13,
                                                    fontWeight: '800'
                                                }}>Community</Text>
                                            </TouchableOpacity>
                                        </BlurView>
                                    </LinearGradient>
                                </View>

                                <View style={{ width: 40 }} />
                            </Animated.View>


                            {/* Search Bar */}
                            {isSearchOpen && (
                                <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassModal, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.glassBorder }}>
                                        <Search color={colors.textMuted} size={16} />
                                        <TextInput
                                            style={{ flex: 1, color: colors.text, fontSize: 15, height: 40, marginLeft: 8, padding: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as any}
                                            placeholder="Search symbols..."
                                            placeholderTextColor={colors.textMuted}
                                            value={searchQuery}
                                            onChangeText={setSearchQuery}
                                            autoFocus
                                        />
                                        {searchQuery.length > 0 && (
                                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                                <X color={colors.textMuted} size={16} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>
                    </Animated.View>
                )}

                {/* Main List */}
                {headerTab === 'watchlist' ? (
                    <AnimatedSectionList
                        sections={getFilteredData()}
                        keyExtractor={(item) => item.id}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        contentContainerStyle={[styles.listContent, { paddingTop: isSearchOpen ? 110 : 60, paddingBottom: 100 }]}
                        ListHeaderComponent={
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 }}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                            <TouchableOpacity
                                                onPress={() => setActiveList(null)}
                                                style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: activeList === null ? colors.primary : colors.glassCardBorder }}
                                                activeOpacity={0.8}
                                            >
                                                <LinearGradient
                                                    colors={activeList === null 
                                                        ? (isDark ? ['rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0.1)'] : ['rgba(37, 99, 235, 0.25)', 'rgba(37, 99, 235, 0.1)'])
                                                        : (isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)'])
                                                    }
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                >
                                                    <BlurView
                                                        intensity={isDark ? 30 : 80}
                                                        tint={colors.blurTint}
                                                        style={{ paddingHorizontal: 14, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 0 }}
                                                    >
                                                        <Text style={{ color: activeList === null ? colors.primaryLight : colors.textMuted, fontSize: 13, fontWeight: '700' }}>All</Text>
                                                    </BlurView>
                                                </LinearGradient>
                                            </TouchableOpacity>

                                            {customLists.map(list => (
                                                <TouchableOpacity
                                                    key={list.name}
                                                    onPress={() => setActiveList(list.name)}
                                                    onLongPress={() => setShowManageLists(true)}
                                                    style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: activeList === list.name ? colors.accent : colors.glassCardBorder }}
                                                    activeOpacity={0.8}
                                                >
                                                    <LinearGradient
                                                        colors={activeList === list.name
                                                            ? (isDark ? ['rgba(168, 85, 247, 0.25)', 'rgba(168, 85, 247, 0.1)'] : ['rgba(124, 58, 237, 0.25)', 'rgba(124, 58, 237, 0.1)'])
                                                            : (isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)'])
                                                        }
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 1 }}
                                                    >
                                                        <BlurView
                                                            intensity={isDark ? 30 : 80}
                                                            tint={colors.blurTint}
                                                            style={{ paddingHorizontal: 14, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 0 }}
                                                        >
                                                            <Text style={{ color: activeList === list.name ? colors.accentLight : colors.textMuted, fontSize: 13, fontWeight: '700' }}>{list.name}</Text>
                                                        </BlurView>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            ))}

                                            <TouchableOpacity 
                                                onPress={() => setShowCreateModal(true)} 
                                                style={{ width: 30, height: 30, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder, justifyContent: 'center', alignItems: 'center' }}
                                                activeOpacity={0.8}
                                            >
                                                <LinearGradient
                                                    colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                    style={{ flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                                                >
                                                    <BlurView
                                                        intensity={isDark ? 30 : 80}
                                                        tint={colors.blurTint}
                                                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 0 }}
                                                    >
                                                        <Plus color={colors.textSubtle} size={16} />
                                                    </BlurView>
                                                </LinearGradient>
                                            </TouchableOpacity>

                                            {customLists.length > 0 && (
                                                <TouchableOpacity 
                                                    onPress={() => setShowManageLists(true)} 
                                                    style={{ width: 30, height: 30, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder, justifyContent: 'center', alignItems: 'center' }}
                                                    activeOpacity={0.8}
                                                >
                                                    <LinearGradient
                                                        colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 1 }}
                                                        style={{ flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                                                    >
                                                        <BlurView
                                                            intensity={isDark ? 30 : 80}
                                                            tint={colors.blurTint}
                                                            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 0 }}
                                                        >
                                                            <Edit3 color={colors.textMuted} size={14} />
                                                        </BlurView>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </ScrollView>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <TouchableOpacity 
                                        onPress={() => setIsSearchOpen(!isSearchOpen)}
                                        style={{ width: 32, height: 32, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder, justifyContent: 'center', alignItems: 'center' }}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{ flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <BlurView
                                                intensity={isDark ? 30 : 80}
                                                tint={colors.blurTint}
                                                style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 0 }}
                                            >
                                                <Search color={colors.textSubtle} size={16} />
                                            </BlurView>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => setIsAddAssetOpen(true)}
                                        style={{ width: 32, height: 32, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder, justifyContent: 'center', alignItems: 'center' }}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{ flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <BlurView
                                                intensity={isDark ? 30 : 80}
                                                tint={colors.blurTint}
                                                style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 0 }}
                                            >
                                                <Plus color={colors.textSubtle} size={16} />
                                            </BlurView>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                    <AccountSwitcher />
                                </View>
                            </View>
                        }
                        renderItem={({item, section}: any) => {
                            if (collapsedSections[section.title]) return null;
                            const isPositive = parseFloat(item.change) >= 0;
                            const priceColor = colors.text;
                            const changeColor = isPositive ? colors.success : colors.danger;
                            const shouldHideMetrics = item.isPromoted && item.showMetrics === false;
                            const handleItemPress = () => {
                                if (item.isPromoted && item.brokerUrl && Platform.OS === 'web') { window.open(item.brokerUrl, '_blank'); }
                                else { navigation.navigate('AssetDetails', { asset: item, brokerUrl: item.brokerUrl }); }
                            };
                            const gradientColors = (item.isPromoted 
                                ? ['rgba(168, 85, 247, 0.12)', 'rgba(168, 85, 247, 0.02)'] 
                                : (isDark 
                                    ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] 
                                    : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)'])) as [string, string];
                            return (
                                <TouchableOpacity 
                                    style={[
                                        styles.itemWrapper, 
                                        { 
                                            borderColor: isDark 
                                                ? (item.isPromoted ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.08)') 
                                                : colors.glassCardBorder,
                                            backgroundColor: Platform.OS === 'web' ? undefined : (isDark ? '#000000' : undefined)
                                        }
                                    ]} 
                                    onPress={handleItemPress} 
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.itemGradient}>
                                        <BlurView 
                                            intensity={isDark ? 30 : 80} 
                                            tint={colors.blurTint} 
                                            style={[
                                                styles.itemContent, 
                                                { 
                                                    flexDirection: 'column', 
                                                    alignItems: 'stretch',
                                                    borderWidth: 0,
                                                    backgroundColor: Platform.OS === 'web' ? undefined : (isDark ? '#000000' : undefined),
                                                    ...Platform.select({
                                                        web: {
                                                            backdropFilter: 'blur(20px) saturate(140%)',
                                                            WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                                                        },
                                                        default: {}
                                                    })
                                                }
                                            ]}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                    <AssetLogo symbol={item.symbol} logoColor={item.logoColor} logoBadge={item.logoBadge} size={25} />
                                                    <Text style={[styles.symbolText, { color: colors.text }]}>{item.symbol}</Text>
                                                    {item.tag && <View style={[styles.tagBadge, { paddingHorizontal: 4, paddingVertical: 2, marginLeft: 6 }]}><Text style={[styles.tagText, { fontSize: 8 }]}>{item.tag}</Text></View>}
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    {activeList && (
                                                        <TouchableOpacity onPress={() => toggleSymbolInList(activeList, item.symbol)} style={{ padding: 4 }}>
                                                            <Star color={isInActiveList(item.symbol) ? '#FBBF24' : '#94A3B8'} size={14} fill={isInActiveList(item.symbol) ? '#FBBF24' : 'none'} />
                                                        </TouchableOpacity>
                                                    )}
                                                    <Text style={{ color: colors.textSubtle, fontSize: 12, fontWeight: '500' }}>{item.time || '...'}</Text>
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <View style={{ flex: 1 }}>{!shouldHideMetrics && <Text style={{ color: colors.textSubtle, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Spread: <Text style={{ color: colors.text }}>{item.spread || '...'}</Text></Text>}</View>
                                                <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={[styles.priceText, { color: priceColor }]}>{item.bid || item.price}</Text></View>
                                                <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={[styles.priceText, { color: priceColor }]}>{item.ask || item.price}</Text></View>
                                            </View>
                                            {!shouldHideMetrics && (
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                                        <Text style={{ color: colors.textSubtle, fontSize: 11, fontWeight: '500' }}>L: <Text style={{ color: colors.text }}>{item.low || '...'}</Text></Text>
                                                        <Text style={{ color: colors.textSubtle, fontSize: 11, fontWeight: '500' }}>H: <Text style={{ color: colors.text }}>{item.high || '...'}</Text></Text>
                                                    </View>
                                                    <View style={[styles.changePill, { backgroundColor: isPositive ? 'rgba(8, 153, 129, 0.15)' : 'rgba(242, 54, 69, 0.15)', paddingVertical: 2, paddingHorizontal: 6 }]}>
                                                        <Text style={[styles.changeText, { color: changeColor, fontSize: 11 }]}>{item.changePct}</Text>
                                                    </View>
                                                </View>
                                            )}
                                            {item.isPromoted && item.brokerUrl && (
                                                <View style={{ marginTop: 12 }}>
                                                    <TouchableOpacity style={{ backgroundColor: colors.primary, padding: 10, borderRadius: 8, alignItems: 'center' }} onPress={handleItemPress}>
                                                        <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Trade {item.symbol}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </BlurView>
                                    </LinearGradient>
                                </TouchableOpacity>
                            );
                        }}
                        renderSectionHeader={renderSectionHeader}
                        stickySectionHeadersEnabled={false}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
                                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(37,99,235,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                                    <Search color={colors.primary} size={32} />
                                </View>
                                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>{activeList ? 'Empty Watchlist' : 'No results found'}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
                                    {activeList ? `Search for symbols and tap the star icon to add them to "${activeList}".` : 'Try a different search term or browse the categories.'}
                                </Text>
                                {activeList && (
                                    <TouchableOpacity 
                                        onPress={() => setIsSearchOpen(true)}
                                        style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(37,99,235,0.1)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.primary }}
                                    >
                                        <Text style={{ color: colors.primaryLight, fontSize: 16, fontWeight: '800' }}>Search Symbols</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        }
                    />
                ) : (
                    !userProfile ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 60 }}>
                            <View style={{
                                width: '100%',
                                maxWidth: 400,
                                borderRadius: 24,
                                padding: 32,
                                borderWidth: 1,
                                borderColor: colors.glassBorder,
                                backgroundColor: colors.glassCard,
                                alignItems: 'center'
                            }}>
                                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                    <Lock color={colors.primary} size={40} />
                                </View>
                                <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 10 }}>Login Required</Text>
                                <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                                    To access communities and chat with other traders, please log in to your account or register a new one.
                                </Text>
                                <TouchableOpacity
                                    style={{ width: '100%', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
                                    onPress={() => navigation.navigate('MainTabs', { screen: 'Login' })}
                                    activeOpacity={0.8}
                                >
                                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Log In to Account</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={{ flex: 1, marginTop: isChatActive ? 0 : 60 }}>
                            <ToolsHubScreen 
                                initialActiveTool="chat_groups" 
                                isEmbedded={true}
                                onActiveToolChange={(tool: string) => {
                                    setIsChatActive(tool === 'community_chat' || tool === 'community_profile');
                                }}
                            />
                        </View>
                    )
                )}
            </View>

            {/* Create List Modal */}
            <CustomBlurModal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
                <View style={{ flex: 1, backgroundColor: colors.glassModal, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <BlurView 
                        experimentalBlurMethod="regular"
                        intensity={100} 
                        tint={colors.blurTint} 
                        style={{ 
                            width: '100%', 
                            borderRadius: 24, 
                            padding: 24, 
                            borderWidth: 1, 
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.45)', 
                            overflow: 'hidden',
                            backgroundColor: isDark ? 'rgba(10, 14, 23, 0.18)' : 'rgba(255, 255, 255, 0.25)',
                        }}
                        {...Platform.select({ web: { className: 'premium-glass-heavy' } as any, default: {} })}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(37,99,235,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                <Plus color={colors.primaryLight} size={24} />
                            </View>
                            <View>
                                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>New Watchlist</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Create a custom tracking list</Text>
                            </View>
                        </View>
                        
                        <TextInput
                            style={{ backgroundColor: colors.glassInputBg, borderWidth: 1, borderColor: colors.glassInputBorder, borderRadius: 16, padding: 16, color: colors.text, fontSize: 16, marginBottom: 24, ...Platform.select({ web: { outlineStyle: 'none' } }) } as any}
                            placeholder="e.g. My Favorites"
                            placeholderTextColor={colors.textMuted}
                            value={newListName}
                            onChangeText={setNewListName}
                            autoFocus
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)} style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.glassButtonBg, alignItems: 'center' }}>
                                <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 15 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={createList} style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
                                <LinearGradient colors={['#3B82F6', '#6366F1']} style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 16 }}>
                                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>Create List</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </BlurView>
                </View>
            </CustomBlurModal>

            {/* Manage Lists Modal */}
            <CustomBlurModal visible={showManageLists} transparent animationType="fade" onRequestClose={() => setShowManageLists(false)}>
                <View style={{ flex: 1, backgroundColor: colors.glassModal, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <BlurView 
                        experimentalBlurMethod="regular"
                        intensity={100} 
                        tint={colors.blurTint} 
                        style={{ 
                            width: '100%', 
                            borderRadius: 24, 
                            padding: 24, 
                            borderWidth: 1, 
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.45)', 
                            overflow: 'hidden', 
                            maxHeight: '70%',
                            backgroundColor: isDark ? 'rgba(10, 14, 23, 0.18)' : 'rgba(255, 255, 255, 0.25)',
                        }}
                        {...Platform.select({ web: { className: 'premium-glass-heavy' } as any, default: {} })}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isDark ? 'rgba(168,85,247,0.2)' : 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                <Edit3 color={colors.accentLight} size={24} />
                            </View>
                            <View>
                                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>Manage Lists</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Organize your custom watchlists</Text>
                            </View>
                        </View>
                        
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {customLists.map(list => (
                                <View key={list.name} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.glassPillBorder }}>
                                    <View>
                                        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{list.name}</Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{list.symbols.length} symbols</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => deleteList(list.name)} style={{ backgroundColor: colors.dangerBackground, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
                                        <Trash2 color={colors.dangerLight} size={18} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                        
                        <TouchableOpacity onPress={() => setShowManageLists(false)} style={{ marginTop: 24, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.glassButtonBg, alignItems: 'center' }}>
                            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Done</Text>
                        </TouchableOpacity>
                    </BlurView>
                </View>
            </CustomBlurModal>

            {/* Sliding Drawer Menu */}
            <CustomBlurModal visible={isDrawerOpen} transparent={true} animationType="none" onRequestClose={closeDrawer}>
                <View style={{ flex: 1 }}>
                    <Animated.View style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        opacity: fadeAnim,
                        backgroundColor: 'transparent'
                    }}>
                        <TouchableOpacity style={{ flex: 1 }} onPress={closeDrawer} activeOpacity={1} />
                    </Animated.View>
                    <Animated.View style={{ 
                        width: drawerWidth, 
                        height: '100%', 
                        position: 'absolute', 
                        left: 0, 
                        top: 0, 
                        bottom: 0, 
                        transform: [{ translateX: drawerAnim }],
                        borderRightWidth: 1,
                        borderRightColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.25)',
                        shadowColor: '#000',
                        shadowOffset: { width: 4, height: 0 },
                        shadowOpacity: isDark ? 0.35 : 0.15,
                        shadowRadius: 20,
                        elevation: 5,
                    }}>
                        <BlurView 
                            experimentalBlurMethod="regular"
                            intensity={130} 
                            tint={isDark ? 'dark' : 'light'} 
                            style={{ 
                                flex: 1, 
                                backgroundColor: Platform.OS === 'web' 
                                    ? (isDark ? 'rgba(10, 12, 18, 0.08)' : 'rgba(255, 255, 255, 0.2)') 
                                    : (isDark ? '#000000' : '#FFFFFF'), 
                                borderWidth: 0,
                            }}
                            {...Platform.select({ web: { className: 'premium-glass-heavy' } as any, default: {} })}
                        >
                            <SafeAreaView style={{ flex: 1, paddingTop: getTgSafeAreaTop() }}>
                                <TouchableOpacity 
                                    onPress={() => { navigation.navigate('MainTabs', { screen: 'Login' }); closeDrawer(); }}
                                    style={{ padding: 16, paddingTop: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                                    activeOpacity={0.7}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {userProfile ? (
                                             <Image 
                                                 source={getAvatarSource(userProfile.avatarUrl)} 
                                                 style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} 
                                             />
                                         ) : (
                                             <LinearGradient colors={isDark ? ['#3B82F6', '#8B5CF6'] : ['#2563EB', '#7C3AED']} style={{ width: 44, height: 44, borderRadius: 22, padding: 1.5, marginRight: 12 }}>
                                                 <View style={{ flex: 1, borderRadius: 20.5, backgroundColor: isDark ? '#0D0E12' : '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
                                                     <User color={colors.text} size={18} />
                                                 </View>
                                             </LinearGradient>
                                         )}
                                         <View style={{ flex: 1 }}>
                                             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                 <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 }}>
                                                     {userProfile ? `@${userProfile.username}` : 'Guest Trader'}
                                                 </Text>
                                                 {userProfile?.activeNft && (
                                                     <View style={{ width: 14, height: 14, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                                                         <LottieView
                                                             source={
                                                                 userProfile.activeNft === 'nft_rocket' ? require('../../assets/emojis/rocket.json') :
                                                                 userProfile.activeNft === 'nft_star' ? require('../../assets/emojis/star.json') :
                                                                 userProfile.activeNft === 'nft_fire' ? require('../../assets/emojis/fire.json') :
                                                                 userProfile.activeNft === 'nft_heart' ? require('../../assets/emojis/heart.json') :
                                                                 userProfile.activeNft === 'nft_party' ? require('../../assets/emojis/party.json') :
                                                                 require('../../assets/emojis/rocket.json')
                                                             }
                                                             autoPlay
                                                             loop
                                                             style={{ width: '100%', height: '100%' }}
                                                         />
                                                     </View>
                                                 )}
                                             </View>
                                            <Text numberOfLines={1} style={{ color: colors.primaryLight, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                                                {userProfile ? (userProfile.email || 'Click to edit profile') : 'Tap to Login / Register'}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingTop: 16 }}>
                                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800', marginBottom: 10, marginLeft: 4, letterSpacing: 1.5, textTransform: 'uppercase' }}>Preferences</Text>
                                    <TouchableOpacity style={[styles.drawerMenuItem, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]} onPress={() => { toggleTheme(); closeDrawer(); }}>
                                        <View style={[styles.drawerMenuIcon, { backgroundColor: isDark ? 'rgba(251,191,36,0.12)' : 'rgba(59,130,246,0.12)', borderColor: isDark ? 'rgba(251,191,36,0.22)' : 'rgba(59,130,246,0.22)', borderWidth: 1 }]}>
                                            {isDark ? <Sun color="#FBBF24" size={18} /> : <Moon color="#3B82F6" size={18} />}
                                        </View>
                                        <Text style={[styles.drawerMenuText, { color: colors.text, flex: 1 }]} numberOfLines={1}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
                                    </TouchableOpacity>
                                    
                                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800', marginBottom: 10, marginLeft: 4, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 14 }}>Rewards & News</Text>
                                    
                                    <TouchableOpacity style={[styles.drawerMenuItem, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]} onPress={() => { navigation.navigate('EarnNft'); closeDrawer(); }}>
                                        <View style={[styles.drawerMenuIcon, { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.22)', borderWidth: 1 }]}>
                                            <Gift color="#3B82F6" size={18} />
                                        </View>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text style={[styles.drawerMenuText, { color: colors.text, flex: 1 }]} numberOfLines={1}>Earn NFT</Text>
                                            <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                                <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>NEW</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={[styles.drawerMenuItem, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]} onPress={() => { navigation.navigate('NewsRadar'); closeDrawer(); }}>
                                        <View style={[styles.drawerMenuIcon, { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.22)', borderWidth: 1 }]}>
                                            <Newspaper color="#3B82F6" size={18} />
                                        </View>
                                        <Text style={[styles.drawerMenuText, { color: colors.text, flex: 1 }]} numberOfLines={1}>News Radar</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                                <View style={{ padding: 14, alignItems: 'center' }}>
                                    <Text numberOfLines={1} style={{ color: colors.textSubtle, fontSize: 10, fontWeight: '600', opacity: 0.8 }}>Antigravity v1.0.0</Text>
                                </View>
                            </SafeAreaView>
                        </BlurView>
                    </Animated.View>
                </View>
            </CustomBlurModal>

            {/* Add Asset Modal */}
            <CustomBlurModal visible={isAddAssetOpen} transparent animationType="slide" onRequestClose={() => setIsAddAssetOpen(false)}>
                <View style={{ flex: 1, backgroundColor: colors.glassModal }}>
                    <BlurView 
                        experimentalBlurMethod="regular"
                        intensity={120} 
                        tint={colors.blurTint} 
                        style={{ 
                            flex: 1,
                            backgroundColor: isDark ? 'rgba(10, 14, 23, 0.65)' : 'rgba(255, 255, 255, 0.65)',
                        }}
                        {...Platform.select({ web: { className: 'premium-glass-heavy' } as any, default: {} })}
                    >
                        <SafeAreaView style={{ flex: 1, paddingTop: getTgSafeAreaTop() }}>
                            {/* Modal Header */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
                                <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>Add Asset</Text>
                                <TouchableOpacity 
                                    onPress={() => setIsAddAssetOpen(false)} 
                                    style={{ 
                                        width: 36, 
                                        height: 36, 
                                        borderRadius: 18, 
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', 
                                        justifyContent: 'center', 
                                        alignItems: 'center' 
                                    }}
                                >
                                    <X color={colors.text} size={20} />
                                </TouchableOpacity>
                            </View>

                            {/* Search bar inside Modal */}
                            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                                <View style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    backgroundColor: colors.glassInputBg, 
                                    borderRadius: 16, 
                                    paddingHorizontal: 16, 
                                    borderWidth: 1, 
                                    borderColor: colors.glassInputBorder 
                                }}>
                                    <Search color={colors.textMuted} size={18} />
                                    <TextInput
                                        style={{ 
                                            flex: 1, 
                                            color: colors.text, 
                                            fontSize: 16, 
                                            height: 48, 
                                            marginLeft: 10, 
                                            padding: 0, 
                                            ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) 
                                        } as any}
                                        placeholder="Search specific assets..."
                                        placeholderTextColor={colors.textMuted}
                                        value={addAssetSearchQuery}
                                        onChangeText={setAddAssetSearchQuery}
                                    />
                                    {addAssetSearchQuery.length > 0 && (
                                        <TouchableOpacity onPress={() => setAddAssetSearchQuery('')}>
                                            <X color={colors.textMuted} size={18} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Categories and asset items */}
                            <FlatList
                                data={getFilteredAddAssetData()}
                                keyExtractor={(item) => item.title}
                                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item: category }) => {
                                    const isCollapsed = collapsedAddAssetSections[category.title];
                                    return (
                                        <View style={{ marginBottom: 12 }}>
                                            {/* Category Header */}
                                            <TouchableOpacity 
                                                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} 
                                                onPress={() => toggleAddAssetSection(category.title)}
                                                activeOpacity={0.7}
                                            >
                                                <ChevronDown
                                                    color={colors.textMuted}
                                                    size={16}
                                                    style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }}
                                                />
                                                <Text style={[styles.sectionTitle, { color: colors.textSubtle, fontSize: 13, marginLeft: 8 }]}>{category.title}</Text>
                                            </TouchableOpacity>

                                            {/* Category Items */}
                                            {!isCollapsed && category.data.map((item: any) => {
                                                const isActive = activeSymbols.includes(item.symbol);
                                                return (
                                                    <View 
                                                        key={item.id} 
                                                        style={{ 
                                                            flexDirection: 'row', 
                                                            justifyContent: 'space-between', 
                                                            alignItems: 'center', 
                                                            paddingVertical: 14, 
                                                            borderBottomWidth: 1, 
                                                            borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' 
                                                        }}
                                                    >
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                                                            <AssetLogo symbol={item.symbol} logoColor={item.logoColor} logoBadge={item.logoBadge} size={32} />
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{item.symbol}</Text>
                                                                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.name}</Text>
                                                            </View>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                            <TouchableOpacity style={{ padding: 6 }}>
                                                                <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: 'bold' }}>...</Text>
                                                            </TouchableOpacity>
                                                            {isActive ? (
                                                                <TouchableOpacity 
                                                                    onPress={() => toggleAssetActive(item.symbol)}
                                                                    style={{ 
                                                                        width: 32, 
                                                                        height: 32, 
                                                                        borderRadius: 16, 
                                                                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', 
                                                                        justifyContent: 'center', 
                                                                        alignItems: 'center' 
                                                                    }}
                                                                >
                                                                    <Trash2 color={colors.danger} size={16} />
                                                                </TouchableOpacity>
                                                            ) : (
                                                                <TouchableOpacity 
                                                                    onPress={() => toggleAssetActive(item.symbol)}
                                                                    style={{ 
                                                                        width: 32, 
                                                                        height: 32, 
                                                                        borderRadius: 16, 
                                                                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)', 
                                                                        justifyContent: 'center', 
                                                                        alignItems: 'center' 
                                                                    }}
                                                                >
                                                                    <Plus color="#3B82F6" size={16} />
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    );
                                }}
                            />
                        </SafeAreaView>
                    </BlurView>
                </View>
            </CustomBlurModal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    glowOrb: {
        display: 'none',
        width: 0,
        height: 0,
        opacity: 0,
    },
    safeArea: {
        flex: 1,
        paddingTop: getTgSafeAreaTop(),
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuButton: {
        marginRight: 16,
    },
    headerTabs: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activeTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        marginRight: 12,
    },
    activeTabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    inactiveTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    inactiveTabText: {
        fontSize: 16,
        fontWeight: '500',
    },
    listContent: {
        paddingBottom: 80,
        paddingHorizontal: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        backgroundColor: 'transparent',
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
        letterSpacing: 1,
        textTransform: 'uppercase',
        },
    itemWrapper: {
        marginBottom: 6,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
    },
    itemGradient: {
        flex: 1,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    logoCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    logoText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    symbolRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    symbolText: {
        fontSize: 17,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        },
    tagBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 8,
    },
    tagText: {
        color: '#EF4444',
        fontSize: 10,
        fontWeight: '900',
        },
    nameText: {
        fontSize: 13,
        fontWeight: '500',
        },
    sparklineContainer: {
        width: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    priceContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        minWidth: 80,
    },
    priceText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 6,
        letterSpacing: 0.5,
        },
    changePill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    changeText: {
        fontSize: 12,
        fontWeight: 'bold',
        },
    drawerMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        marginBottom: 4,
    },
    drawerMenuIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    drawerMenuText: {
        fontSize: 14,
        fontWeight: '700',
    },
});

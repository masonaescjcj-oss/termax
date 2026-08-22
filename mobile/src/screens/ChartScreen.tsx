// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { View, StyleSheet, Platform, SafeAreaView, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, Dimensions, useWindowDimensions, Image } from 'react-native';
import { Text, TextInput } from '../components/Typography';
;
import Svg, { Path, SvgXml } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import io from 'socket.io-client';
import axios from 'axios';
import { getItemAsync, setItemAsync } from '../utils/storage';
import { ChevronDown, ChevronUp, ChevronLeft, X, Ruler, Eraser, Trash2, Target, Maximize, Minimize, PenTool, AlignLeft, Activity, Info, BarChart2, TrendingUp, Clock, Layers, Lightbulb, Share, MoreVertical, Check, Paperclip, Rocket, Mic, Bot, ShieldAlert, Sliders, Zap, TrendingDown, Search, Eye, Menu } from 'lucide-react-native';
import BlurView from '../components/GlassView';
import CustomBlurModal from '../components/CustomBlurModal';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import GlassToast from '../components/GlassToast';
import { colors as defaultColors } from '../theme/colors';
import { BACKEND_URL, isTelegram, getTgSafeAreaTop } from '../config';
import { useAccountStore } from '../store/accountStore';
import { SVG_ICONS } from '../components/SvgIcons';
import { revaluePnL, markPrice, canRevalue } from '../lib/positionMath';

const SYMBOLSList = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'GOLD', 'SILVER', 'SPX', 'NDQ', 'USOIL', 'AAPL', 'TSLA'];

const ASSET_METADATA = {
    'BTC/USDT': { name: 'Bitcoin', logoColor: '#F7931A', logoBadge: '₿' },
    'ETH/USDT': { name: 'Ethereum', logoColor: '#627EEA', logoBadge: 'Ξ' },
    'BNB/USDT': { name: 'BNB', logoColor: '#F3BA2F', logoBadge: 'BNB' },
    'SOL/USDT': { name: 'Solana', logoColor: '#14F195', logoBadge: 'SOL' },
    'GOLD': { name: 'Gold (US$ / OZ)', logoColor: '#B68925', logoBadge: 'Au' },
    'SILVER': { name: 'Silver (US$ / OZ)', logoColor: '#C0C0C0', logoBadge: 'Ag' },
    'USOIL': { name: 'WTI Crude Oil', logoColor: '#1A1D24', logoBadge: '🛢️' },
    'SPX': { name: 'S&P 500 Index', logoColor: '#1A1D24', logoBadge: '500' },
    'NDQ': { name: 'Nasdaq 100 Index', logoColor: '#1A1D24', logoBadge: 'ND' },
    'AAPL': { name: 'Apple Inc.', logoColor: '#000000', logoBadge: 'Ap' },
    'TSLA': { name: 'Tesla Inc.', logoColor: '#CC0000', logoBadge: 'Ts' }
};

const ASSET_CATEGORIES = [
    {
        title: 'CRYPTO',
        symbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT']
    },
    {
        title: 'METALS & ENERGY',
        symbols: ['GOLD', 'SILVER', 'USOIL']
    },
    {
        title: 'INDICES',
        symbols: ['SPX', 'NDQ']
    },
    {
        title: 'STOCKS',
        symbols: ['AAPL', 'TSLA']
    }
];

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
    return svgTag + rest;
}

function AssetLogo({ symbol, size = 28 }: { symbol: string; size?: number }) {
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
            <View style={{ width: size + 6, height: size, position: 'relative', marginRight: 10 }}>
                <Image source={{ uri: uri1 }} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, position: 'absolute', left: 0, top: 2, zIndex: 2, borderWidth: 1.5, borderColor: '#000000' }} />
                <Image source={{ uri: uri2 }} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, position: 'absolute', right: 0, bottom: 2, zIndex: 1, borderWidth: 1.5, borderColor: '#000000' }} />
            </View>
        );
    }
    
    // 2. Crypto logos
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
            <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1E222D', overflow: 'hidden', marginRight: 10, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            </View>
        );
    }
    
    // 3. Traditional stock/index/future SVGs from SvgIcons
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
        'NFLX': 'apple',
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
            <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', marginRight: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E222D' }}>
                <SvgXml xml={xml} width="100%" height="100%" />
            </View>
        );
    }
    
    // Fallback text avatar
    const meta = ASSET_METADATA[s] || {};
    return (
        <View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: meta.logoColor || '#3B82F6',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10
        }}>
            <Text style={{ color: '#FFFFFF', fontSize: size * 0.45, fontWeight: 'bold' }}>
                {meta.logoBadge || s.substring(0, 2)}
            </Text>
        </View>
    );
}

const INDICATORS = [
  { id: 'AI_SIGNALS', name: 'AI Buy/Sell Signals', isMain: true, desc: 'Machine Learning powered entry/exit points', isPremium: true },
  { id: 'AI_ZONES', name: 'AI Supply & Demand', isMain: true, desc: 'Auto-detects institutional liquidity zones', isPremium: true },
  { id: 'AI_TREND', name: 'AI Auto-Trendlines', isMain: true, desc: 'Smart regression channels and trendlines', isPremium: true },
  { id: 'MA', name: 'Moving Average (MA)', isMain: true, desc: 'Trend indicator displaying average price' },
  { id: 'EMA', name: 'Exponential MA (EMA)', isMain: true, desc: 'Weighted moving average' },
  { id: 'BOLL', name: 'Bollinger Bands (BOLL)', isMain: true, desc: 'Volatility bands' },
  { id: 'VOL', name: 'Volume', isMain: false, desc: 'Trading volume' },
  { id: 'MACD', name: 'MACD', isMain: false, desc: 'Momentum oscillator' },
  { id: 'RSI', name: 'RSI', isMain: false, desc: 'Relative strength index' },
];

const DRAWING_TABS = ['Tools', 'Lines', 'Fibonacci & Gann', 'Shapes & Text'];

const DRAWING_TOOLS: Record<string, any[]> = {
  'Tools': [
    { id: 'eraser', icon: Eraser, label: 'Eraser (Tap drawing to remove)', overlay: null },
    { id: 'remove', icon: Trash2, label: 'Remove all drawings', overlay: null },
  ],
  'Lines': [
    { id: 'segment', icon: PenTool, label: 'Trend Line', overlay: 'segment' },
    { id: 'straightLine', icon: PenTool, label: 'Extended Line', overlay: 'straightLine' },
    { id: 'rayLine', icon: PenTool, label: 'Ray', overlay: 'rayLine' },
    { id: 'parallelLine', icon: Layers, label: 'Parallel Channel', overlay: 'parallelLine' },
    { id: 'priceLine', icon: AlignLeft, label: 'Horizontal Price Line', overlay: 'priceLine' },
    { id: 'priceChannel', icon: Layers, label: 'Price Channel', overlay: 'priceChannel' },
  ],
  'Fibonacci & Gann': [
    { id: 'fibonacciLine', icon: AlignLeft, label: 'Fib Retracement', overlay: 'fibonacciLine' },
    { id: 'fibonacciSegment', icon: AlignLeft, label: 'Trend-Based Fib Extension', overlay: 'fibonacciSegment' },
    { id: 'fibonacciCircle', icon: AlignLeft, label: 'Fib Circles', overlay: 'fibonacciCircle' },
    { id: 'fibonacciSpiral', icon: AlignLeft, label: 'Fib Spiral', overlay: 'fibonacciSpiral' },
    { id: 'fibonacciSpeedResistanceFan', icon: AlignLeft, label: 'Fib Speed Resistance Fan', overlay: 'fibonacciSpeedResistanceFan' },
    { id: 'fibonacciExtension', icon: AlignLeft, label: 'Fib Extension', overlay: 'fibonacciExtension' },
    { id: 'gannBox', icon: AlignLeft, label: 'Gann Box', overlay: 'gannBox' },
  ],
  'Shapes & Text': [
    { id: 'circle', icon: Activity, label: 'Circle', overlay: 'circle' },
    { id: 'rect', icon: Activity, label: 'Rectangle', overlay: 'rect' },
    { id: 'polygon', icon: Activity, label: 'Polygon', overlay: 'polygon' },
    { id: 'simpleAnnotation', icon: Activity, label: 'Annotation', overlay: 'simpleAnnotation' },
    { id: 'simpleTag', icon: Activity, label: 'Price Tag', overlay: 'simpleTag' },
  ]
};

const INTERVALS = [
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1mo' },
];


const getChartHtml = (symbol: string, colors: any, initialDataStr: string = "[]") => `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
        body { margin: 0; padding: 0; background-color: transparent; color: ${colors.text}; font-family: -apple-system, system-ui; overflow: hidden; }
        #tvchart { position: absolute; width: 100vw; height: 100vh; top: 0; left: 0; z-index: 10; }
        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 80px; font-weight: 900; color: rgba(128,128,128,0.05); z-index: 1; pointer-events: none; display: flex; align-items: center; justify-content: center; flex-direction: column; text-align: center; }
        .watermark svg { width: 100px; height: 100px; opacity: 0.05; margin-bottom: 20px; }
        .watermark div { font-size: 32px; letter-spacing: 12px; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/klinecharts/dist/klinecharts.min.js"></script>
</head>
<body>
    <div class="watermark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        <div>TERMAX</div>
    </div>
    <div id="errlog" style="position: absolute; top: 0; left: 0; background: rgba(0,0,0,0.8); color: red; z-index: 9999; padding: 10px; font-size: 12px; width: 100vw; pointer-events: none; word-wrap: break-word; display: none;"></div>
    <div id="tvchart"></div>
    <script>
        window.onerror = function(msg) { document.getElementById('errlog').style.display = 'block'; document.getElementById('errlog').innerHTML += 'GLOBAL ERR: ' + msg + '<br>'; };
        
        function sendMsgToApp(msgObj) {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(msgObj));
            } else if (window.parent) {
                window.parent.postMessage(JSON.stringify(msgObj), '*');
            }
        }

        window.chartTheme = {
            upColor: '${colors.success}',
            downColor: '${colors.danger}'
        };

        // Custom Overlay for AI Signals (BUY/SELL markers)
        klinecharts.registerOverlay({
            name: 'aiSignal',
            needDefaultPointFigure: false,
            needDefaultXAxisFigure: false,
            needDefaultYAxisFigure: false,
            createPointFigures: ({ overlay, coordinates, bounding }) => {
                const isBuy = overlay.extendData?.isBuy;
                const upColor = (window.chartTheme && window.chartTheme.upColor) ? window.chartTheme.upColor : '#089981';
                const downColor = (window.chartTheme && window.chartTheme.downColor) ? window.chartTheme.downColor : '#F23645';
                const color = isBuy ? upColor : downColor;
                const text = isBuy ? 'BUY' : 'SELL';
                
                const y = coordinates[0].y;
                const x = coordinates[0].x;
                
                if (isBuy) {
                    return [
                        {
                            type: 'polygon',
                            attrs: {
                                coordinates: [
                                    { x: x, y: y + 10 },
                                    { x: x - 6, y: y + 22 },
                                    { x: x + 6, y: y + 22 }
                                ]
                            },
                            styles: { style: 'fill', color: color }
                        },
                        {
                            type: 'text',
                            attrs: { x: x, y: y + 34, text: text, align: 'center', baseline: 'middle' },
                            styles: { color: color, size: 10, weight: 'bold', family: '-apple-system, system-ui, sans-serif' }
                        }
                    ];
                } else {
                    return [
                        {
                            type: 'polygon',
                            attrs: {
                                coordinates: [
                                    { x: x, y: y - 10 },
                                    { x: x - 6, y: y - 22 },
                                    { x: x + 6, y: y - 22 }
                                ]
                            },
                            styles: { style: 'fill', color: color }
                        },
                        {
                            type: 'text',
                            attrs: { x: x, y: y - 34, text: text, align: 'center', baseline: 'middle' },
                            styles: { color: color, size: 10, weight: 'bold', family: '-apple-system, system-ui, sans-serif' }
                        }
                    ];
                }
            }
        });

        // Custom Overlay for AI Supply & Demand Zones
        klinecharts.registerOverlay({
            name: 'aiZone',
            needDefaultPointFigure: false,
            needDefaultXAxisFigure: false,
            needDefaultYAxisFigure: false,
            createPointFigures: ({ overlay, coordinates, bounding }) => {
                const isDemand = overlay.extendData?.isDemand;
                const upColor = (window.chartTheme && window.chartTheme.upColor) ? window.chartTheme.upColor : '#089981';
                const downColor = (window.chartTheme && window.chartTheme.downColor) ? window.chartTheme.downColor : '#F23645';
                const baseColor = isDemand ? upColor : downColor;
                const labelText = isDemand ? 'AI DEMAND ZONE' : 'AI SUPPLY ZONE';
                
                if (coordinates.length < 2) return [];
                const y1 = coordinates[0].y;
                const y2 = coordinates[1].y;
                const x1 = 0;
                const x2 = bounding.width;
                
                return [
                    {
                        type: 'rect',
                        attrs: {
                            x: x1,
                            y: Math.min(y1, y2),
                            width: x2 - x1,
                            height: Math.abs(y2 - y1)
                        },
                        styles: { style: 'fill', color: baseColor + '1a' } // ~10% opacity
                    },
                    {
                        type: 'line',
                        attrs: { coordinates: [{ x: x1, y: y1 }, { x: x2, y: y1 }] },
                        styles: { style: 'dashed', color: baseColor + '4d', size: 1 } // ~30% opacity
                    },
                    {
                        type: 'line',
                        attrs: { coordinates: [{ x: x1, y: y2 }, { x: x2, y: y2 }] },
                        styles: { style: 'dashed', color: baseColor + '4d', size: 1 }
                    },
                    {
                        type: 'text',
                        attrs: { x: 12, y: Math.min(y1, y2) + 6, text: labelText },
                        styles: { color: baseColor, size: 10, weight: 'bold', family: '-apple-system, system-ui, sans-serif' }
                    }
                ];
            }
        });

        // Custom Overlay for AI Auto-Trendlines
        klinecharts.registerOverlay({
            name: 'aiTrendline',
            needDefaultPointFigure: false,
            needDefaultXAxisFigure: false,
            needDefaultYAxisFigure: false,
            createPointFigures: ({ overlay, coordinates, bounding }) => {
                const isSupport = overlay.extendData?.isSupport;
                const upColor = (window.chartTheme && window.chartTheme.upColor) ? window.chartTheme.upColor : '#089981';
                const downColor = (window.chartTheme && window.chartTheme.downColor) ? window.chartTheme.downColor : '#F23645';
                const color = isSupport ? upColor : downColor;
                const labelText = isSupport ? 'AI SUPPORT TREND' : 'AI RESISTANCE TREND';
                
                if (coordinates.length < 2) return [];
                const p1 = coordinates[0];
                const p2 = coordinates[1];
                
                return [
                    {
                        type: 'line',
                        attrs: { coordinates: [p1, p2] },
                        styles: { style: 'solid', color: color, size: 1.5 }
                    },
                    {
                        type: 'text',
                        attrs: { x: Math.max(10, p2.x - 120), y: p2.y - 12, text: labelText },
                        styles: { color: color, size: 9, weight: 'bold', family: '-apple-system, system-ui, sans-serif' }
                    }
                ];
            }
        });

        klinecharts.registerOverlay({
            name: 'positionLine',
            needDefaultPointFigure: false,
            needDefaultXAxisFigure: false,
            needDefaultYAxisFigure: true,
            createPointFigures: ({ overlay, coordinates, bounding }) => {
                const text = overlay.extendData.text;
                const color = overlay.styles?.line?.color || '#089981';
                return [
                    {
                        type: 'line',
                        attrs: { coordinates: [{ x: 0, y: coordinates[0].y }, { x: bounding.width, y: coordinates[0].y }] },
                        styles: { style: 'dashed', color: color, size: 1.5 },
                        ignoreEvent: true
                    },
                    {
                        type: 'text',
                        attrs: { x: 10, y: coordinates[0].y - 16, text: text },
                        ignoreEvent: false,
                        styles: { 
                            color: '#FFFFFF', 
                            backgroundColor: color, 
                            size: 13, 
                            paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, 
                            borderRadius: 4,
                            family: '-apple-system, system-ui, sans-serif'
                        }
                    }
                ];
            },
            onClick: ({ overlay }) => {
                if (overlay.extendData && overlay.extendData.id) {
                    sendMsgToApp({ type: 'positionClick', positionId: overlay.extendData.id });
                    return true;
                }
                return false;
            },
            onPressedMoveEnd: ({ overlay }) => {
                if (overlay.extendData && overlay.extendData.id && overlay.extendData.isTpSl) {
                    const newPrice = overlay.points[0].value;
                    sendMsgToApp({ type: 'updatePositionPrice', positionId: overlay.extendData.id, newPrice: newPrice, label: overlay.extendData.text.split(' ')[0] });
                }
            }
        });

        const chart = klinecharts.init('tvchart', {
            styles: {
                grid: {
                    horizontal: { color: '${colors.border}', style: 'dashed', size: 1 },
                    vertical: { color: '${colors.border}', style: 'dashed', size: 1 }
                },
                candle: {
                    type: 'candle_solid',
                    area: {
                        lineColor: '${colors.success}',
                        backgroundColor: [{ offset: 0, color: '${colors.success}60' }, { offset: 1, color: '${colors.success}00' }]
                    },
                    bar: {
                        upColor: '${colors.success}', downColor: '${colors.danger}', noChangeColor: '${colors.textMuted}',
                        upBorderColor: '${colors.success}', downBorderColor: '${colors.danger}', noChangeBorderColor: '${colors.textMuted}',
                        upWickColor: '${colors.success}', downWickColor: '${colors.danger}', noChangeWickColor: '${colors.textMuted}'
                    },
                    priceMark: {
                        last: {
                            show: true,
                            upColor: '${colors.success}',
                            downColor: '${colors.danger}',
                            noChangeColor: '${colors.textMuted}',
                            line: {
                                show: true,
                                style: 'dashed',
                                dashValue: [4, 4],
                                size: 1
                            },
                            text: {
                                show: true,
                                color: '#FFFFFF',
                                size: 12,
                                family: '-apple-system, system-ui, sans-serif'
                            }
                        }
                    }
                },
                xAxis: { tickText: { color: '${colors.textMuted}' }, axisLine: { color: 'transparent' } },
                yAxis: { tickText: { color: '${colors.textMuted}' }, axisLine: { color: 'transparent' } }
            }
        });

        let isEraserMode = false;
        let activeIndicatorsList = ['VOL'];

        // Fallback click handler via subscribeAction (works on all klinecharts versions)
        chart.subscribeAction('onOverlayClick', (data) => {
            if (isEraserMode && data.overlay && data.overlay.id && (!data.overlay.extendData || !data.overlay.extendData.id)) {
                try { chart.removeOverlay(data.overlay.id); } catch(e) {}
                return;
            }
            if (data.overlay && data.overlay.extendData && data.overlay.extendData.id) {
                sendMsgToApp({ type: 'positionClick', positionId: data.overlay.extendData.id });
            }
        });

        // Create a container for HTML-based clickable position buttons
        const btnContainer = document.createElement('div');
        btnContainer.id = 'posBtns';
        btnContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;';
        document.body.appendChild(btnContainer);

        // Store positions data for button rendering
        let positionsStore = [];

        function redrawPositions() {
            try { chart.removeOverlay({ groupId: 'positions' }); } catch(e) {}
            positionsStore.forEach(pos => {
                const isPending = pos.status === 'PENDING';
                const upColor = (window.chartTheme && window.chartTheme.upColor) ? window.chartTheme.upColor : '#089981';
                const downColor = (window.chartTheme && window.chartTheme.downColor) ? window.chartTheme.downColor : '#F23645';
                const lineColor = pos.side === 'BUY' ? upColor : downColor;
                
                // Main Entry Line (just the dashed line, no label - labels are HTML)
                chart.createOverlay({
                    groupId: 'positions',
                    name: 'horizontalStraightLine',
                    points: [{ value: pos.entryPrice }],
                    lock: true,
                    styles: { line: { color: lineColor, style: isPending ? 'dashed' : 'solid', size: 1.5 } },
                });

                // TP Line
                if (pos.takeProfit) {
                    chart.createOverlay({
                        groupId: 'positions',
                        name: 'horizontalStraightLine',
                        points: [{ value: pos.takeProfit }],
                        lock: true,
                        styles: { line: { color: upColor, style: 'dashed', size: 1 } },
                    });
                }

                // SL Line
                if (pos.stopLoss) {
                    chart.createOverlay({
                        groupId: 'positions',
                        name: 'horizontalStraightLine',
                        points: [{ value: pos.stopLoss }],
                        lock: true,
                        styles: { line: { color: downColor, style: 'dashed', size: 1 } },
                    });
                }
            });
            setTimeout(renderPositionButtons, 100);
        }

        function renderPositionButtons() {
            btnContainer.innerHTML = '';
            if (!positionsStore.length) return;
            const chartEl = document.getElementById('tvchart');
            if (!chartEl) return;
            const chartRect = chartEl.getBoundingClientRect();

            positionsStore.forEach(pos => {
                const yCoord = chart.convertToPixel({ value: pos.entryPrice }, { paneId: 'candle_pane' });
                if (yCoord === null || yCoord === undefined) return;
                const y = typeof yCoord === 'object' ? yCoord.y : yCoord;
                if (isNaN(y) || y < 0 || y > chartRect.height) return;

                const isPending = pos.status === 'PENDING';
                const upColor = (window.chartTheme && window.chartTheme.upColor) ? window.chartTheme.upColor : '#089981';
                const downColor = (window.chartTheme && window.chartTheme.downColor) ? window.chartTheme.downColor : '#F23645';
                const lineColor = pos.side === 'BUY' ? upColor : downColor;
                const pnlColor = pos.unrealizedPnL >= 0 ? upColor : downColor;
                const pnlText = isPending ? 'PENDING' : ('<span style="color:' + pnlColor + '">' + (pos.unrealizedPnL >= 0 ? '+$' : '-$') + Math.abs(pos.unrealizedPnL).toFixed(2) + '</span>');
                const labelType = isPending ? pos.orderType : 'POS';
                const sideSpan = '<span style="color:' + lineColor + '">' + pos.side + '</span>';
                const labelHtml = sideSpan + ' ' + labelType + ' ' + pos.volume + '  |  ' + pnlText;

                // Label button
                const btn = document.createElement('div');
                btn.style.cssText = 'position:absolute;left:8px;padding:6px 14px;border-radius:4px;font-size:13px;font-weight:600;color:#fff;cursor:pointer;pointer-events:auto;white-space:nowrap;touch-action:manipulation;user-select:none;z-index:101;font-family:-apple-system,system-ui,sans-serif;';
                btn.style.top = (y - 16) + 'px';
                btn.style.backgroundColor = 'rgba(25, 25, 35, 0.9)';
                btn.style.border = '1px solid ' + lineColor;
                btn.innerHTML = labelHtml;
                btn.dataset.posId = pos.id;
                btn.addEventListener('click', function(e) { e.stopPropagation(); sendMsgToApp({ type: 'positionClick', positionId: pos.id }); });
                btn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); sendMsgToApp({ type: 'positionClick', positionId: pos.id }); });
                btnContainer.appendChild(btn);

                // Close X button
                const xBtn = document.createElement('div');
                xBtn.style.cssText = 'position:absolute;right:60px;padding:6px 12px;border-radius:4px;font-size:14px;font-weight:bold;color:#fff;cursor:pointer;pointer-events:auto;background:' + downColor + ';touch-action:manipulation;user-select:none;z-index:102;';
                xBtn.style.top = (y - 16) + 'px';
                xBtn.textContent = '✕';
                xBtn.addEventListener('click', function(e) { e.stopPropagation(); sendMsgToApp({ type: 'closePosition', positionId: pos.id }); });
                xBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); sendMsgToApp({ type: 'closePosition', positionId: pos.id }); });
                btnContainer.appendChild(xBtn);

                // TP label
                if (pos.takeProfit) {
                    const tpY = chart.convertToPixel({ value: pos.takeProfit }, { paneId: 'candle_pane' });
                    if (tpY !== null && tpY !== undefined) {
                        const tpYVal = typeof tpY === 'object' ? tpY.y : tpY;
                        if (!isNaN(tpYVal) && tpYVal >= 0 && tpYVal <= chartRect.height) {
                            const isMonoTP = upColor.toLowerCase() === '#ffffff';
                            const tpTextColor = isMonoTP ? '#000000' : '#ffffff';
                            const tpBtn = document.createElement('div');
                            tpBtn.style.cssText = 'position:absolute;left:8px;padding:5px 12px;border-radius:4px;font-size:12px;font-weight:600;color:' + tpTextColor + ';cursor:pointer;pointer-events:auto;background:' + upColor + ';touch-action:manipulation;user-select:none;z-index:101;';
                            tpBtn.style.top = (tpYVal - 14) + 'px';
                            tpBtn.textContent = 'TP | ' + pos.takeProfit;
                            tpBtn.addEventListener('click', function(e) { e.stopPropagation(); sendMsgToApp({ type: 'positionClick', positionId: pos.id }); });
                            tpBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); sendMsgToApp({ type: 'positionClick', positionId: pos.id }); });
                            btnContainer.appendChild(tpBtn);
                        }
                    }
                }

                // SL label
                if (pos.stopLoss) {
                    const slY = chart.convertToPixel({ value: pos.stopLoss }, { paneId: 'candle_pane' });
                    if (slY !== null && slY !== undefined) {
                        const slYVal = typeof slY === 'object' ? slY.y : slY;
                        if (!isNaN(slYVal) && slYVal >= 0 && slYVal <= chartRect.height) {
                            const isMonoSL = downColor.toLowerCase() === '#ffffff';
                            const slTextColor = isMonoSL ? '#000000' : '#ffffff';
                            const slBtn = document.createElement('div');
                            slBtn.style.cssText = 'position:absolute;left:8px;padding:5px 12px;border-radius:4px;font-size:12px;font-weight:600;color:' + slTextColor + ';cursor:pointer;pointer-events:auto;background:' + downColor + ';touch-action:manipulation;user-select:none;z-index:101;';
                            slBtn.style.top = (slYVal - 14) + 'px';
                            slBtn.textContent = 'SL | ' + pos.stopLoss;
                            slBtn.addEventListener('click', function(e) { e.stopPropagation(); sendMsgToApp({ type: 'positionClick', positionId: pos.id }); });
                            slBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); sendMsgToApp({ type: 'positionClick', positionId: pos.id }); });
                            btnContainer.appendChild(slBtn);
                        }
                    }
                }
            });
        }

        // Functions to update custom AI indicators
        function updateAISignals() {
            try { chart.removeOverlay({ groupId: 'ai_signals' }); } catch(e) {}
            if (!activeIndicatorsList.includes('AI_SIGNALS')) return;
            
            const dataList = chart.getDataList();
            if (!dataList || dataList.length === 0) return;
            
            // Draw a buy/sell signal every 40 candles (deterministic for demo)
            for (let i = 15; i < dataList.length; i += 35) {
                const candle = dataList[i];
                const isBuy = (i % 2 === 0);
                const price = isBuy ? candle.low : candle.high;
                
                chart.createOverlay({
                    groupId: 'ai_signals',
                    name: 'aiSignal',
                    points: [{ timestamp: candle.timestamp, value: price }],
                    lock: true,
                    extendData: { isBuy: isBuy, price: price }
                });
            }
        }

        function updateAIZones() {
            try { chart.removeOverlay({ groupId: 'ai_zones' }); } catch(e) {}
            if (!activeIndicatorsList.includes('AI_ZONES')) return;
            
            const dataList = chart.getDataList();
            if (!dataList || dataList.length === 0) return;
            
            const recent = dataList.slice(-100);
            let highest = -Infinity;
            let lowest = Infinity;
            recent.forEach(c => {
                if (c.high > highest) highest = c.high;
                if (c.low < lowest) lowest = c.low;
            });
            
            const range = highest - lowest;
            if (range <= 0) return;
            
            const supplyTop = highest;
            const supplyBottom = highest - range * 0.05;
            const demandTop = lowest + range * 0.05;
            const demandBottom = lowest;
            
            const tFirst = dataList[0].timestamp;
            const tLast = dataList[dataList.length - 1].timestamp;
            
            chart.createOverlay({
                groupId: 'ai_zones',
                name: 'aiZone',
                points: [
                    { timestamp: tFirst, value: supplyTop },
                    { timestamp: tLast, value: supplyBottom }
                ],
                lock: true,
                extendData: { isDemand: false }
            });
            
            chart.createOverlay({
                groupId: 'ai_zones',
                name: 'aiZone',
                points: [
                    { timestamp: tFirst, value: demandTop },
                    { timestamp: tLast, value: demandBottom }
                ],
                lock: true,
                extendData: { isDemand: true }
            });
        }

        function updateAITrends() {
            try { chart.removeOverlay({ groupId: 'ai_trends' }); } catch(e) {}
            if (!activeIndicatorsList.includes('AI_TREND')) return;
            
            const dataList = chart.getDataList();
            if (!dataList || dataList.length < 40) return;
            
            const n = dataList.length;
            const p1Idx = n - 35;
            const p2Idx = n - 5;
            
            const c1 = dataList[p1Idx];
            const c2 = dataList[p2Idx];
            
            chart.createOverlay({
                groupId: 'ai_trends',
                name: 'aiTrendline',
                points: [
                    { timestamp: c1.timestamp, value: c1.high * 1.002 },
                    { timestamp: c2.timestamp, value: c2.high * 0.998 }
                ],
                lock: true,
                extendData: { isSupport: false }
            });
            
            chart.createOverlay({
                groupId: 'ai_trends',
                name: 'aiTrendline',
                points: [
                    { timestamp: c1.timestamp, value: c1.low * 0.998 },
                    { timestamp: c2.timestamp, value: c2.low * 1.002 }
                ],
                lock: true,
                extendData: { isSupport: true }
            });
        }

        // Re-render buttons when chart scrolls/zooms
        chart.subscribeAction('onZoom', () => { setTimeout(renderPositionButtons, 50); });
        chart.subscribeAction('onScroll', () => { setTimeout(renderPositionButtons, 50); });
        
        window.addEventListener('resize', () => {
            try {
                chart.resize();
                setTimeout(renderPositionButtons, 50);
            } catch(e) {}
        });
        
        let initialData = [];
        try {
            initialData = ${initialDataStr};
            if(initialData && initialData.length > 0) {
                chart.applyNewData(initialData);
                updateAISignals();
                updateAIZones();
                updateAITrends();
            }
        } catch(e) {
            document.getElementById('errlog').style.display = 'block'; document.getElementById('errlog').innerHTML += 'INITIAL DATA ERR: ' + e.message + '<br>';
        }

        // Signal to parent that chart is ready to receive data
        sendMsgToApp({ type: 'chartReady' });

        function handleIncomingMessage(incomingData) {
            try {
                let data = incomingData;
                if (typeof data === 'string') data = JSON.parse(data);
                if (data.type === 'clear') {
                    chart.clearData();
                } else if (data.type === 'historical') {
                    chart.applyNewData(data.data);
                    updateAISignals();
                    updateAIZones();
                    updateAITrends();
                } else if (data.type === 'update') {
                    const dataList = chart.getDataList();
                    const incoming = data.data;
                    const price = incoming.close ?? incoming.price;
                    if (!price || isNaN(price)) return;
                    if (dataList.length > 0) {
                        const last = dataList[dataList.length - 1];
                        if (last.timestamp === incoming.timestamp) {
                            last.close = price;
                            last.high = Math.max(last.high, price);
                            last.low = Math.min(last.low, price);
                            chart.updateData(last);
                        } else {
                            chart.updateData({ timestamp: incoming.timestamp, open: price, close: price, high: price, low: price, volume: 0 });
                        }
                    } else {
                        chart.updateData({ timestamp: incoming.timestamp, open: price, close: price, high: price, low: price, volume: 0 });
                    }
                    updateAISignals();
                    updateAIZones();
                    updateAITrends();
                } else if (data.type === 'changeType') {
                    chart.setStyles({ candle: { type: data.chartType === 'line' ? 'area' : 'candle_solid' } });
                } else if (data.type === 'draw') {
                    isEraserMode = false;
                    chart.createOverlay({ name: data.overlay.name, groupId: 'drawings' });
                } else if (data.type === 'removeDrawings') {
                    isEraserMode = false;
                    try { chart.removeOverlay({ groupId: 'drawings' }); } catch(e) {}
                } else if (data.type === 'toggleEraser') {
                    isEraserMode = !isEraserMode;
                    sendMsgToApp({ type: 'toast', msg: isEraserMode ? 'Eraser Mode ON - Tap a drawing to remove it' : 'Eraser Mode OFF' });
                } else if (data.type === 'addIndicator') {
                    if (['AI_SIGNALS', 'AI_ZONES', 'AI_TREND'].includes(data.name)) {
                        if (!activeIndicatorsList.includes(data.name)) {
                            activeIndicatorsList.push(data.name);
                        }
                        updateAISignals();
                        updateAIZones();
                        updateAITrends();
                    } else {
                        chart.createIndicator(data.name, data.isMain, { id: data.isMain ? 'candle_pane' : 'pane_' + data.name });
                    }
                } else if (data.type === 'removeIndicator') {
                    if (['AI_SIGNALS', 'AI_ZONES', 'AI_TREND'].includes(data.name)) {
                        activeIndicatorsList = activeIndicatorsList.filter(x => x !== data.name);
                        updateAISignals();
                        updateAIZones();
                        updateAITrends();
                    } else {
                        const paneId = data.isMain ? 'candle_pane' : 'pane_' + data.name;
                        chart.removeIndicator(paneId, data.name);
                    }
                } else if (data.type === 'changeTheme') {
                    window.chartTheme = data.theme;
                    const isMonochrome = data.theme.upColor.toLowerCase() === '#ffffff';
                    chart.setStyles({
                        candle: {
                            area: {
                                lineColor: data.theme.upColor,
                                backgroundColor: [
                                    { offset: 0, color: data.theme.upColor + '60' },
                                    { offset: 1, color: data.theme.upColor + '00' }
                                ]
                            },
                            bar: {
                                upColor: data.theme.upColor,
                                downColor: data.theme.downColor,
                                upBorderColor: data.theme.upColor,
                                downBorderColor: data.theme.downColor,
                                upWickColor: data.theme.upColor,
                                downWickColor: data.theme.downColor
                            },
                            priceMark: {
                                last: {
                                    upColor: data.theme.upColor,
                                    downColor: data.theme.downColor,
                                    text: {
                                        color: isMonochrome ? '#000000' : '#FFFFFF'
                                    }
                                }
                            }
                        }
                    });
                    updateAISignals();
                    updateAIZones();
                    updateAITrends();
                    redrawPositions();
                } else if (data.type === 'drawPositions') {
                    positionsStore = data.positions;
                    redrawPositions();
                } else if (data.type === 'changeAppColors') {
                    document.body.style.backgroundColor = data.colors.background;
                    document.body.style.color = data.colors.text;
                    chart.setStyles({
                        grid: {
                            horizontal: { color: data.colors.border },
                            vertical: { color: data.colors.border }
                        },
                        xAxis: { tickText: { color: data.colors.textMuted } },
                        yAxis: { tickText: { color: data.colors.textMuted } }
                    });
                }
            } catch (e) {
                document.getElementById('errlog').style.display = 'block'; document.getElementById('errlog').innerHTML += 'MSG ERR: ' + e.message + '<br>';
            }
        }
        window.handleChartMessageFromApp = handleIncomingMessage;
        window.addEventListener('message', (event) => {
            handleIncomingMessage(event.data);
        });

        window.addEventListener('resize', () => { chart.resize(); });
        true;
    </script>
</body>
</html>
`;
const CHART_THEMES = [
  { id: 'tradingview', name: 'TradingView', desc: 'Classic Teal / Red', up: '#089981', down: '#F23645', glowUp: 'rgba(8, 153, 129, 0.15)', glowDown: 'rgba(242, 54, 69, 0.15)' },
  { id: 'neon_cyber', name: 'Neon Cyber', desc: 'Bright Green / Pink', up: '#00FF88', down: '#FF0055', glowUp: 'rgba(0, 255, 136, 0.15)', glowDown: 'rgba(255, 0, 85, 0.15)' },
  { id: 'ocean', name: 'Ocean', desc: 'Sky Blue / Orange', up: '#00A2FF', down: '#FF8C00', glowUp: 'rgba(0, 162, 255, 0.15)', glowDown: 'rgba(255, 140, 0, 0.15)' },
  { id: 'gold_rush', name: 'Gold Rush', desc: 'Gold / Crimson', up: '#FFD700', down: '#CD1C1C', glowUp: 'rgba(255, 215, 0, 0.15)', glowDown: 'rgba(205, 28, 28, 0.15)' },
  { id: 'violet_dream', name: 'Violet Dream', desc: 'Purple / Rose', up: '#9D4EDD', down: '#FF6B6B', glowUp: 'rgba(157, 78, 221, 0.15)', glowDown: 'rgba(255, 107, 107, 0.15)' },
  { id: 'matrix', name: 'Matrix', desc: 'Lime / Red-Pink', up: '#39FF14', down: '#FF4D4D', glowUp: 'rgba(57, 255, 20, 0.15)', glowDown: 'rgba(255, 77, 77, 0.15)' },
  { id: 'sakura', name: 'Sakura', desc: 'Pink / Indigo', up: '#FF85A2', down: '#4361EE', glowUp: 'rgba(255, 133, 162, 0.15)', glowDown: 'rgba(67, 97, 238, 0.15)' },
  { id: 'monochrome', name: 'Monochrome', desc: 'White / Gray', up: '#FFFFFF', down: '#4A5568', glowUp: 'rgba(255, 255, 255, 0.15)', glowDown: 'rgba(74, 85, 104, 0.15)' }
];

const hexToRgba = (hex: string, alpha: number) => {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getContrastColor = (hex: string) => {
  if (!hex) return '#FFFFFF';
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  if (c.length !== 6) return '#FFFFFF';
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#FFFFFF';
};

const ThemeBadge = ({ upColor, downColor }: { upColor: string; downColor: string }) => (
  <View style={{ flexDirection: 'row', gap: 4, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 6, height: 18, borderRadius: 3, backgroundColor: upColor }} />
    <View style={{ width: 6, height: 18, borderRadius: 3, backgroundColor: downColor }} />
  </View>
);

const RotatedCornersIcon = ({ color, size = 80 }: { color: string; size?: number }) => {
  return (
    <View style={{ transform: [{ rotate: '45deg' }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        {/* Top-Left Corner */}
        <Path d="M 15 35 L 15 20 A 5 5 0 0 1 20 15 L 35 15" stroke={color} strokeWidth="6" strokeLinecap="round" />
        {/* Top-Right Corner */}
        <Path d="M 65 15 L 80 15 A 5 5 0 0 1 85 20 L 85 35" stroke={color} strokeWidth="6" strokeLinecap="round" />
        {/* Bottom-Right Corner */}
        <Path d="M 85 65 L 85 80 A 5 5 0 0 1 80 85 L 65 85" stroke={color} strokeWidth="6" strokeLinecap="round" />
        {/* Bottom-Left Corner */}
        <Path d="M 35 85 L 20 85 A 5 5 0 0 1 15 80 L 15 65" stroke={color} strokeWidth="6" strokeLinecap="round" />
      </Svg>
    </View>
  );
};

export default function ChartScreen({ navigation, route }: any) {
  const { colors, isDark } = useTheme();
  const { selectedAccount, syncFromServer, updateAccountData } = useAccountStore();
  const [isExecuting, setIsExecuting] = useState(false);

  const pillStyle = {
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
      },
      default: {}
    })
  };

  const initialSymbol = route?.params?.symbol || 'BTC/USDT';
  const [symbol, setSymbol] = useState(initialSymbol);

  // Chart color theme — must be declared before any useEffect that references it
  const [chartTheme, setChartTheme] = useState(CHART_THEMES[0]);
  const [isThemesExpanded, setIsThemesExpanded] = useState(false);

  const [isSymbolSelectorOpen, setIsSymbolSelectorOpen] = useState(false);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const toggleCategory = (title) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };
  const [livePrice, setLivePrice] = useState('...');

  useEffect(() => {
    if (route?.params?.symbol) {
      setSymbol(route.params.symbol);
    }
  }, [route?.params?.symbol]);

  // Load saved chart color theme on mount
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const savedThemeId = await getItemAsync('chartThemeId');
        if (savedThemeId) {
          const matched = CHART_THEMES.find(t => t.id === savedThemeId);
          if (matched) {
            setChartTheme(matched);
          }
        }
      } catch (e) {
        console.log("Failed to load chart theme", e);
      }
    };
    loadSavedTheme();
  }, []);

  // Sync theme changes to the WebView
  useEffect(() => {
    sendMessageToChart(JSON.stringify({
      type: 'changeTheme',
      theme: {
        upColor: chartTheme.up,
        downColor: chartTheme.down
      }
    }));
  }, [chartTheme]);

  // Sync light/dark mode color changes to the WebView dynamically without reloading
  useEffect(() => {
    sendMessageToChart(JSON.stringify({
      type: 'changeAppColors',
      colors: {
        background: colors.background,
        text: colors.text,
        border: colors.border,
        textMuted: colors.textMuted
      }
    }));
  }, [colors]);

  // Memoize chart HTML - only regenerate when symbol changes (theme/colors update dynamically via message passing without reloading)
  const chartHtml = useMemo(() => getChartHtml(symbol, colors), [symbol]);

  // Toolbar state
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [isDrawingsOpen, setIsDrawingsOpen] = useState(false);
  const [isIntervalsOpen, setIsIntervalsOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['VOL']);
  const [drawingTab, setDrawingTab] = useState('Trend lines');
  const [isChartMenuOpen, setIsChartMenuOpen] = useState(false);
  const [isTradeUIHidden, setIsTradeUIHidden] = useState(false);
  const [isIndicatorsUIHidden, setIsIndicatorsUIHidden] = useState(false);

  // New Features State
  const [isDomOpen, setIsDomOpen] = useState(false);
  const [riskPercent, setRiskPercent] = useState('2');
  const [trailingStopDistance, setTrailingStopDistance] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { width, height } = useWindowDimensions();
  const orientation = width > height ? 'landscape' : 'portrait';

  const isMobileDevice = useMemo(() => {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.userAgent) {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      }
    }
    return Platform.OS !== 'web';
  }, []);

  const isTradeUIBlocked = isFullscreen || (isMobileDevice && orientation === 'landscape');

  // Order Panel State
  const [isOrderPanelOpen, setIsOrderPanelOpen] = useState(false);
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP'>('MARKET');
  const [orderTargetPrice, setOrderTargetPrice] = useState('');
  const [orderVolume, setOrderVolume] = useState('1.00');
  const [orderTP, setOrderTP] = useState('');
  const [orderSL, setOrderSL] = useState('');
  
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [isModifyPanelOpen, setIsModifyPanelOpen] = useState(false);
  const [modifyTP, setModifyTP] = useState('');
  const [modifySL, setModifySL] = useState('');

  // Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const openPositionsRef = useRef<any[]>([]);
  const chartReadyRef = useRef(false);
  const pendingMessagesRef = useRef<string[]>([]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  // Listen for fullscreen change events (web)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('MSFullscreenChange', handleFullscreenChange);

      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      };
    }
  }, []);

  // Sync navigation tab bar visibility with fullscreen state and orientation
  useEffect(() => {
    if (navigation && typeof navigation.setOptions === 'function') {
      const shouldHideTabBar = isFullscreen || (isMobileDevice && orientation === 'landscape');
      if (shouldHideTabBar) {
        navigation.setOptions({
          tabBarStyle: { display: 'none' }
        });
      } else {
        navigation.setOptions({
          tabBarStyle: {
            backgroundColor: 'transparent',
            borderTopColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            shadowColor: 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 0,
            height: isTelegram ? 54 : 60,
            paddingBottom: isTelegram ? 4 : 8,
            paddingTop: 8,
          }
        });
      }
    }
  }, [isFullscreen, orientation, isMobileDevice, navigation]);

  const toggleFullscreen = () => {
    showToast("Rotate Your Phone", "info");
    setIsFullscreen(prev => !prev);
    if (Platform.OS === 'web') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const webviewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fetchHistoryRef = useRef<(() => void) | null>(null);
  const lastHistoricalDataRef = useRef<any>(null);

  const fetchPositions = async () => {
    try {
      const token = await getItemAsync('accessToken');
      const res = await axios.get(`${BACKEND_URL}/api/v1/trade/positions?accountId=${selectedAccount.id}&t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        const positions = res.data.data.positions || res.data.data;
        openPositionsRef.current = positions.filter((p: any) => p.status === 'OPEN' || p.status === 'PENDING');
        if (res.data.data.account) {
          updateAccountData({ balance: res.data.data.account.balance });
        }
        if (res.data.data.accounts) {
          syncFromServer(res.data.data.accounts);
        }
      }
    } catch (err) {
      console.log('ChartScreen: Failed to fetch positions');
    }
  };

  useEffect(() => {
    setLivePrice('...');
    lastHistoricalDataRef.current = null; // Clear cached history for new symbol/interval
    fetchPositions();

    // Reset chart ready for the new symbol
    chartReadyRef.current = false;
    pendingMessagesRef.current = [];

    // Fallback for Web: if chartReady event is missed due to fast iframe load race condition
    const fallback = setTimeout(() => {
        if (!chartReadyRef.current) {
            console.log('[Chart] Fallback: Forcing chart ready for symbol:', symbol);
            chartReadyRef.current = true;
            const pending = [...pendingMessagesRef.current];
            pendingMessagesRef.current = [];
            for (const pendingMsg of pending) {
                sendMessageToChartDirect(pendingMsg);
            }
        }
    }, 1500);

    const fetchHistory = async () => {
      try {
        // Clear old candles when interval changes
        sendMessageToChart(JSON.stringify({ type: 'clear' }));
        
        const urlSafeSymbol = symbol.replace('/', '-');
        const response = await axios.get(`${BACKEND_URL}/api/v1/market/candles/${urlSafeSymbol}?interval=${selectedInterval.toLowerCase()}&limit=500`);
        if (!response.data || response.data.length === 0) return;
                const getSnapSeconds = (interval: string) => {
          if (interval === '1m') return 60;
          if (interval === '5m') return 300;
          if (interval === '15m') return 900;
          if (interval === '30m') return 1800;
          if (interval === '1h') return 3600;
          if (interval === '4h') return 14400;
          if (interval === '1d') return 86400;
          if (interval === '1w') return 604800;
          return 3600;
        };
        const snapSeconds = getSnapSeconds(selectedInterval);

        const formattedData = response.data.map((item: any) => {
          const currentUnixTime = Math.floor(new Date(item.timestamp).getTime() / 1000);
          const snappedTime = currentUnixTime - (currentUnixTime % snapSeconds);
          return {
            timestamp: snappedTime * 1000,
            open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume || 0
          };
        }).sort((a: any, b: any) => a.timestamp - b.timestamp);

        const uniqueData = formattedData.filter((item: any, index: number, arr: any[]) => index === 0 || item.timestamp !== arr[index - 1].timestamp);

        const messageStr = JSON.stringify({ type: 'historical', data: uniqueData });
        lastHistoricalDataRef.current = uniqueData; // Cache it!
        sendMessageToChart(messageStr);
      } catch (error) {
        console.error("ChartScreen: Failed to fetch historical data", error);
      }
    };

    fetchHistoryRef.current = fetchHistory;

    // When symbol changes, iframe reloads so we need to wait for chartReady again
    // When only interval changes, iframe stays the same so chart is already ready
    if (!chartReadyRef.current) {
      // Chart not ready yet (first load or symbol changed), data will be queued
      fetchHistory();
    } else {
      // Chart is already ready (only interval changed), send data immediately
      fetchHistory();
    }

    const socket = io(BACKEND_URL, {
      transports: ['websocket']
    });
    socket.on('connect', async () => {
      socket.emit('subscribe', symbol);
      // Join user room for position updates
      const token = await getItemAsync('accessToken');
      if (token) {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64));
          const userId = payload.sub || payload.id;
          if (userId) socket.emit('joinUserRoom', userId);
        } catch (e) {
          console.log('[Socket] Error joining user room in ChartScreen:', e);
        }
      }
    });

    // Debounce fetchPositions to prevent API DDOS from rapid socket events
    let fetchTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetchPositions = () => {
      if (fetchTimer) clearTimeout(fetchTimer);
      fetchTimer = setTimeout(() => fetchPositions(), 500);
    };

    socket.on('positionOpened', (data: any) => {
      // If the new position data is included in the event, add it directly to the ref
      if (data?.position && (data.position.status === 'OPEN' || data.position.status === 'PENDING')) {
        const exists = openPositionsRef.current.find((p: any) => p.id === data.position.id || p._id === data.position._id);
        if (!exists) {
          openPositionsRef.current = [...openPositionsRef.current, data.position];
          sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));
        }
      }
      // Always sync with server to get accurate data, but debounced
      debouncedFetchPositions();
    });
    socket.on('positionClosed', (data: any) => {
      const closedId = data?.positionId || data?.position?.id || data?.position?._id;
      if (closedId) {
        openPositionsRef.current = openPositionsRef.current.filter(p => p.id !== closedId && p._id !== closedId);
      } else {
        openPositionsRef.current = [];
      }
      sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));
      // Sync with server to ensure consistency, debounced
      debouncedFetchPositions();
    });
    socket.on('stopOut', (data: any) => {
      const closedId = data?.positionId;
      if (closedId) {
        openPositionsRef.current = openPositionsRef.current.filter(p => p.id !== closedId && p._id !== closedId);
      } else {
        openPositionsRef.current = [];
      }
      sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));
      debouncedFetchPositions();
    });

    socket.on('priceUpdate', (data) => {
      if (data.symbol === symbol) {
        setLivePrice(data.price.toFixed(2));
        
        const getSnapSeconds = (interval: string) => {
          if (interval === '1m') return 60;
          if (interval === '5m') return 300;
          if (interval === '15m') return 900;
          if (interval === '30m') return 1800;
          if (interval === '1h') return 3600;
          if (interval === '4h') return 14400;
          if (interval === '1d') return 86400;
          if (interval === '1w') return 604800;
          return 3600;
        };
        const snapSeconds = getSnapSeconds(selectedInterval);

        const currentUnixTime = Math.floor(new Date(data.timestamp).getTime() / 1000);
        const snappedTime = currentUnixTime - (currentUnixTime % snapSeconds);
        const updateData = { timestamp: snappedTime * 1000, open: data.price, high: data.price, low: data.price, close: data.price, volume: 0 };
        sendMessageToChart(JSON.stringify({ type: 'update', data: updateData }));

        // Update positions overlay with live PnL
        const chartPositions = openPositionsRef.current.filter(p => p.symbol === symbol).map(pos => {
             // Revalue on the closing side using the contract terms the
             // server ships with each position.
             const mark = markPrice(pos.side, data);
             const pnl = mark === undefined ? null : revaluePnL(pos, mark);
             return pnl === null ? pos : { ...pos, unrealizedPnL: pnl };
        });
        // Always call drawPositions, even if empty, so it clears them if all were closed
        sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: chartPositions }));
      }
    });

    const handleWebMessage = (e: any) => {
      // ignore react devtools
      if (e.data && e.data.source === 'react-devtools-bridge') return;
      handleChartMessage({ nativeEvent: { data: e.data } });
    };

    if (Platform.OS === 'web') {
      window.addEventListener('message', handleWebMessage);
    }

    return () => {
      clearTimeout(fallback);
      if (fetchTimer) clearTimeout(fetchTimer);
      socket.emit('unsubscribe', symbol);
      socket.disconnect();
      if (Platform.OS === 'web') window.removeEventListener('message', handleWebMessage);
    };
  }, [symbol, selectedInterval, selectedAccount.id]);

  useEffect(() => {
    sendMessageToChart(JSON.stringify({ type: 'changeType', chartType }));
  }, [chartType]);

  const handleChartMessage = async (event: any) => {
    let msg = event.data || event.nativeEvent?.data;
    try {
      if (typeof msg === 'string') msg = JSON.parse(msg);
      if (msg.type === 'chartReady') {
        console.log('[Chart] Chart is ready, flushing', pendingMessagesRef.current.length, 'pending messages');
        chartReadyRef.current = true;
        
        const initialMessages = [
          JSON.stringify({
            type: 'changeTheme',
            theme: {
              upColor: chartTheme.up,
              downColor: chartTheme.down
            }
          }),
          JSON.stringify({
            type: 'changeAppColors',
            colors: {
              background: colors.background,
              text: colors.text,
              border: colors.border,
              textMuted: colors.textMuted
            }
          }),
          // Send all active indicators
          ...activeIndicators.map(id => {
            const ind = INDICATORS.find(i => i.id === id);
            return JSON.stringify({
              type: 'addIndicator',
              name: id,
              isMain: ind ? ind.isMain : false
            });
          }),
          // Draw current positions
          JSON.stringify({
            type: 'drawPositions',
            positions: openPositionsRef.current.filter((p: any) => p.symbol === symbol)
          }),
          ...pendingMessagesRef.current
        ];
        pendingMessagesRef.current = [];
        
        setTimeout(() => {
          if (Platform.OS === 'web') {
            for (const pendingMsg of initialMessages) {
              sendMessageToChartDirect(pendingMsg);
            }
          } else {
            if (webviewRef.current && typeof webviewRef.current.injectJavaScript === 'function') {
              const code = initialMessages.map(msgStr => `
                if (window.handleChartMessageFromApp) {
                  window.handleChartMessageFromApp(${JSON.stringify(msgStr)});
                } else {
                  window.postMessage(${JSON.stringify(msgStr)}, '*');
                }
              `).join('\n');
              webviewRef.current.injectJavaScript(`(function(){ ${code} })();`);
            }
          }

          // Send historical data (either cached or fetch fresh)
          if (lastHistoricalDataRef.current) {
            sendMessageToChartDirect(JSON.stringify({ type: 'historical', data: lastHistoricalDataRef.current }));
          } else if (fetchHistoryRef.current) {
            fetchHistoryRef.current();
          }
        }, 150);
        return;
      }
      if (msg.type === 'closePosition') {
        const token = await getItemAsync('accessToken');
        const pos = openPositionsRef.current.find((p: any) => p.id === msg.positionId || p._id === msg.positionId);
        const currentPrice = pos ? (pos.currentPrice || pos.entryPrice) : undefined;
        
        // Optimistic update
        const originalPositions = [...openPositionsRef.current];
        openPositionsRef.current = openPositionsRef.current.filter(p => p.id !== msg.positionId && p._id !== msg.positionId);
        sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));

        axios.post(`${BACKEND_URL}/api/v1/trade/close`, { 
          positionId: msg.positionId,
          currentPrice: currentPrice
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
          if (res.data.success) {
            showToast(`Order Closed Successfully`, 'success');
            fetchPositions();
          } else {
            // Revert on failure
            openPositionsRef.current = originalPositions;
            sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));
          }
        }).catch(err => {
          // Revert on error
          openPositionsRef.current = originalPositions;
          sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));
          const errorMsg = err.response?.data?.message || err.message;
          showToast(`Error: ${errorMsg}`, 'error');
        });
      } else if (msg.type === 'positionClick') {
        const pos = openPositionsRef.current.find((p: any) => p.id === msg.positionId);
        if (pos) {
          setSelectedPosition(pos);
          setModifyTP(pos.takeProfit ? String(pos.takeProfit) : '');
          setModifySL(pos.stopLoss ? String(pos.stopLoss) : '');
          setTrailingStopDistance(pos.trailingStopDistance ? String(pos.trailingStopDistance) : '');
          setIsModifyPanelOpen(true);
        }
      } else if (msg.type === 'updatePositionPrice') {
        const pos = openPositionsRef.current.find((p: any) => p.id === msg.positionId);
        if (pos) {
          const isTP = msg.label === 'TP';
          axios.post(`${BACKEND_URL}/api/v1/trade/modify`, {
            positionId: pos.id,
            takeProfit: isTP ? msg.newPrice : pos.takeProfit,
            stopLoss: !isTP ? msg.newPrice : pos.stopLoss
          }).then(res => {
            if(res.data.success) {
              showToast(`${msg.label} modified to ${msg.newPrice} via Drag`, 'success');
              fetchPositions();
            }
          }).catch((err: any) => {
            const errorMsg = err.response?.data?.message || err.message;
            showToast(`Error: ${errorMsg}`, 'error');
          });
        }
      } else if (msg.type === 'toast') {
        showToast(msg.msg, 'info');
      }
    } catch(e) { console.log("Chart Message Error", e); }
  };

  const sendMessageToChartDirect = (messageStr: string) => {
    if (Platform.OS === 'web') {
      if (iframeRef.current && iframeRef.current.contentWindow) iframeRef.current.contentWindow.postMessage(messageStr, '*');
    } else {
      if (webviewRef.current && typeof webviewRef.current.injectJavaScript === 'function') {
        webviewRef.current.injectJavaScript(`
          (function() {
            if (window.handleChartMessageFromApp) {
              window.handleChartMessageFromApp(${JSON.stringify(messageStr)});
            } else {
              window.postMessage(${JSON.stringify(messageStr)}, '*');
            }
          })();
        `);
      }
    }
  };

  const sendMessageToChart = (messageStr: string) => {
    if (chartReadyRef.current) {
      sendMessageToChartDirect(messageStr);
    } else {
      pendingMessagesRef.current.push(messageStr);
    }

  };

  const handleToolSelect = (tool: any) => {
    setIsDrawingsOpen(false);
    if (tool.id === 'remove') {
      sendMessageToChart(JSON.stringify({ type: 'removeDrawings' }));
      showToast('All drawings removed', 'success');
    } else if (tool.id === 'eraser') {
      sendMessageToChart(JSON.stringify({ type: 'toggleEraser' }));
    } else if (tool.overlay) {
      sendMessageToChart(JSON.stringify({ type: 'draw', overlay: { name: tool.overlay } }));
      showToast(`Draw ${tool.label}: Tap on chart to place points`, 'info');
    }
  };

  const toggleIndicator = (indicator: any) => {
    const isActive = activeIndicators.includes(indicator.id);
    setActiveIndicators(isActive ? activeIndicators.filter(id => id !== indicator.id) : [...activeIndicators, indicator.id]);
    sendMessageToChart(JSON.stringify({ type: isActive ? 'removeIndicator' : 'addIndicator', name: indicator.id, isMain: indicator.isMain }));
  };

  const [riskInfo, setRiskInfo] = useState('');
  
  const calculateAutoLot = async () => {
    if (!riskPercent || !orderSL || !livePrice || livePrice === '...') return;
    try {
      const currentP = parseFloat(livePrice);
      const slP = parseFloat(orderSL);
      const slDistance = Math.abs(currentP - slP);
      if (slDistance <= 0) return;
      
      const res = await axios.post(`${BACKEND_URL}/api/v1/trade/calculate-lot`, {
        symbol,
        riskPercent: Number(riskPercent),
        stopLossDistance: slDistance
      });
      if (res.data.success) {
        setOrderVolume(String(res.data.data.lotSize));
        setRiskInfo(res.data.data.warningMsg || '');
      }
    } catch (e) {
      console.log('Risk calc error', e);
    }
  };

  const executeTrade = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    try {
      const token = await getItemAsync('accessToken');
      const response = await axios.post(`${BACKEND_URL}/api/v1/trade/execute`, {
        symbol,
        side: orderSide,
        orderType,
        targetPrice: orderType !== 'MARKET' ? Number(orderTargetPrice) : undefined,
        volume: Number(orderVolume),
        takeProfit: orderTP ? Number(orderTP) : undefined,
        stopLoss: orderSL ? Number(orderSL) : undefined,
        trailingStopDistance: trailingStopDistance ? Number(trailingStopDistance) : 0,
        currentPrice: parseFloat(livePrice) || 0,
        accountId: selectedAccount.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if(response.data.success) {
        setIsOrderPanelOpen(false);
        showToast(`${orderSide} ${orderType !== 'MARKET' ? orderType : ''} ${orderVolume} ${symbol} executed!`, 'success');
        const newPos = response.data.data;
        if (newPos) {
          const exists = openPositionsRef.current.find((p: any) => p.id === newPos.id || p._id === newPos._id);
          if (!exists) {
            openPositionsRef.current = [...openPositionsRef.current, newPos];
            sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));
          }
        }
        fetchPositions();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      showToast(`Error: ${msg}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const executeInstantTrade = async (side: 'BUY' | 'SELL') => {
    if (isExecuting) return;
    setIsExecuting(true);
    try {
      const token = await getItemAsync('accessToken');
      const response = await axios.post(`${BACKEND_URL}/api/v1/trade/execute`, {
        symbol,
        side: side,
        orderType: 'MARKET',
        volume: Number(orderVolume),
        currentPrice: parseFloat(livePrice) || 0,
        accountId: selectedAccount.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if(response.data.success) {
        showToast(`${side} INSTANT ${orderVolume} ${symbol} executed!`, 'success');
        const newPos = response.data.data;
        if (newPos) {
          const exists = openPositionsRef.current.find((p: any) => p.id === newPos.id || p._id === newPos._id);
          if (!exists) {
            openPositionsRef.current = [...openPositionsRef.current, newPos];
            sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));
          }
        }
        fetchPositions();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      showToast(`Error: ${msg}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const executeModifyTrade = async () => {
    if (!selectedPosition) return;
    try {
      const token = await getItemAsync('accessToken');
      const response = await axios.post(`${BACKEND_URL}/api/v1/trade/modify`, {
        positionId: selectedPosition.id,
        takeProfit: modifyTP ? Number(modifyTP) : undefined,
        stopLoss: modifySL ? Number(modifySL) : undefined,
        trailingStopDistance: trailingStopDistance ? Number(trailingStopDistance) : 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if(response.data.success) {
        setIsModifyPanelOpen(false);
        showToast(selectedPosition?.status === 'PENDING' ? `Order modified successfully!` : `Position modified successfully!`, 'success');
        fetchPositions();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      showToast(`Error: ${msg}`, 'error');
    }
  };

  const executeCloseTrade = async () => {
    if (!selectedPosition) return;
    const targetId = selectedPosition.id || selectedPosition._id;
    const originalPositions = [...openPositionsRef.current];

    // Optimistic update
    setIsModifyPanelOpen(false);
    openPositionsRef.current = openPositionsRef.current.filter(p => p.id !== targetId && p._id !== targetId);
    sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));

    try {
      const token = await getItemAsync('accessToken');
      const res = await axios.post(`${BACKEND_URL}/api/v1/trade/close`, { 
        positionId: targetId,
        currentPrice: selectedPosition.currentPrice || selectedPosition.entryPrice
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if(res.data.success) {
        showToast(selectedPosition?.status === 'PENDING' ? `Order Cancelled Successfully` : `Order Closed Successfully`, 'success');
        fetchPositions();
      } else {
        // Revert on failure
        openPositionsRef.current = originalPositions;
        sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));
        setIsModifyPanelOpen(true);
      }
    } catch(e: any) {
      // Revert on error
      openPositionsRef.current = originalPositions;
      sendMessageToChart(JSON.stringify({ type: 'drawPositions', positions: openPositionsRef.current.filter(p => p.symbol === symbol) }));
      setIsModifyPanelOpen(true);
      const errorMsg = e.response?.data?.message || e.message;
      showToast(`Error: ${errorMsg}`, 'error');
    }
  };

  const renderDrawingsModal = () => (
    <CustomBlurModal visible={isDrawingsOpen} transparent={true} animationType="slide" onRequestClose={() => setIsDrawingsOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsDrawingsOpen(false)} activeOpacity={1} />
        <BlurView 
            experimentalBlurMethod="regular"
            intensity={100} 
            tint={colors.blurTint} 
            style={[
              styles.drawingsModal, 
              { 
                height: '80%', 
                backgroundColor: isDark ? '#000000' : 'rgba(255, 255, 255, 0.96)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
                borderBottomWidth: 0,
                ...Platform.select({
                  web: {
                    backdropFilter: 'blur(20px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  },
                  default: {}
                })
              }
            ]}
        >
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={[styles.modalHeader, { justifyContent: 'space-between', marginBottom: 16 }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Drawing Tools</Text>
            <TouchableOpacity onPress={() => setIsDrawingsOpen(false)}><X color={colors.textMuted} size={24} /></TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }}>
            {DRAWING_TABS.map(tab => (
              <TouchableOpacity key={tab} style={[styles.drawingTab, drawingTab === tab && styles.drawingTabActive]} onPress={() => setDrawingTab(tab)}>
                <Text style={[styles.drawingTabText, drawingTab === tab && styles.drawingTabTextActive, { color: colors.text }]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.drawingToolsGrid}>
              {(DRAWING_TOOLS[drawingTab] || []).map(tool => (
                <TouchableOpacity key={tool.id} style={styles.drawingToolItem} onPress={() => handleToolSelect(tool)}>
                  <View style={styles.drawingToolIconWrapper}>
                    <tool.icon color={colors.text} size={22} />
                  </View>
                  <Text style={[styles.drawingToolLabel, { color: colors.text }]} numberOfLines={1}>{tool.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </BlurView>
      </View>
    </CustomBlurModal>
  );

  const renderOrderPanelModal = () => (
    <CustomBlurModal visible={isOrderPanelOpen} transparent={true} animationType="slide" onRequestClose={() => setIsOrderPanelOpen(false)}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsOrderPanelOpen(false)} activeOpacity={1} />
          <BlurView 
            experimentalBlurMethod="regular"
            intensity={100} 
            tint={colors.blurTint} 
            style={{ 
              borderTopLeftRadius: 20, 
              borderTopRightRadius: 20, 
              padding: 12, 
              height: 'auto', 
              maxHeight: '85%', 
              paddingBottom: Platform.OS === 'ios' ? 30 : 10, 
              paddingTop: 10, 
              backgroundColor: isDark ? '#000000' : 'rgba(255, 255, 255, 0.96)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
              borderBottomWidth: 0,
              ...Platform.select({
                web: {
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                },
                default: {}
              })
            }}
          >
            <View style={[styles.modalHandle, { marginBottom: 8, backgroundColor: colors.border }]} />
            <View style={[styles.modalHeader, { justifyContent: 'space-between', marginBottom: 4 }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>New Order</Text>
                <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Trading Account • {symbol}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsOrderPanelOpen(false)}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            {/* Order Type Tabs */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {['MARKET', 'LIMIT', 'STOP'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: orderType === type ? colors.primary : 'transparent' }}
                  onPress={() => setOrderType(type as any)}
                >
                  <Text style={{ color: orderType === type ? colors.text : colors.textMuted, fontWeight: 'bold' }}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Buy/Sell Tabs */}
            <View style={[styles.orderSideTabs, { marginBottom: 8 }]}>
              <TouchableOpacity
                style={[styles.orderSideTab, orderSide === 'SELL' && { backgroundColor: chartTheme.down }]}
                onPress={() => setOrderSide('SELL')}
              >
                <Text style={[styles.orderSideTabText, orderSide === 'SELL' && { color: '#FFF' }]}>SELL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.orderSideTab, orderSide === 'BUY' && { backgroundColor: chartTheme.up }]}
                onPress={() => setOrderSide('BUY')}
              >
                <Text style={[styles.orderSideTabText, orderSide === 'BUY' && { color: '#FFF' }]}>BUY</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              
              {/* Target Price for Limit/Stop */}
              {orderType !== 'MARKET' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Price</Text>
                  <TextInput style={[styles.basicInput, { color: colors.text, borderColor: colors.border }]} value={orderTargetPrice} onChangeText={setOrderTargetPrice} placeholder="Entry Price" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                </View>
              )}

              {/* Lots Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Volume (Lots)</Text>
                <View style={styles.numberInputContainer}>
                  <TouchableOpacity style={[styles.numberInputBtn, { borderColor: colors.border }]} onPress={() => setOrderVolume(v => (Math.max(0.01, parseFloat(v) - 0.1)).toFixed(2))}>
                    <Text style={[styles.numberInputBtnText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.numberInputField, { color: colors.text }]}
                    value={orderVolume}
                    onChangeText={setOrderVolume}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity style={[styles.numberInputBtn, { borderColor: colors.border }]} onPress={() => setOrderVolume(v => (parseFloat(v) + 0.1).toFixed(2))}>
                    <Text style={[styles.numberInputBtnText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Risk Calculator */}
              <View style={[styles.inputGroup, { marginTop: 4 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Risk % of Equity</Text>
                  <TouchableOpacity onPress={calculateAutoLot}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold' }}>⚡ Calculate Lot</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.numberInputContainer}>
                  <TouchableOpacity style={[styles.numberInputBtn, { borderColor: colors.border }]} onPress={() => setRiskPercent(v => (Math.max(0.5, parseFloat(v || '2') - 0.5)).toFixed(1))}>
                    <Text style={[styles.numberInputBtnText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.numberInputField, { color: colors.text }]}
                    value={riskPercent}
                    onChangeText={setRiskPercent}
                    keyboardType="numeric"
                    placeholder="2%"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity style={[styles.numberInputBtn, { borderColor: colors.border }]} onPress={() => setRiskPercent(v => (Math.min(100, parseFloat(v || '2') + 0.5)).toFixed(1))}>
                    <Text style={[styles.numberInputBtnText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
                {riskInfo ? (
                  <Text style={{ color: '#F59E0B', fontSize: 11, marginTop: 6, textAlign: 'center' }}>{riskInfo}</Text>
                ) : null}
              </View>

              {/* TP / SL */}
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Take Profit</Text>
                  <TextInput style={[styles.basicInput, { color: colors.text, borderColor: colors.border }]} value={orderTP} onChangeText={setOrderTP} placeholder="Price" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Stop Loss</Text>
                  <TextInput style={[styles.basicInput, { color: colors.text, borderColor: colors.border }]} value={orderSL} onChangeText={(v) => { setOrderSL(v); setRiskInfo(''); }} placeholder="Price" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                </View>
              </View>

              {/* Trailing Stop Distance */}
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Trailing Stop (Distance)</Text>
                  <Text style={{ color: trailingStopDistance ? colors.primary : colors.textMuted, fontSize: 12 }}>{trailingStopDistance ? 'Active' : 'Off'}</Text>
                </View>
                <View style={styles.numberInputContainer}>
                  <TouchableOpacity style={[styles.numberInputBtn, { borderColor: colors.border }]} onPress={() => setTrailingStopDistance(v => v ? (Math.max(0, parseFloat(v) - 10)).toFixed(0) : '0')}>
                    <Text style={[styles.numberInputBtnText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.numberInputField, { color: colors.text }]}
                    value={trailingStopDistance}
                    onChangeText={setTrailingStopDistance}
                    keyboardType="numeric"
                    placeholder="0 = Off"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity style={[styles.numberInputBtn, { borderColor: colors.border }]} onPress={() => setTrailingStopDistance(v => v ? (parseFloat(v) + 10).toFixed(0) : '10')}>
                    <Text style={[styles.numberInputBtnText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ height: 10 }} />
              
              <TouchableOpacity onPress={executeTrade}>
                <LinearGradient
                  colors={orderSide === 'BUY' ? [chartTheme.up, chartTheme.up] : [chartTheme.down, chartTheme.down]}
                  style={[styles.executeTradeBtn, { paddingVertical: 8 }]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Text style={[styles.executeTradeBtnText, { fontSize: 14, color: (orderSide === 'BUY' && chartTheme.id === 'monochrome') ? '#000000' : '#FFFFFF' }]}>Execute Order</Text>
                  <Text style={{ color: (orderSide === 'BUY' && chartTheme.id === 'monochrome') ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)', fontSize: 10, marginTop: 2 }}>{orderType === 'MARKET' ? 'at Market Price' : `at ${orderTargetPrice || 'specified price'}`}</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <View style={{ height: 4 }} />
            </ScrollView>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </CustomBlurModal>
  );

  const renderModifyPanelModal = () => (
    <CustomBlurModal visible={isModifyPanelOpen} transparent={true} animationType="slide" onRequestClose={() => setIsModifyPanelOpen(false)}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsModifyPanelOpen(false)} activeOpacity={1} />
          <BlurView 
            experimentalBlurMethod="regular"
            intensity={100} 
            tint={colors.blurTint} 
            style={{ 
              borderTopLeftRadius: 20, 
              borderTopRightRadius: 20, 
              padding: 12, 
              height: 'auto', 
              maxHeight: '85%', 
              paddingBottom: Platform.OS === 'ios' ? 30 : 10, 
              paddingTop: 10, 
              backgroundColor: isDark ? '#000000' : 'rgba(255, 255, 255, 0.96)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
              borderBottomWidth: 0,
              ...Platform.select({
                web: {
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                },
                default: {}
              })
            }}
          >
            <View style={[styles.modalHandle, { marginBottom: 12, backgroundColor: colors.border }]} />
            <View style={[styles.modalHeader, { justifyContent: 'space-between', marginBottom: 8 }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectedPosition?.status === 'PENDING' ? 'Modify Order' : 'Modify Position'}
                </Text>
                <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>{selectedPosition?.side} {selectedPosition?.volume} {symbol}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModifyPanelOpen(false)}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              
              <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, marginBottom: 16, alignItems: 'center' }}>
                <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 4 }}>
                  {selectedPosition?.status === 'PENDING' ? 'Order Price' : 'Entry Price'}
                </Text>
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>{selectedPosition?.entryPrice}</Text>
                {selectedPosition?.status !== 'PENDING' && (() => {
                  const currentPrice = livePrice !== '...' ? parseFloat(livePrice) : selectedPosition?.entryPrice;
                  // Revalue via the server-supplied contract terms; fall back
                  // to the server's own figure when they are unavailable.
                  const pnl = selectedPosition
                    ? (revaluePnL(selectedPosition, currentPrice) ?? (selectedPosition.unrealizedPnL || 0))
                    : 0;
                  return (
                    <Text style={{ color: pnl >= 0 ? chartTheme.up : chartTheme.down, fontSize: 14, marginTop: 4 }}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USD
                    </Text>
                  );
                })()}
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: chartTheme.up }]}>Take Profit</Text>
                  <View style={styles.numberInputContainer}>
                    <TouchableOpacity style={[styles.numberInputBtn, { backgroundColor: hexToRgba(chartTheme.up, 0.1) }]} onPress={() => setModifyTP(v => v ? (parseFloat(v) - 0.5).toFixed(2) : (selectedPosition?.entryPrice + 10).toString())}>
                      <Text style={[styles.numberInputBtnText, { color: chartTheme.up }]}>-</Text>
                    </TouchableOpacity>
                    <TextInput style={[styles.numberInputField, { color: chartTheme.up, fontWeight: 'bold' }]} value={modifyTP} onChangeText={setModifyTP} placeholder="Not Set" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                    <TouchableOpacity style={[styles.numberInputBtn, { backgroundColor: hexToRgba(chartTheme.up, 0.1) }]} onPress={() => setModifyTP(v => v ? (parseFloat(v) + 0.5).toFixed(2) : (selectedPosition?.entryPrice + 10).toString())}>
                      <Text style={[styles.numberInputBtnText, { color: chartTheme.up }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: chartTheme.down }]}>Stop Loss</Text>
                  <View style={styles.numberInputContainer}>
                    <TouchableOpacity style={[styles.numberInputBtn, { backgroundColor: hexToRgba(chartTheme.down, 0.1) }]} onPress={() => setModifySL(v => v ? (parseFloat(v) - 0.5).toFixed(2) : (selectedPosition?.entryPrice - 10).toString())}>
                      <Text style={[styles.numberInputBtnText, { color: chartTheme.down }]}>-</Text>
                    </TouchableOpacity>
                    <TextInput style={[styles.numberInputField, { color: chartTheme.down, fontWeight: 'bold' }]} value={modifySL} onChangeText={setModifySL} placeholder="Not Set" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                    <TouchableOpacity style={[styles.numberInputBtn, { backgroundColor: hexToRgba(chartTheme.down, 0.1) }]} onPress={() => setModifySL(v => v ? (parseFloat(v) + 0.5).toFixed(2) : (selectedPosition?.entryPrice - 10).toString())}>
                      <Text style={[styles.numberInputBtnText, { color: chartTheme.down }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Trailing Stop Distance */}
              <View style={[styles.inputGroup, { marginTop: 12 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Trailing Stop (Distance)</Text>
                  <Text style={{ color: selectedPosition?.trailingStopActivated ? '#F59E0B' : (trailingStopDistance ? colors.primary : colors.textMuted), fontSize: 12 }}>
                    {selectedPosition?.trailingStopActivated ? '🔄 Active' : (trailingStopDistance ? 'Will activate' : 'Off')}
                  </Text>
                </View>
                <View style={styles.numberInputContainer}>
                  <TouchableOpacity style={[styles.numberInputBtn, { borderColor: colors.border }]} onPress={() => setTrailingStopDistance(v => v ? (Math.max(0, parseFloat(v) - 10)).toFixed(0) : '0')}>
                    <Text style={[styles.numberInputBtnText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.numberInputField, { color: colors.text }]}
                    value={trailingStopDistance}
                    onChangeText={setTrailingStopDistance}
                    keyboardType="numeric"
                    placeholder="0 = Off"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity style={[styles.numberInputBtn, { borderColor: colors.border }]} onPress={() => setTrailingStopDistance(v => v ? (parseFloat(v) + 10).toFixed(0) : '10')}>
                    <Text style={[styles.numberInputBtnText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <TouchableOpacity onPress={executeCloseTrade} style={{ flex: 1 }}>
                  <LinearGradient colors={[chartTheme.down, chartTheme.down]} style={[styles.executeTradeBtn, { paddingVertical: 12 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={[styles.executeTradeBtnText, { color: '#FFFFFF' }]}>
                      {selectedPosition?.status === 'PENDING' ? 'Cancel Order' : 'Close Position'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={executeModifyTrade} style={{ flex: 1 }}>
                  <LinearGradient colors={[chartTheme.up, chartTheme.up]} style={[styles.executeTradeBtn, { paddingVertical: 12 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={[styles.executeTradeBtnText, { color: chartTheme.id === 'monochrome' ? '#000000' : '#FFFFFF' }]}>Modify</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              <View style={{ height: 10 }} />
            </ScrollView>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </CustomBlurModal>
  );

  const renderIndicatorsModal = () => (
    <CustomBlurModal visible={isIndicatorsOpen} transparent={true} animationType="slide" onRequestClose={() => setIsIndicatorsOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsIndicatorsOpen(false)} activeOpacity={1} />
        <BlurView 
            experimentalBlurMethod="regular"
            intensity={100} 
            tint={colors.blurTint} 
            style={[
              styles.drawingsModal, 
              { 
                height: '85%', 
                backgroundColor: isDark ? '#000000' : 'rgba(255, 255, 255, 0.96)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
                borderBottomWidth: 0,
                ...Platform.select({
                  web: {
                    backdropFilter: 'blur(20px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  },
                  default: {}
                })
              }
            ]}
        >
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={[styles.modalHeader, { justifyContent: 'space-between' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Indicators</Text>
            <TouchableOpacity onPress={() => setIsIndicatorsOpen(false)}><X color={colors.textMuted} size={24} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.intervalCategoryTitle}>PREMIUM AI INDICATORS</Text>
            {INDICATORS.filter(i => i.isPremium).map(ind => {
              const isActive = activeIndicators.includes(ind.id);
              return (
                <TouchableOpacity key={ind.id} style={styles.indicatorRow} onPress={() => toggleIndicator(ind)}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Zap color="#F59E0B" size={18} style={{ marginRight: 10 }} />
                    <View>
                      <Text style={{ color: isActive ? '#F59E0B' : colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>{ind.name}</Text>
                      <Text style={{ color: '#64748B', fontSize: 13 }}>{ind.desc}</Text>
                    </View>
                  </View>
                  <View style={[styles.checkbox, isActive && styles.checkboxActive, isActive && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }]}>
                    {isActive && <Check color={colors.surface} size={16} />}
                  </View>
                </TouchableOpacity>
              )
            })}

            <Text style={[styles.intervalCategoryTitle, { marginTop: 24 }]}>STANDARD INDICATORS</Text>
            {INDICATORS.filter(i => !i.isPremium).map(ind => {
              const isActive = activeIndicators.includes(ind.id);
              return (
                <TouchableOpacity key={ind.id} style={styles.indicatorRow} onPress={() => toggleIndicator(ind)}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isActive ? colors.primary : colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>{ind.name}</Text>
                    <Text style={{ color: '#64748B', fontSize: 13 }}>{ind.desc}</Text>
                  </View>
                  <View style={[styles.checkbox, isActive && styles.checkboxActive]}>
                    {isActive && <Check color={colors.surface} size={16} />}
                  </View>
                </TouchableOpacity>
              )
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </BlurView>
      </View>
    </CustomBlurModal>
  );

  const renderDomModal = () => (
    <CustomBlurModal visible={isDomOpen} transparent={true} animationType="slide" onRequestClose={() => setIsDomOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', flexDirection: 'row' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsDomOpen(false)} activeOpacity={1} />
        <BlurView 
            experimentalBlurMethod="regular"
            intensity={100} 
            tint={colors.blurTint} 
            style={{ 
              width: '65%', 
              height: '100%', 
              backgroundColor: isDark ? '#000000' : 'rgba(255, 255, 255, 0.96)', 
              borderLeftWidth: 1, 
              borderLeftColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
              ...Platform.select({
                web: {
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                },
                default: {}
              })
            }}
        >
          <View style={[styles.modalHeader, { justifyContent: 'space-between', marginTop: Platform.OS === 'ios' ? 40 : 20, paddingHorizontal: 16 }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Order Book (DOM)</Text>
            <TouchableOpacity onPress={() => setIsDomOpen(false)}><X color={colors.textMuted} size={24} /></TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', paddingBottom: 8 }}>
            <Text style={{ flex: 1, color: '#64748B', fontSize: 12 }}>Price</Text>
            <Text style={{ flex: 1, color: '#64748B', fontSize: 12, textAlign: 'right' }}>Volume</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {/* Mock Asks (Sells) */}
            {[...Array(10)].map((_, i) => (
              <TouchableOpacity key={'ask'+i} style={{ flexDirection: 'row', marginVertical: 4, position: 'relative' }}>
                <View style={{ position: 'absolute', right: 0, height: '100%', backgroundColor: hexToRgba(chartTheme.down, 0.15), width: `${Math.random() * 100}%` }} />
                <Text style={{ flex: 1, color: chartTheme.down, fontSize: 13, fontWeight: 'bold' }}>{(parseFloat(livePrice || '60000') + (10 - i) * 1.5).toFixed(2)}</Text>
                <Text style={{ flex: 1, color: colors.text, fontSize: 13, textAlign: 'right' }}>{(Math.random() * 5).toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
            
            <View style={{ marginVertical: 12, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>{livePrice}</Text>
              <Text style={{ color: '#64748B', fontSize: 12 }}>Spread: 0.5</Text>
            </View>

            {/* Mock Bids (Buys) */}
            {[...Array(10)].map((_, i) => (
              <TouchableOpacity key={'bid'+i} style={{ flexDirection: 'row', marginVertical: 4, position: 'relative' }}>
                <View style={{ position: 'absolute', right: 0, height: '100%', backgroundColor: hexToRgba(chartTheme.up, 0.15), width: `${Math.random() * 100}%` }} />
                <Text style={{ flex: 1, color: chartTheme.up, fontSize: 13, fontWeight: 'bold' }}>{(parseFloat(livePrice || '60000') - (i + 1) * 1.5).toFixed(2)}</Text>
                <Text style={{ flex: 1, color: colors.text, fontSize: 13, textAlign: 'right' }}>{(Math.random() * 5).toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </BlurView>
      </View>
    </CustomBlurModal>
  );

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Ambient background glowing orbs for premium glassmorphism depth */}
      {isDark && (
        <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]} pointerEvents="none">
          <View style={[styles.glowOrb, { backgroundColor: colors.glowBlue, top: -60, left: -60, opacity: isDark ? 0.25 : 0.4 }]} />
          <View style={[styles.glowOrb, { backgroundColor: colors.glowPurple, bottom: 80, right: -120, opacity: isDark ? 0.2 : 0.35 }]} />
          <View style={[styles.glowOrb, { backgroundColor: colors.glowGreen, top: '40%', left: '60%', opacity: isDark ? 0.15 : 0.25 }]} />
        </View>
      )}

      <GlassToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
      
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        {Platform.OS === 'web' ? (
          <iframe ref={iframeRef} srcDoc={chartHtml} style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }} />
        ) : (
          <WebView ref={webviewRef} originWhitelist={['*']} source={{ html: chartHtml }} style={{ backgroundColor: 'transparent' }} scrollEnabled={false} javaScriptEnabled={true} onMessage={handleChartMessage} />
        )}
      </View>

      <SafeAreaView style={styles.glassOverlaySafeArea} pointerEvents="box-none">
        {/* Top Header Row */}
        {!isChartMenuOpen && !isTradeUIBlocked && (
          <View style={styles.floatingHeaderRow} pointerEvents="box-none">
            <BlurView experimentalBlurMethod="regular" intensity={isDark ? 50 : 90} tint={colors.blurTint} style={[styles.pillContainer, pillStyle]}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setIsSymbolSelectorOpen(true)}>
                <Text style={[styles.symbolText, { color: colors.text }]}>{symbol}</Text>
                <ChevronDown color={colors.textMuted} size={18} />
              </TouchableOpacity>
            </BlurView>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} pointerEvents="box-none">
              <BlurView experimentalBlurMethod="regular" intensity={isDark ? 50 : 90} tint={colors.blurTint} style={[styles.pillContainer, pillStyle]}>
                <View style={styles.pricePill}>
                  <Text style={[styles.priceText, { color: colors.text }]}>{livePrice !== '...' ? `$${livePrice}` : 'Loading...'}</Text>
                </View>
              </BlurView>
            </View>
          </View>
        )}

        {/* Toolbar Row */}
        {!isChartMenuOpen && !isTradeUIBlocked && (
          <View style={styles.floatingToolbarRow} pointerEvents="box-none">
            <BlurView experimentalBlurMethod="regular" intensity={isDark ? 50 : 90} tint={colors.blurTint} style={[styles.pillContainer, pillStyle]}>
              <TouchableOpacity onPress={() => setIsDrawingsOpen(true)} style={styles.iconButton}><PenTool color={colors.text} size={20} /></TouchableOpacity>
            </BlurView>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} pointerEvents="box-none">
              <BlurView experimentalBlurMethod="regular" intensity={isDark ? 50 : 90} tint={colors.blurTint} style={[styles.pillContainer, pillStyle, { flexDirection: 'row', alignItems: 'center' }]}>
                <TouchableOpacity onPress={() => setOrderVolume(v => (Math.max(0.01, parseFloat(v) - 0.1)).toFixed(2))} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: 'bold' }}>-</Text>
                </TouchableOpacity>
                <TextInput 
                  style={{ color: colors.text, fontSize: 13, fontWeight: 'bold', width: 36, textAlign: 'center', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as any}
                  value={orderVolume}
                  onChangeText={setOrderVolume}
                  keyboardType="numeric"
                />
                <TouchableOpacity onPress={() => setOrderVolume(v => (parseFloat(v) + 0.1).toFixed(2))} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: 'bold' }}>+</Text>
                </TouchableOpacity>
              </BlurView>
              <BlurView experimentalBlurMethod="regular" intensity={isDark ? 50 : 90} tint={colors.blurTint} style={[styles.pillContainer, pillStyle]}>
                <TouchableOpacity onPress={() => setIsIntervalsOpen(true)} style={styles.iconButton}><Text style={[styles.intervalText, { color: colors.text }]}>{selectedInterval}</Text></TouchableOpacity>
              </BlurView>
              {!isIndicatorsUIHidden && (
                <BlurView experimentalBlurMethod="regular" intensity={isDark ? 50 : 90} tint={colors.blurTint} style={[styles.pillContainer, pillStyle]}>
                  <TouchableOpacity onPress={() => setIsIndicatorsOpen(true)} style={styles.iconButton}><Sliders color={colors.text} size={20} /></TouchableOpacity>
                </BlurView>
              )}
              <BlurView experimentalBlurMethod="regular" intensity={isDark ? 50 : 90} tint={colors.blurTint} style={[styles.pillContainer, pillStyle]}>
                <TouchableOpacity onPress={() => setIsChartMenuOpen(true)} style={styles.iconButton}>
                  <Menu color={colors.text} size={20} />
                </TouchableOpacity>
              </BlurView>
            </View>
          </View>
        )}

        {/* Bottom Floating Trading Buttons */}
        {!isTradeUIHidden && !isChartMenuOpen && !isTradeUIBlocked && (
          <View style={styles.floatingTradeBottomRow} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }} pointerEvents="box-none">
              {/* Split SELL Button */}
              <View style={{ flex: 1 }}>
                <LinearGradient colors={[chartTheme.down, chartTheme.down]} style={styles.splitButtonContainer} start={{x:0,y:0}} end={{x:0,y:1}}>
                  <TouchableOpacity style={styles.splitButtonHalf} onPress={() => { setOrderSide('SELL'); setOrderType('LIMIT'); setIsOrderPanelOpen(true); }}>
                    <Text style={[styles.splitButtonSmallText, { color: '#FFFFFF' }]}>Limit / Stop</Text>
                    <Text style={[styles.splitButtonMainText, { color: '#FFFFFF' }]}>SELL</Text>
                  </TouchableOpacity>
                  <View style={[styles.splitButtonDivider, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]} />
                  <TouchableOpacity style={[styles.splitButtonHalf, isExecuting && { opacity: 0.5 }]} disabled={isExecuting} onPress={() => executeInstantTrade('SELL')}>
                    <Text style={[styles.splitButtonSmallText, { color: '#FFFFFF' }]}>INSTANT</Text>
                    <Text style={[styles.splitButtonPriceText, { color: '#FFFFFF' }]}>{livePrice !== '...' ? livePrice : '...'}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>

              {/* Split BUY Button */}
              <View style={{ flex: 1 }}>
                <LinearGradient colors={[chartTheme.up, chartTheme.up]} style={styles.splitButtonContainer} start={{x:0,y:0}} end={{x:0,y:1}}>
                  <TouchableOpacity style={styles.splitButtonHalf} onPress={() => { setOrderSide('BUY'); setOrderType('LIMIT'); setIsOrderPanelOpen(true); }}>
                    <Text style={[styles.splitButtonSmallText, { color: chartTheme.id === 'monochrome' ? '#000000' : '#FFFFFF' }]}>Limit / Stop</Text>
                    <Text style={[styles.splitButtonMainText, { color: chartTheme.id === 'monochrome' ? '#000000' : '#FFFFFF' }]}>BUY</Text>
                  </TouchableOpacity>
                  <View style={[styles.splitButtonDivider, { backgroundColor: chartTheme.id === 'monochrome' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.3)' }]} />
                  <TouchableOpacity style={[styles.splitButtonHalf, isExecuting && { opacity: 0.5 }]} disabled={isExecuting} onPress={() => executeInstantTrade('BUY')}>
                    <Text style={[styles.splitButtonSmallText, { color: chartTheme.id === 'monochrome' ? '#000000' : '#FFFFFF' }]}>INSTANT</Text>
                    <Text style={[styles.splitButtonPriceText, { color: chartTheme.id === 'monochrome' ? '#000000' : '#FFFFFF' }]}>{livePrice !== '...' ? livePrice : '...'}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* Rendering Modals */}
      {renderOrderPanelModal()}
      {renderModifyPanelModal()}
      {renderIndicatorsModal()}
      {renderDrawingsModal()}
      {renderDomModal()}
      
      {/* Sliding Chart Options Menu Drawer */}
      <CustomBlurModal visible={isChartMenuOpen} transparent={true} animationType="slide" onRequestClose={() => setIsChartMenuOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', flexDirection: 'row' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsChartMenuOpen(false)} activeOpacity={1} />
          <BlurView 
            experimentalBlurMethod="regular"
            intensity={100} 
            tint={colors.blurTint} 
            style={{ 
              width: '65%', 
              height: '100%', 
              backgroundColor: isDark ? '#000000' : 'rgba(255, 255, 255, 0.96)', 
              borderLeftWidth: 1, 
              borderLeftColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
              ...Platform.select({
                web: {
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                } as any,
                default: {}
              })
            }}
          >
            <View style={[styles.modalHeader, { justifyContent: 'space-between', alignItems: 'center', marginTop: Platform.OS === 'ios' ? 60 : 45, paddingHorizontal: 16, marginBottom: 15 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.modalTitle, { color: colors.text, fontSize: 18, fontWeight: '700' }]}>Chart Menu</Text>
                <ChevronDown color={colors.text} size={18} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity onPress={() => showToast('More options', 'info')}><MoreVertical color={colors.text} size={20} /></TouchableOpacity>
                <TouchableOpacity onPress={() => setIsChartMenuOpen(false)}><X color={colors.textMuted} size={22} /></TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}>
              
              <TouchableOpacity 
                style={[styles.fullscreenCard, { 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', 
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' 
                }]} 
                onPress={toggleFullscreen}
              >
                <View style={[styles.fullscreenIconContainer, { backgroundColor: isDark ? 'rgba(41, 98, 255, 0.15)' : 'rgba(41, 98, 255, 0.1)' }]}>
                  {isFullscreen ? <Minimize color="#2962FF" size={20} /> : <Maximize color="#2962FF" size={20} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fullscreenCardTitle, { color: colors.text }]}>
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
                  </Text>
                  <Text style={[styles.fullscreenCardSubtitle, { color: colors.textMuted }]}>
                    {isFullscreen ? 'Return to normal view' : 'Clean chart'}
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.intervalCategoryTitle}>CHART TYPE</Text>
              
              <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 12 }}>
                <TouchableOpacity onPress={() => { setChartType('candle'); }} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: chartType === 'candle' ? '#2962FF' : 'transparent', borderRadius: 8 }}>
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Candles</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setChartType('line'); }} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: chartType === 'line' ? '#2962FF' : 'transparent', borderRadius: 8 }}>
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Line</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }} 
                onPress={() => setIsThemesExpanded(!isThemesExpanded)}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <ThemeBadge upColor={chartTheme.up} downColor={chartTheme.down} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Chart Colors</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Tap to change theme</Text>
                </View>
                {isThemesExpanded ? <ChevronUp color={colors.textMuted} size={18} /> : <ChevronDown color={colors.textMuted} size={18} />}
              </TouchableOpacity>

              {isThemesExpanded && (
                <View style={{ paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.04)', marginVertical: 8 }}>
                  {CHART_THEMES.map(theme => {
                    const isSelected = chartTheme.id === theme.id;
                    return (
                      <TouchableOpacity
                        key={theme.id}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginVertical: 2, paddingHorizontal: 8, borderRadius: 8, backgroundColor: isSelected ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                        onPress={() => {
                          setChartTheme(theme);
                          setItemAsync('chartThemeId', theme.id).catch(() => {});
                          // Send dynamic message to WebView
                          sendMessageToChart(JSON.stringify({
                            type: 'changeTheme',
                            theme: {
                              upColor: theme.up,
                              downColor: theme.down
                            }
                          }));
                        }}
                      >
                        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          <ThemeBadge upColor={theme.up} downColor={theme.down} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: isSelected ? '#2962FF' : colors.text, fontSize: 14, fontWeight: 'bold' }}>{theme.name}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{theme.desc}</Text>
                        </View>
                        {isSelected && (
                          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#2962FF', justifyContent: 'center', alignItems: 'center' }}>
                            <Check color="#FFF" size={10} strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.intervalCategoryTitle}>TOOLS</Text>

              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }} onPress={() => { setIsChartMenuOpen(false); setIsDomOpen(true); }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Layers color="#3B82F6" size={18} />
                </View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Orderbook (DOM)</Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginVertical: 12 }} />

              <Text style={styles.intervalCategoryTitle}>VISIBILITY</Text>
              
              <TouchableOpacity style={[styles.indicatorRow, { borderBottomColor: 'rgba(255,255,255,0.04)' }]} onPress={() => setIsTradeUIHidden(!isTradeUIHidden)}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <Eye color={isTradeUIHidden ? colors.textMuted : colors.primary} size={18} style={{ marginRight: 10 }} />
                  <Text style={{ color: isTradeUIHidden ? colors.textMuted : colors.text, fontSize: 16, fontWeight: 'bold' }}>Buy/Sell Buttons</Text>
                </View>
                <View style={[styles.checkbox, !isTradeUIHidden && styles.checkboxActive, !isTradeUIHidden && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  {!isTradeUIHidden && <Check color={colors.surface} size={16} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.indicatorRow, { borderBottomColor: 'rgba(255,255,255,0.04)' }]} onPress={() => setIsIndicatorsUIHidden(!isIndicatorsUIHidden)}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <Sliders color={isIndicatorsUIHidden ? colors.textMuted : "#8B5CF6"} size={18} style={{ marginRight: 10 }} />
                  <Text style={{ color: isIndicatorsUIHidden ? colors.textMuted : colors.text, fontSize: 16, fontWeight: 'bold' }}>Indicators</Text>
                </View>
                <View style={[styles.checkbox, !isIndicatorsUIHidden && styles.checkboxActive, !isIndicatorsUIHidden && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }]}>
                  {!isIndicatorsUIHidden && <Check color={colors.surface} size={16} />}
                </View>
              </TouchableOpacity>

            </ScrollView>
          </BlurView>
        </View>
      </CustomBlurModal>

      {/* Intervals Modal */}
      <CustomBlurModal visible={isIntervalsOpen} animationType="slide" transparent={true} onRequestClose={() => setIsIntervalsOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsIntervalsOpen(false)} activeOpacity={1} />
          <BlurView 
            experimentalBlurMethod="regular"
            intensity={100} 
            tint={colors.blurTint} 
            style={[
              styles.drawingsModal, 
              { 
                height: '50%', 
                backgroundColor: isDark ? '#000000' : 'rgba(255, 255, 255, 0.96)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
                borderBottomWidth: 0,
                ...Platform.select({
                  web: {
                    backdropFilter: 'blur(20px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  },
                  default: {}
                })
              }
            ]}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Timeframe</Text>
              <TouchableOpacity onPress={() => setIsIntervalsOpen(false)}><X color={colors.textMuted} size={24} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'].map(interval => (
                <TouchableOpacity 
                  key={interval} 
                  style={[styles.symbolRow, selectedInterval === interval && { borderBottomColor: colors.primary }, { borderBottomColor: colors.border }]} 
                  onPress={() => { setSelectedInterval(interval); setIsIntervalsOpen(false); }}
                >
                  <Text style={[styles.symbolRowText, selectedInterval === interval ? { color: colors.primary, fontWeight: 'bold' } : { color: colors.text }]}>{interval}</Text>
                </TouchableOpacity>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </BlurView>
        </View>
      </CustomBlurModal>
      
      {/* Symbol Selector Modal */}
      <CustomBlurModal visible={isSymbolSelectorOpen} animationType="slide" transparent={true} onRequestClose={() => setIsSymbolSelectorOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsSymbolSelectorOpen(false)} activeOpacity={1} />
          <BlurView 
            experimentalBlurMethod="regular"
            intensity={100} 
            tint={colors.blurTint} 
            style={[
              styles.drawingsModal, 
              { 
                height: '70%', 
                backgroundColor: isDark ? '#000000' : 'rgba(255, 255, 255, 0.96)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
                borderBottomWidth: 0,
                ...Platform.select({
                  web: {
                    backdropFilter: 'blur(20px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  },
                  default: {}
                })
              }
            ]}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Asset</Text>
              <TouchableOpacity onPress={() => setIsSymbolSelectorOpen(false)}><X color={colors.textMuted} size={24} /></TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20, marginBottom: 15 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: 10, paddingHorizontal: 12, height: 45, borderWidth: 1, borderColor: colors.border }}>
                <Search color={colors.textMuted} size={20} />
                <TextInput
                  style={{ flex: 1, marginLeft: 10, color: colors.text, fontSize: 16, ...Platform.select({ web: { outlineStyle: 'none' } }) } as any}
                  placeholder="Search asset..."
                  placeholderTextColor={colors.textMuted}
                  value={symbolSearchQuery}
                  onChangeText={setSymbolSearchQuery}
                  autoCapitalize="characters"
                />
                {symbolSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSymbolSearchQuery('')}>
                    <X color={colors.textMuted} size={16} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ASSET_CATEGORIES.map(category => {
                // Filter symbols in this category matching search query
                const filteredSymbols = category.symbols.filter(item => 
                  item.toLowerCase().includes(symbolSearchQuery.toLowerCase()) ||
                  (ASSET_METADATA[item]?.name || '').toLowerCase().includes(symbolSearchQuery.toLowerCase())
                );
                
                // If there are no matching symbols in this category, don't render it
                if (filteredSymbols.length === 0) return null;
                
                // If query is active, auto-expand categories, otherwise respect collapsed state
                const isCollapsed = symbolSearchQuery.length > 0 ? false : !!collapsedCategories[category.title];
                
                return (
                  <View key={category.title} style={{ marginBottom: 10 }}>
                    {/* Category Header */}
                    <TouchableOpacity 
                      onPress={() => toggleCategory(category.title)}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        paddingHorizontal: 20, 
                        paddingVertical: 12, 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border
                      }}
                    >
                      <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>{category.title}</Text>
                      {isCollapsed ? (
                        <ChevronDown color={colors.textMuted} size={16} />
                      ) : (
                        <ChevronUp color={colors.textMuted} size={16} />
                      )}
                    </TouchableOpacity>
                    
                    {/* Category Assets */}
                    {!isCollapsed && (
                      <View style={{ paddingHorizontal: 10 }}>
                        {filteredSymbols.map(item => {
                          const meta = ASSET_METADATA[item] || { name: item };
                          const isSelected = symbol === item;
                          return (
                            <TouchableOpacity 
                              key={item} 
                              style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                paddingHorizontal: 10, 
                                paddingVertical: 14, 
                                borderBottomWidth: 1, 
                                borderBottomColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                backgroundColor: isSelected ? (isDark ? 'rgba(41, 98, 255, 0.08)' : 'rgba(41, 98, 255, 0.05)') : 'transparent',
                                borderRadius: 8,
                                marginVertical: 2
                              }} 
                              onPress={() => { 
                                setSymbol(item); 
                                setIsSymbolSelectorOpen(false); 
                                setSymbolSearchQuery(''); 
                              }}
                            >
                              <AssetLogo symbol={item} size={32} />
                              <View style={{ flex: 1, marginLeft: 4 }}>
                                <Text style={{ color: isSelected ? colors.primary : colors.text, fontSize: 16, fontWeight: isSelected ? '700' : '600' }}>{item}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{meta.name}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </BlurView>
        </View>
      </CustomBlurModal>

      {/* Landscape Toolbar (Image 2) */}
      {isFullscreen && orientation === 'landscape' && (
        <View style={styles.floatingLandscapeToolbar}>
          <BlurView 
            experimentalBlurMethod="regular" 
            intensity={100} 
            tint={colors.blurTint} 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 12, 
              paddingHorizontal: 10, 
              paddingVertical: 8, 
              borderRadius: 16,
              backgroundColor: isDark ? '#000000' : 'rgba(255, 255, 255, 0.96)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
              ...Platform.select({
                web: {
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                } as any,
                default: {}
              })
            }}
          >
            <TouchableOpacity onPress={() => setIsDrawingsOpen(true)} style={{ padding: 6 }}>
              <PenTool color="#FFFFFF" size={18} />
            </TouchableOpacity>
            <View style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <TouchableOpacity onPress={() => setIsIndicatorsOpen(true)} style={{ padding: 6 }}>
              <Sliders color="#FFFFFF" size={18} />
            </TouchableOpacity>
            <View style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <TouchableOpacity onPress={toggleFullscreen} style={{ padding: 6 }}>
              <Minimize color="#2962FF" size={18} />
            </TouchableOpacity>
          </BlurView>
        </View>
      )}

      
      {isMobileDevice && !isFullscreen && orientation === 'landscape' && (
        <View style={styles.overlayContainer}>
          <RotatedCornersIcon color={colors.primary} />
          <Text style={styles.overlayTitle}>Rotate Back to Portrait</Text>
          <Text style={styles.overlaySubtitle}>Hold your phone straight to return to normal view</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: getTgSafeAreaTop() },
  glowOrb: {
    display: 'none',
    width: 0,
    height: 0,
    opacity: 0,
  },
  glassOverlaySafeArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() },
  floatingHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  floatingToolbarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  pillContainer: { borderRadius: 12, overflow: 'hidden', borderWidth: 0 },
  iconButton: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  pricePill: { paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  symbolText: { fontSize: 16, fontWeight: 'bold' },
  priceText: { fontSize: 15, fontWeight: 'bold' },
  container: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  symbolRow: { paddingVertical: 16, borderBottomWidth: 1 },
  symbolRowActive: {},
  symbolRowText: { fontSize: 16 },
  symbolRowTextActive: { fontWeight: 'bold' },
  drawingsModal: { flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  intervalCategoryTitle: { fontSize: 11, fontWeight: '700', marginTop: 20, marginBottom: 8, letterSpacing: 1.5, color: '#848E9C', textTransform: 'uppercase' },
  intervalText: { fontSize: 13, fontWeight: '600' },
  indicatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: defaultColors.border },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: defaultColors.textMuted, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { borderWidth: 0, backgroundColor: defaultColors.primary },

  // Trade Execution UI
  floatingTradeBottomRow: { position: 'absolute', bottom: Platform.OS === 'ios' ? 30 : 20, left: 16, right: 16 },
  
  splitButtonContainer: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden' },
  splitButtonHalf: { flex: 1, paddingVertical: Platform.OS === 'web' ? 12 : 7, alignItems: 'center', justifyContent: 'center' },
  splitButtonDivider: { width: 1, marginVertical: Platform.OS === 'web' ? 8 : 4 },
  splitButtonSmallText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 2, textTransform: 'uppercase' },
  splitButtonMainText: { color: '#FFF', fontSize: 15, fontWeight: 'bold', letterSpacing: 1 },
  splitButtonPriceText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  orderSideTabs: { flexDirection: 'row', borderRadius: 10, padding: 2, marginBottom: 12 },
  orderSideTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  orderSideTabText: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },

  inputGroup: { marginBottom: 6 },
  inputLabel: { fontSize: 11, marginBottom: 4, fontWeight: '600' },
  numberInputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  numberInputBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  numberInputBtnText: { fontSize: 18, fontWeight: 'bold' },
  numberInputField: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 'bold', paddingVertical: 6 },

  basicInput: { borderRadius: 10, borderWidth: 1, fontSize: 14, padding: 8, fontWeight: '500' },
  
  executeTradeBtn: { paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  executeTradeBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },

  // Drawing Tools Styles
  drawingTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  drawingTabActive: {},
  drawingTabText: { fontSize: 14, fontWeight: '600' },
  drawingTabTextActive: {},
  drawingToolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  drawingToolItem: { width: '30%', alignItems: 'center', marginBottom: 16 },
  drawingToolIconWrapper: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  drawingToolLabel: { fontSize: 12, textAlign: 'center' },

  fullscreenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(41, 98, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(41, 98, 255, 0.15)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    marginTop: 10,
  },
  fullscreenIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(41, 98, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  fullscreenCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  fullscreenCardSubtitle: {
    color: '#848E9C',
    fontSize: 12,
    marginTop: 2,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 12, 18, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  overlayTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  overlaySubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  floatingLandscapeToolbar: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 9999,
  },
});

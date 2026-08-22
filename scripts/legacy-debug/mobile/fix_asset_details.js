const fs = require('fs');
let content = fs.readFileSync('src/screens/AssetDetailsScreen.tsx', 'utf8');

// 1. Add chartReadyRef and pendingMessagesRef
content = content.replace(
    /const webviewRef = useRef<WebView>\(null\);\s*const iframeRef = useRef<HTMLIFrameElement>\(null\);/,
    "const webviewRef = useRef<WebView>(null);\n    const iframeRef = useRef<HTMLIFrameElement>(null);\n    const chartReadyRef = useRef(false);\n    const pendingMessagesRef = useRef<string[]>([]);\n\n    const sendMessageToChartDirect = (messageStr: string) => {\n        if (Platform.OS === 'web') {\n            if (iframeRef.current && iframeRef.current.contentWindow) iframeRef.current.contentWindow.postMessage(messageStr, '*');\n        } else {\n            if (webviewRef.current && typeof webviewRef.current.injectJavaScript === 'function') {\n                webviewRef.current.injectJavaScript('window.postMessage(' + JSON.stringify(messageStr) + ', \"*\");');\n            }\n        }\n    };\n\n    const sendMessageToChart = (messageStr: string) => {\n        if (chartReadyRef.current) {\n            sendMessageToChartDirect(messageStr);\n        } else {\n            pendingMessagesRef.current.push(messageStr);\n        }\n    };\n\n    const handleChartMessage = (event: any) => {\n        let msg = event.data || event.nativeEvent?.data;\n        try {\n            if (typeof msg === 'string') msg = JSON.parse(msg);\n            if (msg.type === 'chartReady') {\n                chartReadyRef.current = true;\n                const pending = [...pendingMessagesRef.current];\n                pendingMessagesRef.current = [];\n                for (const pendingMsg of pending) {\n                    sendMessageToChartDirect(pendingMsg);\n                }\n            }\n        } catch(e){}\n    };"
);

// 2. Add chartReady to HTML
content = content.replace(
    /window\.addEventListener\('message',\s*\(event\)\s*=>\s*\{/,
    "function sendMsgToApp(msgObj) {\n            if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msgObj));\n            else if (window.parent) window.parent.postMessage(JSON.stringify(msgObj), '*');\n        }\n        sendMsgToApp({ type: 'chartReady' });\n\n        window.addEventListener('message', (event) => {"
);

// 3. Replace all postMessage blocks with sendMessageToChart
// In fetchHistory (historical)
content = content.replace(
    /if\s*\(Platform\.OS === 'web'\)\s*\{\s*if\s*\(iframeRef\.current.*?\}\s*\}\s*else\s*\{\s*if\s*\(webviewRef\.current.*?\)\s*\{\s*webviewRef\.current\.injectJavaScript.*?\}\s*\}/gs,
    "sendMessageToChart(messageStr);"
);

// 4. Add onMessage to WebView
content = content.replace(
    /<WebView\s*ref=\{webviewRef\}/,
    "<WebView\n                                ref={webviewRef}\n                                onMessage={handleChartMessage}"
);

// 5. Add event listener to iframe
content = content.replace(
    /<iframe\s*ref=\{iframeRef\}/,
    "useEffect(() => {\n        const handleWebMessage = (e: any) => {\n            if (e.data && typeof e.data === 'string' && e.data.includes('react-devtools')) return;\n            handleChartMessage(e);\n        };\n        if (Platform.OS === 'web') window.addEventListener('message', handleWebMessage);\n        return () => { if (Platform.OS === 'web') window.removeEventListener('message', handleWebMessage); };\n    }, []);\n\n                            <iframe\n                                ref={iframeRef}"
);

fs.writeFileSync('src/screens/AssetDetailsScreen.tsx', content);
console.log('Done!');
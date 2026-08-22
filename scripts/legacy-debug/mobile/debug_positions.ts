// @ts-nocheck
const React = require('react');

// Mock browser/React Native globals
global.window = global;
global.$RefreshReg$ = () => {};
global.$RefreshSig$ = () => () => {};

// Mock components
const mockComponent = (name) => {
  const Comp = (props) => React.createElement(name, props, props.children);
  Comp.displayName = name;
  return Comp;
};

// Mock React Native and other dependencies
const mockModules = {
  'react-native': {
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    StyleSheet: { create: (s) => s },
    FlatList: mockComponent('FlatList'),
    TouchableOpacity: mockComponent('TouchableOpacity'),
    SafeAreaView: mockComponent('SafeAreaView'),
    Platform: { OS: 'web', select: (obj) => obj.web || obj.default || obj },
    ActivityIndicator: mockComponent('ActivityIndicator'),
    Linking: { canOpenURL: async () => false, openURL: async () => {} },
    TextInput: mockComponent('TextInput'),
    Modal: mockComponent('Modal'),
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Dimensions: { get: () => ({ width: 375, height: 812 }) }
  },
  'react-native-svg': {
    default: mockComponent('Svg'),
    Svg: mockComponent('Svg'),
    Path: mockComponent('Path'),
    Rect: mockComponent('Rect'),
    Circle: mockComponent('Circle')
  },
  'socket.io-client': () => ({
    on: () => {},
    off: () => {},
    emit: () => {}
  }),
  '../utils/storage': {
    getItemAsync: async () => null,
    setItemAsync: async () => {},
    deleteItemAsync: async () => {}
  },
  '@react-navigation/native': {
    useFocusEffect: (cb) => cb(),
    useNavigation: () => ({ navigate: () => {} })
  },
  '../theme/ThemeContext': {
    useTheme: () => ({
      theme: 'dark',
      isDark: true,
      colors: {
        background: '#000',
        text: '#fff',
        primary: '#089981',
        card: '#12161f',
        border: '#2a2e39',
        up: '#089981',
        down: '#f23645',
        tabBar: '#12161f',
        tabBarInactive: '#848e9c'
      },
      toggleTheme: () => {},
      setTheme: () => {}
    })
  },
  '../components/GlassToast': {
    default: mockComponent('GlassToast'),
    show: () => {}
  },
  '../store/accountStore': {
    useAccountStore: () => ({
      selectedAccount: { balance: 10000, currency: 'USD', equity: 10000, margin: 0, freeMargin: 10000, marginLevel: 0 },
      updateAccountData: () => {}
    })
  },
  '../components/GlassView': mockComponent('GlassView'),
  '../config': {
    API_BASE_URL: 'http://localhost:5000',
    BACKEND_URL: 'http://localhost:5000',
    isTelegram: false,
    getTgSafeAreaTop: () => 0
  },
  'react/jsx-runtime': {
    jsx: (type, props) => React.createElement(type, props),
    jsxs: (type, props) => React.createElement(type, props)
  },
  'react/jsx-dev-runtime': {
    jsxDEV: (type, props) => React.createElement(type, props)
  }
};

const originalRequire = module.constructor.prototype.require;
module.constructor.prototype.require = function (modulePath) {
  if (mockModules[modulePath]) {
    return mockModules[modulePath];
  }
  return originalRequire.apply(this, arguments);
};

console.log('Loading PositionsScreen...');
try {
  const PositionsScreenModule = require('./src/screens/PositionsScreen.tsx');
  const PositionsScreen = PositionsScreenModule.default;
  console.log('Successfully loaded PositionsScreen component.');
  
  console.log('Rendering PositionsScreen...');
  // We mock React hooks context by using a simple render test inside a mock component state
  const testElement = React.createElement(PositionsScreen);
  console.log('Test element created:', testElement.type.name || 'Component');
  
  // To verify hooks, let's call the function directly as a functional component
  // (Note: this will trigger useState / useEffect mock errors if react doesn't have an active dispatcher,
  // but it will tell us if it throws sync errors during body execution before react's dispatcher checks)
  try {
    PositionsScreen();
  } catch (err) {
    if (err.message && err.message.includes('Invalid hook call')) {
      console.log('Component body executed successfully (halted on React hook dispatcher check, which is expected outside React render).');
    } else {
      throw err;
    }
  }
} catch (e) {
  console.error('CRITICAL RUNTIME ERROR IN POSITIONSSCREEN:', e);
}

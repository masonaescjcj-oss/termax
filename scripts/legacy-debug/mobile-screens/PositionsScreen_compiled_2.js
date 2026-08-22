__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  var _jsxFileName = "C:\\Users\\asiac\\OneDrive\\Desktop\\trade (2)\\trade\\mobile\\src\\navigation\\RootNavigator.tsx",
    _s = $RefreshSig$(),
    _s2 = $RefreshSig$();
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
      return RootNavigator;
    }
  });
  require(_dependencyMap[0], "react");
  var _reactNativeWebDistExportsView = require(_dependencyMap[1], "react-native-web/dist/exports/View");
  var View = _interopDefault(_reactNativeWebDistExportsView);
  var _reactNavigationBottomTabs = require(_dependencyMap[2], "@react-navigation/bottom-tabs");
  var _reactNavigationNativeStack = require(_dependencyMap[3], "@react-navigation/native-stack");
  var _reactNavigationNative = require(_dependencyMap[4], "@react-navigation/native");
  var _lucideReactNative = require(_dependencyMap[5], "lucide-react-native");
  var _screensWatchlistScreen = require(_dependencyMap[6], "../screens/WatchlistScreen");
  var WatchlistScreen = _interopDefault(_screensWatchlistScreen);
  var _screensChartScreen = require(_dependencyMap[7], "../screens/ChartScreen");
  var ChartScreen = _interopDefault(_screensChartScreen);
  var _screensToolsHubScreen = require(_dependencyMap[8], "../screens/ToolsHubScreen");
  var ToolsHubScreen = _interopDefault(_screensToolsHubScreen);
  var _screensAssetDetailsScreen = require(_dependencyMap[9], "../screens/AssetDetailsScreen");
  var AssetDetailsScreen = _interopDefault(_screensAssetDetailsScreen);
  var _screensPositionsScreen = require(_dependencyMap[10], "../screens/PositionsScreen");
  var PositionsScreen = _interopDefault(_screensPositionsScreen);
  var _screensLoginScreen = require(_dependencyMap[11], "../screens/LoginScreen");
  var LoginScreen = _interopDefault(_screensLoginScreen);
  var _screensAdminScreen = require(_dependencyMap[12], "../screens/AdminScreen");
  var AdminScreen = _interopDefault(_screensAdminScreen);
  var _screensAICoachScreen = require(_dependencyMap[13], "../screens/AICoachScreen");
  var AICoachScreen = _interopDefault(_screensAICoachScreen);
  var _themeThemeContext = require(_dependencyMap[14], "../theme/ThemeContext");
  var _config = require(_dependencyMap[15], "../config");
  var _reactJsxDevRuntime = require(_dependencyMap[16], "react/jsx-dev-runtime");
  const Tab = (0, _reactNavigationBottomTabs.createBottomTabNavigator)();
  const Stack = (0, _reactNavigationNativeStack.createNativeStackNavigator)();
  function BottomTabs() {
    _s();
    const {
      colors,
      isDark
    } = (0, _themeThemeContext.useTheme)();
    return /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Tab.Navigator, {
      screenOptions: {
        headerShown: false,
        sceneContainerStyle: {
          backgroundColor: colors.background
        },
        tabBarBackground: () => /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(View.default, {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isDark ? '#000000' : colors.tabBar,
            borderTopWidth: 0
          }
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 30,
          columnNumber: 21
        }, this),
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: 'transparent',
          shadowOffset: {
            width: 0,
            height: 0
          },
          shadowRadius: 0,
          height: _config.isTelegram ? 54 : 60,
          paddingBottom: _config.isTelegram ? 4 : 8,
          paddingTop: 8
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: 4
        }
      },
      children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Tab.Screen, {
        name: "Watchlist",
        component: WatchlistScreen.default,
        options: {
          tabBarIcon: ({
            color,
            size
          }) => /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_lucideReactNative.Bookmark, {
            color: color,
            size: 22
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 57,
            columnNumber: 54
          }, this)
        }
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 53,
        columnNumber: 13
      }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Tab.Screen, {
        name: "Positions",
        component: PositionsScreen.default,
        options: {
          tabBarIcon: ({
            color,
            size
          }) => /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_lucideReactNative.Layers, {
            color: color,
            size: 22
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 64,
            columnNumber: 54
          }, this)
        }
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 60,
        columnNumber: 13
      }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Tab.Screen, {
        name: "Chart",
        component: ChartScreen.default,
        options: {
          tabBarIcon: ({
            color,
            size
          }) => /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_lucideReactNative.LineChart, {
            color: color,
            size: 22
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 71,
            columnNumber: 54
          }, this)
        }
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 67,
        columnNumber: 13
      }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Tab.Screen, {
        name: "ToolsHub",
        component: ToolsHubScreen.default,
        options: {
          tabBarLabel: 'Pro Tools',
          tabBarIcon: ({
            color,
            size
          }) => /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_lucideReactNative.Cpu, {
            color: color,
            size: 22
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 79,
            columnNumber: 54
          }, this)
        }
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 74,
        columnNumber: 13
      }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Tab.Screen, {
        name: "Login",
        component: LoginScreen.default,
        options: {
          tabBarIcon: ({
            color,
            size
          }) => /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_lucideReactNative.User, {
            color: color,
            size: 22
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 86,
            columnNumber: 54
          }, this)
        }
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 82,
        columnNumber: 13
      }, this)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 25,
      columnNumber: 9
    }, this);
  }
  _s(BottomTabs, "A3APyYMjcf28VfHRYztdyTb0Uo8=", false, function () {
    return [_themeThemeContext.useTheme];
  });
  _c = BottomTabs;
  function RootNavigator() {
    _s2();
    const {
      colors,
      isDark
    } = (0, _themeThemeContext.useTheme)();
    const navTheme = {
      ...(isDark ? _reactNavigationNative.DarkTheme : _reactNavigationNative.DefaultTheme),
      colors: {
        ...(isDark ? _reactNavigationNative.DarkTheme : _reactNavigationNative.DefaultTheme).colors,
        background: colors.background,
        card: isDark ? '#000000' : colors.tabBar,
        text: colors.text,
        border: isDark ? '#000000' : colors.border,
        primary: colors.primary
      }
    };
    return /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(_reactNavigationNative.NavigationContainer, {
      theme: navTheme,
      children: /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Stack.Navigator, {
        screenOptions: {
          headerShown: false
        },
        children: [/*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Stack.Screen, {
          name: "MainTabs",
          component: BottomTabs
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 111,
          columnNumber: 17
        }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Stack.Screen, {
          name: "AssetDetails",
          component: AssetDetailsScreen.default
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 112,
          columnNumber: 17
        }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Stack.Screen, {
          name: "Admin",
          component: AdminScreen.default
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 113,
          columnNumber: 17
        }, this), /*#__PURE__*/(0, _reactJsxDevRuntime.jsxDEV)(Stack.Screen, {
          name: "AICoach",
          component: AICoachScreen.default
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 114,
          columnNumber: 17
        }, this)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 110,
        columnNumber: 13
      }, this)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 109,
      columnNumber: 9
    }, this);
  }
  _s2(RootNavigator, "A3APyYMjcf28VfHRYztdyTb0Uo8=", false, function () {
    return [_themeThemeContext.useTheme];
  });
  _c2 = RootNavigator;
  var _c, _c2;
  $RefreshReg$(_c, "BottomTabs");
  $RefreshReg$(_c2, "RootNavigator");
});
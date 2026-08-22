const fs = require('fs');
const file = 'c:/Users/Administrator/Desktop/trade/mobile/src/screens/WatchlistScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const startIndex = content.indexOf('    return (');
const endIndex = content.indexOf('                        <View style={{ paddingHorizontal: 16, paddingBottom: 0, paddingTop: 4 }}>');

if (startIndex === -1 || endIndex === -1) {
    console.log("Could not find bounds");
    process.exit(1);
}

const correctJSX = `    return (
        <View style={styles.container}>
            <View style={[styles.glowOrb, { top: -100, left: -100, backgroundColor: 'rgba(59, 130, 246, 0.3)' }]} />
            <View style={[styles.glowOrb, { bottom: -100, right: -100, backgroundColor: 'rgba(168, 85, 247, 0.3)' }]} />
            <View style={[styles.glowOrb, { top: '30%', right: -150, backgroundColor: 'rgba(8, 153, 129, 0.25)' }]} />
            <BlurView intensity={isDark ? 80 : 100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />

            <View style={[styles.safeArea, { paddingTop: getTgSafeAreaTop() }]}>
                {/* Animated Watchlist Header (Glassy background fades in on scroll, slides up on scroll down) */}
                <Animated.View style={{ position: 'absolute', top: getTgSafeAreaTop(), left: 0, right: 0, zIndex: 10, transform: [{ translateY: headerAnim }] }}>
                    <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: headerBgOpacity }]}>
                        <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={[StyleSheet.absoluteFillObject, { borderBottomWidth: 1, borderBottomColor: colors.glassBorder }]} />
                    </Animated.View>
                    <View style={{ borderBottomWidth: 0 }}>
                        {/* Top Header */}
                        <Animated.View style={[styles.header, { justifyContent: 'space-between', opacity: headerOpacity }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ position: 'relative', zIndex: 99 }}>
                                    <TouchableOpacity style={styles.menuButton} onPress={() => setShowDropdown(!showDropdown)}>
                                        <AlignLeft color={colors.text} size={24} />
                                    </TouchableOpacity>
                                    {showDropdown && (
                                        <View style={{ position: 'absolute', top: 40, left: 10, width: 200, backgroundColor: colors.glassModal, borderRadius: 12, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, borderWidth: 1, borderColor: colors.glassBorder }}>
                                            <TouchableOpacity style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder }} onPress={() => { setShowDropdown(false); toggleTheme(); }}>
                                                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{isDark ? '?? Light Mode' : '?? Dark Mode'}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder }} onPress={() => { setShowDropdown(false); alert('Coming soon!'); }}>
                                                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>?? Change Color</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={{ padding: 12 }} onPress={() => { setShowDropdown(false); alert('Earn Budget'); }}>
                                                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>?? Earn Budget</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Watchlist</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TouchableOpacity onPress={() => setIsSearchOpen(!isSearchOpen)} style={{ padding: 6 }}>
                                    <Search color={isSearchOpen ? colors.primary : colors.textMuted} size={20} />
                                </TouchableOpacity>
                                <AccountSwitcher />
                            </View>
                        </Animated.View>

                        {/* Search Bar */}
                        {isSearchOpen && (
                            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassModal, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.glassBorder }}>
                                    <Search color={colors.textMuted} size={16} />
                                    <TextInput
                                        style={[{ flex: 1, color: colors.text, fontSize: 15, height: 40, marginLeft: 8, padding: 0 }, Platform.select({ web: { outlineStyle: 'none' } }) as any]}
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

                {/* Main List */}
                <SectionList
                    sections={getFilteredData()}
                    keyExtractor={(item) => item.id}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={[styles.listContent, { paddingTop: isSearchOpen ? 110 : 60, paddingBottom: 100 }]}
                    ListHeaderComponent={
`;

content = content.substring(0, startIndex) + correctJSX + content.substring(endIndex);
fs.writeFileSync(file, content);
console.log('Fixed completely!');

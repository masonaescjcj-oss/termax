const fs = require('fs');

const file = 'c:/Users/Administrator/Desktop/trade/mobile/src/screens/WatchlistScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// The file is currently broken at the dropdown menu.
// Let's replace the whole header section.

const headerStart = <Animated.View style={[styles.header, { justifyContent: 'space-between', opacity: headerOpacity }]}>;
const listStart = {/* Main List */};

const correctHeader = <Animated.View style={[styles.header, { justifyContent: 'space-between', opacity: headerOpacity }]}>
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
                                    <Search color={isSearchOpen ? '#3B82F6' : '#94A3B8'} size={20} />
                                </TouchableOpacity>
                                <AccountSwitcher />
                            </View>
                        </Animated.View>

                        {/* Search Bar */}
                        {isSearchOpen && (
                            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassModal, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.glassBorder }}>
                                    <Search color="#64748B" size={16} />
                                    <TextInput
                                        style={{ flex: 1, color: colors.text, fontSize: 15, height: 40, marginLeft: 8, padding: 0, ...Platform.select({ web: { outlineStyle: 'none' } }) } as any}
                                        placeholder="Search symbols..."
                                        placeholderTextColor="#64748B"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        autoFocus
                                    />
                                    {searchQuery.length > 0 && (
                                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                                            <X color="#64748B" size={16} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                </Animated.View>

                ;

let idx1 = content.indexOf(headerStart);
let idx2 = content.indexOf(listStart);

if (idx1 !== -1 && idx2 !== -1) {
    content = content.substring(0, idx1) + correctHeader + content.substring(idx2);
    fs.writeFileSync(file, content);
    console.log("Fixed!");
} else {
    console.log("Could not find boundaries.");
}

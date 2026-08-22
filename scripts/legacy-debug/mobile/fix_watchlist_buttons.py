with open(r'C:\t\src\screens\WatchlistScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Plus button next to lists (line 1017)
old_btn1 = """                                            <TouchableOpacity 
                                                onPress={() => setShowCreateModal(true)} 
                                                style={{ width: 30, height: 30, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }}
                                                activeOpacity={0.8}
                                            >
                                                <LinearGradient
                                                    colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                    style={{ flex: 1 }}
                                                >
                                                    <BlurView
                                                        intensity={isDark ? 30 : 80}
                                                        tint={colors.blurTint}
                                                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 0 }}
                                                    >
                                                        <Plus color={colors.textSubtle} size={16} />
                                                    </BlurView>
                                                </LinearGradient>
                                            </TouchableOpacity>"""

new_btn1 = """                                            <TouchableOpacity 
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
                                            </TouchableOpacity>"""

content = content.replace(old_btn1, new_btn1)

# 2. Edit3 button (line 1039)
old_btn2 = """                                                <TouchableOpacity 
                                                    onPress={() => setShowManageLists(true)} 
                                                    style={{ width: 30, height: 30, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }}
                                                    activeOpacity={0.8}
                                                >
                                                    <LinearGradient
                                                        colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 1 }}
                                                        style={{ flex: 1 }}
                                                    >
                                                        <BlurView
                                                            intensity={isDark ? 30 : 80}
                                                            tint={colors.blurTint}
                                                            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 0 }}
                                                        >
                                                            <Edit3 color={colors.textMuted} size={14} />
                                                        </BlurView>
                                                    </LinearGradient>
                                                </TouchableOpacity>"""

new_btn2 = """                                                <TouchableOpacity 
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
                                                </TouchableOpacity>"""

content = content.replace(old_btn2, new_btn2)

# 3. Search button (line 1064)
old_btn3 = """                                    <TouchableOpacity 
                                        onPress={() => setIsSearchOpen(!isSearchOpen)}
                                        style={{ width: 32, height: 32, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{ flex: 1 }}
                                        >
                                            <BlurView
                                                intensity={isDark ? 30 : 80}
                                                tint={colors.blurTint}
                                                style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 0 }}
                                            >
                                                <Search color={colors.textSubtle} size={16} />
                                            </BlurView>
                                        </LinearGradient>
                                    </TouchableOpacity>"""

new_btn3 = """                                    <TouchableOpacity 
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
                                    </TouchableOpacity>"""

content = content.replace(old_btn3, new_btn3)

# 4. Add Asset Plus button (line 1084)
old_btn4 = """                                    <TouchableOpacity 
                                        onPress={() => setIsAddAssetOpen(true)}
                                        style={{ width: 32, height: 32, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{ flex: 1 }}
                                        >
                                            <BlurView
                                                intensity={isDark ? 30 : 80}
                                                tint={colors.blurTint}
                                                style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 0 }}
                                            >
                                                <Plus color={colors.textSubtle} size={16} />
                                            </BlurView>
                                        </LinearGradient>
                                    </TouchableOpacity>"""

new_btn4 = """                                    <TouchableOpacity 
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
                                    </TouchableOpacity>"""

content = content.replace(old_btn4, new_btn4)

with open(r'C:\t\src\screens\WatchlistScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated WatchlistScreen header buttons centering.")

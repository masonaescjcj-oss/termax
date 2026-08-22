import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../components/Typography';
;
import CustomBlurModal from './CustomBlurModal';
import { ChevronRight, Check, UserPlus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import BlurView from './GlassView';
import { useAccountStore } from '../store/accountStore';
import { useTheme } from '../theme/ThemeContext';

export default function AccountSwitcher() {
    const [isModalVisible, setModalVisible] = useState(false);
    const { selectedAccount, setSelectedAccount, mockAccounts } = useAccountStore();
    const { colors, isDark } = useTheme();
    const navigation = useNavigation<any>();

    return (
        <View>
            <TouchableOpacity 
                activeOpacity={0.8} 
                onPress={() => setModalVisible(true)} 
                style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
            >
                <LinearGradient
                    colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <BlurView 
                        intensity={isDark ? 30 : 80} 
                        tint={isDark ? 'dark' : 'light'} 
                        style={[styles.btn, { borderWidth: 0 }]}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.badge, { backgroundColor: selectedAccount.type === 'LIVE' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }]}>
                                <Text style={[styles.badgeText, { color: selectedAccount.type === 'LIVE' ? '#34D399' : '#FBBF24' }]}>{selectedAccount.type}</Text>
                            </View>
                            <View style={{ marginLeft: 8 }}>
                                <Text style={[styles.brokerText, { color: colors.text }]}>{selectedAccount.broker}</Text>
                                <Text style={[styles.balanceText, { color: colors.textMuted }]}>${selectedAccount.balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                            </View>
                        </View>
                    </BlurView>
                </LinearGradient>
            </TouchableOpacity>

            <CustomBlurModal visible={isModalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: colors.glassModal }]}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setModalVisible(false)} />
                    <BlurView intensity={isDark ? 40 : 80} tint={colors.blurTint} style={[styles.modalContent, { borderColor: colors.glassBorder }]}>
                        <View style={[styles.modalHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]} />
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Select Trading Account</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>All orders will be routed to the selected broker</Text>
                        
                        {mockAccounts.map((acc) => {
                            const isSelected = selectedAccount.id === acc.id;
                            return (
                                <TouchableOpacity 
                                    key={acc.id} 
                                    activeOpacity={0.8}
                                    onPress={() => { setSelectedAccount(acc); setModalVisible(false); }}
                                    style={[styles.accountOption, { backgroundColor: colors.glassCard, borderColor: colors.glassCardBorder }, isSelected && { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(37,99,235,0.08)', borderColor: colors.primary }]}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={[styles.badge, { backgroundColor: acc.type === 'LIVE' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)' }]}>
                                            <Text style={[styles.badgeText, { color: acc.type === 'LIVE' ? '#34D399' : '#FBBF24' }]}>{acc.type}</Text>
                                        </View>
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={[styles.optBroker, { color: colors.text }]}>{acc.broker}</Text>
                                            <Text style={[styles.optId, { color: colors.textMuted }]}>ID: {acc.id}</Text>
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[styles.optBalance, { color: colors.text }]}>${acc.balance.toLocaleString()}</Text>
                                        {isSelected && <Check color={colors.primary} size={18} style={{ marginTop: 4 }} />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        <TouchableOpacity 
                            activeOpacity={0.8}
                            onPress={() => {
                                setModalVisible(false);
                                navigation.navigate('ToolsHub', { subScreen: 'demo_account', referrer: 'AccountSwitcher' });
                            }}
                            style={[
                                styles.accountOption, 
                                { 
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', 
                                    borderColor: colors.primary, 
                                    borderStyle: 'dashed',
                                    justifyContent: 'center',
                                    marginTop: 4,
                                    marginBottom: 0
                                }
                            ]}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <UserPlus color={colors.primary} size={18} style={{ marginRight: 8 }} />
                                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '800' }}>Create Demo Account</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={{ height: 40 }} />
                    </BlurView>
                </View>
            </CustomBlurModal>
        </View>
    );
}

const styles = StyleSheet.create({
    btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    badge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    brokerText: { fontSize: 13, fontWeight: '800' },
    balanceText: { fontSize: 10, fontWeight: '600', marginTop: 1 },
    
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingTop: 12, borderWidth: 1 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
    modalSubtitle: { fontSize: 14, marginBottom: 24 },
    accountOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
    optBroker: { fontSize: 16, fontWeight: '800' },
    optId: { fontSize: 13, marginTop: 2 },
    optBalance: { fontSize: 16, fontWeight: '900' },
});

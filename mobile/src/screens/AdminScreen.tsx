// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Modal, Alert, Image } from 'react-native';
import { Text, TextInput } from '../components/Typography';
;
import { ChevronLeft, Users, Shield, Server, CheckCircle, XCircle, Plus, Trash2, Edit2, Star, Link, UploadCloud, Zap, Award, Globe, Flame } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import GlassView from '../components/GlassView';
const BlurView = GlassView;
import CustomBlurModal from '../components/CustomBlurModal';
import axios from 'axios';
import { colors, colors as defaultColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { BACKEND_URL, getTgSafeAreaTop, isTelegram } from '../config';
import { getItemAsync } from '../utils/storage';
import LottieView from 'lottie-react-native';

const LOTTIE_MAP: Record<string, any> = {
    'nft_rocket': require('../../assets/emojis/rocket.json'),
    'nft_star': require('../../assets/emojis/star.json'),
    'nft_fire': require('../../assets/emojis/fire.json'),
    'nft_heart': require('../../assets/emojis/heart.json'),
    'nft_party': require('../../assets/emojis/party.json'),
};

const getLottieSource = (key: string | null | undefined) => {
    if (!key) return LOTTIE_MAP['nft_rocket'];
    if (key.startsWith('http://') || key.startsWith('https://')) {
        return { uri: key };
    }
    if (key.startsWith('/') || key.startsWith('uploads/')) {
        return { uri: key.startsWith('/') ? `${BACKEND_URL}${key}` : `${BACKEND_URL}/${key}` };
    }
    const cleanKey = key.startsWith('nft_') ? key : `nft_${key}`;
    return LOTTIE_MAP[cleanKey] || LOTTIE_MAP[key] || LOTTIE_MAP['nft_rocket'];
};

export default function AdminScreen({ navigation }: any) {
    const { colors, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'brokers' | 'communities' | 'symbols' | 'users' | 'campaigns' | 'lotties' | 'ai-config'>('dashboard');
    const [customLotties, setCustomLotties] = useState<any[]>([]);
    const [isLottieModalOpen, setIsLottieModalOpen] = useState(false);
    const [lottieForm, setLottieForm] = useState({ name: '', key: '', lottieJson: '' });
    const [aiForm, setAiForm] = useState({
        activeProvider: 'nara',
        apiKey: '',
        baseUrl: '',
        modelName: '',
        fallbackApiKey: '',
        fallbackBaseUrl: '',
        fallbackModelName: ''
    });

    const [brokers, setBrokers] = useState<any[]>([]);
    const [communities, setCommunities] = useState<any[]>([]);
    const [symbols, setSymbols] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);

    // Modals state
    const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);
    const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
    const [isSymbolModalOpen, setIsSymbolModalOpen] = useState(false);
    const [isUserRoleModalOpen, setIsUserRoleModalOpen] = useState(false);
    const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
    const [editingBrokerId, setEditingBrokerId] = useState<string | null>(null);
    const [editingCommunityId, setEditingCommunityId] = useState<string | null>(null);
    const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

    // Form states
    const [brokerForm, setBrokerForm] = useState({ name: '', regulation: '', spreads: '', minDeposit: '', maxLeverage: '', logoUrl: '', ranking: '0', isPromoted: false, communityName: '' });
    const [communityForm, setCommunityForm] = useState({ name: '', description: '', iconColor: '#A855F7', imageUrl: '', newAdminUsername: '', newAdminRole: 'admin' });
    const [symbolForm, setSymbolForm] = useState({ symbol: '', name: '', description: '', price: '0', brokerUrl: '', isPinned: false, imageUrl: '', high: '', low: '', changePct: '', showMetrics: false });
    const [userRoleForm, setUserRoleForm] = useState({ userId: '', role: 'user' });

    // Campaign Forms
    const [campaignForm, setCampaignForm] = useState<any>({
        title: '',
        description: '',
        rewardLottieKey: 'nft_rocket',
        accentColor: '#3B82F6',
        maxParticipants: 0,
        isActive: true,
        tasks: []
    });
    const [taskForm, setTaskForm] = useState<any>({
        taskId: '',
        title: '',
        description: '',
        taskType: 'CONNECT_BROKER',
        config: {}
    });
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);

    const handlePickImage = async (onUploadSuccess: (url: string) => void) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                const token = await getItemAsync('accessToken');
                const res = await axios.post(`${BACKEND_URL}/api/v1/admin/upload`, {
                    imageBase64: `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`
                }, { headers: { Authorization: `Bearer ${token}` } });
                
                if (res.data.success) {
                    onUploadSuccess(res.data.url);
                }
            }
        } catch (err) {
            Alert.alert('Upload Failed', 'Could not upload image');
        }
    };

    useEffect(() => {
        fetchAdminData();
    }, [activeTab]);

    const fetchAdminData = async () => {
        try {
            setLoading(true);
            const token = await getItemAsync('accessToken');
            if (!token) return navigation.goBack();

            const headers = { Authorization: `Bearer ${token}` };

            if (activeTab === 'dashboard') {
                const res = await axios.get(`${BACKEND_URL}/api/v1/admin/stats`, { headers });
                setStats(res.data.data);
            } else if (activeTab === 'brokers') {
                const res = await axios.get(`${BACKEND_URL}/api/v1/admin/brokers`, { headers });
                setBrokers(res.data.data);
            } else if (activeTab === 'communities') {
                const res = await axios.get(`${BACKEND_URL}/api/v1/admin/communities`, { headers });
                setCommunities(res.data.data);
            } else if (activeTab === 'symbols') {
                const res = await axios.get(`${BACKEND_URL}/api/v1/admin/symbols`, { headers });
                setSymbols(res.data.data);
            } else if (activeTab === 'users') {
                const res = await axios.get(`${BACKEND_URL}/api/v1/admin/users`, { headers });
                setUsers(res.data.data);
            } else if (activeTab === 'campaigns') {
                const res = await axios.get(`${BACKEND_URL}/api/v1/campaigns/admin/list`, { headers });
                setCampaigns(res.data.campaigns);
                const lottieRes = await axios.get(`${BACKEND_URL}/api/v1/admin/lotties`, { headers });
                setCustomLotties(lottieRes.data.lotties || []);
            } else if (activeTab === 'lotties') {
                const res = await axios.get(`${BACKEND_URL}/api/v1/admin/lotties`, { headers });
                setCustomLotties(res.data.lotties || []);
            } else if (activeTab === 'ai-config') {
                const res = await axios.get(`${BACKEND_URL}/api/v1/admin/ai-config`, { headers });
                if (res.data.success && res.data.config) {
                    setAiForm(res.data.config);
                }
            }
        } catch (err: any) {
            console.log(err.response?.data || err);
            Alert.alert('Error', 'Failed to fetch data. Are you an admin?');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (method: 'post' | 'delete', endpoint: string, data?: any) => {
        try {
            const token = await getItemAsync('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const url = `${BACKEND_URL}/api/v1/admin/${endpoint}`;
            
            if (method === 'post') {
                await axios.post(url, data, { headers });
            } else {
                await axios.delete(url, { headers });
            }
            fetchAdminData(); // Refresh list
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Action failed');
        }
    };

    const renderTabs = () => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
            {['dashboard', 'brokers', 'communities', 'symbols', 'users', 'campaigns', 'lotties', 'ai-config'].map((tab) => (
                <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.activeTabBtn]} onPress={() => setActiveTab(tab as any)}>
                    <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab.toUpperCase()}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderDashboard = () => (
        <View style={styles.statsGrid}>
            <View style={styles.statCard}>
                <Users color={colors.primary} size={24} style={{ marginBottom: 8 }} />
                <Text style={styles.statValue}>{stats?.totalUsers || 0}</Text>
                <Text style={styles.statLabel}>Total Users</Text>
            </View>
            <View style={styles.statCard}>
                <Server color={colors.success} size={24} style={{ marginBottom: 8 }} />
                <Text style={styles.statValue}>{stats?.totalBrokers || 0}</Text>
                <Text style={styles.statLabel}>Brokers</Text>
            </View>
            <View style={styles.statCard}>
                <Shield color={colors.warning} size={24} style={{ marginBottom: 8 }} />
                <Text style={styles.statValue}>{stats?.totalCommunities || 0}</Text>
                <Text style={styles.statLabel}>Communities</Text>
            </View>
            <View style={styles.statCard}>
                <Star color={colors.danger} size={24} style={{ marginBottom: 8 }} />
                <Text style={styles.statValue}>{stats?.totalPromoted || 0}</Text>
                <Text style={styles.statLabel}>Promoted</Text>
            </View>
        </View>
    );

    const renderBrokers = () => (
        <View>
            <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingBrokerId(null); setBrokerForm({ name: '', regulation: '', spreads: '', minDeposit: '', maxLeverage: '', logoUrl: '', ranking: '0', isPromoted: false, communityName: '' }); setIsBrokerModalOpen(true); }}>
                <Plus color="#FFF" size={20} />
                <Text style={styles.addBtnText}>Add Broker</Text>
            </TouchableOpacity>
            {brokers.map(b => (
                <View key={b._id} style={styles.listItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {b.logoUrl ? <Image source={{ uri: b.logoUrl.startsWith('http') ? b.logoUrl : `${BACKEND_URL}${b.logoUrl}` }} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} /> : <View style={{ width: 40, height: 40, backgroundColor: colors.border, borderRadius: 8, marginRight: 12 }} />}
                        <View>
                            <Text style={styles.itemTitle}>{b.name} {b.isPromoted && '⭐'}</Text>
                            <Text style={styles.itemSub}>{b.regulation} • Rank: {b.ranking} • Rating: {b.rating}</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity onPress={() => {
                            setEditingBrokerId(b._id);
                            setBrokerForm({
                                name: b.name, regulation: b.regulation, spreads: b.spreads,
                                minDeposit: b.minDeposit, maxLeverage: b.maxLeverage, logoUrl: b.logoUrl || '',
                                ranking: b.ranking?.toString() || '0', isPromoted: b.isPromoted || false,
                                communityName: b.communityName || ''
                            });
                            setIsBrokerModalOpen(true);
                        }}>
                            <Edit2 color={colors.primary} size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleAction('delete', `brokers/${b._id}`)}>
                            <Trash2 color={colors.danger} size={20} />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    );

    const renderCommunities = () => (
        <View>
            <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingCommunityId(null); setCommunityForm({ name: '', description: '', iconColor: '#A855F7', imageUrl: '', newAdminUsername: '', newAdminRole: 'admin' }); setIsCommunityModalOpen(true); }}>
                <Plus color="#FFF" size={20} />
                <Text style={styles.addBtnText}>Create Community</Text>
            </TouchableOpacity>
            {communities.map(c => (
                <View key={c._id} style={styles.listItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {c.imageUrl ? <Image source={{ uri: c.imageUrl.startsWith('http') ? c.imageUrl : `${BACKEND_URL}${c.imageUrl}` }} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} /> : <View style={{ width: 40, height: 40, backgroundColor: c.iconColor || colors.border, borderRadius: 8, marginRight: 12 }} />}
                        <View>
                            <Text style={styles.itemTitle}>{c.name}</Text>
                            <Text style={styles.itemSub}>{c.memberCount} Members</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity onPress={() => {
                            setEditingCommunityId(c._id);
                            setCommunityForm({
                                name: c.name, description: c.description,
                                iconColor: c.iconColor || '#A855F7', imageUrl: c.imageUrl || '',
                                newAdminUsername: '', newAdminRole: 'admin'
                            });
                            setIsCommunityModalOpen(true);
                        }}>
                            <Edit2 color={colors.primary} size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleAction('delete', `communities/${c._id}`)}>
                            <Trash2 color={colors.danger} size={20} />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    );

    const renderSymbols = () => (
        <View>
            <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingBrokerId(null); setSymbolForm({ symbol: '', name: '', description: '', price: '0', brokerUrl: '', isPinned: false, imageUrl: '', high: '', low: '', changePct: '', showMetrics: false }); setIsSymbolModalOpen(true); }}>
                <Plus color="#FFF" size={20} />
                <Text style={styles.addBtnText}>Promote Symbol</Text>
            </TouchableOpacity>
            {symbols.map(s => (
                <View key={s._id} style={styles.listItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {s.imageUrl ? <Image source={{ uri: s.imageUrl.startsWith('http') ? s.imageUrl : `${BACKEND_URL}${s.imageUrl}` }} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} /> : <View style={{ width: 40, height: 40, backgroundColor: colors.border, borderRadius: 8, marginRight: 12 }} />}
                        <View>
                            <Text style={styles.itemTitle}>{s.symbol} {s.isPinned && '📌'}</Text>
                            <Text style={styles.itemSub}>{s.name} • ${s.price}</Text>
                            {s.brokerUrl && <Text style={{ color: colors.primary, fontSize: 11, marginTop: 4 }}>Trade URL: {s.brokerUrl}</Text>}
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity onPress={() => handleAction('post', `symbols/${s._id}/pin`)}>
                            <Star color={s.isPinned ? colors.warning : colors.textMuted} size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            setEditingBrokerId(s._id);
                            setSymbolForm({
                                symbol: s.symbol, name: s.name, description: s.description,
                                price: s.price?.toString() || '0', brokerUrl: s.brokerUrl || '',
                                isPinned: s.isPinned || false, imageUrl: s.imageUrl || '',
                                high: s.high?.toString() || '', low: s.low?.toString() || '',
                                changePct: s.changePct || '', showMetrics: s.showMetrics || false
                            });
                            setIsSymbolModalOpen(true);
                        }}>
                            <Edit2 color={colors.primary} size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleAction('delete', `symbols/${s._id}`)}>
                            <Trash2 color={colors.danger} size={20} />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    );

    const renderUsers = () => (
        <View>
            {users.map(u => (
                <View key={u._id} style={styles.listItem}>
                    <View>
                        <Text style={styles.itemTitle}>{u.username}</Text>
                        <Text style={styles.itemSub}>{u.email} • {u.role}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setUserRoleForm({ userId: u._id, role: u.role }); setIsUserRoleModalOpen(true); }} style={styles.actionBtnSmall}>
                        <Text style={styles.actionBtnTextSmall}>Edit Role</Text>
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );

    const renderLotties = () => {
        const handlePickLottieFile = () => {
            if (Platform.OS === 'web') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e: any) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event: any) => {
                            try {
                                const json = JSON.parse(event.target.result);
                                setLottieForm({
                                    name: file.name.replace('.json', ''),
                                    key: file.name.replace('.json', '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
                                    lottieJson: json
                                });
                                Alert.alert('Success', `Loaded ${file.name} Lottie file!`);
                            } catch (err) {
                                Alert.alert('Error', 'Invalid Lottie JSON file structure');
                            }
                        };
                        reader.readAsText(file);
                    }
                };
                input.click();
            } else {
                Alert.alert('Unsupported', 'File picking is only supported in Web panel currently.');
            }
        };

        const handleUploadLottie = async () => {
            if (!lottieForm.name || !lottieForm.key || !lottieForm.lottieJson) {
                return Alert.alert('Error', 'Please fill in all fields and select a Lottie JSON file.');
            }
            try {
                const token = await getItemAsync('accessToken');
                const headers = { Authorization: `Bearer ${token}` };
                const res = await axios.post(`${BACKEND_URL}/api/v1/admin/lotties/upload`, lottieForm, { headers });
                if (res.data.success) {
                    Alert.alert('Success', 'Lottie file uploaded successfully!');
                    setCustomLotties(res.data.lotties);
                    setIsLottieModalOpen(false);
                    setLottieForm({ name: '', key: '', lottieJson: '' });
                }
            } catch (err: any) {
                Alert.alert('Error', err.response?.data?.message || 'Failed to upload Lottie');
            }
        };

        const handleDeleteLottie = (key: string) => {
            Alert.alert('Confirm Delete', 'Are you sure you want to delete this custom Lottie?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        const token = await getItemAsync('accessToken');
                        const headers = { Authorization: `Bearer ${token}` };
                        const res = await axios.delete(`${BACKEND_URL}/api/v1/admin/lotties/${key}`, { headers });
                        if (res.data.success) {
                            Alert.alert('Success', 'Lottie deleted successfully!');
                            setCustomLotties(res.data.lotties);
                        }
                    } catch (err: any) {
                        Alert.alert('Error', err.response?.data?.message || 'Failed to delete Lottie');
                    }
                }}
            ]);
        };

        return (
            <View>
                <TouchableOpacity 
                    style={styles.addBtn} 
                    onPress={() => {
                        setLottieForm({ name: '', key: '', lottieJson: '' });
                        setIsLottieModalOpen(true);
                    }}
                >
                    <Plus color="#FFF" size={20} />
                    <Text style={styles.addBtnText}>Upload Custom Lottie</Text>
                </TouchableOpacity>

                <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 12, marginTop: 16 }}>
                    Default Built-in NFTs (5)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                    {['nft_rocket', 'nft_star', 'nft_fire', 'nft_heart', 'nft_party'].map(key => (
                        <View key={key} style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, alignItems: 'center', width: '30%', minWidth: 100 }}>
                            <LottieView 
                                source={getLottieSource(key)} 
                                autoPlay 
                                loop 
                                style={{ width: 50, height: 50, marginBottom: 8 }} 
                            />
                            <Text style={{ color: colors.text, fontSize: 11, fontWeight: '500' }}>
                                {key.replace('nft_', '').toUpperCase()}
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 2 }}>
                                key: {key}
                            </Text>
                        </View>
                    ))}
                </View>

                <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
                    Custom Uploaded NFTs ({customLotties.length})
                </Text>
                {customLotties.length === 0 ? (
                    <Text style={{ color: colors.textMuted, fontStyle: 'italic', marginBottom: 20 }}>
                        No custom Lottie files uploaded yet.
                    </Text>
                ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                        {customLotties.map(l => (
                            <View key={l.key} style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, alignItems: 'center', width: '30%', minWidth: 100, position: 'relative' }}>
                                <LottieView 
                                    source={getLottieSource(l.url)} 
                                    autoPlay 
                                    loop 
                                    style={{ width: 50, height: 50, marginBottom: 8 }} 
                                />
                                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '500', textAlign: 'center' }} numberOfLines={1}>
                                    {l.name}
                                </Text>
                                <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 2 }} numberOfLines={1}>
                                    key: {l.key}
                                </Text>
                                <TouchableOpacity 
                                    style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(239,68,68,0.1)', padding: 4, borderRadius: 6 }}
                                    onPress={() => handleDeleteLottie(l.key)}
                                >
                                    <Trash2 color={colors.danger} size={14} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* UPLOAD MODAL */}
                <CustomBlurModal visible={isLottieModalOpen} animationType="slide" transparent>
                    <View style={styles.modalBg}>
                        <BlurView 
                            style={styles.modalContent} 
                            intensity={30}
                            tint={isDark ? 'dark' : 'light'}
                        >
                            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                                <Text style={styles.modalTitle}>Upload Custom Lottie</Text>
                                
                                <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>Name</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholderTextColor={colors.textMuted} 
                                    placeholder="e.g. Golden Flame" 
                                    value={lottieForm.name} 
                                    onChangeText={t => setLottieForm({...lottieForm, name: t})} 
                                />

                                <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>Key Identifier</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholderTextColor={colors.textMuted} 
                                    placeholder="e.g. nft_gold_flame" 
                                    value={lottieForm.key} 
                                    onChangeText={t => setLottieForm({...lottieForm, key: t})} 
                                />

                                <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>File Content</Text>
                                <TouchableOpacity 
                                    style={[styles.input, { justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: colors.primary, height: 60 }]}
                                    onPress={handlePickLottieFile}
                                >
                                    <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                                        {lottieForm.lottieJson ? '✓ Lottie File Selected' : 'Select Lottie .json File'}
                                    </Text>
                                </TouchableOpacity>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsLottieModalOpen(false)}>
                                        <Text style={{ color: defaultColors.text }}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.submitBtn} onPress={handleUploadLottie}>
                                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Upload</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </BlurView>
                    </View>
                </CustomBlurModal>
            </View>
        );
    };

    const renderCampaigns = () => (
        <View>
            <TouchableOpacity 
                style={styles.addBtn} 
                onPress={() => {
                    setEditingCampaignId(null);
                    setCampaignForm({
                        title: '',
                        description: '',
                        rewardLottieKey: 'nft_rocket',
                        accentColor: '#3B82F6',
                        maxParticipants: 0,
                        isActive: true,
                        tasks: []
                    });
                    setIsCampaignModalOpen(true);
                }}
            >
                <Plus color="#FFF" size={20} />
                <Text style={styles.addBtnText}>Create Campaign</Text>
            </TouchableOpacity>

            {campaigns.map(c => (
                <View key={c._id} style={styles.listItem}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{c.title}</Text>
                        <Text style={styles.itemSub} numberOfLines={2}>{c.description}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                            Lottie: {c.rewardLottieKey} • Active: {c.isActive ? 'YES' : 'NO'} • Tasks: {c.tasks?.length || 0}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => {
                            setEditingCampaignId(c._id);
                            setCampaignForm({
                                title: c.title,
                                description: c.description,
                                rewardLottieKey: c.rewardLottieKey,
                                accentColor: c.accentColor || '#3B82F6',
                                maxParticipants: c.maxParticipants || 0,
                                isActive: c.isActive !== undefined ? c.isActive : true,
                                tasks: c.tasks || []
                            });
                            setIsCampaignModalOpen(true);
                        }}>
                            <Edit2 color={colors.primary} size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            Alert.alert('Confirm Delete', 'Are you sure you want to delete this campaign?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => {
                                    getItemAsync('accessToken').then(token => {
                                        axios.delete(`${BACKEND_URL}/api/v1/campaigns/admin/${c._id}`, { headers: { Authorization: `Bearer ${token}` } })
                                            .then(() => fetchAdminData())
                                            .catch(err => Alert.alert('Error', err.response?.data?.message || 'Delete failed'));
                                    });
                                }}
                            ]);
                        }}>
                            <Trash2 color={colors.danger} size={20} />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    );

    const handleSaveAIConfig = async () => {
        try {
            const token = await getItemAsync('accessToken');
            const res = await axios.post(`${BACKEND_URL}/api/v1/admin/ai-config`, aiForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                Alert.alert('Success', 'AI configuration saved successfully');
                fetchAdminData();
            }
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to save AI config');
        }
    };

    const renderAIConfig = () => (
        <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>MaxAI Provider Configuration</Text>
            
            <Text style={styles.label}>Active AI Provider</Text>
            <View style={styles.pickerContainer}>
                {['nara', 'openai', 'deepseek', 'gemini'].map((prov) => (
                    <TouchableOpacity 
                        key={prov} 
                        style={[styles.pickerBtn, aiForm.activeProvider === prov && styles.activePickerBtn]} 
                        onPress={() => setAiForm({ ...aiForm, activeProvider: prov })}
                    >
                        <Text style={[styles.pickerBtnText, aiForm.activeProvider === prov && styles.activePickerBtnText]}>{prov.toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Primary Base URL</Text>
            <TextInput
                style={styles.input}
                value={aiForm.baseUrl}
                onChangeText={(text) => setAiForm({ ...aiForm, baseUrl: text })}
                placeholder="https://router.bynara.id/v1"
                placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Primary API Key</Text>
            <TextInput
                style={styles.input}
                value={aiForm.apiKey}
                onChangeText={(text) => setAiForm({ ...aiForm, apiKey: text })}
                placeholder="sk-..."
                secureTextEntry
                placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Primary Model Name</Text>
            <TextInput
                style={styles.input}
                value={aiForm.modelName}
                onChangeText={(text) => setAiForm({ ...aiForm, modelName: text })}
                placeholder="mistral-medium-3-5"
                placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Fallback AI Configuration (Automatic Failover)</Text>

            <Text style={styles.label}>Fallback Base URL</Text>
            <TextInput
                style={styles.input}
                value={aiForm.fallbackBaseUrl}
                onChangeText={(text) => setAiForm({ ...aiForm, fallbackBaseUrl: text })}
                placeholder="https://api.openai.com/v1"
                placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Fallback API Key</Text>
            <TextInput
                style={styles.input}
                value={aiForm.fallbackApiKey}
                onChangeText={(text) => setAiForm({ ...aiForm, fallbackApiKey: text })}
                placeholder="sk-..."
                secureTextEntry
                placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Fallback Model Name</Text>
            <TextInput
                style={styles.input}
                value={aiForm.fallbackModelName}
                onChangeText={(text) => setAiForm({ ...aiForm, fallbackModelName: text })}
                placeholder="gpt-4o"
                placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveAIConfig}>
                <Text style={styles.submitBtnText}>Save AI Configurations</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                {!isTelegram && (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ChevronLeft color={colors.text} size={28} />
                    </TouchableOpacity>
                )}
                <Text style={styles.title}>Admin Control Panel</Text>
            </View>

            {renderTabs()}

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {activeTab === 'dashboard' && renderDashboard()}
                    {activeTab === 'brokers' && renderBrokers()}
                    {activeTab === 'communities' && renderCommunities()}
                    {activeTab === 'symbols' && renderSymbols()}
                    {activeTab === 'users' && renderUsers()}
                    {activeTab === 'campaigns' && renderCampaigns()}
                    {activeTab === 'lotties' && renderLotties()}
                    {activeTab === 'ai-config' && renderAIConfig()}
                </ScrollView>
            )}

            {/* BROKER MODAL */}
            <CustomBlurModal visible={isBrokerModalOpen} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <BlurView 
                        experimentalBlurMethod="regular"
                        intensity={100} 
                        tint={colors.blurTint} 
                        style={[
                            styles.modalContent,
                            { 
                                backgroundColor: isDark ? 'rgba(10, 12, 18, 0.45)' : 'rgba(240, 244, 248, 0.45)',
                                ...Platform.select({
                                    web: {
                                        backdropFilter: 'blur(30px)',
                                        WebkitBackdropFilter: 'blur(30px)',
                                    } as any
                                })
                            }
                        ]}
                    >
                        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                            <Text style={styles.modalTitle}>{editingBrokerId ? 'Edit Broker' : 'Add Broker'}</Text>
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Name" value={brokerForm.name} onChangeText={t => setBrokerForm({...brokerForm, name: t})} />
                            
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholderTextColor={colors.textMuted} placeholder="Logo Image URL" value={brokerForm.logoUrl} onChangeText={t => setBrokerForm({...brokerForm, logoUrl: t})} />
                                <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, justifyContent: 'center' }} onPress={() => handlePickImage((url) => setBrokerForm({...brokerForm, logoUrl: url}))}>
                                    <UploadCloud color={colors.primary} size={20} />
                                </TouchableOpacity>
                            </View>
                            
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Regulation (e.g. FCA, CySEC)" value={brokerForm.regulation} onChangeText={t => setBrokerForm({...brokerForm, regulation: t})} />
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Spreads (e.g. from 0.0 pips)" value={brokerForm.spreads} onChangeText={t => setBrokerForm({...brokerForm, spreads: t})} />
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Min Deposit (e.g. $10)" value={brokerForm.minDeposit} onChangeText={t => setBrokerForm({...brokerForm, minDeposit: t})} />
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Max Leverage (e.g. 1:500)" value={brokerForm.maxLeverage} onChangeText={t => setBrokerForm({...brokerForm, maxLeverage: t})} />
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Ranking (1-5, higher is better)" keyboardType="numeric" value={brokerForm.ranking} onChangeText={t => setBrokerForm({...brokerForm, ranking: t})} />
                            
                            <TouchableOpacity style={[styles.input, { justifyContent: 'center', backgroundColor: brokerForm.isPromoted ? 'rgba(168,85,247,0.1)' : 'transparent' }]} onPress={() => setBrokerForm({...brokerForm, isPromoted: !brokerForm.isPromoted})}>
                                <Text style={{ color: brokerForm.isPromoted ? colors.primary : colors.text }}>Promoted Broker: {brokerForm.isPromoted ? 'YES' : 'NO'}</Text>
                            </TouchableOpacity>

                            <Text style={{ color: colors.textMuted, marginBottom: 4, marginLeft: 4 }}>Link to Community (Optional):</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                <TouchableOpacity
                                    onPress={() => setBrokerForm({...brokerForm, communityName: ''})}
                                    style={{ backgroundColor: brokerForm.communityName === '' ? colors.primary : 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: brokerForm.communityName === '' ? colors.primary : defaultColors.border }}
                                >
                                    <Text style={{ color: brokerForm.communityName === '' ? '#FFF' : defaultColors.textMuted }}>None</Text>
                                </TouchableOpacity>
                                {communities.map(c => (
                                    <TouchableOpacity
                                        key={c._id}
                                        onPress={() => setBrokerForm({...brokerForm, communityName: c.name})}
                                        style={{ backgroundColor: brokerForm.communityName === c.name ? colors.primary : 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: brokerForm.communityName === c.name ? colors.primary : defaultColors.border }}
                                    >
                                        <Text style={{ color: brokerForm.communityName === c.name ? '#FFF' : defaultColors.textMuted }}>{c.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsBrokerModalOpen(false)}><Text style={{ color: defaultColors.text }}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.submitBtn} onPress={() => {
                                    const url = editingBrokerId ? `brokers/${editingBrokerId}` : 'brokers';
                                    const method = editingBrokerId ? 'put' : 'post';
                                    const token = getItemAsync('accessToken').then(t => {
                                        axios[method](`${BACKEND_URL}/api/v1/admin/${url}`, { ...brokerForm, ranking: Number(brokerForm.ranking) || 0, hasCommunity: brokerForm.communityName !== '' }, { headers: { Authorization: `Bearer ${t}` } })
                                            .then(() => { fetchAdminData(); setIsBrokerModalOpen(false); })
                                            .catch((err) => Alert.alert('Error', err.response?.data?.message || 'Failed'));
                                    });
                                }}><Text style={{ color: defaultColors.text, fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
                            </View>
                        </ScrollView>
                    </BlurView>
                </View>
            </CustomBlurModal>

            {/* COMMUNITY MODAL */}
            <CustomBlurModal visible={isCommunityModalOpen} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <BlurView 
                        experimentalBlurMethod="regular"
                        intensity={100} 
                        tint={colors.blurTint} 
                        style={[
                            styles.modalContent,
                            { 
                                backgroundColor: isDark ? 'rgba(10, 12, 18, 0.45)' : 'rgba(240, 244, 248, 0.45)',
                                ...Platform.select({
                                    web: {
                                        backdropFilter: 'blur(30px)',
                                        WebkitBackdropFilter: 'blur(30px)',
                                    } as any
                                })
                            }
                        ]}
                    >
                        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                            <Text style={styles.modalTitle}>{editingCommunityId ? 'Edit Community' : 'Create Community'}</Text>
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Name" value={communityForm.name} onChangeText={t => setCommunityForm({...communityForm, name: t})} />
                            
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholderTextColor={colors.textMuted} placeholder="Image URL (Logo)" value={communityForm.imageUrl} onChangeText={t => setCommunityForm({...communityForm, imageUrl: t})} />
                                <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, justifyContent: 'center' }} onPress={() => handlePickImage((url) => setCommunityForm({...communityForm, imageUrl: url}))}>
                                    <UploadCloud color={colors.primary} size={20} />
                                </TouchableOpacity>
                            </View>

                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Description" value={communityForm.description} onChangeText={t => setCommunityForm({...communityForm, description: t})} />
                            
                            {editingCommunityId && (
                                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                                    <Text style={{ color: colors.text, marginBottom: 8, fontWeight: 'bold' }}>Manage Admins/Moderators</Text>
                                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                                        <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholderTextColor={colors.textMuted} placeholder="Username or Email" value={communityForm.newAdminUsername} onChangeText={t => setCommunityForm({...communityForm, newAdminUsername: t})} />
                                        <TouchableOpacity 
                                            style={{ backgroundColor: communityForm.newAdminRole === 'admin' ? colors.primary : 'rgba(255,255,255,0.1)', paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center' }}
                                            onPress={() => setCommunityForm({...communityForm, newAdminRole: communityForm.newAdminRole === 'admin' ? 'moderator' : 'admin'})}
                                        >
                                            <Text style={{ color: '#FFF' }}>{communityForm.newAdminRole === 'admin' ? 'Admin' : 'Mod'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>Enter username and click Save to assign role.</Text>
                                </View>
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCommunityModalOpen(false)}><Text style={{ color: defaultColors.text }}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.submitBtn} onPress={() => {
                                    const url = editingCommunityId ? `communities/${editingCommunityId}` : 'communities';
                                    const method = editingCommunityId ? 'put' : 'post';
                                    getItemAsync('accessToken').then(token => {
                                        axios[method](`${BACKEND_URL}/api/v1/admin/${url}`, communityForm, { headers: { Authorization: `Bearer ${token}` } })
                                            .then((res) => {
                                                const savedId = editingCommunityId || res.data.data._id;
                                                if (communityForm.newAdminUsername) {
                                                    return axios.post(`${BACKEND_URL}/api/v1/admin/communities/${savedId}/admins`, {
                                                        targetUserIdentifier: communityForm.newAdminUsername,
                                                        role: communityForm.newAdminRole
                                                    }, { headers: { Authorization: `Bearer ${token}` } });
                                                }
                                            })
                                            .then(() => { fetchAdminData(); setIsCommunityModalOpen(false); })
                                            .catch((err) => Alert.alert('Error', err.response?.data?.message || 'Failed'));
                                    });
                                }}><Text style={{ color: defaultColors.text, fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
                            </View>
                        </ScrollView>
                    </BlurView>
                </View>
            </CustomBlurModal>

            {/* SYMBOL MODAL */}
            <CustomBlurModal visible={isSymbolModalOpen} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <BlurView 
                        experimentalBlurMethod="regular"
                        intensity={100} 
                        tint={colors.blurTint} 
                        style={[
                            styles.modalContent,
                            { 
                                backgroundColor: isDark ? 'rgba(10, 12, 18, 0.45)' : 'rgba(240, 244, 248, 0.45)',
                                ...Platform.select({
                                    web: {
                                        backdropFilter: 'blur(30px)',
                                        WebkitBackdropFilter: 'blur(30px)',
                                    } as any
                                })
                            }
                        ]}
                    >
                        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                            <Text style={styles.modalTitle}>Promote Symbol</Text>
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Symbol (e.g. BTC/USDT)" value={symbolForm.symbol} onChangeText={t => setSymbolForm({...symbolForm, symbol: t})} />
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Name (e.g. Bitcoin)" value={symbolForm.name} onChangeText={t => setSymbolForm({...symbolForm, name: t})} />
                            
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholderTextColor={colors.textMuted} placeholder="Image URL (Logo)" value={symbolForm.imageUrl} onChangeText={t => setSymbolForm({...symbolForm, imageUrl: t})} />
                                <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, justifyContent: 'center' }} onPress={() => handlePickImage((url) => setSymbolForm({...symbolForm, imageUrl: url}))}>
                                    <UploadCloud color={colors.primary} size={20} />
                                </TouchableOpacity>
                            </View>

                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Description" value={symbolForm.description} onChangeText={t => setSymbolForm({...symbolForm, description: t})} />
                            
                            <TouchableOpacity style={[styles.input, { justifyContent: 'center', backgroundColor: symbolForm.showMetrics ? 'rgba(8,153,129,0.1)' : 'transparent' }]} onPress={() => setSymbolForm({...symbolForm, showMetrics: !symbolForm.showMetrics})}>
                                <Text style={{ color: symbolForm.showMetrics ? colors.success : colors.text }}>Show Metrics on Screen (High/Low/Change): {symbolForm.showMetrics ? 'YES' : 'NO'}</Text>
                            </TouchableOpacity>

                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Price (Current)" keyboardType="numeric" value={symbolForm.price} onChangeText={t => setSymbolForm({...symbolForm, price: t})} />
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="High (e.g. 65000)" keyboardType="numeric" value={symbolForm.high} onChangeText={t => setSymbolForm({...symbolForm, high: t})} />
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Low (e.g. 60000)" keyboardType="numeric" value={symbolForm.low} onChangeText={t => setSymbolForm({...symbolForm, low: t})} />
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Change Pct (e.g. +5.20%)" value={symbolForm.changePct} onChangeText={t => setSymbolForm({...symbolForm, changePct: t})} />
                            
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Trade Redirect URL (Optional)" value={symbolForm.brokerUrl} onChangeText={t => setSymbolForm({...symbolForm, brokerUrl: t})} />
                            <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setSymbolForm({...symbolForm, isPinned: !symbolForm.isPinned})}>
                                <Text style={{ color: symbolForm.isPinned ? colors.warning : colors.text }}>Pinned to top: {symbolForm.isPinned ? 'YES' : 'NO'}</Text>
                            </TouchableOpacity>
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsSymbolModalOpen(false)}><Text style={{ color: defaultColors.text }}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.submitBtn} onPress={() => {
                                    const url = editingBrokerId ? `symbols/${editingBrokerId}` : 'symbols';
                                    const method = editingBrokerId ? 'put' : 'post';
                                    const token = getItemAsync('accessToken').then(t => {
                                        axios[method](`${BACKEND_URL}/api/v1/admin/${url}`, { 
                                            ...symbolForm, 
                                            price: parseFloat(symbolForm.price?.toString().replace(/,/g, '')) || 0,
                                            high: parseFloat(symbolForm.high?.toString().replace(/,/g, '')) || 0,
                                            low: parseFloat(symbolForm.low?.toString().replace(/,/g, '')) || 0
                                        }, { headers: { Authorization: `Bearer ${t}` } })
                                        .then(() => { fetchAdminData(); setIsSymbolModalOpen(false); })
                                        .catch((err) => Alert.alert('Error', err.response?.data?.message || 'Failed'));
                                    });
                                }}><Text style={{ color: defaultColors.text, fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
                            </View>
                        </ScrollView>
                    </BlurView>
                </View>
            </CustomBlurModal>

            {/* USER ROLE MODAL */}
            <CustomBlurModal visible={isUserRoleModalOpen} animationType="fade" transparent>
                <View style={styles.modalBg}>
                    <BlurView 
                        experimentalBlurMethod="regular"
                        intensity={100} 
                        tint={colors.blurTint} 
                        style={[
                            styles.modalContent,
                            { 
                                backgroundColor: isDark ? 'rgba(10, 12, 18, 0.45)' : 'rgba(240, 244, 248, 0.45)',
                                ...Platform.select({
                                    web: {
                                        backdropFilter: 'blur(30px)',
                                        WebkitBackdropFilter: 'blur(30px)',
                                    } as any
                                })
                            }
                        ]}
                    >
                        <Text style={styles.modalTitle}>Update Role</Text>
                        <TouchableOpacity style={styles.roleBtn} onPress={() => setUserRoleForm({...userRoleForm, role: 'user'})}>
                            <Text style={{ color: defaultColors.text, opacity: userRoleForm.role === 'user' ? 1 : 0.5 }}>User</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.roleBtn} onPress={() => setUserRoleForm({...userRoleForm, role: 'moderator'})}>
                            <Text style={{ color: defaultColors.text, opacity: userRoleForm.role === 'moderator' ? 1 : 0.5 }}>Moderator</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.roleBtn} onPress={() => setUserRoleForm({...userRoleForm, role: 'admin'})}>
                            <Text style={{ color: defaultColors.text, opacity: userRoleForm.role === 'admin' ? 1 : 0.5 }}>Admin</Text>
                        </TouchableOpacity>
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsUserRoleModalOpen(false)}><Text style={{ color: defaultColors.text }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.submitBtn} onPress={() => {
                                handleAction('post', 'users/role', userRoleForm);
                                setIsUserRoleModalOpen(false);
                            }}><Text style={{ color: defaultColors.text, fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
                        </View>
                    </BlurView>
                </View>
            </CustomBlurModal>

            {/* CAMPAIGN MODAL */}
            <CustomBlurModal visible={isCampaignModalOpen} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <BlurView 
                        experimentalBlurMethod="regular"
                        intensity={100} 
                        tint={colors.blurTint} 
                        style={[
                            styles.modalContent,
                            { 
                                backgroundColor: isDark ? 'rgba(10, 12, 18, 0.45)' : 'rgba(240, 244, 248, 0.45)',
                                ...Platform.select({
                                    web: {
                                        backdropFilter: 'blur(30px)',
                                        WebkitBackdropFilter: 'blur(30px)',
                                    } as any
                                }),
                                maxHeight: '85%'
                            }
                        ]}
                    >
                        <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalTitle}>{editingCampaignId ? 'Edit Campaign' : 'Create Campaign'}</Text>
                            
                            <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>Campaign Title</Text>
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Title" value={campaignForm.title} onChangeText={t => setCampaignForm({...campaignForm, title: t})} />
                            
                            <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>Campaign Description</Text>
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Description" value={campaignForm.description} onChangeText={t => setCampaignForm({...campaignForm, description: t})} />
                            
                            <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>Reward Lottie Key / URL</Text>
                            
                            {/* Default Lotties */}
                            <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 4 }}>Default Built-in:</Text>
                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                                {['nft_rocket', 'nft_star', 'nft_fire', 'nft_heart', 'nft_party'].map(key => (
                                    <TouchableOpacity 
                                        key={key} 
                                        style={{ 
                                            padding: 8, 
                                            backgroundColor: campaignForm.rewardLottieKey === key ? colors.primary : 'rgba(255,255,255,0.05)',
                                            borderRadius: 6,
                                            flex: 1,
                                            minWidth: 70,
                                            alignItems: 'center'
                                        }}
                                        onPress={() => setCampaignForm({...campaignForm, rewardLottieKey: key})}
                                    >
                                        <Text style={{ color: '#FFF', fontSize: 10 }}>{key.replace('nft_', '')}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Custom Lotties */}
                            {customLotties.length > 0 && (
                                <View style={{ marginBottom: 8 }}>
                                    <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 4 }}>Custom Uploaded:</Text>
                                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                                        {customLotties.map(l => (
                                            <TouchableOpacity 
                                                key={l.key} 
                                                style={{ 
                                                    padding: 8, 
                                                    backgroundColor: campaignForm.rewardLottieKey === l.url || campaignForm.rewardLottieKey === l.key ? colors.primary : 'rgba(255,255,255,0.05)',
                                                    borderRadius: 6,
                                                    minWidth: 90,
                                                    alignItems: 'center'
                                                }}
                                                onPress={() => setCampaignForm({...campaignForm, rewardLottieKey: l.url})}
                                            >
                                                <Text style={{ color: '#FFF', fontSize: 10 }} numberOfLines={1}>{l.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                            <TextInput 
                                style={[styles.input, { marginBottom: 12 }]} 
                                placeholderTextColor={colors.textMuted} 
                                placeholder="Enter custom Lottie Key or URL (https://...)" 
                                value={campaignForm.rewardLottieKey} 
                                onChangeText={t => setCampaignForm({...campaignForm, rewardLottieKey: t})} 
                            />

                            <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>Accent Color (HEX)</Text>
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="#3B82F6" value={campaignForm.accentColor} onChangeText={t => setCampaignForm({...campaignForm, accentColor: t})} />

                            <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>Max Participants (0 = unlimited)</Text>
                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Max Participants" keyboardType="numeric" value={campaignForm.maxParticipants?.toString()} onChangeText={t => setCampaignForm({...campaignForm, maxParticipants: parseInt(t) || 0})} />

                            <TouchableOpacity 
                                style={[styles.input, { justifyContent: 'center', backgroundColor: campaignForm.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]} 
                                onPress={() => setCampaignForm({...campaignForm, isActive: !campaignForm.isActive})}
                            >
                                <Text style={{ color: campaignForm.isActive ? colors.success : colors.danger }}>Active Status: {campaignForm.isActive ? 'ACTIVE' : 'INACTIVE'}</Text>
                            </TouchableOpacity>

                            {/* TASKS SUB-SECTION */}
                            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15, marginBottom: 10 }}>Manage Campaign Tasks ({campaignForm.tasks?.length || 0})</Text>
                                
                                {campaignForm.tasks?.map((task: any, index: number) => (
                                    <View key={task.taskId || index} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, marginBottom: 8, alignItems: 'center' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{task.title}</Text>
                                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{task.taskType}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                            <TouchableOpacity onPress={() => {
                                                setEditingTaskIndex(index);
                                                setTaskForm({
                                                    taskId: task.taskId,
                                                    title: task.title,
                                                    description: task.description || '',
                                                    taskType: task.taskType,
                                                    config: task.config || {}
                                                });
                                                setIsAddingTask(true);
                                            }}>
                                                <Edit2 size={16} color={colors.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => {
                                                const updatedTasks = campaignForm.tasks.filter((_: any, idx: number) => idx !== index);
                                                setCampaignForm({...campaignForm, tasks: updatedTasks});
                                            }}>
                                                <Trash2 size={16} color={colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}

                                {!isAddingTask ? (
                                    <TouchableOpacity 
                                        style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.border }]} 
                                        onPress={() => {
                                            setEditingTaskIndex(null);
                                            setTaskForm({
                                                taskId: 'task_' + Math.random().toString(36).substring(2, 7),
                                                title: '',
                                                description: '',
                                                taskType: 'CONNECT_BROKER',
                                                config: {}
                                            });
                                            setIsAddingTask(true);
                                        }}
                                    >
                                        <Plus color={colors.primary} size={16} />
                                        <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Task</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, marginTop: 4 }}>
                                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>{editingTaskIndex !== null ? 'Edit Task' : 'Add New Task'}</Text>
                                        
                                        <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Task ID (e.g. win_trades_5)" value={taskForm.taskId} onChangeText={t => setTaskForm({...taskForm, taskId: t})} />
                                        <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Task Title" value={taskForm.title} onChangeText={t => setTaskForm({...taskForm, title: t})} />
                                        <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Task Description" value={taskForm.description} onChangeText={t => setTaskForm({...taskForm, description: t})} />
                                        
                                        <Text style={{ color: colors.text, fontSize: 11, marginBottom: 4 }}>Task Type</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                            {['WIN_RATE', 'BALANCE_GROWTH', 'TRADE_COUNT', 'CONNECT_BROKER', 'VISIT_LINK', 'REFERRAL', 'DAILY_CHECK', 'WIN_STREAK', 'BALANCE_MULTIPLY'].map(type => (
                                                <TouchableOpacity 
                                                    key={type} 
                                                    style={{ 
                                                        padding: 8, 
                                                        backgroundColor: taskForm.taskType === type ? colors.primary : 'rgba(255,255,255,0.05)',
                                                        borderRadius: 6,
                                                        marginRight: 6
                                                    }}
                                                    onPress={() => setTaskForm({...taskForm, taskType: type, config: {}})}
                                                >
                                                    <Text style={{ color: '#FFF', fontSize: 10 }}>{type}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>

                                        {/* DYNAMIC CONFIG FIELDS */}
                                        {taskForm.taskType === 'WIN_RATE' && (
                                            <View style={{ gap: 8, marginBottom: 12 }}>
                                                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholderTextColor={colors.textMuted} placeholder="Min Win Rate % (e.g. 70)" keyboardType="numeric" value={taskForm.config?.minRate?.toString() || ''} onChangeText={t => setTaskForm({...taskForm, config: {...taskForm.config, minRate: parseInt(t) || 0}})} />
                                                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholderTextColor={colors.textMuted} placeholder="Last N Trades (e.g. 10)" keyboardType="numeric" value={taskForm.config?.lastNTrades?.toString() || ''} onChangeText={t => setTaskForm({...taskForm, config: {...taskForm.config, lastNTrades: parseInt(t) || 0}})} />
                                            </View>
                                        )}

                                        {taskForm.taskType === 'BALANCE_GROWTH' && (
                                            <View style={{ gap: 8, marginBottom: 12 }}>
                                                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholderTextColor={colors.textMuted} placeholder="Start Balance (e.g. 1000)" keyboardType="numeric" value={taskForm.config?.startBalance?.toString() || ''} onChangeText={t => setTaskForm({...taskForm, config: {...taskForm.config, startBalance: parseInt(t) || 0}})} />
                                                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholderTextColor={colors.textMuted} placeholder="Target Balance (e.g. 3000)" keyboardType="numeric" value={taskForm.config?.targetBalance?.toString() || ''} onChangeText={t => setTaskForm({...taskForm, config: {...taskForm.config, targetBalance: parseInt(t) || 0}})} />
                                            </View>
                                        )}

                                        {taskForm.taskType === 'TRADE_COUNT' && (
                                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Min Trades Needed" keyboardType="numeric" value={taskForm.config?.minTrades?.toString() || ''} onChangeText={t => setTaskForm({...taskForm, config: {...taskForm.config, minTrades: parseInt(t) || 0}})} />
                                        )}

                                        {taskForm.taskType === 'WIN_STREAK' && (
                                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Min Streak Count" keyboardType="numeric" value={taskForm.config?.minStreak?.toString() || ''} onChangeText={t => setTaskForm({...taskForm, config: {...taskForm.config, minStreak: parseInt(t) || 0}})} />
                                        )}

                                        {taskForm.taskType === 'BALANCE_MULTIPLY' && (
                                            <View style={{ gap: 8, marginBottom: 12 }}>
                                                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholderTextColor={colors.textMuted} placeholder="Multiplier (e.g. 3)" keyboardType="numeric" value={taskForm.config?.multiplier?.toString() || ''} onChangeText={t => setTaskForm({...taskForm, config: {...taskForm.config, multiplier: parseFloat(t) || 0}})} />
                                                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholderTextColor={colors.textMuted} placeholder="Initial Balance (default 1000)" keyboardType="numeric" value={taskForm.config?.initialBalance?.toString() || ''} onChangeText={t => setTaskForm({...taskForm, config: {...taskForm.config, initialBalance: parseInt(t) || 0}})} />
                                            </View>
                                        )}

                                        {taskForm.taskType === 'VISIT_LINK' && (
                                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="URL to Visit" value={taskForm.config?.url || ''} onChangeText={t => setTaskForm({...taskForm, config: {...taskForm.config, url: t}})} />
                                        )}

                                        {taskForm.taskType === 'REFERRAL' && (
                                            <TextInput style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Min Referrals" keyboardType="numeric" value={taskForm.config?.minReferrals?.toString() || ''} onChangeText={t => setTaskForm({...taskForm, config: {...taskForm.config, minReferrals: parseInt(t) || 0}})} />
                                        )}

                                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                                            <TouchableOpacity style={{ padding: 10 }} onPress={() => setIsAddingTask(false)}>
                                                <Text style={{ color: colors.textMuted }}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                style={{ backgroundColor: colors.primary, padding: 10, borderRadius: 6 }} 
                                                onPress={() => {
                                                    if (!taskForm.taskId || !taskForm.title) {
                                                        Alert.alert('Validation Error', 'Task ID and Title are required');
                                                        return;
                                                    }
                                                    
                                                    const updatedTasks = [...(campaignForm.tasks || [])];
                                                    if (editingTaskIndex !== null) {
                                                        updatedTasks[editingTaskIndex] = taskForm;
                                                    } else {
                                                        // Check if taskId is unique
                                                        if (updatedTasks.some(t => t.taskId === taskForm.taskId)) {
                                                            Alert.alert('Validation Error', 'Task ID must be unique');
                                                            return;
                                                        }
                                                        updatedTasks.push(taskForm);
                                                    }
                                                    
                                                    setCampaignForm({...campaignForm, tasks: updatedTasks});
                                                    setIsAddingTask(false);
                                                    setEditingTaskIndex(null);
                                                }}
                                            >
                                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Save Task</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>

                            <View style={[styles.modalActions, { marginTop: 20 }]}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCampaignModalOpen(false)}><Text style={{ color: defaultColors.text }}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.submitBtn} onPress={() => {
                                    if (!campaignForm.title || !campaignForm.rewardLottieKey) {
                                        Alert.alert('Validation Error', 'Title and Reward Lottie Key are required.');
                                        return;
                                    }

                                    const url = editingCampaignId ? `campaigns/admin/${editingCampaignId}` : 'campaigns/admin/create';
                                    const method = editingCampaignId ? 'put' : 'post';
                                    getItemAsync('accessToken').then(token => {
                                        axios[method](`${BACKEND_URL}/api/v1/${url}`, campaignForm, { headers: { Authorization: `Bearer ${token}` } })
                                            .then(() => { fetchAdminData(); setIsCampaignModalOpen(false); })
                                            .catch((err) => Alert.alert('Error', err.response?.data?.message || 'Failed to save campaign'));
                                    });
                                }}><Text style={{ color: defaultColors.text, fontWeight: 'bold' }}>Save Campaign</Text></TouchableOpacity>
                            </View>
                        </ScrollView>
                    </BlurView>
                </View>
            </CustomBlurModal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: defaultColors.background, paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: defaultColors.border },
    backBtn: { padding: 4, marginRight: 12 },
    title: { color: defaultColors.text, fontSize: 20, fontWeight: 'bold' },
    
    tabsContainer: { borderBottomWidth: 1, borderBottomColor: defaultColors.border, paddingHorizontal: 16, maxHeight: 50 },
    tabBtn: { paddingVertical: 14, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTabBtn: { borderBottomColor: defaultColors.primary },
    tabText: { color: '#64748B', fontSize: 13, fontWeight: 'bold' },
    activeTabText: { color: defaultColors.text },
    
    content: { padding: 16, paddingBottom: 60 },
    
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    statCard: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, alignItems: 'center' },
    statValue: { color: defaultColors.text, fontSize: 24, fontWeight: 'bold' },
    statLabel: { color: '#64748B', fontSize: 12, marginTop: 4 },
    
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: defaultColors.primary, padding: 14, borderRadius: 8, marginBottom: 16 },
    addBtnText: { color: defaultColors.text, fontWeight: 'bold', marginLeft: 8 },
    
    listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 8, marginBottom: 10 },
    itemTitle: { color: defaultColors.text, fontSize: 16, fontWeight: 'bold' },
    itemSub: { color: '#64748B', fontSize: 13, marginTop: 4 },
    
    actionBtnSmall: { backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    actionBtnTextSmall: { color: defaultColors.primary, fontSize: 12, fontWeight: 'bold' },

    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: defaultColors.glassCard, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: defaultColors.border },
    modalTitle: { color: defaultColors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    input: { backgroundColor: defaultColors.background, color: defaultColors.text, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: defaultColors.border },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
    cancelBtn: { padding: 12 },
    submitBtn: { backgroundColor: defaultColors.primary, padding: 12, borderRadius: 8, paddingHorizontal: 20 },
    roleBtn: { padding: 16, backgroundColor: defaultColors.background, marginBottom: 8, borderRadius: 8, alignItems: 'center' },
    label: { color: defaultColors.text, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
    pickerContainer: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    pickerBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
    activePickerBtn: { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: defaultColors.primary },
    pickerBtnText: { color: '#64748B', fontSize: 11, fontWeight: 'bold' },
    activePickerBtnText: { color: defaultColors.primary },
    formContainer: { backgroundColor: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: defaultColors.border }
});

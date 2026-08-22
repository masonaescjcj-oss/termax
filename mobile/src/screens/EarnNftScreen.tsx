// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  Linking, 
  Dimensions, 
  ActivityIndicator,
  Alert } from 'react-native';
import { Text } from '../components/Typography';
;
import LottieView from 'lottie-react-native';
import { 
  ChevronLeft, 
  CheckCircle2, 
  Circle, 
  Trophy, 
  Sparkles, 
  Flame, 
  Gift, 
  ArrowRight, 
  Zap, 
  Award, 
  Globe, 
  Users,
  Lock,
  Clock,
  UserCheck
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import GlassView from '../components/GlassView';
import { getItemAsync, setItemAsync } from '../utils/storage';
import { BACKEND_URL, isTelegram, getTgSafeAreaTop } from '../config';
import axios from 'axios';

const { width } = Dimensions.get('window');

const LOTTIE_MAP: Record<string, any> = {
  'nft_rocket': require('../../assets/emojis/rocket.json'),
  'nft_star': require('../../assets/emojis/star.json'),
  'nft_fire': require('../../assets/emojis/fire.json'),
  'nft_heart': require('../../assets/emojis/heart.json'),
  'nft_party': require('../../assets/emojis/party.json'),
};

export const getLottieSource = (key: string | null | undefined) => {
  if (!key) return LOTTIE_MAP['nft_rocket'];
  
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return { uri: key };
  }
  
  if (key.startsWith('/') || key.startsWith('uploads/')) {
    return { uri: key.startsWith('/') ? `${BACKEND_URL}${key}` : `${BACKEND_URL}/${key}` };
  }
  
  if (key.startsWith('{') && key.endsWith('}')) {
    try {
      return JSON.parse(key);
    } catch (e) {
      console.log('Failed to parse raw Lottie JSON:', e);
    }
  }
  
  const cleanKey = key.startsWith('nft_') ? key : `nft_${key}`;
  return LOTTIE_MAP[cleanKey] || LOTTIE_MAP[key] || LOTTIE_MAP['nft_rocket'];
};

export default function EarnNftScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLogged, setIsLogged] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [justClaimedNft, setJustClaimedNft] = useState<any>(null);

  // Fetch campaigns and user progress from API
  const fetchCampaigns = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      let token = await getItemAsync('accessToken');
      
      // Auto-login fallback if token is missing inside Telegram WebApp
      if (!token && isTelegram && typeof window !== 'undefined') {
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
          const tgUser = tg.initDataUnsafe.user;
          console.log('[EarnNftScreen] No token, attempting auto-login for:', tgUser);
          
          const tgUsername = tgUser.username || `tg_${tgUser.id}`;
          const tgPassword = `tg_secure_${tgUser.id}_${tgUser.first_name || 'user'}`;
          
          // Try login
          try {
            const loginRes = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, {
              username: tgUsername, password: tgPassword, telegramId: tgUser.id
            });
            if (loginRes.data.success && loginRes.data.data) {
              token = loginRes.data.data.accessToken;
              await setItemAsync('accessToken', token);
              await setItemAsync('refreshToken', loginRes.data.data.refreshToken);
              await setItemAsync('tg_cached_profile', JSON.stringify(loginRes.data.data.user));
              console.log('[EarnNftScreen] Telegram auto-login success');
            }
          } catch (loginErr) {
            // Try register
            try {
              const startParam = tg.initDataUnsafe.start_param || '';
              const regRes = await axios.post(`${BACKEND_URL}/api/v1/auth/register`, {
                username: tgUsername, password: tgPassword,
                email: `${tgUsername}@telegram.user`,
                telegramId: tgUser.id, referredByCode: startParam,
                avatarUrl: tgUser.photo_url || 'default'
              });
              if (regRes.data.success && regRes.data.data) {
                token = regRes.data.data.accessToken;
                await setItemAsync('accessToken', token);
                await setItemAsync('refreshToken', regRes.data.data.refreshToken);
                await setItemAsync('tg_cached_profile', JSON.stringify(regRes.data.data.user));
                console.log('[EarnNftScreen] Telegram auto-registration success');
              }
            } catch (regErr) {
              console.error('[EarnNftScreen] Telegram auto-registration failed:', regErr);
            }
          }
        }
      }

      if (!token) {
        setIsLogged(false);
        setLoading(false);
        return;
      }
      setIsLogged(true);

      const res = await axios.get(`${BACKEND_URL}/api/v1/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setCampaigns(res.data.campaigns);
        
        // Update selected campaign details if currently viewing one
        if (selectedCampaign) {
          const updated = res.data.campaigns.find(c => c._id === selectedCampaign._id);
          if (updated) {
            setSelectedCampaign(updated);
          }
        }
      }
    } catch (err: any) {
      console.log('Failed to fetch campaigns', err);
      if (err.response?.status === 401) {
        setIsLogged(false);
      } else {
        Alert.alert('Loading Error', err.response?.data?.message || 'A connection error occurred with the server.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCampaigns(campaigns.length > 0);
    }, [campaigns.length])
  );

  // Manage Telegram WebApp Native Back Button via global customTelegramBackHandler
  useEffect(() => {
    if (!isTelegram) return;

    if (selectedCampaign) {
      (window as any).customTelegramBackHandler = () => {
        setSelectedCampaign(null);
        return true; // handled
      };
    } else {
      (window as any).customTelegramBackHandler = null;
    }

    return () => {
      (window as any).customTelegramBackHandler = null;
    };
  }, [selectedCampaign]);

  // Auto verify campaign tasks on select and poll progress silently
  useEffect(() => {
    if (selectedCampaign) {
      handleVerifyTasks(selectedCampaign, true);
      const interval = setInterval(() => {
        handleVerifyTasks(selectedCampaign, true);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [selectedCampaign?._id]);

  const getTaskProgressText = (task: any) => {
    const cur = task.currentValue || 0;
    const tgt = task.targetValue || 1;
    switch (task.taskType) {
      case 'BALANCE_MULTIPLY':
      case 'BALANCE_GROWTH':
        return `$${cur.toLocaleString()} / $${tgt.toLocaleString()}`;
      case 'WIN_RATE':
        return `${cur}% / ${tgt}%`;
      case 'TRADE_COUNT':
        return `${cur} / ${tgt} trades`;
      case 'REFERRAL':
        return `${cur} / ${tgt} referrals`;
      case 'WIN_STREAK':
        return `${cur} / ${tgt} win streak`;
      default:
        return `${cur} / ${tgt}`;
    }
  };

  const handleJoinCampaign = async (campaign: any) => {
    try {
      setActionLoading(true);
      const token = await getItemAsync('accessToken');
      const res = await axios.post(`${BACKEND_URL}/api/v1/campaigns/${campaign._id}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        Alert.alert('Success', 'You have successfully joined this campaign!');
        await fetchCampaigns(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Unable to join campaign.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyTasks = async (campaign: any, silent = false) => {
    try {
      if (!silent) setActionLoading(true);
      const token = await getItemAsync('accessToken');
      const res = await axios.post(`${BACKEND_URL}/api/v1/campaigns/${campaign._id}/verify`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        if (!silent) {
          Alert.alert('Status Verified', res.data.message || 'Task status successfully updated.');
        }
        await fetchCampaigns(true);
      }
    } catch (err: any) {
      if (!silent) {
        Alert.alert('Verification Error', err.response?.data?.message || 'Task verification failed.');
      }
    } finally {
      if (!silent) setActionLoading(false);
    }
  };

  const handlePerformTask = async (campaign: any, task: any) => {
    const isClientTask = task.taskType === 'VISIT_LINK' || task.taskType === 'DAILY_CHECK';
    
    if (task.taskType === 'VISIT_LINK' && task.config?.url) {
      Linking.openURL(task.config.url).catch(() => {});
    }

    if (isClientTask) {
      try {
        setActionLoading(true);
        const token = await getItemAsync('accessToken');
        const res = await axios.post(`${BACKEND_URL}/api/v1/campaigns/${campaign._id}/complete-task`, {
          taskId: task.taskId
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.data?.success) {
          await fetchCampaigns(true);
        }
      } catch (err: any) {
        console.log('Failed to complete client task', err);
      } finally {
        setActionLoading(false);
      }
    } else {
      // Server-side task: advise user to click verify
      Alert.alert(
        'System Task',
        'This task is automatically verified by the server. Once the conditions are met, it will update automatically.'
      );
    }
  };

  const handleClaimNft = async (campaign: any) => {
    try {
      setActionLoading(true);
      const token = await getItemAsync('accessToken');
      const res = await axios.post(`${BACKEND_URL}/api/v1/campaigns/${campaign._id}/claim`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setJustClaimedNft(campaign);
        setShowCelebration(true);
        await fetchCampaigns(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Unable to claim reward.');
    } finally {
      setActionLoading(false);
    }
  };

  const getCampaignProgressInfo = (campaign: any) => {
    const total = campaign.tasks.length;
    const completed = campaign.progress?.completedTasks?.length || 0;
    return {
      completed,
      total,
      percent: total > 0 ? completed / total : 0
    };
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'CONNECT_BROKER': return <Zap color="#3B82F6" size={18} />;
      case 'VISIT_LINK': return <Globe color="#10B981" size={18} />;
      case 'WIN_RATE': return <Trophy color="#FBBF24" size={18} />;
      case 'DAILY_CHECK': return <CheckCircle2 color="#A855F7" size={18} />;
      case 'REFERRAL': return <Users color="#EC4899" size={18} />;
      case 'TRADE_COUNT': return <Award color="#06B6D4" size={18} />;
      case 'WIN_STREAK': return <Flame color="#EF4444" size={18} />;
      case 'BALANCE_GROWTH':
      case 'BALANCE_MULTIPLY': return <Sparkles color="#3B82F6" size={18} />;
      default: return <Award color="#6B7280" size={18} />;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!isLogged) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() }]}>
        {/* Header Block */}
        {!isTelegram && (
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' })}
              activeOpacity={0.7}
            >
              <ChevronLeft color={colors.primary} size={24} />
              <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={[styles.loginRequiredCard, { backgroundColor: isDark ? colors.glassCard : '#FFFFFF', borderColor: isDark ? colors.glassBorder : 'rgba(0,0,0,0.06)' }]}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
              <Lock color={colors.primary} size={40} />
            </View>
            <Text style={[styles.loginRequiredTitle, { color: colors.text }]}>Login Required</Text>
            <Text style={[styles.loginRequiredDesc, { color: colors.textMuted }]}>
              To view challenges and track your trading progress, please log in to your account or register a new one.
            </Text>
            <TouchableOpacity 
              style={[styles.loginBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Login' })}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>Log In to Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() }]}>
      {/* Header Block */}
      {!isTelegram && (
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => {
              if (selectedCampaign) {
                setSelectedCampaign(null);
              } else {
                navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' });
              }
            }}
            activeOpacity={0.7}
          >
            <ChevronLeft color={colors.primary} size={24} />
            <Text style={[styles.backText, { color: colors.text }]}>
              {selectedCampaign ? 'Challenges' : 'Back'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Campaign List Screen */}
      {!selectedCampaign ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <View style={styles.titleContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-start' }}>
              <Gift color="#A855F7" size={26} />
              <Text style={[styles.screenTitle, { color: colors.text, textAlign: 'left' }]}>NFT Challenges & Rewards</Text>
            </View>
            <Text style={[styles.screenSubtitle, { color: colors.textMuted, textAlign: 'left' }]}>
              Complete trading and social tasks to unlock and claim rare animated avatars.
            </Text>
          </View>

          {campaigns.length === 0 ? (
            <View style={{ py: 40, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted }}>No active challenges found.</Text>
            </View>
          ) : (
            campaigns.map(campaign => {
              const { completed, total, percent } = getCampaignProgressInfo(campaign);
              const isJoined = campaign.progress?.joined;
              const isClaimed = campaign.progress?.claimedReward;
              const isDone = completed === total && total > 0;
              const lottieSource = getLottieSource(campaign.rewardLottieKey);

              return (
                <TouchableOpacity
                  key={campaign._id}
                  onPress={() => setSelectedCampaign(campaign)}
                  activeOpacity={0.85}
                >
                  <GlassView
                    intensity={isDark ? 30 : 80}
                    tint={isDark ? 'dark' : 'light'}
                    style={[
                      styles.campaignCard,
                      { 
                        backgroundColor: colors.glassCard, 
                        borderColor: isClaimed ? 'rgba(16, 185, 129, 0.4)' : colors.glassCardBorder 
                      }
                    ]}
                  >
                    {/* Accent line */}
                    <View style={[styles.accentLine, { backgroundColor: campaign.accentColor }]} />

                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                    {/* NFT Lottie Container */}
                    <View style={[styles.lottieIconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.03)' }]}>
                      <LottieView
                        source={lottieSource}
                        autoPlay
                        loop
                        style={{ width: 70, height: 70 }}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 16, alignItems: 'flex-start' }}>
                      <Text style={[styles.campaignTitle, { color: colors.text, textAlign: 'left' }]}>{campaign.title}</Text>
                      <Text style={[styles.campaignDesc, { color: colors.textMuted, textAlign: 'left' }]} numberOfLines={2}>
                        {campaign.description}
                      </Text>

                      {/* Participant Limit Badge */}
                      {campaign.maxParticipants > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                          <Users size={11} color={colors.textMuted} />
                          <Text style={{ fontSize: 10, color: colors.textMuted }}>
                            Capacity: {campaign.currentParticipants} / {campaign.maxParticipants}
                          </Text>
                        </View>
                      )}

                      {/* Progress details */}
                      {isJoined && (
                        <View style={{ marginTop: 12, width: '100%' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>
                              {isClaimed ? 'Claimed' : `${completed} of ${total} tasks completed`}
                            </Text>
                            <Text style={{ fontSize: 11, color: campaign.accentColor, fontWeight: 'bold' }}>
                              {Math.round(percent * 100)}%
                            </Text>
                          </View>
                          
                          {/* Progress Bar */}
                          <View style={styles.progressBarBg}>
                            <View 
                              style={[
                                styles.progressBarFill, 
                                { 
                                  width: `${percent * 100}%`, 
                                  backgroundColor: isClaimed ? '#10B981' : campaign.accentColor 
                                }
                              ]} 
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Footer / Status Area */}
                  <View style={[styles.cardFooter, { borderTopColor: colors.glassBorder }]}>
                    {isClaimed ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 color="#10B981" size={16} />
                        <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700' }}>Active avatar in your profile</Text>
                      </View>
                    ) : isDone && isJoined ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Sparkles color="#FBBF24" size={16} />
                        <Text style={{ color: '#FBBF24', fontSize: 12, fontWeight: '700' }}>Ready to claim reward!</Text>
                      </View>
                    ) : isJoined ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Clock color={colors.primary} size={16} />
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>In progress</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ArrowRight color={colors.primary} size={16} />
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>View details & start challenge</Text>
                      </View>
                    )}
                  </View>
                </GlassView>
              </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      ) : (
        /* Details & Tasks View */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            {/* Holographic NFT Frame */}
            <View style={[styles.holoFrame, { borderColor: selectedCampaign.accentColor }]}>
              <LottieView
                source={getLottieSource(selectedCampaign.rewardLottieKey)}
                autoPlay
                loop
                style={{ width: 90, height: 90 }}
              />
              <View style={[styles.badgeIndicator, { backgroundColor: selectedCampaign.accentColor }]}>
                <Award color="#FFF" size={12} />
              </View>
            </View>

            <Text style={[styles.detailTitle, { color: colors.text }]}>{selectedCampaign.title}</Text>
            {/* Removed description text to save space for tasks */}

            {/* Campaign Joined Stats */}
            {selectedCampaign.maxParticipants > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                Remaining slots: {selectedCampaign.maxParticipants - selectedCampaign.currentParticipants} / {selectedCampaign.maxParticipants}
              </Text>
            )}
          </View>

          {/* Creative Glassmorphic Progress Bar Card */}
          <GlassView 
            intensity={isDark ? 30 : 80}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.progressHeaderCard, { borderColor: selectedCampaign.accentColor, backgroundColor: colors.glassCard }]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '700' }}>Challenge Progress</Text>
              <Text style={{ fontSize: 18, color: selectedCampaign.accentColor, fontWeight: '900', textShadowColor: `${selectedCampaign.accentColor}33`, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }}>
                {selectedCampaign.progress?.claimedReward ? '100% (Claimed)' : `${Math.round(getCampaignProgressInfo(selectedCampaign).percent * 100)}%`}
              </Text>
            </View>
            
            {/* Outer Bar */}
            <View style={[styles.creativeProgressBarBg, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
              {/* Inner Glowing Filled Bar */}
              <View 
                style={[
                  styles.creativeProgressBarFill, 
                  { 
                    width: `${getCampaignProgressInfo(selectedCampaign).percent * 100}%`, 
                    backgroundColor: selectedCampaign.progress?.claimedReward ? '#10B981' : selectedCampaign.accentColor,
                    shadowColor: selectedCampaign.progress?.claimedReward ? '#10B981' : selectedCampaign.accentColor,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 10,
                  }
                ]} 
              />
            </View>

            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8, alignSelf: 'flex-start' }}>
              {selectedCampaign.progress?.claimedReward ? 'NFT reward successfully added to your gallery.' : `${getCampaignProgressInfo(selectedCampaign).completed} of ${getCampaignProgressInfo(selectedCampaign).total} tasks successfully completed.`}
            </Text>
          </GlassView>

          {/* Removed Verify Tasks Button as verification happens automatically in background */}

          {/* Tasks List */}
          <Text style={[styles.sectionTitle, { color: colors.text, textAlign: 'left' }]}>Challenge Tasks</Text>
          
          {selectedCampaign.tasks.map((task) => {
            const isDone = selectedCampaign.progress?.completedTasks?.includes(task.taskId);
            const isServerSide = task.taskType !== 'VISIT_LINK' && task.taskType !== 'DAILY_CHECK';
            const hasProgress = ['BALANCE_GROWTH', 'BALANCE_MULTIPLY', 'TRADE_COUNT', 'WIN_RATE', 'WIN_STREAK', 'REFERRAL'].includes(task.taskType);
            const taskPercent = Math.min(1, Math.max(0, (task.currentValue || 0) / (task.targetValue || 1)));

            return (
              <GlassView 
                key={task.taskId} 
                intensity={isDark ? 20 : 60}
                tint={isDark ? 'dark' : 'light'}
                style={[
                  styles.taskItem, 
                  { 
                    backgroundColor: colors.glassCard,
                    borderColor: isDone ? 'rgba(16, 185, 129, 0.2)' : colors.glassCardBorder 
                  }
                ]}
              >
                <View style={styles.taskIconWrapper}>
                  {getTaskIcon(task.taskType)}
                </View>

                <View style={{ flex: 1, marginLeft: 12, marginRight: 8, alignItems: 'flex-start' }}>
                  <Text style={[styles.taskTitle, { color: colors.text, textDecorationLine: isDone ? 'line-through' : 'none', textAlign: 'left' }]}>
                    {task.title}
                  </Text>
                  <Text style={[styles.taskDesc, { color: colors.textMuted, textAlign: 'left' }]}>
                    {task.description}
                  </Text>
                  {isServerSide && !isDone && (
                    <View style={styles.serverBadge}>
                      <Lock size={10} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: 9, marginLeft: 4 }}>Auto System Verification</Text>
                    </View>
                  )}

                  {/* Render progress bar for numeric tasks */}
                  {hasProgress && !isDone && (
                    <View style={{ marginTop: 8, width: '100%' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 10, color: colors.textMuted }}>
                          {getTaskProgressText(task)}
                        </Text>
                        <Text style={{ fontSize: 10, color: selectedCampaign.accentColor, fontWeight: 'bold' }}>
                          {Math.round(taskPercent * 100)}%
                        </Text>
                      </View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <View 
                          style={{ 
                            height: '100%', 
                            width: `${taskPercent * 100}%`, 
                            backgroundColor: selectedCampaign.accentColor 
                          }} 
                        />
                      </View>
                    </View>
                  )}
                </View>

                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  {isDone ? (
                    <View style={{ padding: 6 }}>
                      <CheckCircle2 color="#10B981" size={20} />
                    </View>
                  ) : isServerSide ? (
                    // Server-side task: no guide button, just Lock indicator
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                      <Lock color={colors.textMuted} size={14} />
                    </View>
                  ) : (
                    // Client-side task: interactive button
                    <TouchableOpacity
                      style={[
                        styles.taskActionBtn,
                        { 
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          borderColor: colors.glassCardBorder
                        }
                      ]}
                      onPress={() => handlePerformTask(selectedCampaign, task)}
                      disabled={actionLoading}
                    >
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Go</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </GlassView>
            );
          })}

          {/* Claim Button */}
          <View style={{ marginTop: 24 }}>
            {selectedCampaign.progress?.claimedReward ? (
              <View style={[styles.claimedStatusCard, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <CheckCircle2 color="#10B981" size={24} />
                <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 15, marginTop: 8 }}>
                  Reward successfully claimed and activated!
                </Text>
              </View>
            ) : (
              // Check if all taskIds are completed
              selectedCampaign.tasks.every(t => selectedCampaign.progress?.completedTasks?.includes(t.taskId)) ? (
                <TouchableOpacity 
                  style={[styles.claimGlowBtn, { backgroundColor: selectedCampaign.accentColor, shadowColor: selectedCampaign.accentColor }]}
                  onPress={() => handleClaimNft(selectedCampaign)}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <Sparkles color="#FFF" size={20} style={{ marginRight: 8 }} />
                  <Text style={styles.claimGlowText}>Claim Challenge NFT Avatar</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.claimDisabledBtn}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', fontSize: 15 }}>
                    Complete all tasks to claim the reward
                  </Text>
                </View>
              )
            )}
          </View>
        </ScrollView>
      )}

      {/* Success / Claim Celebration Popup */}
      {showCelebration && justClaimedNft && (
        <View style={styles.overlayCelebration}>
          <View style={[styles.celebrationCard, { backgroundColor: colors.background, borderColor: justClaimedNft.accentColor }]}>
            {/* Confetti effect using party.json */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <LottieView
                source={LOTTIE_MAP['nft_party']}
                autoPlay
                loop
                style={{ width: '100%', height: '100%', opacity: 0.8 }}
              />
            </View>

            <LottieView
              source={getLottieSource(justClaimedNft.rewardLottieKey)}
              autoPlay
              loop
              style={{ width: 150, height: 150, alignSelf: 'center' }}
            />

            <Text style={[styles.celebrationTitle, { color: colors.text }]}>Congratulations! Challenge Completed</Text>
            <Text style={[styles.celebrationSubtitle, { color: colors.textMuted }]}>
              The animated avatar **{justClaimedNft.title}** has been added to your collection and set as your active profile avatar.
            </Text>

            <TouchableOpacity 
              style={[styles.celebrationBtn, { backgroundColor: justClaimedNft.accentColor }]}
              onPress={() => {
                setShowCelebration(false);
                setSelectedCampaign(null);
                navigation.navigate('MainTabs', { screen: 'Login' }); // Navigate to profile/login dashboard
              }}
            >
              <Text style={styles.celebrationBtnText}>View in Profile Collection</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  titleContainer: {
    marginVertical: 16,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
  },
  screenSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  campaignCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  lottieIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  campaignTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  campaignDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardFooter: {
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'flex-start'
  },
  holoFrame: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  badgeIndicator: {
    position: 'absolute',
    bottom: -2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0D0E12',
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 20,
  },
  detailDesc: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 30,
    marginTop: 8,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 14,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  taskIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  taskDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  serverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  taskActionBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60
  },
  verifyBtn: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  verifyBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  claimGlowBtn: {
    backgroundColor: '#A855F7',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    width: '100%'
  },
  claimGlowText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  claimDisabledBtn: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimedStatusCard: {
    borderRadius: 14,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayCelebration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 12, 18, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    padding: 24,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  celebrationTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  celebrationSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  celebrationBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  celebrationBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  loginRequiredCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  loginRequiredTitle: {
    fontSize: 20,
    fontWeight: '950',
    marginBottom: 10,
    textAlign: 'center',
  },
  loginRequiredDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  loginBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  progressHeaderCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    alignItems: 'center',
  },
  creativeProgressBarBg: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  creativeProgressBarFill: {
    height: '100%',
    borderRadius: 5,
  }
});

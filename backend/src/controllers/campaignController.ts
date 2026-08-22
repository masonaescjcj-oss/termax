import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import {
    mapCampaignToCamel,
    mapCampaignToSnake,
    mapCampaignProgressToCamel,
    mapCampaignProgressToSnake,
    mapUserToCamel
} from '../utils/mapper';

// ═══════════════════════════════════════════════════════════
// SEED DEFAULT CAMPAIGNS
// ═══════════════════════════════════════════════════════════
export const seedCampaigns = async () => {
    try {
        const seeds = [
            {
                title: 'Genesis Rocket NFT',
                description: 'Complete the trading and social tasks below to unlock and claim your animated Rocket NFT avatar.',
                reward_lottie_key: 'nft_rocket',
                accent_color: '#2962FF',
                max_participants: 0,
                is_active: true,
                tasks: [
                    {
                        taskId: 'task_connect_broker',
                        title: 'Connect Trading Account',
                        description: 'Connect a cTrader account (Demo or Live) to sync your trades.',
                        taskType: 'CONNECT_BROKER',
                        config: {}
                    },
                    {
                        taskId: 'task_join_telegram',
                        title: 'Join Telegram Channel',
                        description: 'Join our official channel to get the latest updates and analysis.',
                        taskType: 'VISIT_LINK',
                        config: { url: 'https://t.me/trade_app_channel' }
                    },
                    {
                        taskId: 'task_demo_multiply_3',
                        title: '3x Demo Account Growth',
                        description: 'Grow your initial $1,000 demo balance 3x to reach $3,000.',
                        taskType: 'BALANCE_MULTIPLY',
                        config: { multiplier: 3, initialBalance: 1000 }
                    },
                    {
                        taskId: 'task_trade_count_10',
                        title: 'Complete 10 Demo Trades',
                        description: 'Complete at least 10 closed trades in your demo account.',
                        taskType: 'TRADE_COUNT',
                        config: { minTrades: 10, accountType: 'DEMO' }
                    },
                    {
                        taskId: 'task_win_rate_60',
                        title: 'Maintain 60%+ Win Rate',
                        description: 'Achieve a win rate of at least 60% in your last 5 closed trades.',
                        taskType: 'WIN_RATE',
                        config: { minRate: 60, lastNTrades: 5, accountType: 'DEMO' }
                    }
                ]
            },
            {
                title: 'Social Star NFT',
                description: 'Social engagement and network building. This campaign is for traders who follow and support us on social media.',
                reward_lottie_key: 'nft_star',
                accent_color: '#FBBF24',
                max_participants: 0,
                is_active: true,
                tasks: [
                    {
                        taskId: 'task_follow_instagram',
                        title: 'Follow Instagram',
                        description: 'Follow our official Instagram page.',
                        taskType: 'VISIT_LINK',
                        config: { url: 'https://instagram.com/trade_app' }
                    },
                    {
                        taskId: 'task_follow_twitter',
                        title: 'Follow Twitter/X',
                        description: 'Follow our official Twitter/X page.',
                        taskType: 'VISIT_LINK',
                        config: { url: 'https://twitter.com/trade_app' }
                    },
                    {
                        taskId: 'task_daily_check',
                        title: 'Daily Check-in',
                        description: 'Confirm your attendance in the app for today.',
                        taskType: 'DAILY_CHECK',
                        config: {}
                    }
                ]
            },
            {
                title: 'Streak Flame NFT',
                description: 'Hardcore trading streak campaign! This challenge tests your consistent trading skills and growth.',
                reward_lottie_key: 'nft_fire',
                accent_color: '#EF4444',
                max_participants: 0,
                is_active: true,
                tasks: [
                    {
                        taskId: 'task_refer_friend',
                        title: 'Invite Friends',
                        description: 'Invite at least 1 friend using your referral code.',
                        taskType: 'REFERRAL',
                        config: { minReferrals: 1 }
                    },
                    {
                        taskId: 'task_win_streak_3',
                        title: '3 Win Streak',
                        description: 'Register at least 3 winning trades (CLOSED) in a row.',
                        taskType: 'WIN_STREAK',
                        config: { minStreak: 3 }
                    },
                    {
                        taskId: 'task_join_chat_group',
                        title: 'Join Chat Group',
                        description: 'Join our traders community chat group.',
                        taskType: 'VISIT_LINK',
                        config: { url: 'https://t.me/trade_app_chat' }
                    }
                ]
            }
        ];

        for (const seed of seeds) {
            // Check if campaign already exists by title
            const { data: existing } = await supabase
                .from('campaigns')
                .select('id')
                .eq('title', seed.title)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('campaigns')
                    .update(seed)
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('campaigns')
                    .insert(seed);
            }
            console.log(`Seeded/Updated campaign in SQL: ${seed.title}`);
        }
    } catch (error) {
        console.error('Error seeding campaigns:', error);
    }
};

// ═══════════════════════════════════════════════════════════
// USER ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * List active campaigns along with the current user's progress
 */
export const getCampaigns = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        // Fetch active campaigns ordered by creation
        const { data: campaigns, error: campError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (campError || !campaigns) {
            return res.status(500).json({ success: false, message: campError?.message || 'Failed to fetch campaigns' });
        }

        // Fetch progress for this user
        const { data: progressList } = userId 
            ? await supabase.from('campaign_progresses').select('*').eq('user_id', userId)
            : { data: [] };

        const progressMap = new Map();
        (progressList || []).forEach(p => {
            progressMap.set(p.campaign_id, {
                joined: true,
                completedTasks: p.completed_tasks || [],
                claimedReward: p.claimed_reward || false,
                claimedAt: p.claimed_at
            });
        });

        // Fetch user object to compute direct user metrics (broker, referral counts)
        const { data: rawUser } = userId
            ? await supabase.from('users').select('*').eq('id', userId).maybeSingle()
            : { data: null };

        const user = mapUserToCamel(rawUser);

        const result = await Promise.all(campaigns.map(async (camp) => {
            const progress = progressMap.get(camp.id) || {
                joined: false,
                completedTasks: [],
                claimedReward: false,
                claimedAt: null
            };

            // Calculate task progress values
            const tasksWithProgress = await Promise.all((camp.tasks || []).map(async (task: any) => {
                let currentValue = 0;
                let targetValue = 1;
                const config = task.config || {};

                if (user) {
                    const isCompleted = progress.completedTasks.includes(task.taskId);
                    if (isCompleted) {
                        currentValue = 1;
                        targetValue = 1;
                    } else {
                        switch (task.taskType) {
                            case 'CONNECT_BROKER':
                                currentValue = user.cTraderAccounts && user.cTraderAccounts.length > 0 ? 1 : 0;
                                targetValue = 1;
                                break;
                            case 'REFERRAL':
                                currentValue = user.referralCount || 0;
                                targetValue = config.minReferrals || 1;
                                break;
                            case 'TRADE_COUNT': {
                                const { count } = await supabase
                                    .from('positions')
                                    .select('*', { count: 'exact', head: true })
                                    .eq('user_id', userId)
                                    .eq('status', 'CLOSED')
                                    .eq('account_type', config.accountType || 'DEMO');
                                currentValue = count || 0;
                                targetValue = config.minTrades || 1;
                                break;
                            }
                            case 'WIN_RATE': {
                                const lastN = config.lastNTrades || 3;
                                const { data: positions } = await supabase
                                    .from('positions')
                                    .select('final_profit')
                                    .eq('user_id', userId)
                                    .eq('status', 'CLOSED')
                                    .eq('account_type', config.accountType || 'DEMO')
                                    .order('close_time', { ascending: false })
                                    .limit(lastN);
                                
                                const count = positions?.length || 0;
                                const wins = positions?.filter(p => Number(p.final_profit || 0) > 0).length || 0;
                                currentValue = count > 0 ? Math.round((wins / count) * 100) : 0;
                                targetValue = config.minRate || 50;
                                break;
                            }
                            case 'WIN_STREAK': {
                                const minStreak = config.minStreak || 3;
                                const { data: positions } = await supabase
                                    .from('positions')
                                    .select('final_profit')
                                    .eq('user_id', userId)
                                    .eq('status', 'CLOSED')
                                    .eq('account_type', config.accountType || 'DEMO')
                                    .order('close_time', { ascending: true }); // Chronological order
                                
                                let maxStreak = 0;
                                let currentStreak = 0;
                                for (const p of positions || []) {
                                    if (Number(p.final_profit || 0) > 0) {
                                        currentStreak++;
                                        if (currentStreak > maxStreak) maxStreak = currentStreak;
                                    } else {
                                        currentStreak = 0;
                                    }
                                }
                                currentValue = maxStreak;
                                targetValue = minStreak;
                                break;
                            }
                            case 'BALANCE_GROWTH': {
                                const account = user.cTraderAccounts.find((a: any) => a.accountType === (config.accountType || 'DEMO'));
                                currentValue = account ? Math.round(account.balance) : 0;
                                targetValue = config.targetBalance || 3000;
                                break;
                            }
                            case 'BALANCE_MULTIPLY': {
                                const account = user.cTraderAccounts.find((a: any) => a.accountType === (config.accountType || 'DEMO'));
                                currentValue = account ? Math.round(account.balance) : 0;
                                targetValue = (config.initialBalance || 1000) * (config.multiplier || 3);
                                break;
                            }
                            default:
                                currentValue = 0;
                                targetValue = 1;
                                break;
                        }
                    }
                }

                return {
                    ...task,
                    currentValue,
                    targetValue
                };
            }));

            const mappedCamp = mapCampaignToCamel(camp);
            return {
                ...mappedCamp,
                tasks: tasksWithProgress,
                progress
            };
        }));

        res.status(200).json({ success: true, campaigns: result });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Join a campaign
 */
export const joinCampaign = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id: campaignId } = req.params;

        const { data: campaign, error: fetchErr } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (fetchErr || !campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        if (!campaign.is_active) {
            return res.status(400).json({ success: false, message: 'Campaign is inactive' });
        }

        // Limit check
        if (campaign.max_participants > 0 && campaign.current_participants >= campaign.max_participants) {
            return res.status(400).json({ success: false, message: 'Campaign is full' });
        }

        // Check existing progress
        const { data: existingProgress } = await supabase
            .from('campaign_progresses')
            .select('*')
            .eq('user_id', userId)
            .eq('campaign_id', campaignId)
            .maybeSingle();

        if (existingProgress) {
            return res.status(200).json({
                success: true,
                message: 'Already joined this campaign',
                progress: mapCampaignProgressToCamel(existingProgress)
            });
        }

        // Create campaign progress record
        const { data: progress, error: createErr } = await supabase
            .from('campaign_progresses')
            .insert({
                user_id: userId,
                campaign_id: campaignId,
                completed_tasks: [],
                joined_at: new Date().toISOString(),
                claimed_reward: false
            })
            .select()
            .single();

        if (createErr || !progress) {
            return res.status(500).json({ success: false, message: createErr?.message || 'Failed to join campaign' });
        }

        // Increment current participants
        await supabase
            .from('campaigns')
            .update({ current_participants: (campaign.current_participants || 0) + 1 })
            .eq('id', campaignId);

        res.status(201).json({
            success: true,
            message: 'Successfully joined campaign',
            progress: mapCampaignProgressToCamel(progress)
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Verify tasks server-side and update progress
 */
export const verifyCampaignTasks = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id: campaignId } = req.params;

        const { data: campaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        let { data: progress } = await supabase
            .from('campaign_progresses')
            .select('*')
            .eq('user_id', userId)
            .eq('campaign_id', campaignId)
            .maybeSingle();

        if (!progress) {
            const { data: newProg } = await supabase
                .from('campaign_progresses')
                .insert({
                    user_id: userId,
                    campaign_id: campaignId,
                    completed_tasks: []
                })
                .select()
                .single();
            
            progress = newProg;
            // Increment participants
            await supabase
                .from('campaigns')
                .update({ current_participants: (campaign.current_participants || 0) + 1 })
                .eq('id', campaignId);
        }

        if (!progress) {
            return res.status(500).json({ success: false, message: 'Failed to find or create progress record.' });
        }

        if (progress.claimed_reward) {
            return res.status(200).json({
                success: true,
                message: 'Campaign already completed and reward claimed',
                progress: mapCampaignProgressToCamel(progress)
            });
        }

        const { data: rawUser } = await supabase.from('users').select('*').eq('id', userId).single();
        const user = mapUserToCamel(rawUser);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newlyCompleted: string[] = [];

        for (const task of campaign.tasks || []) {
            if (progress.completed_tasks.includes(task.taskId)) {
                continue;
            }

            let isTaskMet = false;
            const config = task.config || {};

            switch (task.taskType) {
                case 'CONNECT_BROKER':
                    isTaskMet = user.cTraderAccounts && user.cTraderAccounts.length > 0;
                    break;

                case 'REFERRAL':
                    isTaskMet = user.referralCount >= (config.minReferrals || 1);
                    break;

                case 'TRADE_COUNT': {
                    const { count } = await supabase
                        .from('positions')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .eq('status', 'CLOSED')
                        .eq('account_type', config.accountType || 'DEMO');
                    isTaskMet = (count || 0) >= (config.minTrades || 1);
                    break;
                }

                case 'WIN_RATE': {
                    const lastN = config.lastNTrades || 3;
                    const minRate = config.minRate || 50;
                    const { data: positions } = await supabase
                        .from('positions')
                        .select('final_profit')
                        .eq('user_id', userId)
                        .eq('status', 'CLOSED')
                        .eq('account_type', config.accountType || 'DEMO')
                        .order('close_time', { ascending: false })
                        .limit(lastN);

                    if (positions && positions.length >= lastN) {
                        const wins = positions.filter(p => Number(p.final_profit || 0) > 0).length;
                        const rate = (wins / positions.length) * 100;
                        isTaskMet = rate >= minRate;
                    }
                    break;
                }

                case 'WIN_STREAK': {
                    const minStreak = config.minStreak || 3;
                    const { data: positions } = await supabase
                        .from('positions')
                        .select('final_profit')
                        .eq('user_id', userId)
                        .eq('status', 'CLOSED')
                        .eq('account_type', config.accountType || 'DEMO')
                        .order('close_time', { ascending: true }); // Chronological order

                    let maxStreak = 0;
                    let currentStreak = 0;
                    for (const p of positions || []) {
                        if (Number(p.final_profit || 0) > 0) {
                            currentStreak++;
                            if (currentStreak > maxStreak) {
                                maxStreak = currentStreak;
                            }
                        } else {
                            currentStreak = 0;
                        }
                    }
                    isTaskMet = maxStreak >= minStreak;
                    break;
                }

                case 'BALANCE_GROWTH': {
                    const accountType = config.accountType || 'DEMO';
                    const targetBalance = config.targetBalance || 3000;
                    const account = user.cTraderAccounts.find((a: any) => a.accountType === accountType);
                    isTaskMet = account ? account.balance >= targetBalance : false;
                    break;
                }

                case 'BALANCE_MULTIPLY': {
                    const accountType = config.accountType || 'DEMO';
                    const multiplier = config.multiplier || 3;
                    const initialBalance = config.initialBalance || 1000;
                    const account = user.cTraderAccounts.find((a: any) => a.accountType === accountType);
                    isTaskMet = account ? account.balance >= (initialBalance * multiplier) : false;
                    break;
                }

                case 'VISIT_LINK':
                case 'DAILY_CHECK':
                    // Mark completed client-side
                    break;

                default:
                    break;
            }

            if (isTaskMet) {
                newlyCompleted.push(task.taskId);
            }
        }

        let finalProgress = progress;
        if (newlyCompleted.length > 0) {
            const updatedTasks = [...(progress.completed_tasks || []), ...newlyCompleted];
            const { data: updatedProg } = await supabase
                .from('campaign_progresses')
                .update({ completed_tasks: updatedTasks })
                .eq('id', progress.id)
                .select()
                .single();
            if (updatedProg) finalProgress = updatedProg;
        }

        res.status(200).json({
            success: true,
            message: newlyCompleted.length > 0
                ? `${newlyCompleted.length} tasks newly verified`
                : 'No new tasks verified',
            progress: mapCampaignProgressToCamel(finalProgress)
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Mark a client-side task (VISIT_LINK, DAILY_CHECK) as completed
 */
export const completeClientTask = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id: campaignId } = req.params;
        const { taskId } = req.body;

        if (!taskId) {
            return res.status(400).json({ success: false, message: 'taskId is required' });
        }

        const { data: campaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        const task = (campaign.tasks || []).find((t: any) => t.taskId === taskId);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found in campaign' });
        }

        let { data: progress } = await supabase
            .from('campaign_progresses')
            .select('*')
            .eq('user_id', userId)
            .eq('campaign_id', campaignId)
            .maybeSingle();

        if (!progress) {
            const { data: newProg } = await supabase
                .from('campaign_progresses')
                .insert({
                    user_id: userId,
                    campaign_id: campaignId,
                    completed_tasks: []
                })
                .select()
                .single();
            progress = newProg;
            // Increment participants
            await supabase
                .from('campaigns')
                .update({ current_participants: (campaign.current_participants || 0) + 1 })
                .eq('id', campaignId);
        }

        if (!progress) {
            return res.status(500).json({ success: false, message: 'Failed to join campaign progress.' });
        }

        if (progress.completed_tasks.includes(taskId)) {
            return res.status(200).json({
                success: true,
                message: 'Task already completed',
                progress: mapCampaignProgressToCamel(progress)
            });
        }

        const updatedTasks = [...(progress.completed_tasks || []), taskId];
        const { data: finalProgress, error } = await supabase
            .from('campaign_progresses')
            .update({ completed_tasks: updatedTasks })
            .eq('id', progress.id)
            .select()
            .single();

        if (error || !finalProgress) {
            return res.status(500).json({ success: false, message: error?.message || 'Failed to update task progress' });
        }

        res.status(200).json({
            success: true,
            message: 'Task completed successfully',
            progress: mapCampaignProgressToCamel(finalProgress)
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Claim reward NFT
 */
export const claimReward = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id: campaignId } = req.params;

        const { data: campaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        const { data: progress } = await supabase
            .from('campaign_progresses')
            .select('*')
            .eq('user_id', userId)
            .eq('campaign_id', campaignId)
            .maybeSingle();

        if (!progress) {
            return res.status(400).json({ success: false, message: 'You have not joined this campaign yet' });
        }

        if (progress.claimed_reward) {
            return res.status(400).json({ success: false, message: 'Reward already claimed' });
        }

        // Verify all tasks are completed
        const requiredTaskIds = (campaign.tasks || []).map((t: any) => t.taskId);
        const allCompleted = requiredTaskIds.every((id: string) => (progress.completed_tasks || []).includes(id));

        if (!allCompleted) {
            return res.status(400).json({ success: false, message: 'Please complete all tasks before claiming reward' });
        }

        const { data: updatedProgress, error } = await supabase
            .from('campaign_progresses')
            .update({
                claimed_reward: true,
                claimed_at: new Date().toISOString()
            })
            .eq('id', progress.id)
            .select()
            .single();

        if (error || !updatedProgress) {
            return res.status(500).json({ success: false, message: error?.message || 'Failed to claim reward' });
        }

        res.status(200).json({
            success: true,
            message: 'Reward claimed successfully!',
            progress: mapCampaignProgressToCamel(updatedProgress)
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * Get all campaigns for admin
 */
export const adminListCampaigns = async (req: AuthRequest, res: Response) => {
    try {
        const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        res.status(200).json({ success: true, campaigns: (campaigns || []).map(mapCampaignToCamel) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create a campaign
 */
export const adminCreateCampaign = async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, rewardLottieKey, accentColor, tasks, maxParticipants, startDate, endDate, isActive } = req.body;

        const campaignSnake = mapCampaignToSnake({
            title,
            description,
            rewardLottieKey,
            accentColor: accentColor || '#3B82F6',
            tasks: tasks || [],
            maxParticipants: maxParticipants || 0,
            startDate,
            endDate,
            isActive: isActive !== undefined ? isActive : true
        });

        const { data: newCampaign, error } = await supabase
            .from('campaigns')
            .insert(campaignSnake)
            .select()
            .single();

        if (error || !newCampaign) {
            return res.status(500).json({ success: false, message: error?.message || 'Failed to create campaign' });
        }

        res.status(201).json({ success: true, campaign: mapCampaignToCamel(newCampaign) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update a campaign
 */
export const adminUpdateCampaign = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, description, rewardLottieKey, accentColor, tasks, maxParticipants, startDate, endDate, isActive } = req.body;

        const { data: campaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .single();

        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        const updates = mapCampaignToSnake({
            title: title !== undefined ? title : campaign.title,
            description: description !== undefined ? description : campaign.description,
            rewardLottieKey: rewardLottieKey !== undefined ? rewardLottieKey : campaign.reward_lottie_key,
            accentColor: accentColor !== undefined ? accentColor : campaign.accent_color,
            tasks: tasks !== undefined ? tasks : campaign.tasks,
            maxParticipants: maxParticipants !== undefined ? maxParticipants : campaign.max_participants,
            startDate: startDate !== undefined ? startDate : campaign.start_date,
            endDate: endDate !== undefined ? endDate : campaign.end_date,
            isActive: isActive !== undefined ? isActive : campaign.is_active
        });

        const { data: updatedCampaign, error } = await supabase
            .from('campaigns')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error || !updatedCampaign) {
            return res.status(500).json({ success: false, message: error?.message || 'Failed to update campaign' });
        }

        res.status(200).json({ success: true, campaign: mapCampaignToCamel(updatedCampaign) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete a campaign
 */
export const adminDeleteCampaign = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const { data: deleted, error } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error || !deleted) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        // Clean up progress entries in Supabase (cascade can handle this but we delete explicitly for safety)
        await supabase
            .from('campaign_progresses')
            .delete()
            .eq('campaign_id', id);

        res.status(200).json({ success: true, message: 'Campaign and associated progress records deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

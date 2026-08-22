/**
 * Database <-> Application Model Mapper
 * Maps snake_case PostgreSQL column names to camelCase Application properties,
 * and handles MongoDB _id/id compatibility for the Expo mobile app.
 */

// --- USER ---
export const mapUserToCamel = (dbUser: any): any => {
    if (!dbUser) return null;
    return {
        _id: dbUser.id,
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        avatarUrl: dbUser.avatar_url,
        activeNft: dbUser.active_nft,
        role: dbUser.role,
        telegramId: dbUser.telegram_id,
        referralCode: dbUser.referral_code,
        referredBy: dbUser.referred_by,
        referralCount: dbUser.referral_count || 0,
        watchlist: dbUser.watchlist || [],
        settings: dbUser.settings || { notifications: true, language: 'en', theme: 'dark' },
        cTraderAccounts: (dbUser.ctrader_accounts || []).map((acc: any) => ({
            cTraderId: acc.cTraderId || acc.cTraderId || acc.id,
            accessToken: acc.accessToken,
            refreshToken: acc.refreshToken,
            accountType: acc.accountType || 'DEMO',
            broker: acc.broker,
            balance: acc.balance || 0,
            currency: acc.currency || 'USD',
            leverage: acc.leverage || '1:100',
            connectedAt: acc.connectedAt ? new Date(acc.connectedAt) : new Date()
        })),
        lastLogin: dbUser.last_login ? new Date(dbUser.last_login) : new Date(),
        createdAt: dbUser.created_at ? new Date(dbUser.created_at) : new Date(),
        updatedAt: dbUser.updated_at ? new Date(dbUser.updated_at) : new Date()
    };
};

export const mapUserToSnake = (appUser: any): any => {
    if (!appUser) return null;
    const snake: any = {};
    if (appUser.id || appUser._id) snake.id = appUser.id || appUser._id;
    if (appUser.username !== undefined) snake.username = appUser.username;
    if (appUser.email !== undefined) snake.email = appUser.email;
    if (appUser.avatarUrl !== undefined) snake.avatar_url = appUser.avatarUrl;
    if (appUser.activeNft !== undefined) snake.active_nft = appUser.activeNft;
    if (appUser.role !== undefined) snake.role = appUser.role;
    if (appUser.telegramId !== undefined) snake.telegram_id = appUser.telegramId;
    if (appUser.referralCode !== undefined) snake.referral_code = appUser.referralCode;
    if (appUser.referredBy !== undefined) snake.referred_by = appUser.referredBy;
    if (appUser.referralCount !== undefined) snake.referral_count = appUser.referralCount;
    if (appUser.watchlist !== undefined) snake.watchlist = appUser.watchlist;
    if (appUser.settings !== undefined) snake.settings = appUser.settings;
    if (appUser.cTraderAccounts !== undefined) {
        snake.ctrader_accounts = appUser.cTraderAccounts.map((acc: any) => ({
            cTraderId: acc.cTraderId,
            accessToken: acc.accessToken,
            refreshToken: acc.refreshToken,
            accountType: acc.accountType,
            broker: acc.broker,
            balance: acc.balance,
            currency: acc.currency,
            leverage: acc.leverage,
            connectedAt: acc.connectedAt
        }));
    }
    if (appUser.lastLogin !== undefined) snake.last_login = appUser.lastLogin;
    return snake;
};

// --- POSITION ---
export const mapPositionToCamel = (dbPos: any): any => {
    if (!dbPos) return null;
    return {
        _id: dbPos.id,
        id: dbPos.id,
        userId: dbPos.user_id,
        accountId: dbPos.account_id,
        accountType: dbPos.account_type,
        symbol: dbPos.symbol,
        side: dbPos.side,
        volume: Number(dbPos.volume),
        entryPrice: Number(dbPos.entry_price),
        closePrice: dbPos.close_price ? Number(dbPos.close_price) : null,
        takeProfit: dbPos.take_profit ? Number(dbPos.take_profit) : null,
        stopLoss: dbPos.stop_loss ? Number(dbPos.stop_loss) : null,
        trailingStopDistance: dbPos.trailing_stop_distance ? Number(dbPos.trailing_stop_distance) : 0,
        trailingStopActivated: dbPos.trailing_stop_activated || false,
        orderType: dbPos.order_type || 'MARKET',
        status: dbPos.status || 'OPEN',
        unrealizedPnl: Number(dbPos.unrealized_pnl || 0),
        finalProfit: dbPos.final_profit ? Number(dbPos.final_profit) : null,
        swap: Number(dbPos.swap || 0),
        commission: Number(dbPos.commission || 0),
        advancedRules: dbPos.advanced_rules || [],
        openTime: dbPos.open_time ? new Date(dbPos.open_time) : new Date(),
        closeTime: dbPos.close_time ? new Date(dbPos.close_time) : null,
        createdAt: dbPos.created_at ? new Date(dbPos.created_at) : new Date(),
        updatedAt: dbPos.updated_at ? new Date(dbPos.updated_at) : new Date()
    };
};

export const mapPositionToSnake = (appPos: any): any => {
    if (!appPos) return null;
    const snake: any = {};
    if (appPos.id || appPos._id) snake.id = appPos.id || appPos._id;
    if (appPos.userId !== undefined) snake.user_id = appPos.userId;
    if (appPos.accountId !== undefined) snake.account_id = appPos.accountId;
    if (appPos.accountType !== undefined) snake.account_type = appPos.accountType;
    if (appPos.symbol !== undefined) snake.symbol = appPos.symbol;
    if (appPos.side !== undefined) snake.side = appPos.side;
    if (appPos.volume !== undefined) snake.volume = appPos.volume;
    if (appPos.entryPrice !== undefined) snake.entry_price = appPos.entryPrice;
    if (appPos.closePrice !== undefined) snake.close_price = appPos.closePrice;
    if (appPos.takeProfit !== undefined) snake.take_profit = appPos.takeProfit;
    if (appPos.stopLoss !== undefined) snake.stop_loss = appPos.stopLoss;
    if (appPos.trailingStopDistance !== undefined) snake.trailing_stop_distance = appPos.trailingStopDistance;
    if (appPos.trailingStopActivated !== undefined) snake.trailing_stop_activated = appPos.trailingStopActivated;
    if (appPos.orderType !== undefined) snake.order_type = appPos.orderType;
    if (appPos.status !== undefined) snake.status = appPos.status;
    if (appPos.unrealizedPnl !== undefined) snake.unrealized_pnl = appPos.unrealizedPnl;
    if (appPos.finalProfit !== undefined) snake.final_profit = appPos.finalProfit;
    if (appPos.swap !== undefined) snake.swap = appPos.swap;
    if (appPos.commission !== undefined) snake.commission = appPos.commission;
    if (appPos.advancedRules !== undefined) snake.advanced_rules = appPos.advancedRules;
    if (appPos.openTime !== undefined) snake.open_time = appPos.openTime;
    if (appPos.closeTime !== undefined) snake.close_time = appPos.closeTime;
    return snake;
};

// --- CHAT MESSAGE ---
export const mapChatMessageToCamel = (dbMsg: any): any => {
    if (!dbMsg) return null;
    return {
        _id: dbMsg.id,
        id: dbMsg.id,
        room: dbMsg.room,
        userId: dbMsg.user_id,
        username: dbMsg.username,
        avatarUrl: dbMsg.avatar_url,
        text: dbMsg.text,
        mediaUrl: dbMsg.media_url,
        replyTo: dbMsg.reply_to,
        mentions: dbMsg.mentions || [],
        isPro: dbMsg.is_pro || false,
        likes: dbMsg.likes || [],
        createdAt: dbMsg.created_at ? new Date(dbMsg.created_at) : new Date()
    };
};

export const mapChatMessageToSnake = (appMsg: any): any => {
    if (!appMsg) return null;
    const snake: any = {};
    if (appMsg.id || appMsg._id) snake.id = appMsg.id || appMsg._id;
    if (appMsg.room !== undefined) snake.room = appMsg.room;
    if (appMsg.userId !== undefined) snake.user_id = appMsg.userId;
    if (appMsg.username !== undefined) snake.username = appMsg.username;
    if (appMsg.avatarUrl !== undefined) snake.avatar_url = appMsg.avatarUrl;
    if (appMsg.text !== undefined) snake.text = appMsg.text;
    if (appMsg.mediaUrl !== undefined) snake.media_url = appMsg.mediaUrl;
    if (appMsg.replyTo !== undefined) snake.reply_to = appMsg.replyTo;
    if (appMsg.mentions !== undefined) snake.mentions = appMsg.mentions;
    if (appMsg.isPro !== undefined) snake.is_pro = appMsg.isPro;
    if (appMsg.likes !== undefined) snake.likes = appMsg.likes;
    return snake;
};

// --- COMMUNITY ---
export const mapCommunityToCamel = (dbComm: any): any => {
    if (!dbComm) return null;
    return {
        _id: dbComm.id,
        id: dbComm.id,
        name: dbComm.name,
        slug: dbComm.slug,
        description: dbComm.description,
        iconColor: dbComm.icon_color,
        imageUrl: dbComm.image_url,
        category: dbComm.category,
        memberCount: dbComm.member_count || 0,
        members: dbComm.members || [],
        admins: dbComm.admins || [],
        moderators: dbComm.moderators || [],
        pinnedMessageId: dbComm.pinned_message_id,
        isActive: dbComm.is_active || false,
        createdBy: dbComm.created_by,
        createdAt: dbComm.created_at ? new Date(dbComm.created_at) : new Date(),
        updatedAt: dbComm.updated_at ? new Date(dbComm.updated_at) : new Date()
    };
};

export const mapCommunityToSnake = (appComm: any): any => {
    if (!appComm) return null;
    const snake: any = {};
    if (appComm.id || appComm._id) snake.id = appComm.id || appComm._id;
    if (appComm.name !== undefined) snake.name = appComm.name;
    if (appComm.slug !== undefined) snake.slug = appComm.slug;
    if (appComm.description !== undefined) snake.description = appComm.description;
    if (appComm.iconColor !== undefined) snake.icon_color = appComm.iconColor;
    if (appComm.imageUrl !== undefined) snake.image_url = appComm.imageUrl;
    if (appComm.category !== undefined) snake.category = appComm.category;
    if (appComm.memberCount !== undefined) snake.member_count = appComm.memberCount;
    if (appComm.members !== undefined) {
        snake.members = (appComm.members || []).map((m: any) => m && typeof m === 'object' ? (m.id || m._id || m) : m);
    }
    if (appComm.admins !== undefined) {
        snake.admins = (appComm.admins || []).map((a: any) => a && typeof a === 'object' ? (a.id || a._id || a) : a);
    }
    if (appComm.moderators !== undefined) {
        snake.moderators = (appComm.moderators || []).map((m: any) => m && typeof m === 'object' ? (m.id || m._id || m) : m);
    }
    if (appComm.pinnedMessageId !== undefined) snake.pinned_message_id = appComm.pinnedMessageId;
    if (appComm.isActive !== undefined) snake.is_active = appComm.isActive;
    if (appComm.createdBy !== undefined) snake.created_by = appComm.createdBy;
    return snake;
};

// --- BROKER ---
export const mapBrokerToCamel = (dbBroker: any): any => {
    if (!dbBroker) return null;
    return {
        _id: dbBroker.id,
        id: dbBroker.id,
        name: dbBroker.name,
        slug: dbBroker.slug,
        logoUrl: dbBroker.logo_url,
        regulation: dbBroker.regulation,
        rating: Number(dbBroker.rating || 0),
        ranking: dbBroker.ranking || 0,
        isPromoted: dbBroker.is_promoted || false,
        spreads: dbBroker.spreads,
        minDeposit: dbBroker.min_deposit,
        maxLeverage: dbBroker.max_leverage,
        platforms: dbBroker.platforms,
        baseCurrencies: dbBroker.base_currencies,
        features: dbBroker.features || [],
        hasCommunity: dbBroker.has_community || false,
        communityName: dbBroker.community_name,
        isActive: dbBroker.is_active || false,
        createdAt: dbBroker.created_at ? new Date(dbBroker.created_at) : new Date(),
        updatedAt: dbBroker.updated_at ? new Date(dbBroker.updated_at) : new Date()
    };
};

export const mapBrokerToSnake = (appBroker: any): any => {
    if (!appBroker) return null;
    const snake: any = {};
    if (appBroker.id || appBroker._id) snake.id = appBroker.id || appBroker._id;
    if (appBroker.name !== undefined) snake.name = appBroker.name;
    if (appBroker.slug !== undefined) snake.slug = appBroker.slug;
    if (appBroker.logoUrl !== undefined) snake.logo_url = appBroker.logoUrl;
    if (appBroker.regulation !== undefined) snake.regulation = appBroker.regulation;
    if (appBroker.rating !== undefined) snake.rating = appBroker.rating;
    if (appBroker.ranking !== undefined) snake.ranking = appBroker.ranking;
    if (appBroker.isPromoted !== undefined) snake.is_promoted = appBroker.isPromoted;
    if (appBroker.spreads !== undefined) snake.spreads = appBroker.spreads;
    if (appBroker.minDeposit !== undefined) snake.min_deposit = appBroker.minDeposit;
    if (appBroker.maxLeverage !== undefined) snake.max_leverage = appBroker.maxLeverage;
    if (appBroker.platforms !== undefined) snake.platforms = appBroker.platforms;
    if (appBroker.baseCurrencies !== undefined) snake.base_currencies = appBroker.baseCurrencies;
    if (appBroker.features !== undefined) snake.features = appBroker.features;
    if (appBroker.hasCommunity !== undefined) snake.has_community = appBroker.hasCommunity;
    if (appBroker.communityName !== undefined) snake.community_name = appBroker.communityName;
    if (appBroker.isActive !== undefined) snake.is_active = appBroker.isActive;
    return snake;
};

// --- BROKER REVIEW ---
export const mapBrokerReviewToCamel = (dbReview: any): any => {
    if (!dbReview) return null;
    return {
        _id: dbReview.id,
        id: dbReview.id,
        brokerId: dbReview.broker_id,
        userId: dbReview.user_id,
        rating: dbReview.rating,
        text: dbReview.text,
        isApproved: dbReview.is_approved || false,
        createdAt: dbReview.created_at ? new Date(dbReview.created_at) : new Date(),
        updatedAt: dbReview.updated_at ? new Date(dbReview.updated_at) : new Date()
    };
};

export const mapBrokerReviewToSnake = (appReview: any): any => {
    if (!appReview) return null;
    const snake: any = {};
    if (appReview.id || appReview._id) snake.id = appReview.id || appReview._id;
    if (appReview.brokerId !== undefined) snake.broker_id = appReview.brokerId;
    if (appReview.userId !== undefined) snake.user_id = appReview.userId;
    if (appReview.rating !== undefined) snake.rating = appReview.rating;
    if (appReview.text !== undefined) snake.text = appReview.text;
    if (appReview.isApproved !== undefined) snake.is_approved = appReview.isApproved;
    return snake;
};

// --- CAMPAIGN ---
export const mapCampaignToCamel = (dbCamp: any): any => {
    if (!dbCamp) return null;
    return {
        _id: dbCamp.id,
        id: dbCamp.id,
        title: dbCamp.title,
        description: dbCamp.description,
        rewardLottieKey: dbCamp.reward_lottie_key,
        accentColor: dbCamp.accent_color,
        tasks: dbCamp.tasks || [],
        maxParticipants: dbCamp.max_participants || 0,
        currentParticipants: dbCamp.current_participants || 0,
        isActive: dbCamp.is_active || false,
        startDate: dbCamp.start_date ? new Date(dbCamp.start_date) : null,
        endDate: dbCamp.end_date ? new Date(dbCamp.end_date) : null,
        createdAt: dbCamp.created_at ? new Date(dbCamp.created_at) : new Date(),
        updatedAt: dbCamp.updated_at ? new Date(dbCamp.updated_at) : new Date()
    };
};

export const mapCampaignToSnake = (appCamp: any): any => {
    if (!appCamp) return null;
    const snake: any = {};
    if (appCamp.id || appCamp._id) snake.id = appCamp.id || appCamp._id;
    if (appCamp.title !== undefined) snake.title = appCamp.title;
    if (appCamp.description !== undefined) snake.description = appCamp.description;
    if (appCamp.rewardLottieKey !== undefined) snake.reward_lottie_key = appCamp.rewardLottieKey;
    if (appCamp.accentColor !== undefined) snake.accent_color = appCamp.accentColor;
    if (appCamp.tasks !== undefined) snake.tasks = appCamp.tasks;
    if (appCamp.maxParticipants !== undefined) snake.max_participants = appCamp.maxParticipants;
    if (appCamp.currentParticipants !== undefined) snake.current_participants = appCamp.currentParticipants;
    if (appCamp.isActive !== undefined) snake.is_active = appCamp.isActive;
    if (appCamp.startDate !== undefined) snake.start_date = appCamp.startDate;
    if (appCamp.endDate !== undefined) snake.end_date = appCamp.endDate;
    return snake;
};

// --- CAMPAIGN PROGRESS ---
export const mapCampaignProgressToCamel = (dbProg: any): any => {
    if (!dbProg) return null;
    return {
        _id: dbProg.id,
        id: dbProg.id,
        userId: dbProg.user_id,
        campaignId: dbProg.campaign_id,
        completedTasks: dbProg.completed_tasks || [],
        joinedAt: dbProg.joined_at ? new Date(dbProg.joined_at) : new Date(),
        claimedReward: dbProg.claimed_reward || false,
        claimedAt: dbProg.claimed_at ? new Date(dbProg.claimed_at) : null,
        createdAt: dbProg.created_at ? new Date(dbProg.created_at) : new Date(),
        updatedAt: dbProg.updated_at ? new Date(dbProg.updated_at) : new Date()
    };
};

export const mapCampaignProgressToSnake = (appProg: any): any => {
    if (!appProg) return null;
    const snake: any = {};
    if (appProg.id || appProg._id) snake.id = appProg.id || appProg._id;
    if (appProg.userId !== undefined) snake.user_id = appProg.userId;
    if (appProg.campaignId !== undefined) snake.campaign_id = appProg.campaignId;
    if (appProg.completedTasks !== undefined) snake.completed_tasks = appProg.completedTasks;
    if (appProg.joinedAt !== undefined) snake.joined_at = appProg.joinedAt;
    if (appProg.claimedReward !== undefined) snake.claimed_reward = appProg.claimedReward;
    if (appProg.claimedAt !== undefined) snake.claimed_at = appProg.claimedAt;
    return snake;
};

// --- PROMOTED SYMBOL ---
export const mapPromotedSymbolToCamel = (dbSym: any): any => {
    if (!dbSym) return null;
    return {
        _id: dbSym.id,
        id: dbSym.id,
        symbol: dbSym.symbol,
        name: dbSym.name,
        description: dbSym.description,
        logoColor: dbSym.logo_color,
        logoBadge: dbSym.logo_badge,
        imageUrl: dbSym.image_url,
        price: Number(dbSym.price || 0),
        high: dbSym.high ? Number(dbSym.high) : null,
        low: dbSym.low ? Number(dbSym.low) : null,
        changePct: dbSym.change_pct,
        showMetrics: dbSym.show_metrics || false,
        brokerUrl: dbSym.broker_url,
        isPinned: dbSym.is_pinned || false,
        isActive: dbSym.is_active || false,
        createdAt: dbSym.created_at ? new Date(dbSym.created_at) : new Date(),
        updatedAt: dbSym.updated_at ? new Date(dbSym.updated_at) : new Date()
    };
};

export const mapPromotedSymbolToSnake = (appSym: any): any => {
    if (!appSym) return null;
    const snake: any = {};
    if (appSym.id || appSym._id) snake.id = appSym.id || appSym._id;
    if (appSym.symbol !== undefined) snake.symbol = appSym.symbol;
    if (appSym.name !== undefined) snake.name = appSym.name;
    if (appSym.description !== undefined) snake.description = appSym.description;
    if (appSym.logoColor !== undefined) snake.logo_color = appSym.logoColor;
    if (appSym.logoBadge !== undefined) snake.logo_badge = appSym.logoBadge;
    if (appSym.imageUrl !== undefined) snake.image_url = appSym.imageUrl;
    if (appSym.price !== undefined) snake.price = appSym.price;
    if (appSym.high !== undefined) snake.high = appSym.high;
    if (appSym.low !== undefined) snake.low = appSym.low;
    if (appSym.changePct !== undefined) snake.change_pct = appSym.changePct;
    if (appSym.showMetrics !== undefined) snake.show_metrics = appSym.showMetrics;
    if (appSym.brokerUrl !== undefined) snake.broker_url = appSym.brokerUrl;
    if (appSym.isPinned !== undefined) snake.is_pinned = appSym.isPinned;
    if (appSym.isActive !== undefined) snake.is_active = appSym.isActive;
    return snake;
};

// --- TRADE HISTORY ---
export const mapTradeHistoryToCamel = (dbHist: any): any => {
    if (!dbHist) return null;
    return {
        _id: dbHist.id,
        id: dbHist.id,
        userId: dbHist.user_id,
        positionId: dbHist.position_id,
        action: dbHist.action,
        details: dbHist.details,
        priceAtAction: Number(dbHist.price_at_action),
        timestamp: dbHist.timestamp ? new Date(dbHist.timestamp) : new Date()
    };
};

export const mapTradeHistoryToSnake = (appHist: any): any => {
    if (!appHist) return null;
    const snake: any = {};
    if (appHist.id || appHist._id) snake.id = appHist.id || appHist._id;
    if (appHist.userId !== undefined) snake.user_id = appHist.userId;
    if (appHist.positionId !== undefined) snake.position_id = appHist.positionId;
    if (appHist.action !== undefined) snake.action = appHist.action;
    if (appHist.details !== undefined) snake.details = appHist.details;
    if (appHist.priceAtAction !== undefined) snake.price_at_action = appHist.priceAtAction;
    if (appHist.timestamp !== undefined) snake.timestamp = appHist.timestamp;
    return snake;
};

export function createQueryChain<T>(promise: Promise<T>): any {
    return Object.assign(promise, {
        sort: function(...args: any[]) { return this; },
        limit: function(...args: any[]) { return this; },
        populate: function(...args: any[]) { return this; },
        select: function(...args: any[]) { return this; },
        lean: function(...args: any[]) { return this; },
        exec: function(...args: any[]) { return this; }
    });
}


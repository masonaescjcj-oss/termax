-- ==========================================
-- SUPABASE POSTGRESQL SCHEMA MIGRATION
-- ==========================================
-- Instructions: Copy and paste this script into the Supabase SQL Editor and click RUN.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
-- Using Supabase's auth.users as the primary identity, but keeping a public profile table.
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(30) UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]+$'),
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    active_nft TEXT,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    telegram_id VARCHAR(50) UNIQUE,
    referral_code VARCHAR(50) UNIQUE,
    referred_by UUID REFERENCES public.users(id),
    referral_count INTEGER DEFAULT 0,
    watchlist TEXT[] DEFAULT ARRAY['BTC/USDT', 'ETH/USDT', 'GOLD'],
    settings JSONB DEFAULT '{"notifications": true, "language": "en", "theme": "dark"}'::jsonb,
    ctrader_accounts JSONB DEFAULT '[]'::jsonb,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. POSITIONS TABLE
CREATE TABLE public.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id VARCHAR(100) NOT NULL,
    account_type VARCHAR(10) CHECK (account_type IN ('LIVE', 'DEMO')),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) CHECK (side IN ('BUY', 'SELL')),
    volume NUMERIC NOT NULL,
    entry_price NUMERIC NOT NULL,
    close_price NUMERIC,
    take_profit NUMERIC,
    stop_loss NUMERIC,
    trailing_stop_distance NUMERIC,
    trailing_stop_activated BOOLEAN DEFAULT FALSE,
    order_type VARCHAR(20) DEFAULT 'MARKET' CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP')),
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PENDING', 'CANCELLED')),
    unrealized_pnl NUMERIC DEFAULT 0,
    final_profit NUMERIC,
    swap NUMERIC DEFAULT 0,
    commission NUMERIC DEFAULT 0,
    advanced_rules JSONB DEFAULT '[]'::jsonb,
    open_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    close_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. BROKERS TABLE
CREATE TABLE public.brokers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    regulation VARCHAR(255) NOT NULL,
    rating NUMERIC DEFAULT 0,
    ranking INTEGER DEFAULT 0,
    is_promoted BOOLEAN DEFAULT FALSE,
    spreads VARCHAR(255) NOT NULL,
    min_deposit VARCHAR(100) NOT NULL,
    max_leverage VARCHAR(50) NOT NULL,
    platforms VARCHAR(255) NOT NULL,
    base_currencies VARCHAR(255) NOT NULL,
    features TEXT[] DEFAULT '{}',
    has_community BOOLEAN DEFAULT FALSE,
    community_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. BROKER REVIEWS TABLE
CREATE TABLE public.broker_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    text VARCHAR(1000) NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CAMPAIGNS TABLE
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    reward_lottie_key VARCHAR(255) NOT NULL,
    accent_color VARCHAR(20) DEFAULT '#3B82F6',
    tasks JSONB DEFAULT '[]'::jsonb,
    max_participants INTEGER DEFAULT 0,
    current_participants INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CAMPAIGN PROGRESS TABLE
CREATE TABLE public.campaign_progresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    completed_tasks TEXT[] DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    claimed_reward BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, campaign_id)
);

-- 7. CANDLES TABLE (Timeseries equivalent in Postgres)
CREATE TABLE public.candles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    interval VARCHAR(10) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    open NUMERIC NOT NULL,
    high NUMERIC NOT NULL,
    low NUMERIC NOT NULL,
    close NUMERIC NOT NULL,
    volume NUMERIC NOT NULL
);
-- Create index for faster querying like MongoDB timeseries
CREATE INDEX idx_candles_symbol_interval_time ON public.candles(symbol, interval, timestamp DESC);

-- 8. CHAT MESSAGES TABLE
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    text VARCHAR(2000),
    media_url TEXT,
    reply_to UUID REFERENCES public.chat_messages(id),
    mentions UUID[] DEFAULT '{}',
    is_pro BOOLEAN DEFAULT FALSE,
    likes UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_chat_messages_room ON public.chat_messages(room);

-- 9. COMMUNITIES TABLE
CREATE TABLE public.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    icon_color VARCHAR(20) DEFAULT '#A855F7',
    image_url TEXT,
    category VARCHAR(50) DEFAULT 'General',
    member_count INTEGER DEFAULT 0,
    members UUID[] DEFAULT '{}',
    admins UUID[] DEFAULT '{}',
    moderators UUID[] DEFAULT '{}',
    pinned_message_id UUID REFERENCES public.chat_messages(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_communities_category ON public.communities(category);

-- 10. PROMOTED SYMBOLS TABLE
CREATE TABLE public.promoted_symbols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    logo_color VARCHAR(20) DEFAULT '#A855F7',
    logo_badge VARCHAR(10) DEFAULT '⭐',
    image_url TEXT,
    price NUMERIC DEFAULT 0,
    high NUMERIC,
    low NUMERIC,
    change_pct VARCHAR(20),
    show_metrics BOOLEAN DEFAULT FALSE,
    broker_url TEXT DEFAULT '',
    is_pinned BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. TRADE HISTORY TABLE
CREATE TABLE public.trade_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('OPEN', 'CLOSE', 'MODIFY', 'SL_HIT', 'TP_HIT', 'PARTIAL_CLOSE', 'TS_UPDATE')),
    details TEXT NOT NULL,
    price_at_action NUMERIC NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_trade_histories_user ON public.trade_histories(user_id);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
-- Enable RLS on core tables to ensure users only see their own data
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_progresses ENABLE ROW LEVEL SECURITY;

-- Users policy: A user can read/update their own profile
CREATE POLICY "Users can read own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (true);
-- Note: Everyone needs to be able to see basic profiles for chat, but we can refine this later.
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);

-- Positions policy: A user can read/insert/update their own positions
CREATE POLICY "Users can read own positions" ON public.positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own positions" ON public.positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own positions" ON public.positions FOR UPDATE USING (auth.uid() = user_id);

-- Trade Histories policy
CREATE POLICY "Users can read own trade history" ON public.trade_histories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trade history" ON public.trade_histories FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Campaign Progresses policy
CREATE POLICY "Users can read own campaign progress" ON public.campaign_progresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaign progress" ON public.campaign_progresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaign progress" ON public.campaign_progresses FOR UPDATE USING (auth.uid() = user_id);

-- Other tables (Brokers, Campaigns, PromotedSymbols, Communities) are generally public read-only for regular users
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brokers are public read" ON public.brokers FOR SELECT USING (true);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaigns are public read" ON public.campaigns FOR SELECT USING (true);

ALTER TABLE public.promoted_symbols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Promoted symbols are public read" ON public.promoted_symbols FOR SELECT USING (true);

-- Social Media: Communities security policies
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Communities are public read" ON public.communities FOR SELECT USING (true);
CREATE POLICY "Users can create communities" ON public.communities FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update own communities" ON public.communities FOR UPDATE USING (auth.uid() = created_by);

-- Social Media: Chat Messages security policies
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat messages are public read" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Users can insert own chat messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update/delete own chat messages" ON public.chat_messages FOR ALL USING (auth.uid() = user_id);


-- ==========================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_positions_modtime BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_brokers_modtime BEFORE UPDATE ON public.brokers FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_broker_reviews_modtime BEFORE UPDATE ON public.broker_reviews FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_campaigns_modtime BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_campaign_progresses_modtime BEFORE UPDATE ON public.campaign_progresses FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_communities_modtime BEFORE UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_promoted_symbols_modtime BEFORE UPDATE ON public.promoted_symbols FOR EACH ROW EXECUTE FUNCTION update_modified_column();

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';
import { mapBrokerToCamel, mapBrokerToSnake, mapBrokerReviewToCamel } from '../utils/mapper';

/**
 * GET /api/v1/brokers
 * Get all active brokers
 */
export const getBrokers = async (req: Request, res: Response) => {
    try {
        const { data: brokers, error } = await supabase
            .from('brokers')
            .select('*')
            .eq('is_active', true)
            .order('rating', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch brokers', error: error.message });
        }

        res.status(200).json({ success: true, data: (brokers || []).map(mapBrokerToCamel) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: 'Failed to fetch brokers', error: error.message });
    }
};

/**
 * GET /api/v1/brokers/:id
 * Get single broker details
 */
export const getBrokerById = async (req: Request, res: Response) => {
    try {
        const { data: broker, error } = await supabase
            .from('brokers')
            .select('*')
            .eq('id', req.params.id)
            .eq('is_active', true)
            .maybeSingle();

        if (error || !broker) {
            return res.status(404).json({ success: false, message: 'Broker not found' });
        }

        res.status(200).json({ success: true, data: mapBrokerToCamel(broker) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: 'Failed to fetch broker', error: error.message });
    }
};

/**
 * POST /api/v1/brokers/:id/reviews
 * Submit a review for a broker (requires auth)
 */
export const addReview = async (req: AuthRequest, res: Response) => {
    try {
        const { rating, text } = req.body;
        const brokerId = req.params.id;

        if (!rating || !text) {
            return res.status(400).json({ success: false, message: 'Rating and text are required' });
        }

        const { data: broker } = await supabase
            .from('brokers')
            .select('id')
            .eq('id', brokerId)
            .maybeSingle();

        if (!broker) {
            return res.status(404).json({ success: false, message: 'Broker not found' });
        }

        // Check if user already reviewed
        const { data: existingReview } = await supabase
            .from('broker_reviews')
            .select('id')
            .eq('broker_id', brokerId)
            .eq('user_id', req.user!.id)
            .maybeSingle();

        if (existingReview) {
            return res.status(409).json({ success: false, message: 'You have already reviewed this broker' });
        }

        const { data: review, error } = await supabase
            .from('broker_reviews')
            .insert({
                broker_id: brokerId,
                user_id: req.user!.id,
                rating: Number(rating),
                text,
                is_approved: false // Requires admin approval
            })
            .select()
            .single();

        if (error || !review) {
            return res.status(500).json({ success: false, message: 'Failed to submit review', error: error?.message });
        }

        res.status(201).json({
            success: true,
            message: 'Review submitted and pending approval',
            data: mapBrokerReviewToCamel(review)
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: 'Failed to submit review', error: error.message });
    }
};

/**
 * GET /api/v1/brokers/:id/reviews
 * Get approved reviews for a broker
 */
export const getBrokerReviews = async (req: Request, res: Response) => {
    try {
        const { data: reviews, error } = await supabase
            .from('broker_reviews')
            .select('*, users (username, avatar_url)')
            .eq('broker_id', req.params.id)
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch reviews', error: error.message });
        }

        const mappedReviews = (reviews || []).map(r => {
            const camelReview = mapBrokerReviewToCamel(r);
            return {
                ...camelReview,
                userId: {
                    _id: r.users?.id || r.user_id,
                    id: r.users?.id || r.user_id,
                    username: r.users?.username || 'user',
                    avatarUrl: r.users?.avatar_url || null
                }
            };
        });

        res.status(200).json({ success: true, data: mappedReviews });
    } catch (error: any) {
        res.status(500).json({ success: false, message: 'Failed to fetch reviews', error: error.message });
    }
};

/**
 * SEED THE BROKER DIRECTORY
 * POST /api/v1/brokers/init  (admin only)
 *
 * This used to be an unauthenticated route that opened with
 * `.delete().neq('id', ...)` — a single unauthenticated request wiped every
 * broker in the database, including everything an admin had added by hand,
 * and took the reviews attached to them with it. It is now admin-only and
 * additive: a broker whose slug is already present is left exactly as it is,
 * so seeding can never destroy curated data.
 */
export const initMockBrokers = async (req: Request, res: Response) => {
    try {
        const mockBrokers = [
            { name: 'Alpari', slug: 'alpari', rating: 4.8, spreads: 'From 0.0 pips', regulation: 'FSA, FSC', features: ['PAMM Accounts', 'Crypto Deposits', 'High Leverage'], min_deposit: '$1', max_leverage: '1:1000', base_currencies: 'USD, EUR, GLD', platforms: 'MT4, MT5', has_community: true, community_name: 'Alpari Farsi' },
            { name: 'Amarkets', slug: 'amarkets', rating: 4.7, spreads: 'From 0.0 pips', regulation: 'FSA', features: ['Daily Analysis', 'Fast Withdrawal', 'Copy Trading'], min_deposit: '$100', max_leverage: '1:1000', base_currencies: 'USD, EUR', platforms: 'MT4, MT5, App', has_community: true, community_name: 'AMarkets Iran' },
            { name: 'LiteFinance', slug: 'litefinance', rating: 4.6, spreads: 'From 0.0 pips', regulation: 'CySEC, RAFMM', features: ['Social Trading', 'Islamic Accounts', 'Cent Accounts'], min_deposit: '$50', max_leverage: '1:500', base_currencies: 'USD, EUR, MBT', platforms: 'MT4, MT5, cTrader', has_community: true, community_name: 'LiteFinance Persian' },
            { name: 'RoboForex', slug: 'roboforex', rating: 4.8, spreads: 'From 0.0 pips', regulation: 'FSC', features: ['CopyFX', 'Bonus Programs', 'R StocksTrader'], min_deposit: '$10', max_leverage: '1:2000', base_currencies: 'USD, EUR, GOLD', platforms: 'MT4, MT5, cTrader, R WebTrader', has_community: false },
            { name: 'Windsor Brokers', slug: 'windsor-brokers', rating: 4.4, spreads: 'From 0.5 pips', regulation: 'CySEC, FSC, JSC', features: ['VIP Accounts', 'Loyalty Program', 'Free VPS'], min_deposit: '$50', max_leverage: '1:1000', base_currencies: 'USD, EUR', platforms: 'MT4', has_community: true, community_name: 'Windsor Iran' },
            { name: 'OpoFinance', slug: 'opofinance', rating: 4.5, spreads: 'From 0.0 pips', regulation: 'FSA', features: ['Social Trading', 'Crypto Funding', 'Local Bank Transfer'], min_deposit: '$100', max_leverage: '1:500', base_currencies: 'USD, EUR', platforms: 'MT4, MT5, cTrader', has_community: false },
            { name: 'Aron Groups', slug: 'aron-groups', rating: 4.3, spreads: 'From 1.0 pips', regulation: 'FSA', features: ['Toman Base Currency', 'Iranian Stocks', 'Crypto'], min_deposit: '$50', max_leverage: '1:500', base_currencies: 'USD, EUR, TOMAN', platforms: 'MT5', has_community: true, community_name: 'Aron Groups VIP' },
            { name: 'IFC Markets', slug: 'ifc-markets', rating: 4.2, spreads: 'From 0.4 pips', regulation: 'BVI FSC', features: ['Portfolio Quoting', 'Fixed Spreads', 'Crypto'], min_deposit: '$1', max_leverage: '1:400', base_currencies: 'USD, EUR, JPY', platforms: 'MT4, MT5, NetTradeX', has_community: false },
            { name: 'FIBO Group', slug: 'fibo-group', rating: 4.4, spreads: 'From 0.0 pips', regulation: 'CySEC, FSC', features: ['PAMM', 'cTrader', 'Cent Accounts'], min_deposit: '$50', max_leverage: '1:1000', base_currencies: 'USD, EUR, GLD', platforms: 'MT4, MT5, cTrader', has_community: false },
            { name: 'Moneta Markets', slug: 'moneta-markets', rating: 4.6, spreads: 'From 0.0 pips', regulation: 'FSCA, SVG', features: ['Raw Spreads', 'WebTV', 'DupliTrade'], min_deposit: '$50', max_leverage: '1:500', base_currencies: 'USD, EUR, GBP', platforms: 'MT4, MT5, PROTrader', has_community: false },
            { name: 'DeltaFX', slug: 'deltafx', rating: 4.1, spreads: 'From 1.0 pips', regulation: 'Unregulated/Offshore', features: ['Iranian Support', 'Bonus', 'Crypto'], min_deposit: '$50', max_leverage: '1:1000', base_currencies: 'USD, EUR', platforms: 'MT4', has_community: false },
            { name: 'Ingot Brokers', slug: 'ingot-brokers', rating: 4.5, spreads: 'From 0.0 pips', regulation: 'ASIC, JSC, SVGFSA', features: ['Mena Region Focus', 'Zero Commission', 'Crypto'], min_deposit: '$100', max_leverage: '1:500', base_currencies: 'USD, EUR', platforms: 'MT4, MT5', has_community: false },
            { name: 'Errante', slug: 'errante', rating: 4.6, spreads: 'From 0.0 pips', regulation: 'CySEC, FSA', features: ['Tailor-made Accounts', 'Fast Execution', 'CopyTrade'], min_deposit: '$50', max_leverage: '1:500', base_currencies: 'USD, EUR', platforms: 'MT4, MT5, cTrader', has_community: false },
            { name: 'Grand Capital', slug: 'grand-capital', rating: 4.2, spreads: 'From 0.4 pips', regulation: 'FinaCom', features: ['Binary Options', 'Bonus 40%', 'Micro Accounts'], min_deposit: '$10', max_leverage: '1:500', base_currencies: 'USD, EUR', platforms: 'MT4, MT5, WebTrader', has_community: false },
            { name: 'NordFX', slug: 'nordfx', rating: 4.3, spreads: 'From 0.0 pips', regulation: 'VFSC', features: ['Crypto Trading', 'Managed Accounts', 'Savings'], min_deposit: '$10', max_leverage: '1:1000', base_currencies: 'USD', platforms: 'MT4', has_community: false },
            { name: 'HYCM', slug: 'hycm', rating: 4.5, spreads: 'From 0.1 pips', regulation: 'FCA, CySEC, CIMA', features: ['40 Years History', 'VIP Accounts', 'No Deposit Fees'], min_deposit: '$100', max_leverage: '1:500', base_currencies: 'USD, EUR, GBP', platforms: 'MT4, MT5', has_community: false },
            { name: 'CapitalXM', slug: 'capitalxm', rating: 4.0, spreads: 'From 1.2 pips', regulation: 'Offshore', features: ['Bonus 100%', 'Iranian Support'], min_deposit: '$50', max_leverage: '1:400', base_currencies: 'USD', platforms: 'MT4', has_community: false },
            { name: 'IronFX', slug: 'ironfx', rating: 4.3, spreads: 'From 0.0 pips', regulation: 'FCA, CySEC, ASIC', features: ['AutoTrade', 'Portfolio Management', 'Bonus'], min_deposit: '$100', max_leverage: '1:1000', base_currencies: 'USD, EUR, GBP', platforms: 'MT4, WebTrader', has_community: false },
            { name: 'JustMarkets', slug: 'justmarkets', rating: 4.7, spreads: 'From 0.0 pips', regulation: 'FSA, CySEC', features: ['Raw Spread', '120% Bonus', 'Crypto'], min_deposit: '$1', max_leverage: '1:3000', base_currencies: 'USD, EUR', platforms: 'MT4, MT5', has_community: false },
            { name: 'Hantec Markets', slug: 'hantec-markets', rating: 4.5, spreads: 'From 0.2 pips', regulation: 'FCA, ASIC, FSC', features: ['Copy Trading', 'Bullion', 'No Requotes'], min_deposit: '$10', max_leverage: '1:500', base_currencies: 'USD, EUR, GBP', platforms: 'MT4, MT5', has_community: false },
            { name: 'FXTM', slug: 'fxtm', rating: 4.6, spreads: 'From 0.0 pips', regulation: 'FCA, CySEC, FSC', features: ['FXTM Invest', 'Cent Accounts', 'Free Education'], min_deposit: '$10', max_leverage: '1:2000', base_currencies: 'USD, EUR, GBP', platforms: 'MT4, MT5, FXTM Trader', has_community: true, community_name: 'FXTM Global' },
            { name: 'HFM (HotForex)', slug: 'hfm', rating: 4.7, spreads: 'From 0.0 pips', regulation: 'FCA, CySEC, DFSA', features: ['HFcopy', 'Return on Margin', 'Zero Spread'], min_deposit: '$5', max_leverage: '1:1000', base_currencies: 'USD, EUR', platforms: 'MT4, MT5, HFM App', has_community: true, community_name: 'HFM Trading Room' },
            { name: 'M4Markets', slug: 'm4markets', rating: 4.4, spreads: 'From 0.0 pips', regulation: 'FSA', features: ['Low Latency', 'No Deposit Fees', '50% Bonus'], min_deposit: '$5', max_leverage: '1:1000', base_currencies: 'USD, EUR, GBP', platforms: 'MT4, MT5', has_community: false },
            { name: 'AximTrade', slug: 'aximtrade', rating: 4.2, spreads: 'From 0.0 pips', regulation: 'FSA', features: ['Infinite Leverage', 'Cent Accounts', 'Copy Trade'], min_deposit: '$1', max_leverage: 'Infinite', base_currencies: 'USD, EUR', platforms: 'MT4', has_community: false },
            { name: 'USGFX', slug: 'usgfx', rating: 4.1, spreads: 'From 1.0 pips', regulation: 'VFSC', features: ['Trading Central', 'Social Trading', 'VIP Account'], min_deposit: '$100', max_leverage: '1:500', base_currencies: 'USD, EUR', platforms: 'MT4, MT5', has_community: false },
            { name: 'Tradeview', slug: 'tradeview', rating: 4.5, spreads: 'From 0.0 pips', regulation: 'CIMA', features: ['Innovative Liquidity', 'cTrader', 'Currenex'], min_deposit: '$100', max_leverage: '1:400', base_currencies: 'USD, EUR, GBP', platforms: 'MT4, MT5, cTrader, Currenex', has_community: false },
            { name: 'Vantage', slug: 'vantage', rating: 4.8, spreads: 'From 0.0 pips', regulation: 'FCA, ASIC, VFSC', features: ['ProTrader Tools', 'Social Trading', 'SmartTrader'], min_deposit: '$50', max_leverage: '1:500', base_currencies: 'USD, EUR, GBP', platforms: 'MT4, MT5, Vantage App, ProTrader', has_community: true, community_name: 'Vantage Trading Hub', is_promoted: true },
            { name: 'Eightcap', slug: 'eightcap', rating: 4.7, spreads: 'From 0.0 pips', regulation: 'ASIC, SCB', features: ['TradingView', 'Capitalise.ai', 'Crypto Focus'], min_deposit: '$100', max_leverage: '1:500', base_currencies: 'USD, EUR, GBP', platforms: 'MT4, MT5, TradingView', has_community: false },
            { name: 'Dukascopy', slug: 'dukascopy', rating: 4.6, spreads: 'From 0.1 pips', regulation: 'FINMA, FSA', features: ['Swiss Bank', 'JForex Platform', 'API Trading'], min_deposit: '$1000', max_leverage: '1:200', base_currencies: 'USD, EUR, CHF, GBP', platforms: 'JForex, MT4', has_community: false },
            { name: 'AvaTrade', slug: 'avatrade', rating: 4.7, spreads: 'From 0.9 pips', regulation: 'CBI, ASIC, FSA', features: ['AvaProtect', 'AvaSocial', 'Options Trading'], min_deposit: '$100', max_leverage: '1:400', base_currencies: 'USD, EUR, GBP', platforms: 'MT4, MT5, WebTrader, AvaTradeGO', has_community: true, community_name: 'Ava Social Network' }
        ];

        // Add only what is missing. Editing a seeded broker in the admin
        // panel must survive the next call to this route.
        const { data: existing, error: readErr } = await supabase
            .from('brokers')
            .select('slug');

        if (readErr) {
            return res.status(500).json({ success: false, message: 'Failed to read brokers', error: readErr.message });
        }

        const known = new Set((existing || []).map((b: any) => b.slug));
        const toInsert = mockBrokers.filter(b => !known.has(b.slug));

        if (!toInsert.length) {
            return res.status(200).json({ success: true, message: 'Broker directory already seeded.', added: 0 });
        }

        const { error } = await supabase
            .from('brokers')
            .insert(toInsert);

        if (error) {
            return res.status(500).json({ success: false, message: 'Failed to init brokers', error: error.message });
        }

        res.status(201).json({
            success: true,
            message: `Seeded ${toInsert.length} broker(s); ${known.size} already present were left untouched.`,
            added: toInsert.length,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: 'Failed to init brokers', error: error.message });
    }
};

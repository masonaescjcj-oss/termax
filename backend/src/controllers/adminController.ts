import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import {
    mapUserToCamel,
    mapBrokerToCamel,
    mapBrokerToSnake,
    mapCommunityToCamel,
    mapCommunityToSnake,
    mapPromotedSymbolToCamel,
    mapPromotedSymbolToSnake,
    mapBrokerReviewToCamel
} from '../utils/mapper';
import { loadAIConfig, saveAIConfig, AIConfig } from '../utils/aiConfigManager';

// ═══════════════════════════════════════════════════════════
// UPLOAD IMAGE (Base64)
// ═══════════════════════════════════════════════════════════
export const uploadImage = async (req: AuthRequest, res: Response) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ success: false, message: 'No image data provided' });

        // Format: data:image/jpeg;base64,.....
        const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ success: false, message: 'Invalid base64 string' });
        }

        const type = matches[1];
        const data = Buffer.from(matches[2], 'base64');
        const extension = type.split('/')[1] || 'jpg';
        const fileName = `${crypto.randomBytes(16).toString('hex')}.${extension}`;
        
        const uploadsDir = path.join(__dirname, '../../public/uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, data);

        // Store relative path, frontend should prepend BACKEND_URL
        const fileUrl = `/uploads/${fileName}`;

        res.status(200).json({ success: true, url: fileUrl });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════════════════════════
export const getStats = async (req: AuthRequest, res: Response) => {
    try {
        const [
            { count: totalUsers },
            { count: totalBrokers },
            { count: totalPositions },
            { count: pendingReviews },
            { count: totalCommunities },
            { count: totalPromoted }
        ] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('brokers').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('positions').select('*', { count: 'exact', head: true }).eq('status', 'OPEN'),
            supabase.from('broker_reviews').select('*', { count: 'exact', head: true }).eq('is_approved', false),
            supabase.from('communities').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('promoted_symbols').select('*', { count: 'exact', head: true }).eq('is_active', true)
        ]);

        res.json({
            success: true,
            data: {
                totalUsers: totalUsers || 0,
                totalBrokers: totalBrokers || 0,
                totalPositions: totalPositions || 0,
                pendingReviews: pendingReviews || 0,
                totalCommunities: totalCommunities || 0,
                totalPromoted: totalPromoted || 0
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════════════════════════
export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, email, role, avatar_url, created_at')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({ success: true, data: (users || []).map(mapUserToCamel) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateUserRole = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, role } = req.body;
        if (!userId || !['user', 'admin', 'moderator'].includes(role)) {
            return res.status(400).json({ success: false, message: 'userId and valid role required.' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .update({ role })
            .eq('id', userId)
            .select('id, username, email, role')
            .single();

        if (error || !user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({
            success: true,
            message: `${user.username} is now ${role}.`,
            data: mapUserToCamel(user)
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  BROKER MANAGEMENT
// ═══════════════════════════════════════════════════════════
export const listBrokers = async (req: AuthRequest, res: Response) => {
    try {
        const { data: brokers, error } = await supabase
            .from('brokers')
            .select('*')
            .order('ranking', { ascending: false })
            .order('rating', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({ success: true, data: (brokers || []).map(mapBrokerToCamel) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addBroker = async (req: AuthRequest, res: Response) => {
    try {
        const { name, regulation, spreads, minDeposit, maxLeverage, platforms, baseCurrencies, features, logoUrl, ranking, isPromoted } = req.body;
        if (!name || !regulation) return res.status(400).json({ success: false, message: 'Name and regulation required.' });

        const slug = name.toLowerCase().replace(/\s+/g, '-');
        const brokerSnake = mapBrokerToSnake({
            name, slug, regulation,
            logoUrl: logoUrl || '',
            ranking: ranking || 0,
            isPromoted: isPromoted || false,
            spreads: spreads || 'N/A',
            minDeposit: minDeposit || '$0',
            maxLeverage: maxLeverage || '1:100',
            platforms: platforms || 'MT4, MT5',
            baseCurrencies: baseCurrencies || 'USD',
            features: features || [],
            isActive: true
        });

        const { data: broker, error } = await supabase
            .from('brokers')
            .insert(brokerSnake)
            .select()
            .single();

        if (error || !broker) {
            return res.status(500).json({ success: false, message: error?.message || 'Failed to add broker.' });
        }

        res.status(201).json({ success: true, message: `Broker ${name} added.`, data: mapBrokerToCamel(broker) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editBroker = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updates = mapBrokerToSnake(req.body);
        console.log('editBroker req.body:', req.body);
        console.log('editBroker updates:', updates);

        const { data: brokers, error } = await supabase
            .from('brokers')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error('editBroker database error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
        if (!brokers || brokers.length === 0) return res.status(404).json({ success: false, message: 'Broker not found' });
        const broker = brokers[0];
        res.status(200).json({ success: true, message: `Broker updated.`, data: mapBrokerToCamel(broker) });
    } catch (error: any) {
        console.error('editBroker uncaught error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteBroker = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data: broker, error } = await supabase
            .from('brokers')
            .update({ is_active: false })
            .eq('id', id)
            .select()
            .single();

        if (error || !broker) return res.status(404).json({ success: false, message: 'Broker not found.' });
        res.json({ success: true, message: `Broker ${broker.name} deactivated.` });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  COMMUNITY MANAGEMENT
// ═══════════════════════════════════════════════════════════
export const createCommunity = async (req: AuthRequest, res: Response) => {
    try {
        const { name, description, iconColor, imageUrl, category } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name required.' });

        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const communitySnake = mapCommunityToSnake({
            name, slug,
            description: description || '',
            iconColor: iconColor || '#A855F7',
            imageUrl: imageUrl || '',
            category: category || 'General',
            admins: [req.user!.id],
            members: [req.user!.id],
            memberCount: 1,
            createdBy: req.user!.id,
            isActive: true
        });

        const { data: community, error } = await supabase
            .from('communities')
            .insert(communitySnake)
            .select()
            .single();

        if (error || !community) {
            return res.status(500).json({ success: false, message: error?.message || 'Failed to create community.' });
        }

        res.status(201).json({ success: true, message: `Community "${name}" created.`, data: mapCommunityToCamel(community) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteCommunity = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data: community, error } = await supabase
            .from('communities')
            .update({ is_active: false })
            .eq('id', id)
            .select()
            .single();

        if (error || !community) return res.status(404).json({ success: false, message: 'Community not found.' });
        res.json({ success: true, message: `Community "${community.name}" deactivated.` });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const listCommunities = async (req: AuthRequest, res: Response) => {
    try {
        const { data: communities, error } = await supabase
            .from('communities')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({ success: true, data: (communities || []).map(mapCommunityToCamel) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addCommunityModerator = async (req: AuthRequest, res: Response) => {
    try {
        const { communityId, userId } = req.body;
        const { data: community, error: fetchErr } = await supabase
            .from('communities')
            .select('moderators')
            .eq('id', communityId)
            .single();

        if (fetchErr || !community) return res.status(404).json({ success: false, message: 'Community not found.' });

        const moderators = community.moderators || [];
        if (!moderators.includes(userId)) {
            moderators.push(userId);
            await supabase
                .from('communities')
                .update({ moderators })
                .eq('id', communityId);
        }
        res.json({ success: true, message: 'Moderator added.' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editCommunity = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updates = mapCommunityToSnake(req.body);

        const { data: community, error } = await supabase
            .from('communities')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error || !community) return res.status(404).json({ success: false, message: 'Community not found.' });
        res.json({ success: true, message: 'Community updated.', data: mapCommunityToCamel(community) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const assignCommunityAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { targetUserIdentifier, role } = req.body; // targetUserIdentifier can be username or email

        if (!targetUserIdentifier) return res.status(400).json({ success: false, message: 'Username or email required.' });

        const { data: community, error: comErr } = await supabase
            .from('communities')
            .select('*')
            .eq('id', id)
            .single();

        if (comErr || !community) return res.status(404).json({ success: false, message: 'Community not found.' });

        // Find user by username or email
        const { data: targetUser } = await supabase
            .from('users')
            .select('id, username')
            .or(`username.eq.${targetUserIdentifier.toLowerCase()},email.eq.${targetUserIdentifier.toLowerCase()}`)
            .maybeSingle();

        if (!targetUser) return res.status(404).json({ success: false, message: 'User not found in system.' });

        const userIdStr = targetUser.id;
        const members = community.members || [];
        let memberCount = community.member_count || 0;

        // Ensure user is in members array
        if (!members.includes(userIdStr)) {
            members.push(userIdStr);
            memberCount += 1;
        }

        // Filter arrays to reset
        let admins = (community.admins || []).filter((adminId: string) => adminId !== userIdStr);
        let moderators = (community.moderators || []).filter((modId: string) => modId !== userIdStr);

        if (role === 'admin') {
            admins.push(userIdStr);
        } else if (role === 'moderator') {
            moderators.push(userIdStr);
        }

        const { error: updateErr } = await supabase
            .from('communities')
            .update({
                members,
                member_count: memberCount,
                admins,
                moderators
            })
            .eq('id', id);

        if (updateErr) {
            return res.status(500).json({ success: false, message: 'Failed to update community roles.' });
        }

        res.json({ success: true, message: `${targetUser.username} is now a ${role || 'member'}.` });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  PROMOTED SYMBOLS MANAGEMENT
// ═══════════════════════════════════════════════════════════
export const createPromotedSymbol = async (req: AuthRequest, res: Response) => {
    try {
        const { symbol, name, description, logoColor, logoBadge, imageUrl, price, high, low, changePct, showMetrics, brokerUrl, isPinned } = req.body;
        if (!symbol || !name) return res.status(400).json({ success: false, message: 'Symbol and name required.' });

        const promotedSnake = mapPromotedSymbolToSnake({
            symbol: symbol.toUpperCase(),
            name, description: description || '',
            logoColor: logoColor || '#A855F7',
            logoBadge: logoBadge || '⭐',
            imageUrl: imageUrl || '',
            price: price || 0,
            high: high || 0,
            low: low || 0,
            changePct: changePct || '0.00%',
            showMetrics: showMetrics || false,
            brokerUrl: brokerUrl || '',
            isPinned: isPinned || false,
            isActive: true
        });

        const { data: promoted, error } = await supabase
            .from('promoted_symbols')
            .insert(promotedSnake)
            .select()
            .single();

        if (error || !promoted) {
            return res.status(500).json({ success: false, message: error?.message || 'Failed to create promoted symbol.' });
        }

        res.status(201).json({ success: true, message: `Symbol ${symbol} promoted.`, data: mapPromotedSymbolToCamel(promoted) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editPromotedSymbol = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updates = mapPromotedSymbolToSnake(req.body);

        const { data: symbol, error } = await supabase
            .from('promoted_symbols')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error || !symbol) return res.status(404).json({ success: false, message: 'Symbol not found' });
        res.status(200).json({ success: true, message: `Symbol updated.`, data: mapPromotedSymbolToCamel(symbol) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deletePromotedSymbol = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('promoted_symbols')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(404).json({ success: false, message: 'Symbol not found' });
        }

        res.json({ success: true, message: 'Promoted symbol removed.' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const listPromotedSymbols = async (req: AuthRequest, res: Response) => {
    try {
        const { data: symbols, error } = await supabase
            .from('promoted_symbols')
            .select('*')
            .eq('is_active', true)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({ success: true, data: (symbols || []).map(mapPromotedSymbolToCamel) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const togglePinSymbol = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data: sym, error: fetchErr } = await supabase
            .from('promoted_symbols')
            .select('is_pinned')
            .eq('id', id)
            .single();

        if (fetchErr || !sym) return res.status(404).json({ success: false, message: 'Symbol not found.' });

        const { data: updated, error } = await supabase
            .from('promoted_symbols')
            .update({ is_pinned: !sym.is_pinned })
            .eq('id', id)
            .select()
            .single();

        if (error || !updated) {
            return res.status(500).json({ success: false, message: 'Failed to toggle pin.' });
        }

        res.json({ success: true, message: `Symbol ${updated.is_pinned ? 'pinned' : 'unpinned'}.`, data: mapPromotedSymbolToCamel(updated) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  REVIEW MANAGEMENT
// ═══════════════════════════════════════════════════════════
export const getPendingReviews = async (req: AuthRequest, res: Response) => {
    try {
        const { data: reviews, error } = await supabase
            .from('broker_reviews')
            .select('*, users (username), brokers (name)')
            .eq('is_approved', false)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        const mappedReviews = (reviews || []).map(r => {
            const camelReview = mapBrokerReviewToCamel(r);
            return {
                ...camelReview,
                userId: {
                    _id: r.users?.id || r.user_id,
                    id: r.users?.id || r.user_id,
                    username: r.users?.username || 'user'
                },
                brokerId: {
                    _id: r.brokers?.id || r.broker_id,
                    id: r.brokers?.id || r.broker_id,
                    name: r.brokers?.name || 'broker'
                }
            };
        });

        res.json({ success: true, data: mappedReviews });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const approveReview = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data: review, error } = await supabase
            .from('broker_reviews')
            .update({ is_approved: true })
            .eq('id', id)
            .select()
            .single();

        if (error || !review) return res.status(404).json({ success: false, message: 'Review not found.' });
        res.json({ success: true, message: 'Review approved.' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteReview = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('broker_reviews')
            .delete()
            .eq('id', id);

        if (error) return res.status(404).json({ success: false, message: 'Review not found.' });
        res.json({ success: true, message: 'Review deleted.' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getLottiesFilePath = () => {
    const dir = path.join(__dirname, '../../public/uploads/lotties');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const file = path.join(dir, 'list.json');
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, '[]', 'utf8');
    }
    return { dir, file };
};

export const listLotties = async (req: AuthRequest, res: Response) => {
    try {
        const { file } = getLottiesFilePath();
        const content = fs.readFileSync(file, 'utf8');
        const customLotties = JSON.parse(content);
        res.json({ success: true, lotties: customLotties });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const uploadLottie = async (req: AuthRequest, res: Response) => {
    try {
        const { name, key, lottieJson } = req.body;
        if (!name || !key || !lottieJson) {
            return res.status(400).json({ success: false, message: 'Missing name, key or lottieJson' });
        }

        const cleanKey = key.startsWith('nft_') ? key : `nft_${key}`;
        const { dir, file } = getLottiesFilePath();

        // Write the individual lottie file
        const fileName = `${cleanKey}.json`;
        const lottiePath = path.join(dir, fileName);
        fs.writeFileSync(lottiePath, typeof lottieJson === 'string' ? lottieJson : JSON.stringify(lottieJson), 'utf8');

        // Add to the list
        const content = fs.readFileSync(file, 'utf8');
        let customLotties = JSON.parse(content);

        // Remove if key already exists to prevent duplicate entries
        customLotties = customLotties.filter((l: any) => l.key !== cleanKey);

        const newLottie = {
            key: cleanKey,
            name,
            url: `/uploads/lotties/${fileName}`,
            createdAt: new Date().toISOString()
        };
        customLotties.push(newLottie);
        fs.writeFileSync(file, JSON.stringify(customLotties, null, 2), 'utf8');

        res.json({ success: true, lottie: newLottie, lotties: customLotties });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteLottie = async (req: AuthRequest, res: Response) => {
    try {
        const { key } = req.params;
        const { dir, file } = getLottiesFilePath();

        const content = fs.readFileSync(file, 'utf8');
        let customLotties = JSON.parse(content);

        const exists = customLotties.some((l: any) => l.key === key);
        if (!exists) {
            return res.status(404).json({ success: false, message: 'Lottie file not found' });
        }

        customLotties = customLotties.filter((l: any) => l.key !== key);
        fs.writeFileSync(file, JSON.stringify(customLotties, null, 2), 'utf8');

        const lottiePath = path.join(dir, `${key}.json`);
        if (fs.existsSync(lottiePath)) {
            fs.unlinkSync(lottiePath);
        }

        res.json({ success: true, message: 'Lottie deleted successfully', lotties: customLotties });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAIConfig = async (req: AuthRequest, res: Response) => {
    try {
        const config = await loadAIConfig();
        res.json({ success: true, config });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateAIConfig = async (req: AuthRequest, res: Response) => {
    try {
        const { activeProvider, apiKey, baseUrl, modelName, fallbackApiKey, fallbackBaseUrl, fallbackModelName } = req.body;
        
        if (!activeProvider || !apiKey || !baseUrl || !modelName) {
            return res.status(400).json({ success: false, message: 'Missing required configuration fields' });
        }
        
        const updatedConfig: AIConfig = {
            activeProvider,
            apiKey,
            baseUrl,
            modelName,
            fallbackApiKey: fallbackApiKey || '',
            fallbackBaseUrl: fallbackBaseUrl || 'https://api.openai.com/v1',
            fallbackModelName: fallbackModelName || 'gpt-4o'
        };
        
        await saveAIConfig(updatedConfig);
        res.json({ success: true, message: 'AI configuration updated successfully', config: updatedConfig });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

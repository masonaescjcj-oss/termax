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
import { loadAIConfig, saveAIConfig, AIConfig, configSource } from '../utils/aiConfigManager';
import { aiHealth } from '../services/aiHealth';
import { probeProvider } from '../services/ai/probe';
import { mapPositionToCamel } from '../utils/mapper';
import { recordAdminAction, readAuditLog } from '../services/adminAudit';
import { closeSimulatedAtMarket, invalidateScreenUser } from './tradeController';
import { unrealizedPnL } from '../services/pricing';

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
            .select('id, username, email, role, plan, avatar_url, created_at')
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

/** Flip a user's plan — the admin door until a payment gateway lands. */
export const updateUserPlan = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, plan } = req.body;
        if (!userId || !['FREE', 'PRO'].includes(plan)) {
            return res.status(400).json({ success: false, message: 'userId and plan (FREE | PRO) required.' });
        }
        const { data: user, error } = await supabase
            .from('users')
            .update({ plan })
            .eq('id', userId)
            .select('id, username, email, plan')
            .single();
        if (error || !user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        recordAdminAction(req, {
            action: 'user.plan', targetType: 'user', targetId: String(userId),
            summary: `Put ${user.username} on ${plan}`, detail: { plan },
        });
        res.json({ success: true, message: `${user.username} is now on ${plan}.`, data: user });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const updateUserRole = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, role } = req.body;
        if (!userId || !['user', 'admin', 'moderator'].includes(role)) {
            return res.status(400).json({ success: false, message: 'userId and valid role required.' });
        }

        // Demoting the last admin locks the panel for everyone, permanently
        // and from inside the panel itself — there is no route back in
        // without direct database access. Refuse it.
        if (role !== 'admin') {
            const { data: admins } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'admin');
            const remaining = (admins || []).filter((a: any) => a.id !== userId);
            if (!remaining.length) {
                return res.status(409).json({
                    success: false,
                    message: 'This is the only admin left. Promote someone else first.',
                });
            }
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

        recordAdminAction(req, {
            action: 'user.role', targetType: 'user', targetId: String(userId),
            summary: `Made ${user.username} ${role}`, detail: { role },
        });

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
        // Deleting a broker is a soft delete (is_active = false). Without
        // this filter the admin list kept showing brokers that had already
        // been removed from the public directory, so deleting one looked
        // like it had done nothing at all.
        const { data: brokers, error } = await supabase
            .from('brokers')
            .select('*')
            .eq('is_active', true)
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

        recordAdminAction(req, {
            action: 'broker.create', targetType: 'broker', targetId: String(broker.id),
            summary: `Added broker ${name}`,
        });
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
        recordAdminAction(req, {
            action: 'broker.update', targetType: 'broker', targetId: String(id),
            summary: `Edited broker ${broker.name}`, detail: { fields: Object.keys(updates) },
        });
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
        recordAdminAction(req, {
            action: 'broker.delete', targetType: 'broker', targetId: String(id),
            summary: `Deactivated broker ${broker.name}`,
        });
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

        recordAdminAction(req, {
            action: 'community.create', targetType: 'community', targetId: String(community.id),
            summary: `Created community "${name}"`,
        });
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
        recordAdminAction(req, {
            action: 'community.delete', targetType: 'community', targetId: String(id),
            summary: `Deactivated community "${community.name}"`,
        });
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
        recordAdminAction(req, {
            action: 'community.update', targetType: 'community', targetId: String(id),
            summary: `Edited community "${community.name}"`,
        });
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

        // Find user by username or email.
        //
        // This was interpolated straight into a PostgREST `.or()` filter,
        // where a comma or parenthesis in the identifier is syntax: an
        // identifier like `x,role.eq.admin` added a condition of the
        // caller's choosing to the query. It also lower-cased the input
        // before an exact match, so any user whose username carries a
        // capital could never be found. Two case-insensitive equality
        // matches, with the value passed as a value, do the same job with
        // neither problem.
        const identifier = String(targetUserIdentifier).trim();
        if (!identifier || identifier.length > 254) {
            return res.status(400).json({ success: false, message: 'Username or email required.' });
        }

        const byUsername = await supabase
            .from('users')
            .select('id, username')
            .ilike('username', identifier)
            .maybeSingle();

        const targetUser = byUsername.data ?? (await supabase
            .from('users')
            .select('id, username')
            .ilike('email', identifier)
            .maybeSingle()).data;

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

        recordAdminAction(req, {
            action: 'community.role', targetType: 'community', targetId: String(id),
            summary: `Made ${targetUser.username} a ${role || 'member'} of "${community.name}"`,
            detail: { userId: userIdStr, role: role || 'member' },
        });
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

        recordAdminAction(req, {
            action: 'symbol.create', targetType: 'symbol', targetId: String(promoted.id),
            summary: `Promoted ${symbol}`,
        });
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
        recordAdminAction(req, {
            action: 'symbol.update', targetType: 'symbol', targetId: String(id),
            summary: `Edited promoted symbol ${symbol.symbol}`,
        });
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

        recordAdminAction(req, {
            action: 'symbol.delete', targetType: 'symbol', targetId: String(id),
            summary: 'Removed a promoted symbol',
        });
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
        recordAdminAction(req, {
            action: 'review.approve', targetType: 'review', targetId: String(id),
            summary: 'Approved a broker review',
        });
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
        recordAdminAction(req, {
            action: 'review.delete', targetType: 'review', targetId: String(id),
            summary: 'Deleted a broker review',
        });
        res.json({ success: true, message: 'Review deleted.' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * A lottie key becomes a filename, so it must not be able to be a path.
 * `key` arrives from the request; without this, `nft_../../../x` wrote and
 * deleted `.json` files anywhere the process could reach.
 */
const safeLottieKey = (raw: unknown): string | null => {
    const key = String(raw ?? '').trim();
    if (!key || key.length > 64) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(key)) return null;
    return key;
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

        const safeKey = safeLottieKey(key);
        if (!safeKey) {
            return res.status(400).json({ success: false, message: 'Key may contain only letters, numbers, dash and underscore.' });
        }
        const cleanKey = safeKey.startsWith('nft_') ? safeKey : `nft_${safeKey}`;
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
        const key = safeLottieKey(req.params.key);
        if (!key) {
            return res.status(400).json({ success: false, message: 'Invalid lottie key.' });
        }
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

/**
 * The AI provider settings, without the keys.
 *
 * A key that is sent to the client can be read from the client, and this
 * response used to carry the live provider key in plaintext on every visit
 * to the AI tab. The panel does not need to read a key to replace one, so
 * it is told whether a key is set and nothing more.
 */
export const getAIConfig = async (req: AuthRequest, res: Response) => {
    try {
        const config = await loadAIConfig();
        res.json({
            success: true,
            config: {
                activeProvider: config.activeProvider,
                baseUrl: config.baseUrl,
                modelName: config.modelName,
                fallbackBaseUrl: config.fallbackBaseUrl,
                fallbackModelName: config.fallbackModelName,
                apiKey: '',
                fallbackApiKey: '',
                hasApiKey: Boolean(config.apiKey),
                hasFallbackApiKey: Boolean(config.fallbackApiKey),
            },
            // Where the running config actually comes from. 'environment'
            // means nothing has been saved and the app is on its build-time
            // key; 'legacy-file' means it is on a file that the next deploy
            // will delete.
            source: configSource(),
            health: aiHealth(),
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Try a configuration against the provider without storing it.
 *
 * Pasting a key, saving, and learning from a user's complaint that it was
 * wrong is the loop this closes. A blank key here means "test the one
 * already stored", so an admin can also ask "is the current key alive?".
 */
export const testAIConfig = async (req: AuthRequest, res: Response) => {
    try {
        const { apiKey, baseUrl, modelName, target } = req.body || {};
        const current = await loadAIConfig();

        const useFallback = target === 'fallback';
        const candidate = {
            apiKey: (typeof apiKey === 'string' && apiKey.trim())
                ? apiKey.trim()
                : (useFallback ? current.fallbackApiKey || '' : current.apiKey),
            baseUrl: String(baseUrl || (useFallback ? current.fallbackBaseUrl : current.baseUrl) || ''),
            modelName: String(modelName || (useFallback ? current.fallbackModelName : current.modelName) || ''),
        };

        const result = await probeProvider(candidate);

        recordAdminAction(req, {
            action: 'ai.test', targetType: 'config', targetId: 'ai',
            summary: `Tested the ${useFallback ? 'fallback' : 'primary'} AI provider — ${result.ok ? 'answered' : 'failed'}`,
            // Never the key, only what happened.
            detail: { target: useFallback ? 'fallback' : 'primary', ok: result.ok, latencyMs: result.latencyMs, model: candidate.modelName },
        });

        res.json({ success: true, result });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateAIConfig = async (req: AuthRequest, res: Response) => {
    try {
        const { activeProvider, apiKey, baseUrl, modelName, fallbackApiKey, fallbackBaseUrl, fallbackModelName } = req.body;

        // The panel is never sent the current keys, so a blank key here means
        // "leave the one you have" — not "erase it". Requiring a key on every
        // save would have forced the admin to retype it to change a model
        // name, which is how keys end up pasted into places they shouldn't be.
        const current = await loadAIConfig();
        const nextKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : current.apiKey;
        const nextFallbackKey = typeof fallbackApiKey === 'string' && fallbackApiKey.trim()
            ? fallbackApiKey.trim()
            : current.fallbackApiKey;

        if (!activeProvider || !baseUrl || !modelName) {
            return res.status(400).json({ success: false, message: 'Provider, base URL and model name are required.' });
        }
        if (!nextKey) {
            return res.status(400).json({ success: false, message: 'An API key is required — none is stored yet.' });
        }

        const updatedConfig: AIConfig = {
            activeProvider,
            apiKey: nextKey,
            baseUrl,
            modelName,
            fallbackApiKey: nextFallbackKey || '',
            fallbackBaseUrl: fallbackBaseUrl || 'https://api.openai.com/v1',
            fallbackModelName: fallbackModelName || 'gpt-4o'
        };

        await saveAIConfig(updatedConfig, { id: req.user?.id, username: req.user?.username });
        recordAdminAction(req, {
            action: 'ai.config', targetType: 'config', targetId: 'ai',
            // Never the key itself, only that it moved.
            summary: `AI provider set to ${activeProvider} / ${modelName}`,
            detail: { activeProvider, baseUrl, modelName, keyReplaced: nextKey !== current.apiKey },
        });
        res.json({
            success: true,
            message: 'AI configuration updated successfully',
            config: {
                activeProvider: updatedConfig.activeProvider,
                baseUrl: updatedConfig.baseUrl,
                modelName: updatedConfig.modelName,
                fallbackBaseUrl: updatedConfig.fallbackBaseUrl,
                fallbackModelName: updatedConfig.fallbackModelName,
                apiKey: '',
                fallbackApiKey: '',
                hasApiKey: Boolean(updatedConfig.apiKey),
                hasFallbackApiKey: Boolean(updatedConfig.fallbackApiKey),
            },
            source: configSource(),
            health: aiHealth(),
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  USER DETAIL, SEARCH AND MODERATION
//
//  The old users endpoint returned the newest hundred rows and nothing
//  else: no search, no paging, and no way to look at one account. On an app
//  with more than a hundred users that is a list you cannot find anyone in.
// ═══════════════════════════════════════════════════════════

/** One page of users, filtered and searched. */
export const searchUsers = async (req: AuthRequest, res: Response) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const perPage = Math.min(Math.max(Number(req.query.perPage) || 25, 1), 100);
        const q = String(req.query.q || '').trim();
        const role = String(req.query.role || '').trim();
        const plan = String(req.query.plan || '').trim();

        let query = supabase
            .from('users')
            .select('id, username, email, role, plan, avatar_url, telegram_id, referral_count, settings, ctrader_accounts, last_login, created_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * perPage, page * perPage - 1);

        if (q) {
            // `or` takes a filter string, so anything the caller typed has to
            // be neutered first: a comma or a parenthesis in here is syntax.
            const safe = q.replace(/[,()*\\]/g, ' ').trim();
            if (safe) query = query.or(`username.ilike.%${safe}%,email.ilike.%${safe}%`);
        }
        if (['user', 'admin', 'moderator'].includes(role)) query = query.eq('role', role);
        if (['FREE', 'PRO'].includes(plan)) query = query.eq('plan', plan);

        const { data, count, error } = await query;
        if (error) return res.status(500).json({ success: false, message: error.message });

        const rows = (data || []).map((u: any) => {
            const accounts = u.ctrader_accounts || [];
            return {
                _id: u.id,
                id: u.id,
                username: u.username,
                email: u.email,
                role: u.role,
                plan: u.plan || 'FREE',
                avatarUrl: u.avatar_url,
                telegramId: u.telegram_id,
                referralCount: u.referral_count || 0,
                deactivated: u.settings?.deactivated === true,
                accounts: accounts.length,
                balance: accounts.reduce((s: number, a: any) => s + Number(a.balance || 0), 0),
                lastLogin: u.last_login,
                createdAt: u.created_at,
            };
        });

        res.json({ success: true, data: rows, total: count || 0, page, perPage });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/** Everything about one account, on one screen. */
export const getUserDetail = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) return res.status(500).json({ success: false, message: error.message });
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const [openRes, closedRes, botsRes] = await Promise.all([
            supabase.from('positions').select('*').eq('user_id', id).eq('status', 'OPEN'),
            supabase.from('positions').select('final_profit').eq('user_id', id).eq('status', 'CLOSED'),
            supabase.from('bots').select('id, name, status, account_id, created_at').eq('user_id', id),
        ]);

        const closed = (closedRes.data || []) as any[];
        const netProfit = closed.reduce((s, p) => s + Number(p.final_profit || 0), 0);
        const wins = closed.filter(p => Number(p.final_profit || 0) > 0).length;

        res.json({
            success: true,
            data: {
                profile: mapUserToCamel(user),
                deactivated: user.settings?.deactivated === true,
                accounts: (user.ctrader_accounts || []).map((a: any) => ({
                    cTraderId: a.cTraderId,
                    accountType: a.accountType,
                    broker: a.broker,
                    balance: Number(a.balance || 0),
                    currency: a.currency || 'USD',
                })),
                openPositions: (openRes.data || []).map(mapPositionToCamel),
                stats: {
                    closedTrades: closed.length,
                    wins,
                    winRate: closed.length ? Number(((wins / closed.length) * 100).toFixed(1)) : 0,
                    netProfit: Number(netProfit.toFixed(2)),
                },
                bots: (botsRes.data || []).map((b: any) => ({
                    id: b.id, name: b.name, status: b.status,
                    accountId: b.account_id, createdAt: b.created_at,
                })),
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Suspend or restore an account.
 *
 * Login already refuses a profile carrying `settings.deactivated`, so this
 * is the switch behind a door that was already there but had nothing to
 * open it.
 */
export const setUserActive = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, active } = req.body;
        if (!userId || typeof active !== 'boolean') {
            return res.status(400).json({ success: false, message: 'userId and active (boolean) required.' });
        }
        if (userId === req.user?.id && active === false) {
            return res.status(409).json({ success: false, message: 'You cannot suspend your own account.' });
        }

        const { data: user, error: readErr } = await supabase
            .from('users')
            .select('id, username, role, settings')
            .eq('id', userId)
            .maybeSingle();
        if (readErr || !user) return res.status(404).json({ success: false, message: 'User not found.' });

        const settings = { ...(user.settings || {}), deactivated: !active };
        const { error } = await supabase.from('users').update({ settings }).eq('id', userId);
        if (error) return res.status(500).json({ success: false, message: error.message });

        recordAdminAction(req, {
            action: active ? 'user.restore' : 'user.suspend',
            targetType: 'user', targetId: userId,
            summary: `${active ? 'Restored' : 'Suspended'} ${user.username}`,
        });

        res.json({ success: true, message: `${user.username} is ${active ? 'active' : 'suspended'}.` });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Set a simulated account's balance.
 *
 * Demo money only — a CTRADER account's balance is the broker's number and
 * writing over it here would only make our copy lie.
 */
export const setAccountBalance = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, accountId, balance } = req.body;
        const amount = Number(balance);
        if (!userId || !accountId || !Number.isFinite(amount) || amount < 0) {
            return res.status(400).json({ success: false, message: 'userId, accountId and a balance of 0 or more are required.' });
        }
        if (amount > 10_000_000) {
            return res.status(400).json({ success: false, message: 'That balance is not a plausible demo account.' });
        }

        const { data: user, error: readErr } = await supabase
            .from('users')
            .select('id, username, ctrader_accounts')
            .eq('id', userId)
            .maybeSingle();
        if (readErr || !user) return res.status(404).json({ success: false, message: 'User not found.' });

        const accounts = (user.ctrader_accounts || []) as any[];
        const target = accounts.find(a => a.cTraderId === accountId);
        if (!target) return res.status(404).json({ success: false, message: 'Account not found on that user.' });
        if (target.accountType !== 'DEMO') {
            return res.status(409).json({ success: false, message: 'Only a demo balance can be set here — a live balance belongs to the broker.' });
        }

        const before = Number(target.balance || 0);
        target.balance = amount;

        const { error } = await supabase.from('users').update({ ctrader_accounts: accounts }).eq('id', userId);
        if (error) return res.status(500).json({ success: false, message: error.message });

        // The margin screen caches user rows for a minute; this balance is
        // now stale in it, and a stale balance is what hides a stop-out.
        invalidateScreenUser(userId);

        recordAdminAction(req, {
            action: 'user.balance',
            targetType: 'user', targetId: userId,
            summary: `Set ${user.username}'s ${accountId} balance to $${amount.toFixed(2)} (was $${before.toFixed(2)})`,
            detail: { accountId, before, after: amount },
        });

        res.json({ success: true, message: `Balance set to $${amount.toFixed(2)}.` });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  POSITION OVERSIGHT
//
//  What the platform is actually carrying right now. The dashboard counted
//  open positions from the start but there was no way to look at them.
// ═══════════════════════════════════════════════════════════

export const listOpenPositions = async (req: AuthRequest, res: Response) => {
    try {
        const status = ['OPEN', 'PENDING', 'CLOSED'].includes(String(req.query.status))
            ? String(req.query.status)
            : 'OPEN';
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
        const symbol = String(req.query.symbol || '').trim().toUpperCase();

        let q = supabase
            .from('positions')
            .select('*, users (username)')
            .eq('status', status)
            .order('open_time', { ascending: false })
            .limit(limit);
        if (symbol) q = q.eq('symbol', symbol);

        const { data, error } = await q;
        if (error) return res.status(500).json({ success: false, message: error.message });

        const rows = (data || []).map((p: any) => ({
            ...mapPositionToCamel(p),
            username: p.users?.username || null,
            // What it is worth right now, from the same quote store the
            // engine values it with — so this page and a stop-out never
            // disagree about a position's P/L.
            unrealized: unrealizedPnL(mapPositionToCamel(p) as any) ?? null,
        }));

        res.json({ success: true, data: rows });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/** Force a simulated position closed at the current market. */
export const adminClosePosition = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data: pos, error } = await supabase
            .from('positions')
            .select('id, user_id, symbol, side, volume, status, venue')
            .eq('id', id)
            .maybeSingle();

        if (error) return res.status(500).json({ success: false, message: error.message });
        if (!pos) return res.status(404).json({ success: false, message: 'Position not found.' });
        if (pos.status !== 'OPEN') return res.status(409).json({ success: false, message: `Position is ${pos.status}.` });
        if (pos.venue === 'CTRADER') {
            return res.status(409).json({
                success: false,
                message: 'This position lives at the broker. Close it there — closing the mirror would leave the real one open.',
            });
        }

        const result = await closeSimulatedAtMarket(String(pos.user_id), String(pos.id), 'ADMIN_CLOSE');
        if (result.status !== 200) {
            return res.status(result.status).json(result.body);
        }

        recordAdminAction(req, {
            action: 'position.close',
            targetType: 'position', targetId: String(pos.id),
            summary: `Force-closed ${pos.side} ${pos.volume} ${pos.symbol}`,
            detail: { userId: pos.user_id, symbol: pos.symbol, side: pos.side, volume: pos.volume },
        });

        res.json({ success: true, message: 'Position closed.', data: result.body });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  REVIEWS — all of them, not only the pending ones
// ═══════════════════════════════════════════════════════════

export const listAllReviews = async (req: AuthRequest, res: Response) => {
    try {
        const scope = String(req.query.scope || 'pending');
        let q = supabase
            .from('broker_reviews')
            .select('*, users (id, username), brokers (id, name)')
            .order('created_at', { ascending: false })
            .limit(200);

        if (scope === 'pending') q = q.eq('is_approved', false);
        else if (scope === 'approved') q = q.eq('is_approved', true);

        const { data, error } = await q;
        if (error) return res.status(500).json({ success: false, message: error.message });

        res.json({
            success: true,
            data: (data || []).map((r: any) => ({
                ...mapBrokerReviewToCamel(r),
                userId: { id: r.users?.id || r.user_id, username: r.users?.username || 'user' },
                brokerId: { id: r.brokers?.id || r.broker_id, name: r.brokers?.name || 'broker' },
            })),
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  BROKERS — including the deactivated ones, so they can come back
// ═══════════════════════════════════════════════════════════

export const listAllBrokers = async (req: AuthRequest, res: Response) => {
    try {
        const includeInactive = String(req.query.includeInactive || '') === '1';
        let q = supabase
            .from('brokers')
            .select('*')
            .order('ranking', { ascending: false })
            .order('rating', { ascending: false });
        if (!includeInactive) q = q.eq('is_active', true);

        const { data, error } = await q;
        if (error) return res.status(500).json({ success: false, message: error.message });
        res.json({ success: true, data: (data || []).map(mapBrokerToCamel) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/** Undo a soft delete. */
export const restoreBroker = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data: broker, error } = await supabase
            .from('brokers')
            .update({ is_active: true })
            .eq('id', id)
            .select()
            .single();

        if (error || !broker) return res.status(404).json({ success: false, message: 'Broker not found.' });

        recordAdminAction(req, {
            action: 'broker.restore', targetType: 'broker', targetId: String(id),
            summary: `Restored broker ${broker.name}`,
        });

        res.json({ success: true, message: `Broker ${broker.name} restored.`, data: mapBrokerToCamel(broker) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
//  AUDIT LOG
// ═══════════════════════════════════════════════════════════

export const getAuditLog = async (req: AuthRequest, res: Response) => {
    try {
        const entries = await readAuditLog({
            limit: Number(req.query.limit) || 60,
            before: req.query.before ? String(req.query.before) : undefined,
            action: req.query.action ? String(req.query.action) : undefined,
        });
        res.json({ success: true, data: entries });
    } catch (error: any) {
        // A missing table is the normal answer before the migration is run,
        // and it must not look like the page is broken.
        res.status(200).json({ success: true, data: [], note: error.message });
    }
};

import { Router } from 'express';
import { verifyToken, optionalAuth } from '../middleware/auth';
import Community from '../models/Community';

const router = Router();

// GET /api/v1/communities — list all active communities (public)
router.get('/', optionalAuth, async (req: any, res) => {
    try {
        const communities = await Community.find({ isActive: true })
            .populate('admins', 'username avatarUrl')
            .sort({ memberCount: -1, createdAt: -1 })
            .lean();

        const data = communities.map(c => {
            const totalMembers = c.members?.length || c.memberCount || 1;
            const onlineCount = Math.min(totalMembers, Math.ceil(totalMembers * 0.25) + 2);
            return {
                id: c._id,
                name: c.name,
                slug: c.slug,
                description: c.description,
                imageUrl: c.imageUrl,
                iconColor: c.iconColor,
                category: c.category,
                memberCount: totalMembers,
                online: onlineCount,
                admins: c.admins,
                isMember: req.user ? (c.members || []).some((id: any) => id.toString() === req.user.id) : false
            };
        });

        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/v1/communities/:slug — get single community details
router.get('/:slug', optionalAuth, async (req: any, res) => {
    try {
        const community = await Community.findOne({ slug: req.params.slug, isActive: true })
            .populate('admins', 'username avatarUrl role')
            .populate('moderators', 'username avatarUrl role')
            .populate('members', 'username avatarUrl role')
            .lean();

        if (!community) return res.status(404).json({ success: false, message: 'Community not found' });

        const totalMembers = community.members?.length || community.memberCount || 1;
        const onlineCount = Math.min(totalMembers, Math.ceil(totalMembers * 0.25) + 2);

        res.json({
            success: true,
            data: {
                ...community,
                memberCount: totalMembers,
                online: onlineCount,
                isMember: req.user ? (community.members || []).some((m: any) => m._id?.toString() === req.user.id) : false,
                isAdmin: req.user ? (community.admins || []).some((a: any) => a._id?.toString() === req.user.id) : false
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;

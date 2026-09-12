import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PriceAlert } from '../models/PriceAlert';
import { Notification, PushToken } from '../models/Notification';
import { alertEngine } from '../services/alertEngine';
import { feedRouter } from '../services/feeds';

const MAX_ACTIVE_ALERTS = 100;

/* ── Price alerts ─────────────────────────────────────────────────────── */

export const listAlerts = async (req: AuthRequest, res: Response) => {
    try {
        res.status(200).json({ success: true, data: await PriceAlert.listByUser(req.user!.id) });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const createAlert = async (req: AuthRequest, res: Response) => {
    try {
        const symbol = String(req.body?.symbol ?? '').toUpperCase().trim();
        const price = Number(req.body?.price);
        const condition = req.body?.condition === 'below' ? 'below' : req.body?.condition === 'above' ? 'above' : null;
        const note = req.body?.note == null ? null : String(req.body.note).slice(0, 200);

        if (!symbol || symbol.length > 32) return res.status(400).json({ success: false, message: 'A symbol is required.' });
        if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ success: false, message: 'Price must be a positive number.' });
        if (!condition) return res.status(400).json({ success: false, message: "Condition must be 'above' or 'below'." });

        if ((await PriceAlert.countActive(req.user!.id)) >= MAX_ACTIVE_ALERTS) {
            return res.status(429).json({ success: false, message: `You can have at most ${MAX_ACTIVE_ALERTS} active alerts.` });
        }

        const row = await PriceAlert.create(req.user!.id, { symbol, price, condition, note });
        alertEngine.add(row);
        feedRouter.subscribe([symbol]).catch(() => undefined);
        res.status(201).json({ success: true, data: row });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const deleteAlert = async (req: AuthRequest, res: Response) => {
    try {
        const id = String(req.params.id);
        const mine = (await PriceAlert.listByUser(req.user!.id)).find(a => a.id === id);
        if (!mine) return res.status(404).json({ success: false, message: 'Alert not found.' });
        await PriceAlert.remove(id, req.user!.id);
        alertEngine.remove(mine);
        res.status(200).json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const rearmAlert = async (req: AuthRequest, res: Response) => {
    try {
        const row = await PriceAlert.rearm(String(req.params.id), req.user!.id);
        if (!row) return res.status(404).json({ success: false, message: 'Alert not found.' });
        alertEngine.add(row);
        res.status(200).json({ success: true, data: row });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const clearTriggeredAlerts = async (req: AuthRequest, res: Response) => {
    try {
        const removed = await PriceAlert.clearTriggered(req.user!.id);
        res.status(200).json({ success: true, data: { removed } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

/* ── Notifications ─────────────────────────────────────────────────────── */

export const listNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
        const [items, unread] = await Promise.all([
            Notification.list(req.user!.id, { limit, unreadOnly: req.query.unread === '1' }),
            Notification.unreadCount(req.user!.id),
        ]);
        res.status(200).json({ success: true, data: { items, unread } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const markNotificationsRead = async (req: AuthRequest, res: Response) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 200) : 'all';
        await Notification.markRead(req.user!.id, ids);
        res.status(200).json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const registerPushToken = async (req: AuthRequest, res: Response) => {
    try {
        const token = String(req.body?.token ?? '').trim();
        if (!token || token.length > 400) return res.status(400).json({ success: false, message: 'A push token is required.' });
        const platform = ['expo', 'web', 'fcm', 'apns'].includes(req.body?.platform) ? req.body.platform : 'expo';
        await PushToken.register(req.user!.id, token, platform);
        res.status(200).json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const removePushToken = async (req: AuthRequest, res: Response) => {
    try {
        const token = String(req.body?.token ?? '').trim();
        if (token) await PushToken.remove(req.user!.id, token);
        res.status(200).json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

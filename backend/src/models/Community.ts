import { supabase } from '../config/supabase';
import { mapCommunityToCamel, mapCommunityToSnake, createQueryChain } from '../utils/mapper';

export default class Community {
    [key: string]: any;

    constructor(data: any) {
        Object.assign(this, data);
        if (this.id && !this._id) this._id = this.id;
        if (this._id && !this.id) this.id = this._id;
    }

    async save() {
        const snake = mapCommunityToSnake(this);
        const isUpdate = !!snake.id;

        if (isUpdate) {
            const { data, error } = await supabase
                .from('communities')
                .update(snake)
                .eq('id', snake.id)
                .select()
                .single();
            if (error) throw new Error(error.message);
            Object.assign(this, mapCommunityToCamel(data));
        } else {
            const { data, error } = await supabase
                .from('communities')
                .insert(snake)
                .select()
                .single();
            if (error) throw new Error(error.message);
            Object.assign(this, mapCommunityToCamel(data));
        }
        if (this.id && !this._id) this._id = this.id;
        return this;
    }

    toJSON() {
        return { ...this };
    }

    toObject() {
        return { ...this };
    }

    static find(query: any = {}): any {
        const promise = (async () => {
            let q = supabase.from('communities').select('*');
            if (query.isActive !== undefined) q = q.eq('is_active', query.isActive);

            const { data, error } = await q.order('member_count', { ascending: false });
            if (error) throw new Error(error.message);

            const mapped = (data || []).map(d => mapCommunityToCamel(d));

            // Populate admins profiles
            const allAdminIds = Array.from(new Set(mapped.flatMap(c => c.admins || [])));
            if (allAdminIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('users')
                    .select('id, username, avatar_url')
                    .in('id', allAdminIds);
                
                const profileMap = new Map((profiles || []).map(p => [p.id, {
                    _id: p.id,
                    id: p.id,
                    username: p.username,
                    avatarUrl: p.avatar_url
                }]));

                mapped.forEach(c => {
                    c.admins = (c.admins || []).map(id => profileMap.get(id) || { _id: id, id, username: 'user' });
                });
            }

            return mapped.map(c => new Community(c));
        })();

        return createQueryChain(promise);
    }

    static findOne(query: any = {}): any {
        const promise = (async () => {
            let q = supabase.from('communities').select('*');
            if (query.slug) q = q.eq('slug', query.slug);
            if (query.name) q = q.eq('name', query.name);
            if (query.isActive !== undefined) q = q.eq('is_active', query.isActive);

            const { data, error } = await q.maybeSingle();
            if (error) throw new Error(error.message);
            if (!data) return null;

            const camel = mapCommunityToCamel(data);

            // Populate admins, moderators, members in batches
            const uniqueIds = Array.from(new Set([
                ...(camel.admins || []),
                ...(camel.moderators || []),
                ...(camel.members || [])
            ]));

            if (uniqueIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('users')
                    .select('id, username, avatar_url, role')
                    .in('id', uniqueIds);

                const profileMap = new Map((profiles || []).map(p => [p.id, {
                    _id: p.id,
                    id: p.id,
                    username: p.username,
                    avatarUrl: p.avatar_url,
                    role: p.role
                }]));

                camel.admins = (camel.admins || []).map(id => profileMap.get(id) || { _id: id, id, username: 'admin' });
                camel.moderators = (camel.moderators || []).map(id => profileMap.get(id) || { _id: id, id, username: 'moderator' });
                camel.members = (camel.members || []).map(id => profileMap.get(id) || { _id: id, id, username: 'member' });
            }

            return new Community(camel);
        })();

        return createQueryChain(promise);
    }

    static async findById(id: string) {
        return this.findOne({ id });
    }

    static async findByIdAndUpdate(id: string, update: any, options?: any) {
        const snakeUpdate = mapCommunityToSnake(update);
        const { data, error } = await supabase
            .from('communities')
            .update(snakeUpdate)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return new Community(mapCommunityToCamel(data));
    }

    static async countDocuments(query: any = {}) {
        let q = supabase.from('communities').select('*', { count: 'exact', head: true });
        if (query.isActive !== undefined) q = q.eq('is_active', query.isActive);

        const { count, error } = await q;
        if (error) throw new Error(error.message);
        return count || 0;
    }

    static async updateOne(query: any, update: any) {
        const id = query._id || query.id;
        if (!id) return;

        const { data: community } = await supabase.from('communities').select('*').eq('id', id).single();
        if (!community) return;

        let members = community.members || [];
        if (update.$pull && update.$pull.members) {
            members = members.filter((m: string) => m !== update.$pull.members);
        } else if (update.$push && update.$push.members) {
            members.push(update.$push.members);
        }

        const { error } = await supabase
            .from('communities')
            .update({ members, member_count: members.length })
            .eq('id', id);
        if (error) throw new Error(error.message);
    }
}

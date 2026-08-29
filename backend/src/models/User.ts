import { supabase } from '../config/supabase';
import { mapUserToCamel, mapUserToSnake, createQueryChain } from '../utils/mapper';

export default class User {
    [key: string]: any;

    constructor(data: any) {
        Object.assign(this, data);
        if (this.id && !this._id) this._id = this.id;
        if (this._id && !this.id) this.id = this._id;
    }

    markModified(field: string) {
        // Mock method for mongoose compatibility
    }

    async save() {
        const snake = mapUserToSnake(this);
        const isUpdate = !!snake.id;

        if (isUpdate) {
            const { data, error } = await supabase
                .from('users')
                .update(snake)
                .eq('id', snake.id)
                .select()
                .single();
            if (error) throw new Error(error.message);
            Object.assign(this, mapUserToCamel(data));
        } else {
            const { data, error } = await supabase
                .from('users')
                .insert(snake)
                .select()
                .single();
            if (error) throw new Error(error.message);
            Object.assign(this, mapUserToCamel(data));
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
            let q = supabase.from('users').select('*');
            if (query.username && query.username.$in) {
                q = q.in('username', query.username.$in);
            }
            // `_id: { $in: [...] }` was silently ignored, so a caller asking
            // for a handful of users by id was handed the entire table
            // instead — and never noticed, because the answer contained
            // what it was looking for.
            const idIn = query._id?.$in ?? query.id?.$in;
            if (idIn) {
                if (!idIn.length) return [];
                q = q.in('id', idIn.map((v: any) => String(v)));
            }
            const { data, error } = await q;
            if (error) throw new Error(error.message);
            return (data || []).map(d => new User(mapUserToCamel(d)));
        })();
        return createQueryChain(promise);
    }

    static findById(id: string): any {
        const promise = (async () => {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();
            if (error) return null;
            return new User(mapUserToCamel(data));
        })();
        return createQueryChain(promise);
    }

    static findOne(query: any = {}): any {
        const promise = (async () => {
            let q = supabase.from('users').select('*');
            
            if (query.telegramId) {
                q = q.eq('telegram_id', query.telegramId.toString());
            } else if (query.username) {
                q = q.eq('username', query.username.toLowerCase());
            } else if (query.email) {
                q = q.eq('email', query.email.toLowerCase());
            } else if (query.referralCode) {
                q = q.eq('referral_code', query.referralCode);
            } else if (query.$or) {
                const orQuery = query.$or.map((o: any) => {
                    const k = Object.keys(o)[0];
                    const dbK = k === 'username' ? 'username' : 'email';
                    return `${dbK}.eq.${o[k].toLowerCase()}`;
                }).join(',');
                q = q.or(orQuery);
            }

            const { data, error } = await q.maybeSingle();
            if (error) throw new Error(error.message);
            if (!data) return null;

            return new User(mapUserToCamel(data));
        })();
        return createQueryChain(promise);
    }

    static findByIdAndUpdate(id: string, update: any, options?: any): any {
        const promise = (async () => {
            const snakeUpdate = mapUserToSnake(update);
            const { data, error } = await supabase
                .from('users')
                .update(snakeUpdate)
                .eq('id', id)
                .select()
                .single();
            if (error) throw new Error(error.message);
            return new User(mapUserToCamel(data));
        })();
        return createQueryChain(promise);
    }

    static async countDocuments() {
        const { count, error } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
        if (error) throw new Error(error.message);
        return count || 0;
    }
}

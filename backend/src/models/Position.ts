import { supabase } from '../config/supabase';
import { mapPositionToCamel, mapPositionToSnake, createQueryChain } from '../utils/mapper';

export default class Position {
    [key: string]: any;

    constructor(data: any) {
        Object.assign(this, data);
        if (this.id && !this._id) this._id = this.id;
        if (this._id && !this.id) this.id = this._id;
    }

    async save() {
        const snake = mapPositionToSnake(this);
        const isUpdate = !!snake.id;

        if (isUpdate) {
            const { data, error } = await supabase
                .from('positions')
                .update(snake)
                .eq('id', snake.id)
                .select()
                .single();
            if (error) throw new Error(error.message);
            Object.assign(this, mapPositionToCamel(data));
        } else {
            const { data, error } = await supabase
                .from('positions')
                .insert(snake)
                .select()
                .single();
            if (error) throw new Error(error.message);
            Object.assign(this, mapPositionToCamel(data));
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
            let q = supabase.from('positions').select('*');
            if (query.userId) q = q.eq('user_id', query.userId);
            if (query.status) {
                if (query.status.$in) {
                    q = q.in('status', query.status.$in);
                } else {
                    q = q.eq('status', query.status);
                }
            }
            if (query.accountId) q = q.eq('account_id', query.accountId);
            if (query.symbol) q = q.eq('symbol', query.symbol);
            if (query.venue) q = q.eq('venue', query.venue);
            if (query.brokerPositionId) q = q.eq('broker_position_id', query.brokerPositionId);

            const { data, error } = await q;
            if (error) throw new Error(error.message);

            return (data || []).map(d => new Position(mapPositionToCamel(d)));
        })();
        return createQueryChain(promise);
    }

    static findOne(query: any = {}): any {
        const promise = (async () => {
            let q = supabase.from('positions').select('*');
            if (query._id) q = q.eq('id', query._id);
            if (query.id) q = q.eq('id', query.id);
            if (query.userId) q = q.eq('user_id', query.userId);
            if (query.status) q = q.eq('status', query.status);
            if (query.accountId) q = q.eq('account_id', query.accountId);
            // Needed to resolve a broker position back to its local mirror.
            // Without these two filters the query silently ignored them and
            // could return an unrelated row.
            if (query.brokerPositionId) q = q.eq('broker_position_id', query.brokerPositionId);
            if (query.venue) q = q.eq('venue', query.venue);

            const { data, error } = await q.maybeSingle();
            if (error) throw new Error(error.message);
            if (!data) return null;

            return new Position(mapPositionToCamel(data));
        })();
        return createQueryChain(promise);
    }

    static findById(id: string): any {
        return this.findOne({ id });
    }

    static findByIdAndUpdate(id: string, update: any, options?: any): any {
        const promise = (async () => {
            const snakeUpdate = mapPositionToSnake(update);
            const { data, error } = await supabase
                .from('positions')
                .update(snakeUpdate)
                .eq('id', id)
                .select()
                .single();
            if (error) throw new Error(error.message);
            return new Position(mapPositionToCamel(data));
        })();
        return createQueryChain(promise);
    }

    static async updateMany(query: any, update: any) {
        let q = supabase.from('positions').update(mapPositionToSnake(update));
        if (query.userId) q = q.eq('user_id', query.userId);
        if (query.accountId && query.accountId.$in) {
            q = q.in('account_id', query.accountId.$in);
        }

        const { data, error, count } = await q.select();
        if (error) throw new Error(error.message);
        return { modifiedCount: count || data?.length || 0 };
    }

    static async countDocuments(query: any = {}) {
        let q = supabase.from('positions').select('*', { count: 'exact', head: true });
        if (query.userId) q = q.eq('user_id', query.userId);
        if (query.status) q = q.eq('status', query.status);
        if (query.accountType) q = q.eq('account_type', query.accountType);

        const { count, error } = await q;
        if (error) throw new Error(error.message);
        return count || 0;
    }
}

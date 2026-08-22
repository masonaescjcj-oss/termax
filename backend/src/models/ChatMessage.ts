import { supabase } from '../config/supabase';
import { mapChatMessageToCamel, mapChatMessageToSnake, createQueryChain } from '../utils/mapper';

export default class ChatMessage {
    [key: string]: any;

    constructor(data: any) {
        Object.assign(this, data);
        if (this.id && !this._id) this._id = this.id;
        if (this._id && !this.id) this.id = this._id;
    }

    async save() {
        const snake = mapChatMessageToSnake(this);
        const isUpdate = !!snake.id;

        if (isUpdate) {
            const { data, error } = await supabase
                .from('chat_messages')
                .update(snake)
                .eq('id', snake.id)
                .select()
                .single();
            if (error) throw new Error(error.message);
            Object.assign(this, mapChatMessageToCamel(data));
        } else {
            const { data, error } = await supabase
                .from('chat_messages')
                .insert(snake)
                .select()
                .single();
            if (error) throw new Error(error.message);
            Object.assign(this, mapChatMessageToCamel(data));
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
            let q = supabase.from('chat_messages').select('*');
            if (query.room) q = q.eq('room', query.room);
            if (query.createdAt && query.createdAt.$lt) {
                q = q.lt('created_at', new Date(query.createdAt.$lt).toISOString());
            }

            const { data, error } = await q.order('created_at', { ascending: false });
            if (error) throw new Error(error.message);

            const mapped = (data || []).map(d => mapChatMessageToCamel(d));

            // Populate replyTo details if populate is chained
            const replyToIds = Array.from(new Set(mapped.map(m => m.replyTo).filter(Boolean)));
            if (replyToIds.length > 0) {
                const { data: replies } = await supabase
                    .from('chat_messages')
                    .select('id, username, text, media_url')
                    .in('id', replyToIds);
                
                const replyMap = new Map((replies || []).map(r => [r.id, {
                    _id: r.id,
                    id: r.id,
                    username: r.username,
                    text: r.text,
                    mediaUrl: r.media_url
                }]));

                mapped.forEach(m => {
                    if (m.replyTo) {
                        m.replyTo = replyMap.get(m.replyTo) || { id: m.replyTo, username: 'user', text: '' };
                    }
                });
            }

            return mapped;
        })();

        return createQueryChain(promise);
    }

    static findById(id: string): any {
        const promise = (async () => {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (error || !data) return null;

            const camel = mapChatMessageToCamel(data);

            if (camel.replyTo) {
                const { data: reply } = await supabase
                    .from('chat_messages')
                    .select('id, username, text, media_url')
                    .eq('id', camel.replyTo)
                    .maybeSingle();
                
                if (reply) {
                    camel.replyTo = {
                        _id: reply.id,
                        id: reply.id,
                        username: reply.username,
                        text: reply.text,
                        mediaUrl: reply.media_url
                    };
                }
            }

            return new ChatMessage(camel);
        })();

        return createQueryChain(promise);
    }

    static async findByIdAndDelete(id: string) {
        const { data, error } = await supabase
            .from('chat_messages')
            .delete()
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return new ChatMessage(mapChatMessageToCamel(data));
    }
}

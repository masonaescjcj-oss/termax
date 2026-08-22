import { supabase } from '../config/supabase';
import { mapTradeHistoryToCamel, mapTradeHistoryToSnake } from '../utils/mapper';

export default class TradeHistory {
    [key: string]: any;

    constructor(data: any) {
        Object.assign(this, data);
        if (this.id && !this._id) this._id = this.id;
        if (this._id && !this.id) this.id = this._id;
    }

    async save() {
        const snake = mapTradeHistoryToSnake(this);
        const { data, error } = await supabase
            .from('trade_histories')
            .insert(snake)
            .select()
            .single();
        if (error) throw new Error(error.message);
        Object.assign(this, mapTradeHistoryToCamel(data));
        if (this.id && !this._id) this._id = this.id;
        return this;
    }
}

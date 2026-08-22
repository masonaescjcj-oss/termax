import mongoose, { Schema, Document } from 'mongoose';

export interface ICandle extends Document {
    symbol: string;         // e.g., "BTC/USDT"
    interval: string;       // e.g., "1h", "1d"
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const CandleSchema: Schema = new Schema({
    symbol: { type: String, required: true },
    interval: { type: String, required: true },
    timestamp: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true }
}, {
    timeseries: {
        timeField: 'timestamp',
        metaField: 'symbol',
        granularity: 'minutes' // Or hours, depending on typical interval
    }
});

// Compound index for querying a symbol's specific interval over time
CandleSchema.index({ symbol: 1, interval: 1, timestamp: -1 });

export default mongoose.model<ICandle>('Candle', CandleSchema);

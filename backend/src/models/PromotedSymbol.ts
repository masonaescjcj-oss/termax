import mongoose, { Schema, Document } from 'mongoose';

export interface IPromotedSymbol extends Document {
    symbol: string;
    name: string;
    description: string;
    logoColor: string;
    logoBadge: string;
    imageUrl?: string;
    price: number;
    high?: number;
    low?: number;
    changePct?: string;
    showMetrics: boolean;
    brokerUrl: string;       // Direct redirect URL
    isPinned: boolean;
    isActive: boolean;
    createdAt: Date;
}

const PromotedSymbolSchema: Schema = new Schema({
    symbol: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    logoColor: { type: String, default: '#A855F7' },
    logoBadge: { type: String, default: '⭐' },
    imageUrl: { type: String },
    price: { type: Number, default: 0 },
    high: { type: Number },
    low: { type: Number },
    changePct: { type: String },
    showMetrics: { type: Boolean, default: false },
    brokerUrl: { type: String, default: '' },
    isPinned: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

export default mongoose.model<IPromotedSymbol>('PromotedSymbol', PromotedSymbolSchema);

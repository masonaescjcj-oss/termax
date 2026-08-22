import mongoose, { Schema, Document } from 'mongoose';

export interface IBroker extends Document {
    name: string;
    slug: string;
    logoUrl?: string;
    regulation: string;
    rating: number;      // from reviews
    ranking: number;     // manual admin ranking
    isPromoted: boolean; // promoted broker
    spreads: string;
    minDeposit: string;
    maxLeverage: string;
    platforms: string;
    baseCurrencies: string;
    features: string[];
    hasCommunity: boolean;
    communityName?: string;  // name of the group for community chat
    isActive: boolean;
    createdAt: Date;
}

const BrokerSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    logoUrl: { type: String },
    regulation: { type: String, required: true },
    rating: { type: Number, default: 0 },
    ranking: { type: Number, default: 0 },
    isPromoted: { type: Boolean, default: false },
    spreads: { type: String, required: true },
    minDeposit: { type: String, required: true },
    maxLeverage: { type: String, required: true },
    platforms: { type: String, required: true },
    baseCurrencies: { type: String, required: true },
    features: { type: [String], default: [] },
    hasCommunity: { type: Boolean, default: false },
    communityName: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

export default mongoose.model<IBroker>('Broker', BrokerSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface ICampaignProgress extends Document {
    userId: mongoose.Types.ObjectId;
    campaignId: mongoose.Types.ObjectId;
    completedTasks: string[]; // List of taskIds completed
    joinedAt: Date;
    claimedReward: boolean;
    claimedAt?: Date;
}

const CampaignProgressSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    completedTasks: { type: [String], default: [] },
    joinedAt: { type: Date, default: Date.now },
    claimedReward: { type: Boolean, default: false },
    claimedAt: { type: Date }
}, {
    timestamps: true
});

// Compound index to ensure unique entry per user per campaign
CampaignProgressSchema.index({ userId: 1, campaignId: 1 }, { unique: true });

export default mongoose.model<ICampaignProgress>('CampaignProgress', CampaignProgressSchema);

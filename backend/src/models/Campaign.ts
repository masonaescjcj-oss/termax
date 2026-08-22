import mongoose, { Schema, Document } from 'mongoose';

export interface ICampaignTask {
    taskId: string;
    title: string;
    description: string;
    taskType: 'WIN_RATE' | 'BALANCE_GROWTH' | 'TRADE_COUNT' | 'CONNECT_BROKER' | 
              'VISIT_LINK' | 'REFERRAL' | 'DAILY_CHECK' | 'WIN_STREAK' | 'BALANCE_MULTIPLY';
    config: Record<string, any>;
}

export interface ICampaign extends Document {
    title: string;
    description: string;
    rewardLottieKey: string;
    accentColor: string;
    tasks: ICampaignTask[];
    maxParticipants: number;
    currentParticipants: number;
    isActive: boolean;
    startDate?: Date;
    endDate?: Date;
    createdAt: Date;
}

const CampaignTaskSchema = new Schema({
    taskId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    taskType: { 
        type: String, 
        enum: ['WIN_RATE', 'BALANCE_GROWTH', 'TRADE_COUNT', 'CONNECT_BROKER', 
               'VISIT_LINK', 'REFERRAL', 'DAILY_CHECK', 'WIN_STREAK', 'BALANCE_MULTIPLY'],
        required: true 
    },
    config: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

const CampaignSchema: Schema = new Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    rewardLottieKey: { type: String, required: true },
    accentColor: { type: String, default: '#3B82F6' },
    tasks: { type: [CampaignTaskSchema], default: [] },
    maxParticipants: { type: Number, default: 0 },
    currentParticipants: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date },
    endDate: { type: Date }
}, {
    timestamps: true
});

export default mongoose.model<ICampaign>('Campaign', CampaignSchema);

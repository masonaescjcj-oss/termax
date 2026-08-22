import mongoose, { Schema, Document } from 'mongoose';

export interface IBrokerReview extends Document {
    brokerId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    rating: number;
    text: string;
    isApproved: boolean;
    createdAt: Date;
}

const BrokerReviewSchema: Schema = new Schema({
    brokerId: { type: Schema.Types.ObjectId, ref: 'Broker', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, maxlength: 1000 },
    isApproved: { type: Boolean, default: false } // requires admin approval
}, {
    timestamps: true
});

export default mongoose.model<IBrokerReview>('BrokerReview', BrokerReviewSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  incident: mongoose.Types.ObjectId;
  type: 'assigned' | 'comment' | 'status-change' | 'mention';
  message: string;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    incident: { type: Schema.Types.ObjectId, ref: 'Incident', required: true },
    type: { type: String, enum: ['assigned', 'comment', 'status-change', 'mention'], required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model<INotification>('Notification', notificationSchema);

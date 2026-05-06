import mongoose, { Schema, Document } from 'mongoose';

export type WorkItemStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export interface IRCA extends Document {
  rootCauseCategory: string;
  rootCauseDescription: string;
  fixApplied: string;
  preventionSteps: string;
  startTime: Date;
  endTime: Date;
  submittedBy: mongoose.Types.ObjectId;
  submittedAt: Date;
}

export interface IWorkItem extends Document {
  title: string;
  componentId: string;
  componentType: string;
  initialSeverity: 'P0' | 'P1' | 'P2' | 'P3';
  status: WorkItemStatus;
  assignedTo?: mongoose.Types.ObjectId;
  signalCount: number;
  firstSignalTime: Date;
  lastSignalTime: Date;
  resolvedTime?: Date;
  closedTime?: Date;
  rca?: IRCA;
  mttr?: number; // milliseconds
  alerts: {
    type: string;
    sentAt: Date;
    recipient: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const rcaSchema = new Schema({
  rootCauseCategory: { type: String, required: true },
  rootCauseDescription: { type: String, required: true },
  fixApplied: { type: String, required: true },
  preventionSteps: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt: { type: Date, default: Date.now }
});

const workItemSchema = new Schema<IWorkItem>(
  {
    title: { type: String, required: true },
    componentId: { type: String, required: true, index: true },
    componentType: { type: String, required: true },
    initialSeverity: { type: String, enum: ['P0', 'P1', 'P2', 'P3'], required: true },
    status: { type: String, enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'], default: 'OPEN', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    signalCount: { type: Number, default: 0 },
    firstSignalTime: { type: Date, required: true },
    lastSignalTime: { type: Date, required: true },
    resolvedTime: Date,
    closedTime: Date,
    rca: rcaSchema,
    mttr: Number,
    alerts: [
      {
        type: String,
        sentAt: Date,
        recipient: String
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model<IWorkItem>('WorkItem', workItemSchema);

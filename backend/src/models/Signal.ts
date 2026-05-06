import mongoose, { Schema, Document } from 'mongoose';

export interface ISignal extends Document {
  componentId: string;
  componentType: 'API' | 'CACHE' | 'DATABASE' | 'QUEUE' | 'MCP_HOST' | 'OTHER';
  errorType: string;
  message: string;
  stackTrace?: string;
  latency?: number;
  timestamp: Date;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  workItemId?: mongoose.Types.ObjectId;
  metadata: Record<string, any>;
}

const signalSchema = new Schema<ISignal>(
  {
    componentId: { type: String, required: true, index: true },
    componentType: { type: String, enum: ['API', 'CACHE', 'DATABASE', 'QUEUE', 'MCP_HOST', 'OTHER'], required: true },
    errorType: { type: String, required: true },
    message: { type: String, required: true },
    stackTrace: String,
    latency: Number,
    timestamp: { type: Date, default: Date.now, index: true },
    severity: { type: String, enum: ['P0', 'P1', 'P2', 'P3'], default: 'P2' },
    workItemId: { type: Schema.Types.ObjectId, ref: 'WorkItem', index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: false }
);

signalSchema.index({ componentId: 1, timestamp: -1 });

export default mongoose.model<ISignal>('Signal', signalSchema);

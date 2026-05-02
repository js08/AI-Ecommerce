// 1. Import necessary decorators from NestJS Mongoose wrapper and the base Document type from Mongoose
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * 2. @Schema: Tells NestJS/Mongoose this class represents a MongoDB collection.
 * Setting 'collection' explicitly ensures it matches your existing Spring Boot collection name.
 */
@Schema({ collection: 'achievements' })
export class Achievement extends Document {
  
  /**
   * 3. @Prop: Defines a property in the MongoDB document.
   * 'required: true' acts as a database-level validation constraint.
   */
  @Prop({ required: true })
  message: string;

  /**
   * 4. This field stores the numerical result (totalSum) received from Kafka.
   */
  @Prop({ required: true })
  totalTime: number;

  /**
   * 5. Sets a default value of the current timestamp if no date is provided.
   * This is equivalent to 'LocalDateTime.now()' in your Java code.
   */
  @Prop({ default: Date.now })
  achievedAt: Date;
}

/**
 * 6. SchemaFactory: This utility converts the TypeScript class into a 
 * Mongoose Schema that the underlying driver can understand.
 */
export const AchievementSchema = SchemaFactory.createForClass(Achievement);
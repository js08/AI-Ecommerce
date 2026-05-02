// --- THE IMPORTS: Gathering our tools ---
import { Injectable } from '@nestjs/common'; // Allows this class to be used by other parts of the app
import { InjectModel } from '@nestjs/mongoose'; // A tool to help us "talk" to MongoDB
import { Model } from 'mongoose'; // The "Blueprint" type for our database records
import { Achievement } from './schemas/achievement.schema'; // Our specific "Achievement" data structure
import { WindowResultDto } from './dto/window-result.dto'; // The "shape" of the data coming from Kafka

// --- THE CLASS: The "Chef" of our logic ---
@Injectable() // This tells NestJS: "Keep this class ready so we can plug it in wherever needed"
export class AchievementsService {
  
  /**
   * THE CONSTRUCTOR: Setting up the database connection
   * Think of this as the Chef getting their hands on the "Achievements" filing cabinet.
   * We "Inject" the model so we can save, find, and delete data.
   */
  constructor(
    @InjectModel(Achievement.name) private achievementModel: Model<Achievement>,
  ) {}

  /**
   * THE ACTION: Handling a Kafka Event
   * This is like a recipe that runs whenever Kafka sends us a message.
   */
  async handleGoalEvent(data: WindowResultDto) {
    // 1. Logging: Printing a note in the console so we know the message arrived safely.
    console.log(`📩 Kafka Message Received: Found a window with sum ${data.totalSum}`);

    // 2. Formatting: Turning raw numbers into a friendly "Congratulation" message.
    const achievementMessage = `🏆 Milestone Reached! You hit a target sum of ${data.totalSum}ms!`;

    // 3. Mapping: Preparing a new "Record" based on our Database Schema.
    // We take the Kafka data and the current time and put them into a new object.
    const newAchievement = new this.achievementModel({
      message: achievementMessage,
      totalTime: data.totalSum,
      achievedAt: new Date(), // Records the exact moment the goal was reached
    });

    // 4. Saving: The most important part! We send the object to MongoDB to be stored forever.
    // 'await' makes sure the code waits for the database to finish before moving on.
    await newAchievement.save();
    
    console.log('⭐ Achievement successfully stored in MongoDB!');
  }

  /**
   * THE RETRIEVER: Fetching all data
   * This is a simple function that goes to the database and says: 
   * "Give me every achievement record you have!"
   */
  async findAll(): Promise<Achievement[]> {
    // .find() is a built-in Mongoose command to get all records.
    // .exec() turns it into a "Promise" (a task that will finish in the future).
    return this.achievementModel.find().exec();
  }
}

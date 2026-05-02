// --- THE IMPORTS: Bringing the team together ---
import { Module } from '@nestjs/common'; // The basic building block to create a module
import { MongooseModule } from '@nestjs/mongoose'; // The tool that connects this module to MongoDB
import { AchievementsController } from './achievements.controller'; // Our "Receptionist"
import { AchievementsService } from './achievements.service'; // Our "Chef" (Logic)
import { Achievement, AchievementSchema } from './schemas/achievement.schema'; // Our "Blueprint"

/**
 * THE @MODULE DECORATOR: The Organizer
 * This is where we define how the different parts of this specific feature 
 * (Achievements) interact with each other.
 */
@Module({
  /**
   * 1. IMPORTS: External tools we need.
   * MongooseModule.forFeature tells NestJS: "In this toolbox, we are going 
   * to be working with the 'Achievement' collection in the database."
   * Without this, the Service wouldn't be allowed to talk to MongoDB.
   */
  imports: [
    MongooseModule.forFeature([
      { name: Achievement.name, schema: AchievementSchema }
    ]),
  ],

  /**
   * 2. CONTROLLERS: The entry points.
   * We list our 'AchievementsController' here so the app knows to 
   * listen for the web routes and Kafka events defined inside it.
   */
  controllers: [AchievementsController],

  /**
   * 3. PROVIDERS: The logic workers.
   * We list 'AchievementsService' here. This tells NestJS to create 
   * an instance of the service and handle all the "Dependency Injection" 
   * (the magic that connects the Service to the Controller).
   */
  providers: [AchievementsService],
})
export class AchievementsModule {}
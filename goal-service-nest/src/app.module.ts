import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AchievementsModule } from './achievements/achievements.module';

@Module({
  imports: [
    // This connects to the MongoDB container using the environment variable from docker-compose
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/goal_db'),
    AchievementsModule,
  ],
})
export class AppModule {}
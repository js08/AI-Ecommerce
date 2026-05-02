// --- THE IMPORTS: Bringing in our tools ---
import { Controller, Get } from '@nestjs/common'; // Tools to handle web requests (like GET)
import { EventPattern, Payload } from '@nestjs/microservices'; // Tools to listen to Kafka messages
import { AchievementsService } from './achievements.service'; // Importing our "Chef" (the logic handler)
import { WindowResultDto } from './dto/window-result.dto'; // The "Template" for what the Kafka data looks like

// --- THE DECORATOR: Setting the address ---
// This tells NestJS: "Any web request starting with /api/goals should come to this desk."
@Controller('api/goals') 
export class AchievementsController {

  /**
   * THE CONSTRUCTOR: Hiring the Service
   * We tell the Controller: "You are going to need the AchievementsService to do the heavy lifting."
   * In NestJS, this is like giving the receptionist a direct phone line to the kitchen.
   */
  constructor(private readonly achievementsService: AchievementsService) {}

  /**
   * THE WEB LISTENER: Handling "GET" requests
   * When a user goes to http://localhost:8082/api/goals in their browser:
   * 1. This function wakes up.
   * 2. It asks the Service to "find all" records from the database.
   * 3. It sends those records back to the user's screen.
   */
  @Get()
  async getAllAchievements() {
    return this.achievementsService.findAll();
  }

  /**
   * THE KAFKA LISTENER: Handling "Events"
   * This is like a special radio that only listens to the 'goal-topic' station.
   * 
   * @EventPattern('goal-topic'): This tells the app to watch Kafka for a specific topic.
   * @Payload(): This is like opening the envelope of the Kafka message to get the 'data' inside.
   */
  @EventPattern('goal-topic')
  async handleConsumeGoal(@Payload() data: WindowResultDto) {
    // We don't write the saving logic here! 
    // We just hand the 'data' over to the Service and say: "Hey, handle this goal event."
    await this.achievementsService.handleGoalEvent(data);
  }
}
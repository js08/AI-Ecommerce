// --- THE IMPORTS: Getting the foundation ready ---
import { NestFactory } from '@nestjs/core'; // The "Factory" that builds our application
import { Transport, MicroserviceOptions } from '@nestjs/microservices'; // Tools to speak "Kafka"
import { AppModule } from './app.module'; // The Root Module (the container for everything else)

// --- THE BOOTSTRAP FUNCTION: The Startup Sequence ---
// We use 'async' because starting a server takes a moment, and we want to do it correctly.
async function bootstrap() {
  
  /**
   * 1. CREATE THE APP
   * This line creates the standard Web Server (HTTP).
   * It's like building a house based on the blueprint provided in 'AppModule'.
   */
  const app = await NestFactory.create(AppModule);

  /**
   * 2. CONNECT THE MICROSERVICE (KAFKA)
   * A "Hybrid App" can do two things at once: talk to people (HTTP) and talk to other machines (Kafka).
   * Here, we plug in the Kafka radio:
   * - Transport.KAFKA: We tell NestJS to use the Kafka language.
   * - brokers: The address where the Kafka server is living.
   * - groupId: The "ID tag" for this app so Kafka knows who is reading the messages.
   */
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['localhost:9092'], // Where Kafka is running
      },
      consumer: {
        groupId: 'goal-service-group', // The name of our listening group
      },
    },
  });

  /**
   * 3. ENABLE CORS (The "Bouncer")
   * By default, browsers block one website (like your React app on port 3000) 
   * from talking to another (your NestJS app on port 8082). 
   * 'enableCors' tells the server: "It's okay, let the React app through!"
   */
  app.enableCors({ origin: 'http://localhost:3000' });

  /**
   * 4. START EVERYTHING
   * - startAllMicroservices(): Turns on the Kafka listener we configured in step 2.
   * - listen(8082): Opens the front door for web requests on Port 8082.
   */
  await app.startAllMicroservices();
  await app.listen(8082);

  // A friendly message to tell us everything worked!
  console.log('🚀 Goal Service is running on http://localhost:8082');
}

// Start the sequence!
bootstrap();
/**
 * THE DTO (Data Transfer Object)
 * Think of this as a "Contract" or "Template." 
 * It tells NestJS: "Whenever a message comes from Kafka, it MUST have these specific pieces of information."
 */
export class WindowResultDto {
  
  /**
   * This is the main number we care about. 
   * In your Java/Kafka logic, this represents the calculated sum (like total time spent).
   * We mark it as a 'number' so TypeScript knows we can do math with it.
   */
  totalSum: number;

  /**
   * If your Java application sends other data inside the same message, 
   * you would list them here. For example, if it sent a window ID:
   * windowId: string;
   */
}
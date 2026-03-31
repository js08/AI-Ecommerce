FROM openjdk:17-jdk-slim AS builder
WORKDIR /app
COPY . .
RUN ./mvnw clean package -DskipTests

FROM openjdk:17-jdk-slim
COPY --from=builder /app/target/customer-service-ai-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
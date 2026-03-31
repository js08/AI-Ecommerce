//package com.example.customer.config;
//
//public class WebClientConfig {
//}



package com.ecommerce.customerservice.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Configuration
public class WebClientConfig {

    @Value("${openai.timeout:30s}")
    private Duration timeout;

    @Bean
    public WebClient openAiWebClient(WebClient.Builder builder) {
        // Create a Netty HTTP client with timeouts
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, (int) timeout.toMillis())
                .responseTimeout(timeout)
                .doOnConnected(conn ->
                        conn.addHandlerLast(new ReadTimeoutHandler(timeout.toSeconds(), TimeUnit.SECONDS))
                                .addHandlerLast(new WriteTimeoutHandler(timeout.toSeconds(), TimeUnit.SECONDS)));

        return builder
                .baseUrl("https://api.openai.com/v1")
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }
}
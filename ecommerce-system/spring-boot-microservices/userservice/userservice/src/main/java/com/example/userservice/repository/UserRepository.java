////package com.example.userservice.repository;
////
////public class UserRepository {
////}
//
//
//package com.example.userservice.repository;
//
//import com.example.userservice.entity.User;
//import org.springframework.data.repository.reactive.ReactiveCrudRepository;
//import org.springframework.stereotype.Repository;
//import reactor.core.publisher.Mono;
//
//@Repository   // Marks this as a Spring Data repository
//public interface UserRepository extends ReactiveCrudRepository<User, Long> {
//
//    // Reactive method to find a user by email (returns 0 or 1 result as Mono)
//    Mono<User> findByEmail(String email);
//
//    // Reactive method to check if email already exists
//    Mono<Boolean> existsByEmail(String email);
//}


package com.example.userservice.repository;

import com.example.userservice.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // Standard JPA method to find a user by email (returns an Optional)
    Optional<User> findByEmail(String email);

    // Standard JPA method to check if email already exists
    boolean existsByEmail(String email);
}

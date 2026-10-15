package com.weiwei.blog.api;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BlogUserRepository extends JpaRepository<BlogUser, Long> {
    Optional<BlogUser> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
}

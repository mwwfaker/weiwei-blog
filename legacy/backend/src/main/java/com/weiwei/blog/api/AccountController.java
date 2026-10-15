package com.weiwei.blog.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/account")
public class AccountController {
    private final BlogUserRepository users;
    public AccountController(BlogUserRepository users) { this.users = users; }

    @GetMapping("/me")
    public AccountView current(@AuthenticationPrincipal Jwt token) {
        BlogUser user = users.findById(Long.valueOf(token.getSubject()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return view(user);
    }

    @PutMapping("/me")
    public AccountView update(@AuthenticationPrincipal Jwt token, @Valid @RequestBody ProfileUpdate update) {
        BlogUser user = users.findById(Long.valueOf(token.getSubject()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        user.setDisplayName(update.displayName().trim());
        user.setBio(update.bio() == null ? "" : update.bio().trim());
        user.setAvatarUrl(update.avatarUrl());
        return view(users.save(user));
    }

    private AccountView view(BlogUser user) {
        return new AccountView(user.getId(), user.getEmail(), user.getDisplayName(), user.getBio(), user.getAvatarUrl(), user.getCreatedAt());
    }

    public record ProfileUpdate(@NotBlank @Size(max=80) String displayName, @Size(max=160) String bio, @Size(max=1000) String avatarUrl) {}
    public record AccountView(Long id, String email, String displayName, String bio, String avatarUrl, java.time.Instant createdAt) {}
}

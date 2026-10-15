package com.weiwei.blog.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

// CORS lives in one place: the CorsConfigurationSource in SecurityConfiguration, which covers
// /api/**. A controller-level @CrossOrigin(origins = "${app.cors-origin}") interpolates a single
// literal origin and so cannot express the comma-separated CORS_ORIGIN list that the global
// configuration splits on, which would make the two sources disagree.
@RestController
@RequestMapping("/api/diaries")
public class DiaryController {
    private final DiaryRepository repository;

    public DiaryController(DiaryRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<DiaryEntry> list(@AuthenticationPrincipal Jwt user) {
        return repository.findAllByOwnerIdOrderByEntryDateDescUpdatedAtDesc(userId(user));
    }

    @GetMapping("/{id}")
    public DiaryEntry get(@PathVariable long id, @AuthenticationPrincipal Jwt user) {
        return ownedEntry(id, user);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DiaryEntry create(@Valid @RequestBody DiaryRequest request, @AuthenticationPrincipal Jwt user) {
        DiaryEntry entry = request.apply(new DiaryEntry());
        entry.setOwnerId(userId(user));
        return repository.save(entry);
    }

    @PutMapping("/{id}")
    public DiaryEntry update(@PathVariable long id, @Valid @RequestBody DiaryRequest request, @AuthenticationPrincipal Jwt user) {
        DiaryEntry entry = ownedEntry(id, user);
        return repository.save(request.apply(entry));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id, @AuthenticationPrincipal Jwt user) {
        ownedEntry(id, user);
        repository.deleteById(id);
    }

    private DiaryEntry ownedEntry(long id, Jwt user) {
        DiaryEntry entry = repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!entry.getOwnerId().equals(userId(user))) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return entry;
    }

    private Long userId(Jwt user) { return Long.valueOf(user.getSubject()); }

    @RestController
    @RequestMapping("/api/public/diaries")
    public static class PublicDiaryController {
        private final DiaryRepository repository;
        public PublicDiaryController(DiaryRepository repository) { this.repository = repository; }
        @GetMapping
        public List<DiaryEntry> list() { return repository.findAllByVisibilityOrderByEntryDateDescUpdatedAtDesc("PUBLIC"); }
    }

    public record DiaryRequest(
            @NotBlank @Size(max = 120) String title,
            @NotNull LocalDate entryDate,
            @NotBlank @Size(max = 30) String mood,
            @NotBlank @Size(max = 16) String weather,
            @Size(max = 12) String visibility,
            @NotBlank String tags,
            @NotBlank String content) {
        DiaryEntry apply(DiaryEntry entry) {
            entry.setTitle(title.trim());
            entry.setEntryDate(entryDate);
            entry.setMood(mood.trim());
            entry.setWeather(weather.trim());
            entry.setVisibility("PUBLIC".equals(visibility) ? "PUBLIC" : "PRIVATE");
            entry.setTags(tags.trim());
            entry.setContent(content.trim());
            return entry;
        }
    }
}

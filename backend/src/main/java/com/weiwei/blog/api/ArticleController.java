package com.weiwei.blog.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
@RequestMapping("/api/articles")
public class ArticleController {
    private final BlogArticleRepository repository;
    public ArticleController(BlogArticleRepository repository) { this.repository = repository; }

    @GetMapping public List<BlogArticle> list(@AuthenticationPrincipal Jwt user) {
        return repository.findAllByOwnerIdOrderByArticleDateDescUpdatedAtDesc(userId(user));
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public BlogArticle create(@Valid @RequestBody ArticleRequest request, @AuthenticationPrincipal Jwt user) {
        BlogArticle article = request.apply(new BlogArticle()); article.setOwnerId(userId(user)); return repository.save(article);
    }
    @PutMapping("/{id}") public BlogArticle update(@PathVariable long id, @Valid @RequestBody ArticleRequest request, @AuthenticationPrincipal Jwt user) {
        BlogArticle article = owned(id, user); return repository.save(request.apply(article));
    }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id, @AuthenticationPrincipal Jwt user) { owned(id, user); repository.deleteById(id); }
    private BlogArticle owned(long id, Jwt user) {
        BlogArticle article = repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!article.getOwnerId().equals(userId(user))) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return article;
    }
    private Long userId(Jwt user) { return Long.valueOf(user.getSubject()); }

    @RestController @RequestMapping("/api/public/articles")
    public static class PublicArticleController {
        private final BlogArticleRepository repository;
        public PublicArticleController(BlogArticleRepository repository) { this.repository = repository; }
        @GetMapping public List<BlogArticle> list() { return repository.findAllByVisibilityOrderByArticleDateDescUpdatedAtDesc("PUBLIC"); }
    }

    public record ArticleRequest(@NotBlank @Size(max=120) String title, @NotBlank @Size(max=80) String category,
            @Size(max=12) String visibility, @NotBlank String tags, @Size(max=500) String excerpt,
            @NotBlank String content, @Size(max=1000) String coverUrl, @NotNull LocalDate articleDate) {
        BlogArticle apply(BlogArticle article) {
            article.setTitle(title.trim()); article.setCategory(category.trim());
            article.setVisibility("PRIVATE".equals(visibility) ? "PRIVATE" : "PUBLIC");
            article.setTags(tags == null ? "" : tags.trim()); article.setExcerpt(excerpt == null ? "" : excerpt.trim());
            article.setContent(content.trim()); article.setCoverUrl(coverUrl); article.setArticleDate(articleDate); return article;
        }
    }
}

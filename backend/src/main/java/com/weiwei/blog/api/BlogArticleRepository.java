package com.weiwei.blog.api;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BlogArticleRepository extends JpaRepository<BlogArticle, Long> {
    List<BlogArticle> findAllByOwnerIdOrderByArticleDateDescUpdatedAtDesc(Long ownerId);
    List<BlogArticle> findAllByVisibilityOrderByArticleDateDescUpdatedAtDesc(String visibility);
}

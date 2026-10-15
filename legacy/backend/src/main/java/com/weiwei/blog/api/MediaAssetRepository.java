package com.weiwei.blog.api;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {
    List<MediaAsset> findAllByOwnerIdOrderByCreatedAtDesc(Long ownerId);
    List<MediaAsset> findAllByKindAndVisibilityOrderByCreatedAtDesc(String kind, String visibility);
}

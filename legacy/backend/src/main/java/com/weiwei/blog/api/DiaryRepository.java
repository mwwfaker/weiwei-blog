package com.weiwei.blog.api;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DiaryRepository extends JpaRepository<DiaryEntry, Long> {
    List<DiaryEntry> findAllByOrderByEntryDateDescUpdatedAtDesc();
    List<DiaryEntry> findAllByOwnerIdOrderByEntryDateDescUpdatedAtDesc(Long ownerId);
    List<DiaryEntry> findAllByVisibilityOrderByEntryDateDescUpdatedAtDesc(String visibility);
}

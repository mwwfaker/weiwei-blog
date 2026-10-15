package com.weiwei.blog.api;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** 三个仓储放在一个文件里：它们都很薄，没必要各占一个文件。 */
interface PerfQueueRepository extends JpaRepository<PerfQueue, Long> {
    List<PerfQueue> findAllByOwnerIdOrderBySortOrderAscIdAsc(Long ownerId);

    // 公开读取要先知道「哪些账号有绩效数据」，用一条 distinct 查询而不是逐个账号去问。
    @Query("select distinct q.ownerId from PerfQueue q")
    List<Long> findOwnerIds();

    void deleteAllByOwnerId(Long ownerId);
}

interface PerfMemberRepository extends JpaRepository<PerfMember, Long> {
    List<PerfMember> findAllByOwnerIdOrderBySortOrderAscIdAsc(Long ownerId);

    @Query("select distinct m.ownerId from PerfMember m")
    List<Long> findOwnerIds();

    void deleteAllByOwnerId(Long ownerId);
}

interface PerfEntryRepository extends JpaRepository<PerfEntry, Long> {
    List<PerfEntry> findAllByOwnerIdOrderByIdAsc(Long ownerId);

    @Query("select distinct e.ownerId from PerfEntry e")
    List<Long> findOwnerIds();

    void deleteAllByOwnerId(Long ownerId);
}

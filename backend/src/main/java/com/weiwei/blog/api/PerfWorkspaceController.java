package com.weiwei.blog.api;

import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 绩效计算器的工作区。整个工作区一次读、一次写。
 *
 * 之所以不做成逐个增删改的接口：前端的「数据总览」是整张表在编辑（改队列、改人、改每格数据），
 * 拆成细粒度接口会让一次编辑产生几十个请求，还要处理中途失败导致的半写状态。
 * 整体替换在事务里做，要么全成功要么全不动。
 */
@RestController
@RequestMapping("/api/perf")
public class PerfWorkspaceController {

    /** 一次能存下的规模上限，防止误传超大载荷。 */
    private static final int MAX_MEMBERS = 300;
    private static final int MAX_QUEUES = 200;
    private static final int MAX_ENTRIES = 5000;

    private final PerfQueueRepository queues;
    private final PerfMemberRepository members;
    private final PerfEntryRepository entries;

    public PerfWorkspaceController(PerfQueueRepository queues, PerfMemberRepository members, PerfEntryRepository entries) {
        this.queues = queues;
        this.members = members;
        this.entries = entries;
    }

    private static Long userId(Jwt user) {
        return Long.valueOf(user.getSubject());
    }

    public record QueuePayload(String id, String name, Integer kpi) {}
    public record MemberPayload(String id, String name, String email, String queue,
                                Double requiredHours, Double transferHours, Double overtimeHours, Double tripleHours) {}
    public record EntryPayload(String id, String memberId, String queue, Double actualAht, Integer auditCount, Integer tripleCount) {}
    public record WorkspacePayload(List<QueuePayload> queues, List<MemberPayload> members, List<EntryPayload> entries) {}

    @GetMapping("/workspace")
    public WorkspacePayload load(@AuthenticationPrincipal Jwt user) {
        return build(queues, members, entries, userId(user));
    }

    /**
     * 组装某个账号的整份工作区。写入接口和公开读取接口共用同一段代码，
     * 两边的字段就不会各写一份而慢慢漂移。
     */
    static WorkspacePayload build(PerfQueueRepository queues, PerfMemberRepository members, PerfEntryRepository entries, Long owner) {
        List<QueuePayload> queueList = new ArrayList<>();
        for (PerfQueue queue : queues.findAllByOwnerIdOrderBySortOrderAscIdAsc(owner)) {
            queueList.add(new QueuePayload(queue.getClientId(), queue.getName(), queue.getKpi()));
        }
        List<MemberPayload> memberList = new ArrayList<>();
        for (PerfMember member : members.findAllByOwnerIdOrderBySortOrderAscIdAsc(owner)) {
            memberList.add(new MemberPayload(member.getClientId(), member.getName(), member.getEmail(), member.getQueueName(),
                member.getRequiredHours(), member.getTransferHours(), member.getOvertimeHours(), member.getTripleHours()));
        }
        List<EntryPayload> entryList = new ArrayList<>();
        for (PerfEntry entry : entries.findAllByOwnerIdOrderByIdAsc(owner)) {
            entryList.add(new EntryPayload(entry.getClientId(), entry.getMemberClientId(), entry.getQueueName(),
                entry.getActualAht(), entry.getAuditCount(), entry.getTripleCount()));
        }
        return new WorkspacePayload(queueList, memberList, entryList);
    }

    @PutMapping("/workspace")
    @Transactional
    public WorkspacePayload save(@Valid @RequestBody WorkspacePayload payload, @AuthenticationPrincipal Jwt user) {
        Long owner = userId(user);
        List<QueuePayload> incomingQueues = payload.queues() == null ? List.of() : payload.queues();
        List<MemberPayload> incomingMembers = payload.members() == null ? List.of() : payload.members();
        List<EntryPayload> incomingEntries = payload.entries() == null ? List.of() : payload.entries();
        if (incomingQueues.size() > MAX_QUEUES || incomingMembers.size() > MAX_MEMBERS || incomingEntries.size() > MAX_ENTRIES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "绩效数据超过单次可保存的上限");
        }

        // 整体替换：先清空这个账号的数据，再按 payload 重建
        entries.deleteAllByOwnerId(owner);
        members.deleteAllByOwnerId(owner);
        queues.deleteAllByOwnerId(owner);
        // 必须先 flush：否则随后的 INSERT 可能排在同 key 的 DELETE 之前，
        // 撞上 (owner_id, client_id) 唯一键，整笔事务回滚，看起来就像「保存没生效」。
        entries.flush();
        members.flush();
        queues.flush();

        int order = 0;
        for (QueuePayload item : incomingQueues) {
            if (item.id() == null || item.id().isBlank()) continue;
            PerfQueue queue = new PerfQueue();
            queue.setOwnerId(owner);
            queue.setClientId(item.id());
            queue.setName(item.name() == null ? "" : item.name().trim());
            queue.setKpi(Math.max(0, item.kpi() == null ? 0 : item.kpi()));
            queue.setSortOrder(order++);
            queues.save(queue);
        }

        order = 0;
        List<String> memberIds = new ArrayList<>();
        for (MemberPayload item : incomingMembers) {
            if (item.id() == null || item.id().isBlank()) continue;
            PerfMember member = new PerfMember();
            member.setOwnerId(owner);
            member.setClientId(item.id());
            member.setName(item.name() == null ? "" : item.name().trim());
            member.setEmail(item.email() == null ? "" : item.email().trim());
            member.setQueueName(item.queue() == null ? "" : item.queue().trim());
            member.setRequiredHours(Math.max(0, item.requiredHours() == null ? 0 : item.requiredHours()));
            member.setTransferHours(Math.max(0, item.transferHours() == null ? 0 : item.transferHours()));
            member.setOvertimeHours(Math.max(0, item.overtimeHours() == null ? 0 : item.overtimeHours()));
            member.setTripleHours(Math.max(0, item.tripleHours() == null ? 0 : item.tripleHours()));
            member.setSortOrder(order++);
            members.save(member);
            memberIds.add(item.id());
        }

        for (EntryPayload item : incomingEntries) {
            if (item.id() == null || item.id().isBlank()) continue;
            // 指向不存在员工的明细直接丢弃，避免留下孤儿数据
            if (item.memberId() == null || !memberIds.contains(item.memberId())) continue;
            PerfEntry entry = new PerfEntry();
            entry.setOwnerId(owner);
            entry.setClientId(item.id());
            entry.setMemberClientId(item.memberId());
            entry.setQueueName(item.queue() == null ? "" : item.queue().trim());
            entry.setActualAht(Math.max(0, item.actualAht() == null ? 0 : item.actualAht()));
            entry.setAuditCount(Math.max(0, item.auditCount() == null ? 0 : item.auditCount()));
            entry.setTripleCount(Math.max(0, item.tripleCount() == null ? 0 : item.tripleCount()));
            entries.save(entry);
        }

        return load(user);
    }

    public record PublicWorkspace(Long ownerId, String ownerName, List<QueuePayload> queues,
                                  List<MemberPayload> members, List<EntryPayload> entries) {}

    /**
     * 绩效数据的公开读取，不需要登录：与文章、日记、相册的公开接口是同一个口径——
     * 查看对所有人开放，写仍然只认登录账号，而且只会覆盖自己的那一份（见 PUT /api/perf/workspace）。
     */
    @RestController
    @RequestMapping("/api/public/perf")
    public static class PublicPerfController {
        private final PerfQueueRepository queues;
        private final PerfMemberRepository members;
        private final PerfEntryRepository entries;
        private final BlogUserRepository users;

        public PublicPerfController(PerfQueueRepository queues, PerfMemberRepository members,
                                    PerfEntryRepository entries, BlogUserRepository users) {
            this.queues = queues;
            this.members = members;
            this.entries = entries;
            this.users = users;
        }

        @GetMapping("/workspaces")
        public List<PublicWorkspace> list() {
            // 三个表里任意一个有数据的账号都算「有绩效数据」；TreeSet 让顺序稳定，页面上的选择器不会跳。
            java.util.TreeSet<Long> owners = new java.util.TreeSet<>();
            owners.addAll(queues.findOwnerIds());
            owners.addAll(members.findOwnerIds());
            owners.addAll(entries.findOwnerIds());
            List<PublicWorkspace> result = new ArrayList<>();
            for (Long owner : owners) {
                if (owner == null) continue;
                WorkspacePayload payload = build(queues, members, entries, owner);
                String name = users.findById(owner).map(BlogUser::getDisplayName).orElse("");
                result.add(new PublicWorkspace(owner, name, payload.queues(), payload.members(), payload.entries()));
            }
            return result;
        }
    }
}

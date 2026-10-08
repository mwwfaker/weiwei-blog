-- 绩效计算器的工作区：员工 + 队列 + 每月明细（员工 × 队列）。
-- 按账号隔离（owner_id），接口整体读整体写，保证前端的一次编辑不会写坏一半。
CREATE TABLE perf_queues (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    client_id VARCHAR(64) NOT NULL,
    name VARCHAR(64) NOT NULL,
    kpi INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_perf_queues_client (owner_id, client_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE perf_members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    client_id VARCHAR(64) NOT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    email VARCHAR(190) NOT NULL DEFAULT '',
    queue_name VARCHAR(64) NOT NULL DEFAULT '',
    required_hours DOUBLE NOT NULL DEFAULT 0,
    transfer_hours DOUBLE NOT NULL DEFAULT 0,
    overtime_hours DOUBLE NOT NULL DEFAULT 0,
    triple_hours DOUBLE NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_perf_members_client (owner_id, client_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE perf_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    client_id VARCHAR(64) NOT NULL,
    member_client_id VARCHAR(64) NOT NULL,
    queue_name VARCHAR(64) NOT NULL DEFAULT '',
    actual_aht DOUBLE NOT NULL DEFAULT 0,
    audit_count INT NOT NULL DEFAULT 0,
    triple_count INT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_perf_entries_client (owner_id, client_id),
    KEY idx_perf_entries_member (owner_id, member_client_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

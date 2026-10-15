package com.weiwei.blog.api;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 绩效计算的队列：名字 + 每月手改的 KPI，标准 AHT 与单价都由 KPI 推出，不落库。 */
@Entity
@Table(name = "perf_queues")
public class PerfQueue {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ownerId;

    /** 前端生成的字符串 id，用来跨表引用，避免两边各自维护映射。 */
    @Column(nullable = false, length = 64)
    private String clientId;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(nullable = false)
    private int kpi;

    @Column(nullable = false)
    private int sortOrder;

    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getKpi() { return kpi; }
    public void setKpi(int kpi) { this.kpi = kpi; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}

package com.weiwei.blog.api;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 绩效明细：员工 × 队列，每月只有三个数——实际 AHT、审核量、其中三薪日的审核量。 */
@Entity
@Table(name = "perf_entries")
public class PerfEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ownerId;

    @Column(nullable = false, length = 64)
    private String clientId;

    @Column(nullable = false, length = 64)
    private String memberClientId;

    @Column(nullable = false, length = 64)
    private String queueName = "";

    @Column(nullable = false)
    private double actualAht;

    @Column(nullable = false)
    private int auditCount;

    @Column(nullable = false)
    private int tripleCount;

    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public String getMemberClientId() { return memberClientId; }
    public void setMemberClientId(String memberClientId) { this.memberClientId = memberClientId; }
    public String getQueueName() { return queueName; }
    public void setQueueName(String queueName) { this.queueName = queueName; }
    public double getActualAht() { return actualAht; }
    public void setActualAht(double actualAht) { this.actualAht = actualAht; }
    public int getAuditCount() { return auditCount; }
    public void setAuditCount(int auditCount) { this.auditCount = auditCount; }
    public int getTripleCount() { return tripleCount; }
    public void setTripleCount(int tripleCount) { this.tripleCount = tripleCount; }
}

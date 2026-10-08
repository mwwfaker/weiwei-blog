package com.weiwei.blog.api;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 绩效计算里的员工，以及「一个月只填一次」的那几项。 */
@Entity
@Table(name = "perf_members")
public class PerfMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ownerId;

    @Column(nullable = false, length = 64)
    private String clientId;

    @Column(nullable = false, length = 120)
    private String name = "";

    @Column(nullable = false, length = 190)
    private String email = "";

    @Column(nullable = false, length = 64)
    private String queueName = "";

    @Column(nullable = false)
    private double requiredHours;

    @Column(nullable = false)
    private double transferHours;

    @Column(nullable = false)
    private double overtimeHours;

    @Column(nullable = false)
    private double tripleHours;

    @Column(nullable = false)
    private int sortOrder;

    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getQueueName() { return queueName; }
    public void setQueueName(String queueName) { this.queueName = queueName; }
    public double getRequiredHours() { return requiredHours; }
    public void setRequiredHours(double requiredHours) { this.requiredHours = requiredHours; }
    public double getTransferHours() { return transferHours; }
    public void setTransferHours(double transferHours) { this.transferHours = transferHours; }
    public double getOvertimeHours() { return overtimeHours; }
    public void setOvertimeHours(double overtimeHours) { this.overtimeHours = overtimeHours; }
    public double getTripleHours() { return tripleHours; }
    public void setTripleHours(double tripleHours) { this.tripleHours = tripleHours; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}

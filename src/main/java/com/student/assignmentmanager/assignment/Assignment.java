package com.student.assignmentmanager.assignment;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "assignments")
public class Assignment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, length = 100)
    private String subject;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AssignmentPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AssignmentStatus status;

    @Column
    private LocalDateTime completedAt;

    protected Assignment() {
    }

    public Assignment(String title, String subject, String description, LocalDate dueDate,
                      AssignmentPriority priority, AssignmentStatus status) {
        this.title = title;
        this.subject = subject;
        this.description = description;
        this.dueDate = dueDate;
        this.priority = priority;
        this.status = status;
        this.completedAt = status == AssignmentStatus.COMPLETED ? LocalDateTime.now() : null;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getSubject() { return subject; }
    public String getDescription() { return description; }
    public LocalDate getDueDate() { return dueDate; }
    public AssignmentPriority getPriority() { return priority; }
    public AssignmentStatus getStatus() { return status; }
    public LocalDateTime getCompletedAt() { return completedAt; }

    public void update(String title, String subject, String description, LocalDate dueDate,
                       AssignmentPriority priority, AssignmentStatus status) {
        AssignmentStatus previousStatus = this.status;
        this.title = title;
        this.subject = subject;
        this.description = description;
        this.dueDate = dueDate;
        this.priority = priority;
        this.status = status;
        if (status == AssignmentStatus.COMPLETED && previousStatus != AssignmentStatus.COMPLETED) {
            this.completedAt = LocalDateTime.now();
        } else if (status != AssignmentStatus.COMPLETED) {
            this.completedAt = null;
        }
    }
}

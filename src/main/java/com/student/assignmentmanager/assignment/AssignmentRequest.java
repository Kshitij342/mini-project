package com.student.assignmentmanager.assignment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record AssignmentRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 150, message = "Title must be 150 characters or fewer")
        String title,
        @NotBlank(message = "Subject is required")
        @Size(max = 100, message = "Subject must be 100 characters or fewer")
        String subject,
        @Size(max = 2000, message = "Description must be 2000 characters or fewer")
        String description,
        @NotNull(message = "Due date is required")
        LocalDate dueDate,
        @NotNull(message = "Priority is required")
        AssignmentPriority priority,
        @NotNull(message = "Status is required")
        AssignmentStatus status) {
}

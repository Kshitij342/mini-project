package com.student.assignmentmanager.assignment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {
    List<Assignment> findAllByOrderByDueDateAsc();
}

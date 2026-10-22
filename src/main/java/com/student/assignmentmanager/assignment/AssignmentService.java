package com.student.assignmentmanager.assignment;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.List;

@Service
public class AssignmentService {
    private final AssignmentRepository repository;

    public AssignmentService(AssignmentRepository repository) {
        this.repository = repository;
    }

    public List<Assignment> findAll(String search, AssignmentStatus status, AssignmentPriority priority) {
        String normalizedSearch = search == null ? "" : search.trim().toLowerCase();
        return repository.findAllByOrderByDueDateAsc().stream()
                .filter(assignment -> normalizedSearch.isEmpty()
                        || assignment.getTitle().toLowerCase().contains(normalizedSearch)
                        || assignment.getSubject().toLowerCase().contains(normalizedSearch))
                .filter(assignment -> status == null || assignment.getStatus() == status)
                .filter(assignment -> priority == null || assignment.getPriority() == priority)
                .toList();
    }

    public Assignment findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found"));
    }

    public Assignment create(AssignmentRequest request) {
        return repository.save(new Assignment(request.title().trim(), request.subject().trim(),
                cleanDescription(request.description()), request.dueDate(), request.priority(), request.status()));
    }

    public Assignment update(Long id, AssignmentRequest request) {
        Assignment assignment = findById(id);
        assignment.update(request.title().trim(), request.subject().trim(),
                cleanDescription(request.description()), request.dueDate(), request.priority(), request.status());
        return repository.save(assignment);
    }

    public void delete(Long id) {
        repository.delete(findById(id));
    }

    public Assignment markCompleted(Long id) {
        Assignment assignment = findById(id);
        assignment.update(assignment.getTitle(), assignment.getSubject(), assignment.getDescription(),
                assignment.getDueDate(), assignment.getPriority(), AssignmentStatus.COMPLETED);
        return repository.save(assignment);
    }

    public DashboardStats dashboard() {
        List<Assignment> assignments = repository.findAll();
        LocalDate today = LocalDate.now();
        long completed = assignments.stream().filter(a -> a.getStatus() == AssignmentStatus.COMPLETED).count();
        long overdue = assignments.stream().filter(a -> a.getStatus() != AssignmentStatus.COMPLETED
                && a.getDueDate().isBefore(today)).count();
        return new DashboardStats(assignments.size(), assignments.size() - completed, completed, overdue);
    }

    private String cleanDescription(String description) {
        return description == null ? "" : description.trim();
    }
}

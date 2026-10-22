package com.student.assignmentmanager.assignment;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/assignments")
@CrossOrigin
public class AssignmentController {
    private final AssignmentService service;

    public AssignmentController(AssignmentService service) {
        this.service = service;
    }

    @GetMapping
    public List<Assignment> list(@RequestParam(required = false) String search,
                                 @RequestParam(required = false) AssignmentStatus status,
                                 @RequestParam(required = false) AssignmentPriority priority) {
        return service.findAll(search, status, priority);
    }

    @GetMapping("/{id}")
    public Assignment get(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Assignment create(@Valid @RequestBody AssignmentRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public Assignment update(@PathVariable Long id, @Valid @RequestBody AssignmentRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/complete")
    public Assignment complete(@PathVariable Long id) {
        return service.markCompleted(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}

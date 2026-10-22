package com.student.assignmentmanager.assignment;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin
public class DashboardController {
    private final AssignmentService service;

    public DashboardController(AssignmentService service) {
        this.service = service;
    }

    @GetMapping("/stats")
    public DashboardStats stats() {
        return service.dashboard();
    }
}

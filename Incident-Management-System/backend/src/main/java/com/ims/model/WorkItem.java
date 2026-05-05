package com.ims.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
public class WorkItem {

    @Id
    @GeneratedValue
    private Long id;

    private String componentId;
    private String status;
    private String severity;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
}
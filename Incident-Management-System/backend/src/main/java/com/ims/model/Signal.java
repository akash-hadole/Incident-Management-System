package com.ims.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;
import java.time.LocalDateTime;

@Document(collection = "signals")
@Data
public class Signal {
    @Id
    private String id;

    private String componentId;
    private String message;
    private LocalDateTime timestamp;
    private Long workItemId;
}
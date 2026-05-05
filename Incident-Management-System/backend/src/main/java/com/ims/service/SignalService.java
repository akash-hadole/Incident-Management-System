package com.ims.service;

import com.ims.model.*;
import com.ims.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.*;

@Service
@RequiredArgsConstructor
public class SignalService {

    private final SignalRepository signalRepo;
    private final WorkItemRepository workRepo;

    private final Map<String, Long> debounceMap = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newFixedThreadPool(10);

    public void processSignal(Signal signal) {
        executor.submit(() -> handle(signal));
    }

    private void handle(Signal signal) {
        signalRepo.save(signal);

        String component = signal.getComponentId();
        long now = System.currentTimeMillis();

        if (!debounceMap.containsKey(component) ||
            now - debounceMap.get(component) > 10000) {

            WorkItem work = new WorkItem();
            work.setComponentId(component);
            work.setStatus("OPEN");
            work.setSeverity(component.contains("DB") ? "P0" : "P2");
            work.setStartTime(LocalDateTime.now());

            workRepo.save(work);
            debounceMap.put(component, now);
        }
    }
}
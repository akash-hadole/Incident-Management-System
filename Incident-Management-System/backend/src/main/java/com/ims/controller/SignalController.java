package com.ims.controller;

import com.ims.model.Signal;
import com.ims.service.SignalService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/signals")
@RequiredArgsConstructor
public class SignalController {

    private final SignalService service;

    @PostMapping
    public String ingest(@RequestBody Signal signal) {
        service.processSignal(signal);
        return "Signal received";
    }
}
for (let i = 0; i < 50; i++) {
  fetch("http://localhost:8080/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      componentId: "DB_PRIMARY",
      message: "DB error",
      timestamp: new Date(),
    }),
  });
}
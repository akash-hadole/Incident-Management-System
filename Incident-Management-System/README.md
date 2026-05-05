# 🚨 Incident Management System (IMS)

## 📌 Overview
This project is an Incident Management System that collects system signals (errors, failures, latency issues) and converts them into meaningful incidents.

The goal is to:
- Handle large number of incoming signals
- Avoid duplicate incidents
- Track incidents properly from start to closure
- Ensure every incident is properly analyzed (RCA)

---

## 🏗️ Architecture (Simple Flow)

Client / Simulator  
→ Sends signals  
→ Backend API receives signals  
→ Signals are processed asynchronously  
→ Data stored in databases  
→ Incidents shown on dashboard  

---

## ⚙️ Tech Stack (with Reason)

- **Spring Boot (Backend)**  
  Used to build scalable APIs and handle multiple requests efficiently  

- **PostgreSQL (Main Database)**  
  Used for storing incidents and RCA because it ensures data consistency  

- **MongoDB (Logs Storage)**  
  Used for storing raw signals because it handles large data easily  

- **React (Frontend)**  
  Used to display incidents and allow user interaction  

---

## 🚀 Key Features

### 1. Signal Ingestion
System accepts signals continuously.

**Why?**  
To simulate real-world systems where logs/errors come frequently.

---

### 2. Debouncing (Important Feature)
If multiple signals come from same service within 10 seconds → only one incident is created.

**Why?**  
To avoid duplicate alerts and reduce noise.

---

### 3. Incident Lifecycle
OPEN → INVESTIGATING → RESOLVED → CLOSED  

**Why?**  
To track progress of each incident clearly.

---

### 4. Mandatory RCA
Incident cannot be closed without Root Cause Analysis.

**Why?**  
To ensure proper problem understanding and avoid repeated issues.

---

### 5. MTTR (Mean Time To Repair)
System calculates how long it took to resolve an incident.

**Why?**  
To measure system performance and team efficiency.

---

## 🧠 How System Handles Load

- Uses asynchronous processing (threads)
- Does not process everything in one request

**Why?**  
To prevent system crash when traffic is high.

---

## 🛡️ Safety Features

- Rate limiting to prevent overload  
- Thread-safe processing to avoid errors  

---

## 🐳 How to Run

### 1. Clone Repo
git clone https://github.com/akash-hadole/Incident-Management-System.git  
cd Incident-Management-System  

### 2. Run Project
docker-compose up --build  

### 3. Open
Backend: http://localhost:8080  
Frontend: http://localhost:3000  

---

## 🧪 Testing (Simulation)

Run:
node sample-data/simulate.js  

This will:
- Send multiple signals
- Create incidents
- Test debouncing logic  

---

## 📡 APIs

POST /signals → Send signal  
GET /work-items → Get all incidents  
GET /work-items/{id} → Get one incident  
POST /rca → Submit RCA  

---

## 📚 Design Approach

- Used simple and clean structure  
- Focused on real-world problems like duplicate alerts and system overload  

---

## 👨‍💻 Author

Akash Hadole

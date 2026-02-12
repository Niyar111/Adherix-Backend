
#  Adherix: Medication Adherence Ecosystem

**Adherix** is a high-performance, real-time backend infrastructure designed to solve the global challenge of medication non-compliance. Unlike simple reminder apps, Adherix treats adherence as a backend-enforced safety problem, utilizing automated monitoring and real-time guardian escalation.

---

##  Key Features

###  Clinical Intelligence
- **Reliability Index (RI):** A behavioral algorithm that computes patient trust scores based on dose timing accuracy.
- **Temporal Risk Analysis:** Identifies high-risk failure windows (Morning, Afternoon, Evening, Night).
- **Inventory Runway:** Predictive logistics that calculate exact medication depletion dates.

###  Live Pulse (Real-Time)
- **Bi-Directional Sync:** Powered by Socket.io for instant patient-to-guardian status updates.
- **Namespace Isolation:** Secure, private "rooms" for patient-caregiver data streaming.
- **Emergency Emitters:** Instant alerts for missed doses triggered by the background Reaper engine.

###  Production-Grade Engineering
- **Automated Reaper:** A BullMQ background worker that scans for "ghost doses" every hour.
- **PDF Report Engine:** Generates professional clinical adherence reports on-the-fly using memory streams.
- **Security Shield:** Implements Helmet.js and Rate Limiting to prevent API abuse and DDoS attacks.

---

## Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Node.js (ESM) |
| **Framework** | Express.js |
| **Database** | MongoDB Atlas (Mongoose) |
| **Real-Time** | Socket.io |
| **Task Queue** | Redis (Upstash) + BullMQ |
| **Time Engine** | Luxon (Timezone-resilient logic) |
| **Security** | Helmet.js & Express-Rate-Limit |

---

##  System Health Dashboard
The system includes a live diagnostic endpoint at `/api/admin/health` to monitor:
- **Database Connectivity**
- **Redis & Worker Heartbeat**
- **Active WebSocket Connections**
- **Security Layer Status**

---

##  Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Niyar111/Adherix-Backend.git](https://github.com/Niyar111/Adherix-Backend.git)
   cd Adherix-Backend

   Install Dependencies:

Bash
npm install
Environment Variables: Create a .env file and add:

Code snippet
PORT=5000
MONGO_URI=your_mongodb_uri
REDIS_URL=your_upstash_redis_uri
JWT_SECRET=your_secret_key
Run the Engine:

Bash
# Development mode
npm run dev

# Production mode
npm start
 Security Note
This project utilizes Firebase Admin SDK for identity management. Ensure your serviceAccountKey.json is added to .gitignore to prevent credential leakage.

 License
Distributed under the MIT License. See LICENSE for more information.

Built for the 6th Semester Backend Engineering Project.


---

### **How to Push the Documentation**
Run these commands in your VS Code terminal to update your GitHub page:

1.  `git add README.md`
2.  `git commit -m "docs: finalized technical specification for the repo"`
3.  `git push origin main`



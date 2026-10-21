DesalGuard — AI-Powered Water Infrastructure Security

Hackathon Project | Cybersecurity | Machine Learning**

🌐 Live Demo: https://flourishing-seahorse-34e19f.netlify.app/

 Project Overview

DesalGuard is a cybersecurity monitoring prototype that uses machine learning to detect unusual sensor readings in simulated desalination environments. It monitors pressure, flow rate, and salinity, displays anomaly predictions, and demonstrates a security incident-response workflow.

 Key Features

- Isolation Forest anomaly detection using Scikit-learn.
- Simulated sensor readings and attack scenarios.
- Security event timeline and incident-response demonstration.
- Public river data integration through the USGS Water Data API.
- JSON report export and browser-based fallback detection.

Technology Stack

- Frontend: HTML, CSS, JavaScript
- **Backend:** Python, FastAPI, Uvicorn
- **Machine Learning:** Scikit-learn, Isolation Forest, NumPy
- **External API:** USGS Water Data API
- **Deployment:** Netlify (frontend), Render (backend)

## APIs Used

- **DesalGuard REST API:** `/predict`, `/live-water`, `/health`
- **USGS Water Data API:** Retrieves public streamflow observations for station `USGS-01646500`.

USGS river observations are separate from the synthetic desalination telemetry and are not used to train the ML model.

## Run Locally (Windows + VS Code)

**Prerequisites:** Python 3.10+, VS Code, and the project files.

### 1. Open the project folder

Open the folder containing `app.py`, `index.html`, and `requirements.txt` in VS Code.

### 2. Install dependencies

In the VS Code terminal, run:

```
py -m venv .venv
.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
```

### 3. Start the backend

```
py -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Backend documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 4. Start the frontend

Open a **second terminal** in the project folder and run:

```
py -m http.server 5500
```

Open the dashboard at:

[**http://127.0.0.1:5500**](http://127.0.0.1:5500)

### 5. Connect to the local backend

In `script.js`, change the existing Render backend URL to:

```
http://127.0.0.1:8000
```

Ensure the `/predict` and `/live-water` requests use this local backend. Save the file and refresh the browser. FastAPI must allow the frontend origin through CORS.

Keep both terminals running while testing.

## Demo Instructions

1. Open the dashboard.
2. Click **Simulate attack scenario**.
3. Observe the anomaly prediction and security events.
4. Click **Reset demo** to restore normal simulated readings.
5. Try the incident-response panel and JSON report export.

## Limitations

DesalGuard uses synthetic sensor data and a model trained on synthetic baseline readings. The attack is simulated, not real. USGS data represents public river observations, not desalination plant telemetry. This prototype is for educational demonstration only and is not a production security or safety system.

**DesalGuard — Detect the unusual. Protect the essential.**

Add a clear project objectiveExplain the architecture and data flow

# GreenTrack

**Campus waste reporting and collection at SDGI Global University**

A paper bin outside the library fills up on Thursday, a day before its scheduled pickup. A student standing beside it can scan its label, report **Full**, and attach a photo. The admin sees which bin needs attention. The assigned collector gets a destination, checks the bin on arrival, and records the pickup. GreenTrack brings those three views of the same bin into one workflow.

![GreenTrack citizen homepage with the QR scanner shortcut](docs/citizen-home.png)

[Run the project](README.md) · [Engineering blueprint](docs/ENGINEERING_BLUEPRINT.md) · [API contract](contracts/openapi.yaml)

## Follow a bin through the app

| Workspace | What you do | What the next person gets |
| --- | --- | --- |
| **Admin · Zones & Bins** | Mark the bin on the campus map, choose its waste category, and print its QR label. | A citizen can identify that particular bin and see what belongs in it. |
| **Citizen · Check-In** | Scan the label or enter its token. Confirm a check-in to record participation. Select **Full** or **Empty** to submit a condition report, with an optional photo. | The admin can review the reported condition, submission time, and photo. |
| **Admin · Collectors & Tasks** | Review the report, select the bin, set a priority, and assign a pickup. | The task appears in the assigned collector’s queue. |
| **Collector · Assigned Tasks** | Find the nearest assigned pickup, open directions, inspect the bin, and record the outcome. | The inspection supplies an observed fill level. The collection record captures what happened to the task. |

### What does a scan actually tell us?

A token lookup identifies a bin. A confirmed check-in counts toward participation. Neither measures how full the bin is. Ten people can check in at the library bin while it is almost empty. One person can report it full after a campus event. GreenTrack keeps those signals separate so an admin can act on a condition report and use collector inspections for monthly analysis.

### How does a collector choose the next stop?

The map opens at SDGI. When the collector chooses **Find nearest assigned bin**, GreenTrack requests location access and compares road distances to outstanding assigned pickups using OSRM. The collector can then open the selected destination in Google Maps. A blocked road can be reported as an incident. Sending that report does not automatically update Google Maps routing.

## Try the demo

From the project root, run these commands in Windows PowerShell:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open the URL printed by Vite, usually [localhost:3000](http://localhost:3000). **Start as Admin** and register one zone and one bin. Copy the QR token before switching to Citizen so you can try the whole flow with one screen.

| Sign in as | Demo email |
| --- | --- |
| Admin | `admin@greentrack.org` |
| Citizen | `citizen@greentrack.org` |
| Collector | `collector@greentrack.org` |

The starter password is `password123`. Citizens can also create an account and generate a GreenTrack ID. Admins can register collectors and set their passwords. Use the same browser profile and frontend address when switching roles. The demo saves accounts, tasks, and reports on that browser, so a report entered on a phone will not appear on a separate laptop.

## Implementation at a glance

| Layer | Implementation |
| --- | --- |
| Web application | React, TypeScript, Vite, and Tailwind CSS power the three workspaces. |
| Maps, labels, and charts | Leaflet displays OpenStreetMap tiles. jsQR reads labels, qrcode generates them, and Recharts displays analytics. |
| Local operations | A TypeScript mock API and browser storage support the working demo. Inventory starts empty so you can map your own campus bins. |
| Python backend | FastAPI serves the health check. SQLAlchemy and Alembic prepare PostgreSQL with PostGIS. Shared operational API endpoints are specified in the contract and remain future backend work. |

For backend startup, database migrations, and verification commands, see the [developer setup guide](README.md).

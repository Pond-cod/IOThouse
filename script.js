// Configuration
const MQTT_BROKER = "broker.hivemq.com";
const MQTT_PORT = 8884;
const MQTT_PATH = "/mqtt";
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2rEX2JVVWgrmlh5GaUwOM-1QDgFO6etcpgWtr_ShJpkAaJHHIGAu_abJfgom_YxcCiw/exec';

// Logger Function
function logToGoogleSheets(zoneName, lightName, action) {
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
            zone: zoneName,
            light: lightName,
            action: action
        })
    }).then(() => {
        // Fetch new summary data immediately
        fetchSummaryData();
    }).catch(error => console.error('Error logging to Google Sheets:', error));
}

// Fetch Summary Data
function fetchSummaryData() {
    fetch(GOOGLE_SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            const hoursEl = document.getElementById('usage-total-hours');
            if (hoursEl) hoursEl.innerText = (data.totalHours || "0.00") + " hrs";
            const costEl = document.getElementById('usage-total-cost');
            if (costEl) costEl.innerText = "฿" + (data.totalCost || "0.00");

            // Individual Light Stats
            if (data.individual) {
                for (const [key, stats] of Object.entries(data.individual)) {
                    const statEl = document.getElementById(`stats-${key}`);
                    if (statEl) {
                        const hrs = stats.hours !== undefined ? parseFloat(stats.hours).toFixed(2) : "0.00";
                        const cost = stats.cost !== undefined ? parseFloat(stats.cost).toFixed(2) : "0.00";
                        statEl.innerText = `${hrs} hrs | ${cost} ฿`;
                    }
                }
            }
        })
        .catch(error => console.error('Error fetching summary:', error));
}

// Generate a random Client ID
const clientId = "web_" + Math.random().toString(16).substr(2, 8);

// Initialize Client
const client = new Paho.MQTT.Client(MQTT_BROKER, MQTT_PORT, MQTT_PATH, clientId);

// Setup Callbacks
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived; // Added handler for incoming MQTT messages

// Start Connection
connect();

function connect() {
    console.log(`Connecting to ${MQTT_BROKER}:${MQTT_PORT}${MQTT_PATH} as ${clientId}...`);
    const statusEl = document.getElementById("connection-status");
    if (statusEl) {
        statusEl.textContent = "Connecting…";
        statusEl.classList.remove("connected", "disconnected");
    }
    client.connect({
        onSuccess: onConnect,
        onFailure: onFailure,
        useSSL: true,
        keepAliveInterval: 30,
        timeout: 10,
        reconnect: true
    });
}

function onConnect() {
    console.log("Connected to MQTT broker!");
    const statusEl = document.getElementById("connection-status");
    if (statusEl) {
        statusEl.textContent = "Connected";
        statusEl.classList.remove("disconnected");
        statusEl.classList.add("connected");
    }

    // Subscribe to all zone/light command topics to receive retained states
    zoneConfig.forEach(zone => {
        zone.lights.forEach(light => {
            const topic = `my_private_room_99/zone${zone.id}/light${light.id}/command`;
            client.subscribe(topic);
            console.log(`Subscribed to ${topic}`);
        });
    });
}

function onFailure(responseObject) {
    console.error("Connection failed:", responseObject.errorMessage);
    const statusEl = document.getElementById("connection-status");
    if (statusEl) {
        statusEl.textContent = "Disconnected";
        statusEl.classList.remove("connected");
        statusEl.classList.add("disconnected");
    }
    // Retry after 5 seconds
    setTimeout(connect, 5000);
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.warn("Connection lost:", responseObject.errorMessage);
        const statusEl = document.getElementById("connection-status");
        statusEl.textContent = "Disconnected";
        statusEl.classList.remove("connected");
        statusEl.classList.add("disconnected");
        // Attempt reconnect after 5 seconds
        setTimeout(connect, 5000);
    }
}

// Handle incoming MQTT messages to sync UI across clients
function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    // Expected topic format: my_private_room_99/zone{zId}/light{lId}/command
    const match = topic.match(/zone(\d+)\/light(\d+)\/command/);
    if (!match) return;

    const zId = parseInt(match[1]);
    const lId = parseInt(match[2]);
    const isOn = payload === 'ON';

    const toggle = document.querySelector(`.hidden-checkbox[data-zone="${zId}"][data-light="${lId}"]`);
    const lightItem = document.getElementById(`zone${zId}-light${lId}`);
    if (toggle && lightItem) {
        toggle.checked = isOn;
        if (isOn) {
            lightItem.classList.add("active");
        } else {
            lightItem.classList.remove("active");
        }
    }

    // Persist synced state in localStorage
    const deviceKey = `device-${zId}-${lId}`;
    localStorage.setItem(deviceKey, isOn ? 'ON' : 'OFF');

    // Update counts and badges (guard for DOM readiness)
    const countEl = document.getElementById('usage-active-count');
    if (countEl) {
        const activeCount = document.querySelectorAll('.hidden-checkbox:checked').length;
        countEl.innerText = activeCount;
    }
    document.querySelectorAll('.zone-group[data-zone-id]').forEach(group => {
        const activeInZone = group.querySelectorAll('.hidden-checkbox:checked').length;
        const badge = group.querySelector('.zone-active-badge');
        if (badge) {
            if (activeInZone > 0) {
                badge.textContent = '💡 ' + activeInZone;
                badge.classList.add('visible');
                group.classList.add('has-active');
            } else {
                badge.textContent = '';
                badge.classList.remove('visible');
                group.classList.remove('has-active');
            }
        }
    });
}

// Zone Configuration
const zoneConfig = [
    { id: 1, name: "หน้าบ้าน", lights: [{ id: 1, name: "ดวงหน้าบ้าน" }, { id: 2, name: "ดวงหน้า TV" }] },
    { id: 2, name: "กลางบ้าน", lights: [{ id: 1, name: "ดวงหน้า" }, { id: 2, name: "ดวงหลัง" }] },
    { id: 3, name: "ห้องน้ำ", lights: [{ id: 1, name: "ห้องอาบ" }, { id: 2, name: "ห้องส้วม" }] },
    { id: 4, name: "ครัว", lights: [{ id: 1, name: "ครัว" }] },
    { id: 5, name: "ห้องแรก", lights: [{ id: 1, name: "ห้องแรก" }] },
    { id: 6, name: "ห้องกลาง", lights: [{ id: 1, name: "ห้องกลาง" }] }
];

// Generate UI and Set Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    // Initial fetch of summary data
    fetchSummaryData();

    // Function to calculate and update active devices count
    function updateActiveCount() {
        const activeCount = document.querySelectorAll('.hidden-checkbox:checked').length;
        const countEl = document.getElementById('usage-active-count');
        if (countEl) countEl.innerText = activeCount;
    }

    // Function to update zone badges showing active light count per zone
    function updateZoneBadges() {
        document.querySelectorAll('.zone-group[data-zone-id]').forEach(group => {
            const zoneId = group.getAttribute('data-zone-id');
            const activeInZone = group.querySelectorAll('.hidden-checkbox:checked').length;
            const badge = group.querySelector('.zone-active-badge');

            if (badge) {
                if (activeInZone > 0) {
                    badge.textContent = '💡 ' + activeInZone;
                    badge.classList.add('visible');
                    group.classList.add('has-active');
                } else {
                    badge.textContent = '';
                    badge.classList.remove('visible');
                    group.classList.remove('has-active');
                }
            }
        });
    }

    // Core logic for updating state and publishing
    function setLightState(zId, lId, isOn) {
        // Find DOM Elements by data attributes
        const toggle = document.querySelector(`.hidden-checkbox[data-zone="${zId}"][data-light="${lId}"]`);
        const lightItem = document.getElementById(`zone${zId}-light${lId}`);

        if (!toggle) return;

        // Visual change
        toggle.checked = isOn;
        if (isOn) {
            lightItem.classList.add("active");
        } else {
            lightItem.classList.remove("active");
        }

        // Persist state in localStorage
        const deviceKey = `device-${zId}-${lId}`;
        localStorage.setItem(deviceKey, isOn ? 'ON' : 'OFF');

        // MQTT Publish
        if (client.isConnected()) {
            const topic = `my_private_room_99/zone${zId}/light${lId}/command`;
            const payload = isOn ? "ON" : "OFF";
            const message = new Paho.MQTT.Message(payload);
            message.destinationName = topic;
            message.retained = true; // Ensure broker retains last state
            client.send(message);
            console.log(`Published to ${topic}: ${payload}`);
        } else {
            console.warn("MQTT Disconnected. Command not sent to broker, but logging to Sheets...");
        }

        // Log to Google Sheets
        const zone = zoneConfig.find(z => z.id === zId);
        if (zone) {
            const light = zone.lights.find(l => l.id === lId);
            if (light) {
                logToGoogleSheets(zone.name, light.name, isOn ? "ON" : "OFF");
            }
        }

        // Update Active Count
        updateActiveCount();
        updateZoneBadges();
    }

    // Restore device states from localStorage on page load
    function restoreState() {
        zoneConfig.forEach(zone => {
            zone.lights.forEach(light => {
                const deviceKey = `device-${zone.id}-${light.id}`;
                const state = localStorage.getItem(deviceKey);
                if (state === 'ON') {
                    const toggle = document.querySelector(`.hidden-checkbox[data-zone="${zone.id}"][data-light="${light.id}"]`);
                    const lightItem = document.getElementById(`zone${zone.id}-light${light.id}`);
                    if (toggle && lightItem) {
                        toggle.checked = true;
                        lightItem.classList.add("active");
                    }
                }
            });
        });
        // Update counts and badges after restoring
        updateActiveCount();
        updateZoneBadges();
    }



    // Direct Toggle Event Listeners
    const toggles = document.querySelectorAll('input[type="checkbox"]');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const zId = parseInt(e.target.getAttribute('data-zone'));
            const lId = parseInt(e.target.getAttribute('data-light'));
            const isOn = e.target.checked;
            setLightState(zId, lId, isOn);
        });
    });

    if (typeof restoreState === 'function') {
        restoreState();
    }

    // Initial fetch of active state count
    updateActiveCount();
    updateZoneBadges();

    // Zone-Level Buttons
    document.querySelectorAll('.zone-btn-on').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const zId = parseInt(e.target.getAttribute('data-zone'));
            const zone = zoneConfig.find(z => z.id === zId);
            if (zone) {
                zone.lights.forEach(l => setLightState(zId, l.id, true));
            }
        });
    });

    document.querySelectorAll('.zone-btn-off').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const zId = parseInt(e.target.getAttribute('data-zone'));
            const zone = zoneConfig.find(z => z.id === zId);
            if (zone) {
                zone.lights.forEach(l => setLightState(zId, l.id, false));
            }
        });
    });

    // Global Action Buttons
    const btnAllOn = document.getElementById('btn-all-on');
    const btnAllOff = document.getElementById('btn-all-off');

    if (btnAllOn) {
        btnAllOn.addEventListener('click', () => {
            zoneConfig.forEach(zone => {
                zone.lights.forEach(l => setLightState(zone.id, l.id, true));
            });
            logToGoogleSheets('All', 'All', 'ON');
        });
    }

    if (btnAllOff) {
        btnAllOff.addEventListener('click', () => {
            zoneConfig.forEach(zone => {
                zone.lights.forEach(l => setLightState(zone.id, l.id, false));
            });
            logToGoogleSheets('All', 'All', 'OFF');
        });
    }

    // Refresh Data Button
    const refreshBtn = document.getElementById('refresh-usage-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchSummaryData();
        });
    }


});

/**
 * Toggle a zone's collapsible content open/closed
 */
function toggleZone(headerElement) {
    headerElement.classList.toggle('open');
    const collapse = headerElement.nextElementSibling;

    if (collapse.classList.contains('open')) {
        // Close
        collapse.style.maxHeight = null;
        collapse.classList.remove('open');
    } else {
        // Open
        collapse.style.maxHeight = collapse.scrollHeight + 'px';
        collapse.classList.add('open');
    }
}

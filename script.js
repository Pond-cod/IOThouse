// Configuration
const MQTT_BROKER = "broker.hivemq.com";
const MQTT_PORT = 8884;
const MQTT_PATH = "/mqtt";
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzjMYHS9q7Qh1HC58IK8T8Rb33Q178Q81PUk2a5TkL6aR085EbYSkGnwkJ8jAQ9t9zkkA/exec';

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

// Start Connection
connect();

function connect() {
    console.log(`Connecting to ${MQTT_BROKER}:${MQTT_PORT}${MQTT_PATH} as ${clientId}...`);
    client.connect({
        onSuccess: onConnect,
        onFailure: onFailure,
        useSSL: true
    });
}

function onConnect() {
    console.log("Connected to MQTT broker!");
    const statusEl = document.getElementById("connection-status");
    statusEl.textContent = "Connected";
    statusEl.classList.remove("disconnected");
    statusEl.classList.add("connected");
}

function onFailure(responseObject) {
    console.error("Connection failed:", responseObject.errorMessage);
    const statusEl = document.getElementById("connection-status");
    statusEl.textContent = "Connection Failed";
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

// Zone Configuration
const zoneConfig = [
    { id: 1, name: "Front Zone", lights: [{ id: 1, name: "Front 1" }, { id: 2, name: "Front 2" }] },
    { id: 2, name: "Living Room", lights: [{ id: 1, name: "Living Room 1" }, { id: 2, name: "Living Room 2" }] },
    { id: 3, name: "Bathroom", lights: [{ id: 1, name: "Bathroom 1" }] }
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

    // Core logic for updating state and publishing
    function setLightState(zId, lId, isOn) {
        // Find DOM Elements
        const toggle = document.getElementById(`toggle-z${zId}-l${lId}`);
        const lightItem = document.getElementById(`zone${zId}-light${lId}`);

        if (!toggle || !lightItem) return;

        // Visual change
        toggle.checked = isOn;
        if (isOn) {
            lightItem.classList.add("active");
        } else {
            lightItem.classList.remove("active");
        }

        // MQTT Publish
        if (client.isConnected()) {
            const topic = `my_private_room_99/zone${zId}/light${lId}/command`;
            const payload = isOn ? "ON" : "OFF";
            const message = new Paho.MQTT.Message(payload);
            message.destinationName = topic;
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
 * Toggles the Accordion Header to drop down the grid tiles cleanly
 * Calculates the exact scrollHeight to transition max-height seamlessly
 */
function toggleAccordion(headerElement) {
    headerElement.classList.toggle('active');
    
    // Find the adjacent .accordion-content wrapper
    const content = headerElement.nextElementSibling;
    
    if (content.style.maxHeight) {
        // Close it
        content.style.maxHeight = null;
        content.style.opacity = 0;
    } else {
        // Open it (calculate intrinsic pixel height for CSS transition)
        content.style.maxHeight = content.scrollHeight + "px";
        content.style.opacity = 1;
    }
}
